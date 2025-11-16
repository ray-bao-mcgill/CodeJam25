from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import json
import asyncio
import os
from datetime import datetime
from typing import Dict, Set
from sqlalchemy.orm import Session
from lobby.manager import lobby_manager
from database.game_state import (
    record_answer,
    update_player_submission_status,
    update_phase,
    update_timer_state,
    get_match_by_lobby_id,
    calculate_and_store_scores,
    get_scores_for_phase,
    get_player_answers_for_phase,
    store_question,
    get_question_from_game_state
)
from database import SessionLocal, OngoingMatch
from game.phase_manager import phase_manager
from game.scoring import calculate_phase_scores
from game.question_manager import question_manager
from app.llm.openai import OpenAIClient
from app.llm.followup_generator import FollowUpQuestionGenerator
from app.llm.judge import BehaviouralJudge

# Initialize LLM client and generators
llm_client = OpenAIClient(api_key=os.environ.get("OPENAI_API_KEY"))
followup_generator = FollowUpQuestionGenerator(llm_client)
behavioural_judge = BehaviouralJudge(llm_client)

router = APIRouter()

COUNTDOWN_SECONDS = 5  # For round start counter

# Track ready players per lobby and phase (for scores display)
# Structure: {lobby_id: {phase: set(player_ids)}}
ready_players_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Track players ready to continue to next phase (from score screen)
# Structure: {lobby_id: {phase: set(player_ids)}}
ready_to_continue_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Track players who completed round start countdown
# Structure: {lobby_id: {round_type: set(player_ids)}}
round_start_completed_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Lock for question requests to prevent race conditions
# Structure: {match_id: {phase: {question_index: asyncio.Lock}}}
question_request_locks: Dict[str, Dict[str, Dict[int, asyncio.Lock]]] = {}


class JoinLobbyRequest(BaseModel):
    lobby_id: str
    player_name: str


class LeaveLobbyRequest(BaseModel):
    player_id: str = None
    player_name: str = None


class TransferOwnershipRequest(BaseModel):
    new_owner_id: str
    current_owner_id: str


class KickPlayerRequest(BaseModel):
    player_id: str
    owner_id: str


class StartGameRequest(BaseModel):
    player_id: str
    match_type: str = None  # "job_posting" or "generalized"
    job_description: str = None
    role: str = None
    level: str = None
    match_config: dict = None


# Root route removed - frontend is served at / by main.py
# @router.get("/")
# async def root():
#     return {"message": "Hello World from FastAPI"}


@router.post("/api/lobby/create")
async def create_lobby():
    """Create a new lobby"""
    lobby_id = lobby_manager.create_lobby()
    # Verify lobby was created and still exists
    lobby = lobby_manager.get_lobby(lobby_id)
    if not lobby:
        print(f"ERROR: Lobby {lobby_id} was created but immediately disappeared!")
        return {"lobby_id": None, "message": "Failed to create lobby", "error": True}
    print(f"Verified lobby creation: {lobby_id}, players: {len(lobby.players)}, connections: {len(lobby.connections)}")
    print(f"All lobbies after create: {list(lobby_manager.lobbies.keys())}")
    return {"lobby_id": lobby_id, "message": "Lobby created"}


@router.post("/api/lobby/join")
async def join_lobby(request: JoinLobbyRequest):
    """Join a lobby via HTTP. Case-insensitive lobby ID matching."""
    lobby_id = request.lobby_id.strip()
    player_name = request.player_name.strip()
    print(f"Join request: lobby_id='{lobby_id}', player_name='{player_name}'")
    print(f"Current lobbies before join: {list(lobby_manager.lobbies.keys())}")
    print(f"Lobby manager has {len(lobby_manager.lobbies)} lobbies")
    
    # Find the actual lobby ID (case-correct) for case-insensitive lookup
    actual_lobby_id = None
    lobby_id_lower = lobby_id.lower()
    for key in lobby_manager.lobbies.keys():
        if key.lower() == lobby_id_lower:
            actual_lobby_id = key
            break
    
    if not actual_lobby_id:
        print(f"ERROR: Lobby '{lobby_id}' does not exist!")
        print(f"Available lobby IDs: {list(lobby_manager.lobbies.keys())}")
        print(f"Requested ID (stripped): '{lobby_id}'")
        # Try to find similar IDs
        similar = [lid for lid in lobby_manager.lobbies.keys() if lobby_id.lower() in lid.lower() or lid.lower() in lobby_id.lower()]
        if similar:
            print(f"Similar lobby IDs found: {similar}")
        return {"success": False, "message": f"Lobby not found. Available lobbies: {list(lobby_manager.lobbies.keys())}"}
    
    # Use the actual lobby ID (correct case) for all operations
    lobby_id = actual_lobby_id
    print(f"Found lobby {lobby_id} (matched from '{request.lobby_id.strip()}'), current players: {len(lobby_manager.lobbies[lobby_id].players)}")
    success, message, player_id = lobby_manager.join_lobby(lobby_id, player_name)
    
    if success:
        lobby = lobby_manager.get_lobby(lobby_id)
        if not lobby:
            print(f"ERROR: Lobby {lobby_id} disappeared after join!")
            return {"success": False, "message": "Lobby disappeared after join attempt"}
        print(f"Successfully joined lobby {lobby_id}, now has {len(lobby.players)} players")
        # Give a tiny moment for WebSocket connections to be ready, then broadcast
        await asyncio.sleep(0.1)
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message, "player_id": player_id, "lobby": lobby.to_dict()}
    
    print(f"Failed to join: {message}")
    return {"success": False, "message": message}


@router.post("/api/lobby/{lobby_id}/start")
async def start_game(lobby_id: str, request: StartGameRequest):
    """Start the game - requires owner player_id"""
    success, message = lobby_manager.start_game(
        lobby_id, 
        request.player_id,
        match_type=request.match_type,
        job_description=request.job_description,
        role=request.role,
        level=request.level,
        match_config=request.match_config
    )
    if success:
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message}
    return {"success": False, "message": message}


@router.post("/api/lobby/{lobby_id}/transfer-ownership")
async def transfer_ownership(lobby_id: str, request: TransferOwnershipRequest):
    """Transfer ownership to another player"""
    success, message = lobby_manager.transfer_ownership(
        lobby_id, 
        request.new_owner_id, 
        request.current_owner_id
    )
    if success:
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": message}
    return {"success": False, "message": message}


@router.post("/api/lobby/{lobby_id}/kick")
async def kick_player(lobby_id: str, request: KickPlayerRequest):
    """Kick a player from the lobby (owner only)"""
    lobby = lobby_manager.get_lobby(lobby_id)
    if not lobby:
        return {"success": False, "message": "Lobby not found"}
    
    # Verify requester is the owner
    if lobby.owner_id != request.owner_id:
        return {"success": False, "message": "Only the lobby owner can kick players"}
    
    # Don't allow kicking the owner
    if request.player_id == lobby.owner_id:
        return {"success": False, "message": "Cannot kick the lobby owner"}
    
    # Remove the player
    success = lobby.remove_player(player_id=request.player_id)
    if success:
        # Send kicked message to the kicked player's WebSocket BEFORE removing player from lobby
        # This ensures the message is sent while the connection is still active
        kicked_player_id = request.player_id
        connections = lobby.connections.copy()
        print(f"Sending kicked message to {len(connections)} connections for player {kicked_player_id}")
        for ws in connections:
            try:
                # Send kicked message to all connections - frontend will check if it's for them
                await ws.send_json({
                    "type": "kicked",
                    "player_id": kicked_player_id
                })
                print(f"✓ Sent kicked message to WebSocket")
            except Exception as e:
                print(f"✗ Error sending kicked message: {e}")
        
        # Now remove the player from lobby and clean up
        lobby_manager.leave_lobby(lobby_id, player_id=request.player_id)
        await lobby_manager.broadcast_lobby_update(lobby_id)
        return {"success": True, "message": "Player kicked successfully"}
    return {"success": False, "message": "Player not found"}


@router.post("/api/lobby/{lobby_id}/leave")
async def leave_lobby(lobby_id: str, request: LeaveLobbyRequest):
    """Leave a lobby"""
    print(f"Leave request: lobby_id='{lobby_id}', player_id='{request.player_id}', player_name='{request.player_name}'")
    
    # Get lobby before leaving to check if it exists
    lobby = lobby_manager.get_lobby(lobby_id)
    if not lobby:
        return {"success": False, "message": "Lobby not found"}
    
    lobby_manager.leave_lobby(lobby_id, player_id=request.player_id, player_name=request.player_name)
    
    # Broadcast update to remaining players
    await lobby_manager.broadcast_lobby_update(lobby_id)
    
    return {"success": True, "message": "Left lobby"}


@router.get("/api/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    """Get lobby information"""
    lobby = lobby_manager.get_lobby(lobby_id)
    if lobby:
        return {"success": True, "lobby": lobby.to_dict()}
    return {"success": False, "message": "Lobby not found"}


@router.get("/api/lobby/{lobby_id}/question")
async def get_question(lobby_id: str, phase: str, question_index: int, player_id: str = None):
    """Get a question from the match record for a specific phase and question index"""
    db: Session = SessionLocal()
    try:
        # Get match by lobby_id
        match_record = get_match_by_lobby_id(lobby_id)
        if not match_record:
            print(f"[API_QUESTION] Match not found for lobby_id: {lobby_id}")
            return {"success": False, "message": "Match not found"}
        
        # Print match information
        print(f"[API_QUESTION] ===== MATCH INFORMATION =====")
        print(f"[API_QUESTION] Match ID: {match_record.match_id}")
        print(f"[API_QUESTION] Lobby ID: {match_record.lobby_id}")
        print(f"[API_QUESTION] Match Type: {match_record.match_type}")
        print(f"[API_QUESTION] Match Config: {match_record.match_config}")
        print(f"[API_QUESTION] Created At: {match_record.created_at}")
        print(f"[API_QUESTION] Started At: {match_record.started_at}")
        
        game_state = match_record.game_state or {}
        print(f"[API_QUESTION] Game State Type: {type(game_state)}")
        print(f"[API_QUESTION] Game State Keys: {list(game_state.keys()) if isinstance(game_state, dict) else 'Not a dict'}")
        
        questions_cache = game_state.get("questions", {})
        print(f"[API_QUESTION] Questions Cache Type: {type(questions_cache)}")
        print(f"[API_QUESTION] Questions Cache Keys: {list(questions_cache.keys())}")
        print(f"[API_QUESTION] Total Questions in Cache: {len(questions_cache)}")
        
        # Print all question keys and their basic info
        for key, value in questions_cache.items():
            if isinstance(value, dict):
                print(f"[API_QUESTION]   - Key: '{key}' -> Question: '{value.get('question', 'N/A')[:50]}...', Phase: {value.get('phase')}, Index: {value.get('question_index')}, Player: {value.get('player_id')}")
            else:
                print(f"[API_QUESTION]   - Key: '{key}' -> Value Type: {type(value)}")
        
        # For Q1 (follow-up), use player-specific key
        if phase == "behavioural" and question_index == 1 and player_id:
            question_key = f"{phase}_{question_index}_{player_id}"
        else:
            question_key = f"{phase}_{question_index}"
        
        print(f"[API_QUESTION] Request Parameters:")
        print(f"[API_QUESTION]   - Phase: {phase}")
        print(f"[API_QUESTION]   - Question Index: {question_index}")
        print(f"[API_QUESTION]   - Player ID: {player_id}")
        print(f"[API_QUESTION]   - Looking for key: '{question_key}'")
        
        question_data = questions_cache.get(question_key)
        
        if not question_data:
            print(f"[API_QUESTION] ✗ Question not found with key '{question_key}'")
            print(f"[API_QUESTION] Available keys that might match:")
            # Try to find similar keys
            for key in questions_cache.keys():
                if phase in key and str(question_index) in key:
                    print(f"[API_QUESTION]   - Similar key found: '{key}'")
            return {"success": False, "message": "Question not found"}
        
        print(f"[API_QUESTION] ✓ Question found!")
        print(f"[API_QUESTION] Question Data: {question_data}")
        print(f"[API_QUESTION] =================================")
        
        return {
            "success": True,
            "question": question_data.get("question"),
            "question_id": question_data.get("question_id"),
            "phase": phase,
            "question_index": question_index,
            "role": question_data.get("role"),
            "level": question_data.get("level"),
            "player_id": question_data.get("player_id")  # For personalized questions
        }
    except Exception as e:
        print(f"[API_QUESTION] Error fetching question: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": str(e)}
    finally:
        db.close()


async def safe_send_json(websocket: WebSocket, message: dict):
    """Safely send JSON message to WebSocket, handling closed connections gracefully"""
    try:
        await websocket.send_json(message)
    except RuntimeError as e:
        if "close message has been sent" in str(e):
            print(f"[WS] Cannot send message - WebSocket already closed: {message.get('type', 'unknown')}")
        else:
            raise
    except Exception as e:
        print(f"[WS] Error sending message: {e}")
        raise


@router.websocket("/ws/lobby/{lobby_id}")
async def websocket_lobby(websocket: WebSocket, lobby_id: str):
    """WebSocket endpoint for real-time lobby updates. Case-insensitive lobby ID matching."""
    await websocket.accept()
    
    # Find the actual lobby ID (case-correct) for case-insensitive lookup
    lobby_id_stripped = lobby_id.strip()
    actual_lobby_id = None
    lobby_id_lower = lobby_id_stripped.lower()
    for key in lobby_manager.lobbies.keys():
        if key.lower() == lobby_id_lower:
            actual_lobby_id = key
            break
    
    if not actual_lobby_id:
        print(f"WebSocket: Lobby '{lobby_id_stripped}' not found. Available: {list(lobby_manager.lobbies.keys())}")
        await websocket.close(code=1008, reason="Lobby not found")
        return
    
    lobby_id = actual_lobby_id
    print(f"WebSocket accepted for lobby {lobby_id} (matched from '{lobby_id_stripped}')")
    
    # Add connection to manager
    lobby_manager.add_connection(lobby_id, websocket)
    
    try:
        # Send current lobby state immediately
        lobby = lobby_manager.get_lobby(lobby_id)
        if lobby:
            await safe_send_json(websocket, {
                "type": "lobby_update",
                "lobby": lobby.to_dict()
            })
            print(f"Sent initial lobby state to WebSocket")
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Log all incoming messages for debugging
                msg_type = message.get("type")
                if msg_type == "request_question" or msg_type == "ping" or msg_type == "submit_answer":
                    print(f"[WS_MSG] Received message type: {msg_type}, full message: {message}")

                if message.get("type") == "ping":
                    await safe_send_json(websocket, {"type": "pong"})
                elif message.get("type") == "submit_answer":
                    # Player submitted an answer - track and check phase completion
                    player_id = message.get("player_id")
                    question_id = message.get("questionId")
                    answer_text = message.get("answer", "")
                    phase = message.get("phase", "unknown")
                    question_index = message.get("question_index")
                    
                    print(f"[SUBMIT] Player {player_id} submitted answer in lobby {lobby_id} (question: {question_id}, phase: {phase}, index: {question_index})")
                    
                    # Get lobby and match
                    lobby = lobby_manager.get_lobby(lobby_id)
                    match_id = None
                    if lobby:
                        print(f"[SUBMIT] Lobby {lobby_id} has {len(lobby.connections)} WebSocket connections")
                        
                        # Get match_id from lobby's match
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            # Try to find match by lobby_id in database
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        # Update database with answer
                        if match_id:
                            # Record the answer
                            record_answer(
                                match_id=match_id,
                                player_id=player_id,
                                question_id=question_id or f"q_{phase}_{question_index}_{player_id}",
                                answer=answer_text,
                                phase=phase,
                                question_index=question_index
                            )
                            
                            # Update submission status
                            update_player_submission_status(
                                match_id=match_id,
                                player_id=player_id,
                                question_id=question_id or f"q_{phase}_{question_index}_{player_id}",
                                submitted=True
                            )
                            
                            # Record submission in phase manager
                            phase_manager.record_submission(match_id, phase, player_id, question_index)
                            
                            total_players = len(lobby.players)
                            phase_state = phase_manager.get_phase_state(match_id, phase)
                            
                            print(f"[SUBMIT] After recording submission - Phase: {phase}, Question index: {question_index}, Player: {player_id}")
                            print(f"[SUBMIT] Phase state player_submissions: {phase_state.player_submissions}")
                            print(f"[SUBMIT] Phase state question_submissions: {phase_state.question_submissions}")
                            
                            # For quickfire: players work independently, only check completion when all 10 questions are done
                            if phase == "quickfire":
                                player_submissions = phase_state.player_submissions.get(player_id, set())
                                finished_all = len(player_submissions) >= 10
                                print(f"[QUICKFIRE] Player {player_id} has submitted {len(player_submissions)}/10 questions. Finished all: {finished_all}")
                                
                                if finished_all:
                                    # Player finished all questions - broadcast to show waiting status
                                    finished_players = [p for p in phase_state.player_submissions.keys() if len(phase_state.player_submissions.get(p, set())) >= 10]
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "player_finished_quickfire",
                                            "player_id": player_id,
                                            "total_finished": len(finished_players),
                                            "total_players": total_players
                                        }
                                    )
                                    
                                    # Check if all players finished
                                    if len(finished_players) >= total_players:
                                        print(f"[QUICKFIRE] All players finished! Phase complete.")
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "show_results",
                                                "phase": "quickfire",
                                                "reason": "phase_complete",
                                                "phaseComplete": True,
                                                "forceShow": True
                                            }
                                        )
                            
                            # For behavioural phase: check completion BEFORE general phase check
                            # This ensures we handle Q0->Q1 transition correctly
                            if phase == "behavioural":
                                # Check if question 0 is complete (all players submitted first question)
                                question_0_submissions = phase_state.question_submissions.get(0, set())
                                question_0_complete = len(question_0_submissions) >= total_players
                                
                                # Check if question 1 is complete
                                question_1_submissions = phase_state.question_submissions.get(1, set())
                                question_1_complete = len(question_1_submissions) >= total_players
                                
                                print(f"[SUBMIT] Behavioural status - Q0: {len(question_0_submissions)}/{total_players}, Q1: {len(question_1_submissions)}/{total_players}")
                                print(f"[SUBMIT] Question index: {question_index}, Q0 complete: {question_0_complete}, Q1 complete: {question_1_complete}")
                                
                                # Check phase completion AFTER checking individual questions
                                phase_complete = phase_manager.check_phase_complete(match_id, phase, total_players)
                                print(f"[SUBMIT] Phase completion check result: {phase_complete}")
                                
                                # If Q0 is complete but Q1 is not, advance to Q1
                                if question_0_complete and not question_1_complete:
                                    # Question 0 complete but question 1 not complete - signal to advance to question 1
                                    print(f"[SUBMIT] ✓ Behavioural question 0 complete ({len(question_0_submissions)}/{total_players} players), advancing to question 1")
                                    print(f"[SUBMIT] Broadcasting show_results with phaseComplete=False to trigger navigation to behavioural-answer")
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "show_results",
                                            "phase": phase,
                                            "reason": "question_0_complete",
                                            "phaseComplete": False,
                                            "forceShow": True
                                        }
                                    )
                                    print(f"[SUBMIT] ✓ Broadcast complete for question 0 completion")
                                elif phase_complete:
                                    # Both questions complete - phase is done
                                    print(f"[SUBMIT] ✓ Behavioural phase COMPLETE! All questions answered ({len(question_0_submissions)}/{total_players} Q0, {len(question_1_submissions)}/{total_players} Q1)")
                                    print(f"[SUBMIT] Broadcasting show_results with phaseComplete=True to trigger navigation to current-score")
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "show_results",
                                            "phase": phase,
                                            "reason": "phase_complete",
                                            "phaseComplete": True,
                                            "forceShow": True
                                        }
                                    )
                                    print(f"[SUBMIT] ✓ Broadcast complete for phase completion")
                                else:
                                    print(f"[SUBMIT] ✗ Behavioural phase not ready - Q0: {question_0_complete}, Q1: {question_1_complete}, Phase: {phase_complete}")
                            elif phase in ["technical_theory"]:
                                # Theory complete - signal to advance to practical (not phase complete yet)
                                # For technical sub-phases, check parent phase completion
                                check_phase = "technical"
                                phase_complete = phase_manager.check_phase_complete(match_id, check_phase, total_players)
                                print(f"[SUBMIT] Phase {check_phase} completion status: {phase_complete} ({len(phase_state.player_submissions)}/{total_players} players)")
                                
                                sub_phase_complete = phase_manager.check_phase_complete(match_id, phase, total_players)
                                if sub_phase_complete:
                                    print(f"[SUBMIT] Technical theory complete, advancing to practical")
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "show_results",
                                            "phase": phase,
                                            "reason": "sub_phase_complete",
                                            "phaseComplete": False,
                                            "forceShow": True
                                        }
                                    )
                            elif phase == "technical_practical":
                                # Technical practical is standalone (technical_theory is quickfire, handled separately)
                                # Check if practical phase is complete (both players submitted)
                                phase_complete = phase_manager.check_phase_complete(match_id, phase, total_players)
                                
                                print(f"[SUBMIT] Technical practical completion status: {phase_complete} ({len(phase_state.player_submissions)}/{total_players} players)")
                                
                                if phase_complete:
                                    print(f"[SUBMIT] Technical practical COMPLETE! All players submitted. Broadcasting show_results")
                                    # Phase is complete - broadcast show_results
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "show_results",
                                            "phase": phase,
                                            "reason": "phase_complete",
                                            "phaseComplete": True,
                                            "forceShow": True
                                        }
                                    )
                            else:
                                # For other phases, check phase completion
                                check_phase = phase
                                if phase in ["technical_theory"]:
                                    # Check parent "technical" phase completion (but technical_theory is quickfire, so this shouldn't happen)
                                    check_phase = "technical"
                                
                                # Check if phase completion criteria are met
                                phase_complete = phase_manager.check_phase_complete(match_id, check_phase, total_players)
                                
                                print(f"[SUBMIT] Phase {check_phase} completion status: {phase_complete} ({len(phase_state.player_submissions)}/{total_players} players)")
                                
                                if phase_complete:
                                    print(f"[SUBMIT] Phase {check_phase} COMPLETE! All criteria met. Broadcasting show_results")
                                    # Phase is complete - broadcast show_results
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "show_results",
                                            "phase": check_phase,
                                            "reason": "phase_complete",
                                            "phaseComplete": True,
                                            "forceShow": True
                                        }
                                    )
                            
                            print(f"[SUBMIT] Updated database for match {match_id}")
                    
                    # Broadcast player_submitted message to all connections in lobby
                    # This is CRITICAL - all players need to see when someone submits
                    await lobby_manager.broadcast_game_message(
                        lobby_id,
                        {
                            "type": "player_submitted",
                            "player_id": player_id,
                            "questionId": question_id,
                            "phase": phase,
                            "question_index": question_index
                        }
                    )
                    print(f"[SUBMIT] Broadcast player_submitted to all players for player {player_id}")
                elif message.get("type") == "quickfire_finished":
                    # Player finished all quickfire questions - track and check completion
                    player_id = message.get("player_id")
                    print(f"[QUICKFIRE] Player {player_id} finished all quickfire questions in lobby {lobby_id}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id:
                            # Record that player finished all questions (if not already recorded)
                            # This is a backup in case submit_answer didn't catch it
                            phase_state = phase_manager.get_phase_state(match_id, "quickfire")
                            player_submissions = phase_state.player_submissions.get(player_id, set())
                            
                            # If player hasn't submitted all 10 yet, this message might be premature
                            # But we'll still check if all players are done
                            total_players = len(lobby.players)
                            finished_players = [p for p in phase_state.player_submissions.keys() if len(phase_state.player_submissions.get(p, set())) >= 10]
                            
                            print(f"[QUICKFIRE] Finished players: {len(finished_players)}/{total_players}")
                            
                            # Broadcast player finished status
                            await lobby_manager.broadcast_game_message(
                                lobby_id,
                                {
                                    "type": "player_finished_quickfire",
                                    "player_id": player_id,
                                    "total_finished": len(finished_players),
                                    "total_players": total_players
                                }
                            )
                            
                            # Check if all players finished
                            if len(finished_players) >= total_players:
                                print(f"[QUICKFIRE] All players finished! Phase complete.")
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "show_results",
                                        "phase": "quickfire",
                                        "reason": "phase_complete",
                                        "phaseComplete": True,
                                        "forceShow": True
                                    }
                                )
                elif message.get("type") == "timer_expired":
                    # Timer expired for a player - check if all timers expired
                    player_id = message.get("player_id")
                    question_id = message.get("questionId")
                    phase = message.get("phase", "unknown")
                    print(f"Timer expired for player {player_id} in lobby {lobby_id} (question: {question_id}, phase: {phase})")
                    
                    # Update database
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id and question_id:
                            update_timer_state(
                                match_id=match_id,
                                question_id=question_id,
                                time_remaining=0,
                                timer_started_at=None
                            )
                            # Also record submission in phase manager for timer expiry
                            phase_manager.record_submission(match_id, phase, player_id, None)
                            
                            total_players = len(lobby.players)
                            check_phase = phase
                            if phase in ["technical_theory", "technical_practical"]:
                                check_phase = "technical"
                            
                            phase_complete = phase_manager.check_phase_complete(match_id, check_phase, total_players)
                            
                            if phase_complete:
                                print(f"[TIMER] Phase {check_phase} COMPLETE due to timer expiry. Broadcasting show_results")
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "show_results",
                                        "phase": check_phase,
                                        "reason": "timer_expired",
                                        "phaseComplete": True,
                                        "forceShow": True
                                    }
                                )
                            else:
                                # If phase not complete, but timer expired for one player, still show results for that question
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "show_results",
                                        "phase": phase,
                                        "reason": "timer_expired_single_player",
                                        "phaseComplete": False,
                                        "forceShow": True
                                    }
                                )
                elif message.get("type") == "ready_for_scores":
                    # Player is ready to see scores - track and check if all ready
                    player_id = message.get("player_id")
                    phase = message.get("phase", "unknown")
                    print(f"[SCORES] Player {player_id} ready for scores in lobby {lobby_id} (phase: {phase})")
                    
                    # Initialize tracking for this lobby/phase if needed
                    if lobby_id not in ready_players_tracker:
                        ready_players_tracker[lobby_id] = {}
                    if phase not in ready_players_tracker[lobby_id]:
                        ready_players_tracker[lobby_id][phase] = set()
                    
                    # Add player to ready set
                    ready_players_tracker[lobby_id][phase].add(player_id)
                    
                    # Update phase in database
                    lobby = lobby_manager.get_lobby(lobby_id)
                    match_id = None
                    if lobby:
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id:
                            update_phase(match_id, phase)
                        
                        # Check if all players are ready
                        total_players = len(lobby.players)
                        ready_count = len(ready_players_tracker[lobby_id][phase])
                        
                        print(f"[SCORES] {ready_count}/{total_players} players ready for {phase}")
                        
                        # Broadcast player_ready_for_scores message to all connections
                        await lobby_manager.broadcast_game_message(
                            lobby_id,
                            {
                                "type": "player_ready_for_scores",
                                "player_id": player_id,
                                "ready_count": ready_count,
                                "total_players": total_players
                            }
                        )
                        
                        # If all players are ready, calculate and broadcast scores
                        if ready_count >= total_players and match_id:
                            print(f"[SCORES] All players ready! Calculating scores for {phase}")
                            
                            # Get player IDs
                            player_ids = [p["id"] for p in lobby.players]
                            
                            # Check if scores for this phase already exist (prevent double calculation)
                            phase_scores_key = f"{phase}_scores"
                            db_session: Session = SessionLocal()
                            try:
                                match_record = db_session.query(OngoingMatch).filter(
                                    OngoingMatch.match_id == match_id
                                ).first()
                                
                                if match_record and match_record.game_state:
                                    game_state = match_record.game_state
                                    if isinstance(game_state, dict) and phase_scores_key in game_state:
                                        # Scores already calculated for this phase, use existing cumulative scores
                                        scores = game_state.get("scores", {})
                                        print(f"[SCORES] Using existing cumulative scores for {phase}: {scores}")
                                    else:
                                        # Calculate new scores (this uses database locking to prevent race conditions)
                                        print(f"[SCORES] Calculating new scores for {phase}")
                                        
                                        # For behavioural phase, use LLM-based scoring
                                        if phase == "behavioural_score" or phase == "behavioural":
                                            print(f"[SCORES] Using LLM judge for behavioural scoring")
                                            from game.behavioural_scoring import score_behavioural_answers
                                            
                                            # Score each player using LLM judge
                                            phase_scores = {}
                                            for pid in player_ids:
                                                try:
                                                    llm_score = await score_behavioural_answers(
                                                        match_id=match_id,
                                                        player_id=pid,
                                                        judge=behavioural_judge
                                                    )
                                                    phase_scores[pid] = llm_score
                                                except Exception as e:
                                                    print(f"[SCORES] Error scoring player {pid} with LLM: {e}")
                                                    import traceback
                                                    traceback.print_exc()
                                                    phase_scores[pid] = 0
                                            
                                            # Get existing scores and add LLM scores
                                            existing_scores = game_state.get("scores", {}) if isinstance(game_state, dict) else {}
                                            scores = {}
                                            for pid in player_ids:
                                                base_score = existing_scores.get(pid, 0)
                                                phase_score = phase_scores.get(pid, 0)
                                                scores[pid] = base_score + phase_score
                                            
                                            # Store scores in database
                                            import copy
                                            current_state = match_record.game_state or {}
                                            if not isinstance(current_state, dict):
                                                current_state = {}
                                            
                                            current_state["scores"] = scores.copy()
                                            current_state[f"{phase}_scores"] = phase_scores.copy()
                                            current_state["scores_updated_at"] = datetime.utcnow().isoformat()
                                            
                                            match_record.game_state = copy.deepcopy(current_state)
                                            from sqlalchemy.orm.attributes import flag_modified
                                            flag_modified(match_record, "game_state")
                                            db_session.commit()
                                            
                                            print(f"[SCORES] LLM scores calculated and stored: {scores}")
                                        else:
                                            # Use standard scoring for other phases
                                            scores = calculate_and_store_scores(match_id, phase, player_ids)
                                else:
                                    # No game state yet, calculate scores
                                    print(f"[SCORES] No game state found, calculating new scores for {phase}")
                                    scores = calculate_and_store_scores(match_id, phase, player_ids)
                            finally:
                                db_session.close()
                            
                            # Ensure all players have scores (even if 0)
                            final_scores = {}
                            for pid in player_ids:
                                final_scores[pid] = scores.get(pid, 0)
                            
                            # Broadcast scores to ALL players simultaneously
                            await lobby_manager.broadcast_game_message(
                                lobby_id,
                                {
                                    "type": "scores_ready",
                                    "phase": phase,
                                    "scores": final_scores,
                                    "serverTime": datetime.utcnow().timestamp() * 1000
                                }
                            )
                            print(f"[SCORES] Broadcast cumulative scores to all players: {final_scores}")
                elif message.get("type") == "ready_to_continue":
                    # Player clicked continue button - track and check if all ready
                    player_id = message.get("player_id")
                    phase = message.get("phase", "unknown")
                    print(f"[CONTINUE] Player {player_id} ready to continue in lobby {lobby_id} (phase: {phase})")
                    
                    # Initialize tracking for this lobby/phase if needed
                    if lobby_id not in ready_to_continue_tracker:
                        ready_to_continue_tracker[lobby_id] = {}
                    if phase not in ready_to_continue_tracker[lobby_id]:
                        ready_to_continue_tracker[lobby_id][phase] = set()
                    
                    # Add player to ready set
                    ready_to_continue_tracker[lobby_id][phase].add(player_id)
                    
                    # Get lobby and check if all players are ready
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        total_players = len(lobby.players)
                        ready_count = len(ready_to_continue_tracker[lobby_id][phase])
                        
                        print(f"[CONTINUE] {ready_count}/{total_players} players ready to continue from {phase}")
                        
                        # Broadcast player_ready_to_continue message to all connections
                        await lobby_manager.broadcast_game_message(
                            lobby_id,
                            {
                                "type": "player_ready_to_continue",
                                "player_id": player_id,
                                "ready_count": ready_count,
                                "total_players": total_players,
                                "phase": phase
                            }
                        )
                        
                        # If all players are ready, broadcast all_ready_to_continue
                        if ready_count >= total_players:
                            print(f"[CONTINUE] All players ready to continue from {phase}!")
                            await lobby_manager.broadcast_game_message(
                                lobby_id,
                                {
                                    "type": "all_ready_to_continue",
                                    "phase": phase
                                }
                            )
                            # Clear the tracker for this phase after all are ready
                            ready_to_continue_tracker[lobby_id][phase] = set()
                elif message.get("type") == "tutorial_completed":
                    # Tutorial completed - update phase in database
                    player_id = message.get("player_id")
                    print(f"[PHASE] Player {player_id} completed tutorial in lobby {lobby_id}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                    
                    if match_id:
                        update_phase(match_id, "behavioural")
                    
                    # Broadcast to all players
                    await lobby_manager.broadcast_game_message(
                        lobby_id,
                        {
                            "type": "phase_changed",
                            "phase": "behavioural",
                            "reason": "tutorial_completed"
                        }
                    )
                elif message.get("type") == "round_start_countdown_started":
                    # Round start countdown started - synchronize with other players
                    player_id = message.get("player_id")
                    round_type = message.get("round_type")
                    start_time = message.get("startTime")
                    print(f"[PHASE] Round start countdown started for {round_type} in lobby {lobby_id}")
                    
                    # Broadcast synchronized countdown to all players
                    await lobby_manager.broadcast_game_message(
                        lobby_id,
                        {
                            "type": "round_start_countdown",
                            "round_type": round_type,
                            "startTime": start_time,
                            "serverTime": datetime.utcnow().timestamp() * 1000,
                            "remaining": COUNTDOWN_SECONDS
                        }
                    )
                elif message.get("type") == "round_start_skip":
                    # Player clicked skip - broadcast to all players and update database
                    player_id = message.get("player_id")
                    round_type = message.get("round_type")
                    print(f"[SKIP] Player {player_id} skipped round start countdown for {round_type} in lobby {lobby_id}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id:
                            # Update database state - mark countdown as skipped
                            phase_name = f"{round_type}_start"
                            update_phase(match_id, phase_name, {
                                "countdown_skipped": True,
                                "skipped_by": player_id,
                                "skipped_at": datetime.utcnow().isoformat()
                            })
                        
                        # Broadcast skip to ALL players - they navigate together
                        await lobby_manager.broadcast_game_message(
                            lobby_id,
                            {
                                "type": "round_start_skipped",
                                "round_type": round_type,
                                "skipped_by": player_id
                            }
                        )
                        print(f"[SKIP] Broadcast skip for {round_type} to all players")
                elif message.get("type") == "round_start_countdown_completed":
                    # Round start countdown completed - track and check if all players ready
                    player_id = message.get("player_id")
                    round_type = message.get("round_type")
                    print(f"[PHASE] Round start countdown completed for {round_type} in lobby {lobby_id} by player {player_id}")
                    
                    # Initialize tracking for this lobby/round_type if needed
                    if lobby_id not in round_start_completed_tracker:
                        round_start_completed_tracker[lobby_id] = {}
                    if round_type not in round_start_completed_tracker[lobby_id]:
                        round_start_completed_tracker[lobby_id][round_type] = set()
                    
                    # Add player to completed set
                    round_start_completed_tracker[lobby_id][round_type].add(player_id)
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id:
                            phase_name = f"{round_type}_start"
                            update_phase(match_id, phase_name)
                        
                        # Check if all players completed countdown
                        total_players = len(lobby.players)
                        completed_count = len(round_start_completed_tracker[lobby_id][round_type])
                        
                        print(f"[PHASE] {completed_count}/{total_players} players completed countdown for {round_type}")
                        
                        # If all players completed, broadcast navigation message
                        if completed_count >= total_players:
                            print(f"[PHASE] All players completed countdown for {round_type}! Broadcasting navigation.")
                            await lobby_manager.broadcast_game_message(
                                lobby_id,
                                {
                                    "type": "round_start_navigate",
                                    "round_type": round_type
                                }
                            )
                            # Clear tracker after navigation
                            round_start_completed_tracker[lobby_id][round_type] = set()
                elif message.get("type") == "behavioural_question_skip":
                    # Player clicked skip on behavioural question - broadcast to all players and update database
                    player_id = message.get("player_id")
                    phase = message.get("phase", "behavioural")
                    print(f"[SKIP] Player {player_id} skipped behavioural question in lobby {lobby_id}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id:
                            # Update database state - mark question as skipped
                            update_phase(match_id, phase, {
                                "question_skipped": True,
                                "skipped_by": player_id,
                                "skipped_at": datetime.utcnow().isoformat(),
                                "question_index": 0  # First question
                            })
                            
                            # Record skip as submission for phase manager (so phase can complete)
                            # This allows phase to advance even if players skip
                            phase_manager.record_submission(match_id, phase, player_id, 0)
                            
                            # Check if all players skipped or submitted
                            total_players = len(lobby.players)
                            phase_state = phase_manager.get_phase_state(match_id, phase)
                            submitted_count = len(phase_state.player_submissions)
                            
                            # If all players have skipped/submitted, show results
                            if submitted_count >= total_players:
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "show_results",
                                        "phase": phase,
                                        "reason": "all_skipped_or_submitted",
                                        "phaseComplete": False,  # Not phase complete yet, just first question
                                        "forceShow": True
                                    }
                                )
                        
                        # Broadcast skip to ALL players - they navigate together
                        await lobby_manager.broadcast_game_message(
                            lobby_id,
                            {
                                "type": "behavioural_question_skipped",
                                "skipped_by": player_id
                            }
                        )
                        print(f"[SKIP] Broadcast behavioural question skip to all players")
                elif message.get("type") == "request_question":
                    # Client requests a question for a specific phase
                    # All clients should receive the SAME question - cache it in game_state
                    player_id = message.get("player_id")
                    phase = message.get("phase", "behavioural")
                    question_index = message.get("question_index", 0)
                    print(f"[QUESTION] ===== REQUEST QUESTION HANDLER CALLED =====")
                    print(f"[QUESTION] Player {player_id} requested {phase} question (index={question_index}) in lobby {lobby_id}")
                    print(f"[QUESTION] Full message: {message}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        match_record = None
                        db = SessionLocal()
                        try:
                            if lobby.match:
                                match_id = lobby.match.match_id
                                match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                            else:
                                match_record = get_match_by_lobby_id(lobby_id)
                                if match_record:
                                    match_id = match_record.match_id
                            
                            if match_record:
                                match_id = match_record.match_id
                                
                                # Initialize locks for this match if needed
                                if match_id not in question_request_locks:
                                    question_request_locks[match_id] = {}
                                if phase not in question_request_locks[match_id]:
                                    question_request_locks[match_id][phase] = {}
                                if question_index not in question_request_locks[match_id][phase]:
                                    question_request_locks[match_id][phase][question_index] = asyncio.Lock()
                                
                                # Acquire lock to prevent race conditions
                                lock = question_request_locks[match_id][phase][question_index]
                                
                                async with lock:
                                    # Double-check cache after acquiring lock (another request might have stored it)
                                    # Refresh match_record to get latest game_state
                                    db.refresh(match_record)
                                    game_state_check = match_record.game_state or {}
                                    questions_cache_check = game_state_check.get("questions", {})
                                    question_key_check = f"{phase}_{question_index}"
                                    cached_question = questions_cache_check.get(question_key_check)
                                    
                                    if cached_question:
                                        # Question already selected and stored - send cached question
                                        print(f"[QUESTION] Using cached question for {phase}_{question_index} (after lock)")
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "question_received",
                                                "phase": phase,
                                                "question_index": question_index,
                                                "question": cached_question.get("question"),
                                                "question_id": cached_question.get("question_id"),
                                                "role": cached_question.get("role"),
                                                "level": cached_question.get("level")
                                            }
                                        )
                                        continue
                                    
                                    # No cached question - proceed to select/generate
                                    print(f"[QUESTION] No cached question found, selecting/generating for {phase}_{question_index}")
                                    
                                    # Re-fetch match_record to ensure we have latest data
                                    match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                                    if not match_record:
                                        print(f"[QUESTION] Match {match_id} not found after lock acquisition")
                                        continue
                                    
                                    # Continue with question selection/generation...
                                    # First request - select and store question in game_state
                                    match_type = match_record.match_type
                                    match_config = match_record.match_config or {}
                                    
                                    # For behavioural Q1, generate personalized follow-up question using LLM
                                    if phase == "behavioural" and question_index == 1:
                                        print(f"[QUESTION] Q1 requested for behavioural phase - generating personalized LLM follow-up for player {player_id}")
                                        
                                        # Get Q0 question from game_state (use already loaded match_record)
                                        # Q0 is only needed for question_id lookup - not required for follow-up generation
                                        game_state = match_record.game_state or {}
                                        questions_cache = game_state.get("questions", {})
                                        q0_question_key = f"{phase}_0"
                                        q0_question_data = questions_cache.get(q0_question_key)
                                        
                                        # Q0 question_id is helpful but not strictly required
                                        q0_question_id = ""
                                        original_question = ""
                                        if q0_question_data:
                                            original_question = q0_question_data.get("question", "")
                                            q0_question_id = q0_question_data.get("question_id", "")
                                        else:
                                            print(f"[QUESTION] WARNING: Q0 question not found in game_state for match {match_id}")
                                            print(f"[QUESTION] Available question keys: {list(questions_cache.keys())}")
                                            print(f"[QUESTION] Will proceed with answer-only follow-up generation")
                                        
                                        print(f"[QUESTION] Found Q0 question: {original_question[:100]}...")
                                        
                                        # Check if this player already has a follow-up question stored
                                        player_followups_key = f"{phase}_followups"
                                        player_followups = game_state.get(player_followups_key, {})
                                        
                                        if player_id in player_followups:
                                            # Player already has a follow-up - send it
                                            cached_followup = player_followups[player_id]
                                            print(f"[QUESTION] Using cached follow-up for player {player_id} from database")
                                            
                                            # Verify it's also in questions cache
                                            personalized_question_key = f"{phase}_{question_index}_{player_id}"
                                            questions_cache_check = game_state.get("questions", {})
                                            if personalized_question_key not in questions_cache_check:
                                                print(f"[QUESTION] WARNING: Follow-up not in questions cache, adding it")
                                                # Add to questions cache for consistency
                                                questions_cache_check[personalized_question_key] = {
                                                    "question": cached_followup.get("question"),
                                                    "question_id": cached_followup.get("question_id"),
                                                    "role": cached_followup.get("role"),
                                                    "level": cached_followup.get("level"),
                                                    "phase": phase,
                                                    "question_index": question_index,
                                                    "is_followup": True,
                                                    "parent_question_index": 0,
                                                    "player_id": player_id,
                                                    "stored_at": cached_followup.get("generated_at", datetime.utcnow().isoformat()),
                                                    "generated_at": cached_followup.get("generated_at")
                                                }
                                                game_state["questions"] = questions_cache_check
                                                match_record.game_state = game_state
                                                db.commit()
                                            
                                            await safe_send_json(websocket, {
                                                "type": "question_received",
                                                "phase": phase,
                                                "question_index": question_index,
                                                "question": cached_followup.get("question"),
                                                "question_id": cached_followup.get("question_id"),
                                                "role": cached_followup.get("role"),
                                                "level": cached_followup.get("level"),
                                                "player_id": player_id  # Indicate this is personalized
                                            })
                                            
                                            # Check if all players have follow-ups by checking questions cache
                                            # Refresh to get latest state from database
                                            db.refresh(match_record)
                                            verify_state = match_record.game_state or {}
                                            verify_questions = verify_state.get("questions", {})
                                            
                                            total_players = len(lobby.players)
                                            # Count Q1 questions with player_id suffix (personalized follow-ups)
                                            players_with_followups = 0
                                            for key in verify_questions.keys():
                                                if key.startswith(f"{phase}_{question_index}_"):
                                                    players_with_followups += 1
                                            
                                            print(f"[QUESTION] Cached follow-up check - Follow-ups ready: {players_with_followups}/{total_players} players")
                                            
                                            if players_with_followups >= total_players:
                                                print(f"[QUESTION] All {total_players} players have follow-ups - broadcasting sync")
                                                await lobby_manager.broadcast_game_message(
                                                    lobby_id,
                                                    {
                                                        "type": "all_followups_ready",
                                                        "phase": phase,
                                                        "question_index": question_index
                                                    }
                                                )
                                            continue
                                        
                                        # Refresh match_record to ensure we have the latest game_state with submitted answers
                                        db.refresh(match_record)
                                        game_state = match_record.game_state or {}
                                        
                                        # Get the requesting player's answer to Q0 from player_responses structure
                                        player_responses = game_state.get("player_responses", {})
                                        player_answer = None
                                        answers = game_state.get("answers", {})  # Initialize for error reporting
                                        
                                        # Try to get from player_responses structure first (per-player storage)
                                        if player_id in player_responses:
                                            player_phase_responses = player_responses[player_id].get(phase, {})
                                            # Try both string "0" and integer 0 as keys
                                            q0_response = player_phase_responses.get("0") or player_phase_responses.get(0)
                                            if q0_response:
                                                player_answer = q0_response.get("answer")
                                        
                                        # Fallback: try answers dict (backward compatibility)
                                        if not player_answer:
                                            # First, try to find answer by question_id and player_id (if we have Q0 question_id)
                                            if q0_question_id and q0_question_id in answers:
                                                answer_data = answers[q0_question_id]
                                                if isinstance(answer_data, dict):
                                                    # Check if this answer belongs to the requesting player
                                                    if answer_data.get("player_id") == player_id:
                                                        player_answer = answer_data.get("answer", "")
                                            
                                            # If not found, search all answers for this player's Q0 answer
                                            if not player_answer:
                                                for qid, ans_data in answers.items():
                                                    if isinstance(ans_data, dict):
                                                        # Check both integer 0 and string "0" for question_index
                                                        q_idx = ans_data.get("question_index")
                                                        if (ans_data.get("player_id") == player_id and
                                                            ans_data.get("phase") == phase and 
                                                            (q_idx == 0 or q_idx == "0")):
                                                            player_answer = ans_data.get("answer", "")
                                                            break
                                        
                                        if not player_answer:
                                            print(f"[QUESTION] ERROR: Player {player_id} answer to Q0 not found for match {match_id}")
                                            print(f"[QUESTION] Player responses structure: {player_responses}")
                                            print(f"[QUESTION] Available answers: {list(answers.keys())}")
                                            print(f"[QUESTION] Answers data: {answers}")
                                            print(f"[QUESTION] Looking for player_id={player_id}, phase={phase}, question_index=0")
                                            await safe_send_json(websocket, {
                                                "type": "question_error",
                                                "phase": phase,
                                                "message": "Your answer to the previous question was not found"
                                            })
                                            continue
                                        
                                        print(f"[QUESTION] Generating personalized follow-up question for player {player_id}:")
                                        print(f"[QUESTION]   Player Answer: {player_answer[:200]}...")
                                        
                                        # Send a "generating" status message to keep connection alive and inform client
                                        await safe_send_json(websocket, {
                                            "type": "question_generating",
                                            "phase": phase,
                                            "question_index": question_index,
                                            "player_id": player_id,
                                            "message": "Considering your response..."
                                        })
                                        
                                        try:
                                            # Generate personalized follow-up question using LLM
                                            # Focus on the player's answer - original question is just for context
                                            # This can take 5-30 seconds depending on OpenAI API response time
                                            followup_question = await followup_generator.generate_followup(
                                                original_question=original_question,  # Context only
                                                candidate_answer=player_answer,  # Primary input
                                                role=match_config.get("role"),
                                                level=match_config.get("level")
                                            )
                                            
                                            print(f"[QUESTION] Generated personalized follow-up for player {player_id}: {followup_question}")
                                            
                                            # Create question data structure
                                            question_data = {
                                                "question_id": f"behavioural_followup_{match_id}_{question_index}_{player_id}",
                                                "question": followup_question,
                                                "phase": "behavioural",
                                                "question_index": question_index,
                                                "role": match_config.get("role"),
                                                "level": match_config.get("level"),
                                                "is_generated": True,
                                                "parent_question_id": q0_question_id,
                                                "player_id": player_id
                                            }
                                            
                                            # Add timestamp
                                            question_data["generated_at"] = datetime.utcnow().isoformat()
                                            
                                            # Store personalized follow-up using store_question helper
                                            # This ensures proper per-player storage structure
                                            question_stored = store_question(
                                                match_id=match_id,
                                                phase=phase,
                                                question_index=question_index,
                                                question_data=question_data,
                                                is_followup=True,
                                                parent_question_index=0,
                                                player_id=player_id  # Personalized question
                                            )
                                            
                                            if question_stored:
                                                print(f"[QUESTION] ✓ Successfully stored personalized follow-up for player {player_id} in database")
                                                
                                                # Also maintain behavioural_followups for quick lookup (backward compatibility)
                                                if player_followups_key not in game_state:
                                                    game_state[player_followups_key] = {}
                                                game_state[player_followups_key][player_id] = question_data
                                                
                                                # Refresh match_record to get latest state
                                                db.refresh(match_record)
                                            else:
                                                print(f"[QUESTION] ✗ WARNING: Failed to store personalized follow-up in database")
                                                # Still store in behavioural_followups for immediate use
                                                if player_followups_key not in game_state:
                                                    game_state[player_followups_key] = {}
                                                game_state[player_followups_key][player_id] = question_data
                                                match_record.game_state = game_state
                                                db.commit()
                                            
                                            # Send personalized follow-up ONLY to requesting player
                                            await safe_send_json(websocket, {
                                                "type": "question_received",
                                                "phase": phase,
                                                "question_index": question_index,
                                                "question": followup_question,
                                                "question_id": question_data.get("question_id"),
                                                "role": question_data.get("role"),
                                                "level": question_data.get("level"),
                                                "player_id": player_id  # Indicate this is personalized
                                            })
                                            
                                            # Check if all players have follow-ups now by checking questions cache
                                            # Refresh to get latest state from database
                                            db.refresh(match_record)
                                            verify_state = match_record.game_state or {}
                                            verify_questions = verify_state.get("questions", {})
                                            
                                            total_players = len(lobby.players)
                                            # Count Q1 questions with player_id suffix (personalized follow-ups)
                                            players_with_followups = 0
                                            for key in verify_questions.keys():
                                                if key.startswith(f"{phase}_{question_index}_"):
                                                    players_with_followups += 1
                                            
                                            print(f"[QUESTION] Follow-ups ready: {players_with_followups}/{total_players} players")
                                            
                                            # Only broadcast when ALL players have their follow-ups ready
                                            if players_with_followups >= total_players:
                                                print(f"[QUESTION] All {total_players} players have follow-ups - broadcasting sync message")
                                                await lobby_manager.broadcast_game_message(
                                                    lobby_id,
                                                    {
                                                        "type": "all_followups_ready",
                                                        "phase": phase,
                                                        "question_index": question_index
                                                    }
                                                )
                                            
                                        except Exception as e:
                                            db.rollback()
                                            print(f"[QUESTION] ERROR: Failed to generate follow-up question: {e}")
                                            import traceback
                                            traceback.print_exc()
                                            
                                            # Provide user-friendly error message
                                            error_msg = str(e)
                                            if "401" in error_msg or "Unauthorized" in error_msg or "api key" in error_msg.lower():
                                                user_message = "OpenAI API key is missing or invalid. Please configure your API key to generate personalized follow-up questions."
                                            elif "429" in error_msg or "rate limit" in error_msg.lower():
                                                user_message = "OpenAI API rate limit exceeded. Please try again in a moment."
                                            else:
                                                user_message = f"Failed to generate follow-up question. Please try again."
                                            
                                            await safe_send_json(websocket, {
                                                "type": "question_error",
                                                "phase": phase,
                                            })
                                        continue
                                    
                                    # For non-Q1 questions (Q0, technical, etc.), select from database
                                    print(f"[QUESTION] Calling question_manager.get_question_for_phase for {phase} (index={question_index})")
                                    print(f"[QUESTION] Match type: {match_type}, Match config: {match_config}")
                                    question_data = question_manager.get_question_for_phase(
                                        match_type=match_type,
                                        phase=phase,
                                        match_config=match_config,
                                        question_index=question_index
                                    )
                                    
                                    print(f"[QUESTION] Question manager returned: {question_data is not None}")
                                    if question_data:
                                        print(f"[QUESTION] Question data received: {question_data}")
                                        # Add timestamp for when question was generated/selected
                                        question_data["generated_at"] = datetime.utcnow().isoformat()
                                        
                                        # Determine if this is a follow-up question
                                        is_followup = (phase == "behavioural" and question_index == 1)
                                        parent_index = 0 if is_followup else None
                                        
                                        # Store question in game_state using helper function
                                        # This ensures the question is persisted in the database
                                        # Q0 is shared, so no player_id needed
                                        print(f"[QUESTION] Attempting to store {phase} question (index={question_index}) for match {match_id}")
                                        print(f"[QUESTION] Question data before storage: {question_data}")
                                        
                                        question_stored = store_question(
                                            match_id=match_id,
                                            phase=phase,
                                            question_index=question_index,
                                            question_data=question_data,
                                            is_followup=is_followup,
                                            parent_question_index=parent_index,
                                            player_id=None  # Shared question
                                        )
                                        
                                        if question_stored:
                                            print(f"[QUESTION] ✓ Successfully stored {phase} question (index={question_index}) in database for match {match_id}")
                                            
                                            # Verify storage by reading back from database
                                            db.refresh(match_record)
                                            verify_state = match_record.game_state or {}
                                            verify_questions = verify_state.get("questions", {})
                                            expected_key = f"{phase}_{question_index}"
                                            print(f"[QUESTION] Verification - Game state keys: {list(verify_state.keys())}")
                                            print(f"[QUESTION] Verification - Questions cache keys: {list(verify_questions.keys())}")
                                            print(f"[QUESTION] Verification - Looking for key '{expected_key}': {expected_key in verify_questions}")
                                            
                                            if expected_key in verify_questions:
                                                print(f"[QUESTION] ✓ Verification PASSED - Question stored correctly")
                                            else:
                                                print(f"[QUESTION] ✗ Verification FAILED - Question not found after storage!")
                                                print(f"[QUESTION] Available question keys: {list(verify_questions.keys())}")
                                        else:
                                            print(f"[QUESTION] ✗ WARNING: Failed to store question in database")
                                            # Still broadcast, but log the error
                                        
                                        # Broadcast question to all players
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "question_received",
                                                "phase": phase,
                                                "question_index": question_index,
                                                "question": question_data.get("question"),
                                                "question_id": question_data.get("question_id"),
                                                "role": question_data.get("role"),
                                                "level": question_data.get("level")
                                            }
                                        )
                                        print(f"[QUESTION] Broadcast {phase} question to all players")
                                    else:
                                        # No question found - log detailed error
                                        print(f"[QUESTION] ERROR: No question found for {phase} (match_type={match_type}, question_index={question_index})")
                                        print(f"[QUESTION] Match config: {match_config}")
                                        print(f"[QUESTION] Role: {match_config.get('role')}, Level: {match_config.get('level')}")
                                        await safe_send_json(websocket, {
                                            "type": "question_error",
                                            "phase": phase,
                                            "message": "Question not available"
                                        })
                            else:
                                print(f"[QUESTION] Match not found for lobby {lobby_id}")
                        finally:
                            db.close()
                elif message.get("type") == "winlose_started":
                    # Win/Lose screen started - update phase
                    player_id = message.get("player_id")
                    print(f"[PHASE] Win/Lose screen started in lobby {lobby_id}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        match_id = None
                        if lobby.match:
                            match_id = lobby.match.match_id
                        else:
                            match_record = get_match_by_lobby_id(lobby_id)
                            if match_record:
                                match_id = match_record.match_id
                        
                        if match_id:
                            update_phase(match_id, "winlose")
                    
                    # Broadcast synchronized timer start
                    await lobby_manager.broadcast_game_message(
                        lobby_id,
                        {
                            "type": "winlose_start",
                            "timeRemaining": 7,
                            "serverTime": datetime.utcnow().timestamp() * 1000
                        }
                    )
                    
            except WebSocketDisconnect:
                print(f"WebSocket disconnected normally")
                break
            except json.JSONDecodeError:
                continue
            except Exception as e:
                print(f"WebSocket error: {e}")
                break
    
    except WebSocketDisconnect:
        print(f"WebSocket disconnected")
    finally:
        lobby_manager.remove_connection(lobby_id, websocket)
        # Broadcast updated state after disconnection
        await lobby_manager.broadcast_lobby_update(lobby_id)
