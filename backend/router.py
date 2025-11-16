from fastapi import APIRouter, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel
import json
import asyncio
import os
from datetime import datetime
from typing import Dict, Set, Optional, Any
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
    get_question_from_game_state,
)
from database import (
    SessionLocal,
    OngoingMatch,
    BehaviouralPool,
    TechnicalTheoryPool,
    TechnicalPracticalPool,
)
from game.phase_manager import phase_manager
from game.scoring import calculate_phase_scores
try:
    from code_executor import execute_code
except ImportError as import_error:
    print(f"Warning: code_executor not available: {import_error}")
    error_msg = str(import_error)
    async def execute_code(language: str, code: str):
        return {
            'stdout': '',
            'stderr': f'Code execution not available: {error_msg}',
            'exit_code': 1,
            'error': 'Code executor not available',
            'execution_time': 0
        }
from game.question_manager import question_manager
from app.llm.openai import OpenAIClient
from app.llm.client import LLMTextRequest
from app.llm.followup_generator import FollowUpQuestionGenerator
from app.llm.prompts.renderer import render as render_prompt
from app.llm.routes import _parse_technical_theory_questions

# Initialize LLM client and generators
llm_client = OpenAIClient(api_key=os.environ.get("OPENAI_API_KEY"))
followup_generator = FollowUpQuestionGenerator(llm_client)

router = APIRouter()

COUNTDOWN_SECONDS = 5  # For round start counter

# Track ready players per lobby and phase (for scores display)
# Structure: {lobby_id: {phase: set(player_ids)}}
ready_players_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Track players ready to continue to next phase (from score screen)
# Structure: {lobby_id: {phase: set(player_ids)}}
ready_to_continue_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Track if scores are being calculated for a phase (prevent duplicate calculations)
# Structure: {lobby_id: {phase: bool}}
scores_calculating: Dict[str, Dict[str, bool]] = {}

# Track scores that have been calculated and are ready to broadcast
# Structure: {lobby_id: {phase: {scores, phase_scores, previous_scores, timestamp}}}
calculated_scores_cache: Dict[str, Dict[str, Dict[str, Any]]] = {}

# Track players who confirmed skip for behavioural questions
# Structure: {lobby_id: {phase: set(player_ids)}}
skip_confirmation_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Track players who completed round start countdown
# Structure: {lobby_id: {round_type: set(player_ids)}}
round_start_completed_tracker: Dict[str, Dict[str, Set[str]]] = {}

# Lock for question requests to prevent race conditions
# Structure: {match_id: {phase: {question_index: asyncio.Lock}}}
question_request_locks: Dict[str, Dict[str, Dict[int, asyncio.Lock]]] = {}

# Default roles that have pre-seeded questions - don't need LLM generation
DEFAULT_ROLES = {'frontend', 'backend', 'full stack', 'devops', 'mobile'}


async def ensure_questions_for_role_level(role: str, level: str):
    """
    Ensure there are enough questions in the DB for a given role/level.
    - 1 behavioural
    - 10 technical theory
    - 1 technical practical

    If questions already exist in sufficient quantity, this is a no-op.
    Otherwise, generate missing questions via the LLM and insert them into the pools.
    """
    # Normalize like QuestionManager does
    role_norm = (role or "").lower().strip()
    level_norm = (level or "").lower().strip().replace("-", "").replace("_", "").replace(" ", "")

    db = SessionLocal()
    try:
        beh_count = db.query(BehaviouralPool).filter(
            BehaviouralPool.role == role_norm,
            BehaviouralPool.level == level_norm,
        ).count()
        theory_count = db.query(TechnicalTheoryPool).filter(
            TechnicalTheoryPool.role == role_norm,
            TechnicalTheoryPool.level == level_norm,
        ).count()
        practical_count = db.query(TechnicalPracticalPool).filter(
            TechnicalPracticalPool.role == role_norm,
            TechnicalPracticalPool.level == level_norm,
        ).count()
    finally:
        db.close()

    needs_behavioural = beh_count < 1
    needs_theory = theory_count < 10
    needs_practical = practical_count < 1

    if not (needs_behavioural or needs_theory or needs_practical):
        return

    print(
        f"[LLM_SETUP] Generating questions for custom role='{role_norm}', level='{level_norm}' "
        f"(behavioural={beh_count}, theory={theory_count}, practical={practical_count})",
        flush=True,
    )

    try:
        # Generate behavioural question(s) if needed
        behavioural_questions: list[str] = []
        if needs_behavioural:
            system = render_prompt("role/behavioural/question/system_prompt.jinja")
            prompt = render_prompt(
                "role/behavioural/question/user_prompt.jinja",
                role=role_norm,
                max_questions=1,
            )
            resp = await llm_client.generate_text(
                LLMTextRequest(prompt=prompt, system=system, temperature=0.7, max_tokens=300)
            )
            lines = [line.strip() for line in (resp.text or "").splitlines() if line.strip()]
            if lines:
                behavioural_questions = lines[:1]

        # Generate technical theory questions if needed
        technical_theory_questions: list[dict] = []
        if needs_theory:
            missing = 10 - theory_count if theory_count < 10 else 0
            if missing > 0:
                system = render_prompt("role/technical_theory/system_prompt.jinja")
                prompt = render_prompt(
                    "role/technical_theory/user_prompt.jinja",
                    role=role_norm,
                    max_questions=missing,
                )
                resp = await llm_client.generate_text(
                    LLMTextRequest(
                        prompt=prompt,
                        system=system,
                        temperature=0.7,
                        max_tokens=1200,
                    )
                )
                technical_theory_questions = _parse_technical_theory_questions(
                    resp.text or "", missing
                )

        # Generate technical practical question(s) if needed
        technical_practical_questions: list[str] = []
        if needs_practical:
            system = render_prompt("role/technical_practical/system_prompt.jinja")
            prompt = render_prompt(
                "role/technical_practical/user_prompt.jinja",
                role=role_norm,
                max_questions=1,
            )
            resp = await llm_client.generate_text(
                LLMTextRequest(
                    prompt=prompt,
                    system=system,
                    temperature=0.7,
                    max_tokens=400,
                )
            )
            lines = [line.strip() for line in (resp.text or "").splitlines() if line.strip()]
            if lines:
                technical_practical_questions = lines[:1]
    except Exception as e:
        # Don't block game start if LLM generation fails; just log and return.
        print(f"[LLM_SETUP] Error during LLM generation for role='{role_norm}', level='{level_norm}': {e}", flush=True)
        return

    # Insert new questions into the DB
    if behavioural_questions or technical_theory_questions or technical_practical_questions:
        db = SessionLocal()
        try:
            if behavioural_questions:
                for q_text in behavioural_questions:
                    db.add(
                        BehaviouralPool(
                            role=role_norm,
                            level=level_norm,
                            question=q_text,
                        )
                    )

            if technical_theory_questions:
                for q in technical_theory_questions:
                    db.add(
                        TechnicalTheoryPool(
                            role=role_norm,
                            level=level_norm,
                            question=q["question"],
                            correct_answer=q["correct"],
                            incorrect_answers=q["incorrect"],
                        )
                    )

            if technical_practical_questions:
                for q_text in technical_practical_questions:
                    db.add(
                        TechnicalPracticalPool(
                            role=role_norm,
                            level=level_norm,
                            question=q_text,
                        )
                    )

            db.commit()
            print(
                f"[LLM_SETUP] Inserted new questions for role='{role_norm}', level='{level_norm}'"
            )
        except Exception as e:
            db.rollback()
            print(f"[LLM_SETUP] Error inserting LLM-generated questions: {e}")
        finally:
            db.close()


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
async def start_game(lobby_id: str, request: StartGameRequest, background_tasks: BackgroundTasks):
    """Start the game - requires owner player_id"""
    # Start the game immediately - don't wait for LLM generation
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
        # Generate questions in the background (non-blocking) only for custom roles
        # Default roles (Frontend, Backend, Full Stack, DevOps, Mobile) have pre-seeded questions
        lobby = lobby_manager.get_lobby(lobby_id)
        if lobby:
            final_match_type = request.match_type or lobby.match_type or "generalized"
            final_role = request.role or lobby.role
            final_level = request.level or lobby.level
            if final_match_type == "generalized" and final_role and final_level:
                # Normalize role to check if it's a default role
                role_normalized = (final_role or "").lower().strip()
                is_custom_role = role_normalized not in DEFAULT_ROLES
                
                if is_custom_role:
                    # Only generate for custom roles - default roles already have questions
                    background_tasks.add_task(ensure_questions_for_role_level, final_role, final_level)
                    print(f"[START_GAME] Starting game immediately, generating questions in background for custom role='{final_role}', level='{final_level}'", flush=True)
                else:
                    print(f"[START_GAME] Starting game immediately, using pre-seeded questions for default role='{final_role}', level='{final_level}'", flush=True)
        
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
    
    # Add connection to manager (will check for duplicates internally)
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
                            # Create database session for this handler
                            db = SessionLocal()
                            try:
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
                                
                                # For technical_theory, score the answer immediately
                                if phase == "technical_theory":
                                    from game.technical_theory_scoring import score_technical_theory_answer
                                    try:
                                        score = await score_technical_theory_answer(
                                            match_id=match_id,
                                            player_id=player_id,
                                            question_index=question_index,
                                            answer=answer_text
                                        )
                                        if score is not None:
                                            print(f"[SUBMIT] Scored technical theory answer: {score} points")
                                        else:
                                            print(f"[SUBMIT] WARNING: Could not score technical theory answer")
                                    except Exception as e:
                                        print(f"[SUBMIT] Error scoring technical theory answer: {e}")
                                        import traceback
                                        traceback.print_exc()
                                
                                # For technical_practical, score the submission immediately
                                if phase == "technical_practical":
                                    from game.technical_practical_scoring import score_technical_practical_submission
                                    try:
                                        score = await score_technical_practical_submission(
                                            match_id=match_id,
                                            player_id=player_id,
                                            question_index=question_index or 0,
                                            submission_data=answer_text
                                        )
                                        if score is not None:
                                            print(f"[SUBMIT] Scored technical practical submission: {score} points")
                                        else:
                                            print(f"[SUBMIT] WARNING: Could not score technical practical submission")
                                    except Exception as e:
                                        print(f"[SUBMIT] Error scoring technical practical submission: {e}")
                                        import traceback
                                        traceback.print_exc()
                                
                                total_players = len(lobby.players)
                                phase_state = phase_manager.get_phase_state(match_id, phase)
                                
                                print(f"[SUBMIT] After recording submission - Phase: {phase}, Question index: {question_index}, Player: {player_id}")
                                print(f"[SUBMIT] Phase state player_submissions: {phase_state.player_submissions}")
                                print(f"[SUBMIT] Phase state question_submissions: {phase_state.question_submissions}")
                                
                                # For technical_theory: players work independently, check completion when all questions are done
                                if phase == "technical_theory":
                                    # Get question count from game_state (refresh record first)
                                    match_record_check = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                                    if match_record_check:
                                        db.refresh(match_record_check)
                                    
                                    question_count = 10  # Default fallback
                                    if match_record_check and match_record_check.game_state:
                                        game_state_check = match_record_check.game_state
                                        if isinstance(game_state_check, dict):
                                            phase_metadata = game_state_check.get("phase_metadata", {})
                                            if phase in phase_metadata:
                                                question_count = phase_metadata[phase].get("question_count", 10)
                                                print(f"[SUBMIT] Found question_count in phase_metadata: {question_count}")
                                            else:
                                                print(f"[SUBMIT] WARNING: phase_metadata['{phase}'] not found. Available keys: {list(phase_metadata.keys())}")
                                                # Try to count questions from cache as fallback
                                                questions_cache = game_state_check.get("questions", {})
                                                tech_questions = [k for k in questions_cache.keys() if k.startswith(f"{phase}_")]
                                                if tech_questions:
                                                    # Get max index + 1
                                                    max_idx = -1
                                                    for q_key in tech_questions:
                                                        try:
                                                            # Handle format: technical_theory_0, technical_theory_1, etc.
                                                            parts = q_key.split("_")
                                                            if len(parts) >= 3:
                                                                idx = int(parts[-1])
                                                                max_idx = max(max_idx, idx)
                                                        except:
                                                            pass
                                                    if max_idx >= 0:
                                                        question_count = max_idx + 1
                                                        print(f"[SUBMIT] Calculated question_count from cache: {question_count}")
                                    else:
                                        print(f"[SUBMIT] WARNING: match_record_check or game_state not found")
                                    
                                    print(f"[SUBMIT] Using question_count for technical_theory: {question_count}")
                                    
                                    # Refresh phase state to get latest submissions
                                    phase_state = phase_manager.get_phase_state(match_id, phase)
                                    player_submissions = phase_state.player_submissions.get(player_id, set())
                                    finished_all = len(player_submissions) >= question_count
                                    print(f"[TECHNICAL_THEORY] Player {player_id} has submitted {len(player_submissions)}/{question_count} questions. Finished all: {finished_all}")
                                    print(f"[TECHNICAL_THEORY] Lobby has {total_players} players: {[p.get('id') if isinstance(p, dict) else str(p) for p in lobby.players]}")
                                    
                                    if finished_all:
                                        # Player finished all questions - broadcast to show waiting status
                                        # Calculate finished players by checking all players in lobby
                                        finished_players = []
                                        for p in lobby.players:
                                            # Handle both dict format {"id": "..."} and direct string format
                                            if isinstance(p, dict):
                                                p_id = p.get("id") or p.get("player_id") or str(p)
                                            else:
                                                p_id = str(p)
                                            
                                            p_submissions = phase_state.player_submissions.get(p_id, set())
                                            submission_count = len(p_submissions)
                                            if submission_count >= question_count:
                                                finished_players.append(p_id)
                                                print(f"[TECHNICAL_THEORY] Player {p_id} finished ({submission_count}/{question_count})")
                                            else:
                                                print(f"[TECHNICAL_THEORY] Player {p_id} not finished yet ({submission_count}/{question_count})")
                                        
                                        print(f"[TECHNICAL_THEORY] Broadcasting finished status: {len(finished_players)}/{total_players} players finished")
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "player_finished_technical_theory",
                                                "player_id": player_id,
                                                "total_finished": len(finished_players),
                                                "total_players": total_players
                                            }
                                        )
                                        
                                        # Check if all players finished
                                        if len(finished_players) >= total_players:
                                            print(f"[TECHNICAL_THEORY] All players finished! Getting pre-calculated scores.")
                                            
                                            # Get pre-calculated scores (scored incrementally as answers were submitted)
                                            try:
                                                from game.technical_theory_scoring import get_technical_theory_total_score
                                                player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                                scores = {}
                                                for pid in player_ids:
                                                    score = await get_technical_theory_total_score(match_id, pid)
                                                    scores[pid] = score
                                                    print(f"[TECHNICAL_THEORY] Player {pid} total score: {score}")
                                                
                                                # Store scores in database for consistency
                                                await calculate_and_store_scores(match_id, "technical_theory", player_ids)
                                                print(f"[TECHNICAL_THEORY] Scores retrieved: {scores}")
                                            except Exception as e:
                                                print(f"[TECHNICAL_THEORY] Error getting scores: {e}")
                                                import traceback
                                                traceback.print_exc()
                                                # Fallback: use RNG scores
                                                import random
                                                player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                                scores = {pid: random.randint(50, 100) for pid in player_ids}
                                            
                                            # Broadcast scores and phase completion
                                            await lobby_manager.broadcast_game_message(
                                                lobby_id,
                                                {
                                                    "type": "scores_ready",
                                                    "phase": "technical_theory",
                                                    "scores": scores,
                                                    "serverTime": datetime.utcnow().timestamp() * 1000
                                                }
                                            )
                                            
                                            await lobby_manager.broadcast_game_message(
                                                lobby_id,
                                                {
                                                    "type": "show_results",
                                                    "phase": "technical_theory",
                                                    "reason": "phase_complete",
                                                    "phaseComplete": True,
                                                    "forceShow": True,
                                                    "total_finished": len(finished_players),
                                                    "total_players": total_players
                                                }
                                            )
                            finally:
                                db.close()
                            
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
                                # Get all player IDs for accurate completion check
                                player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                
                                check_phase = "technical"
                                phase_complete = phase_manager.check_phase_complete(match_id, check_phase, total_players, player_ids=player_ids)
                                print(f"[SUBMIT] Phase {check_phase} completion status: {phase_complete} ({len(phase_state.player_submissions)}/{total_players} players)")
                                
                                sub_phase_complete = phase_manager.check_phase_complete(match_id, phase, total_players, player_ids=player_ids)
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
                                # Technical practical is standalone (technical_theory handled separately)
                                # Check if practical phase is complete (both players submitted)
                                phase_complete = phase_manager.check_phase_complete(match_id, phase, total_players)
                                
                                print(f"[SUBMIT] Technical practical completion status: {phase_complete} ({len(phase_state.player_submissions)}/{total_players} players)")
                                
                                if phase_complete:
                                    print(f"[SUBMIT] Technical practical COMPLETE! All players submitted. Getting pre-calculated scores.")
                                    
                                    # Get pre-calculated scores (scored incrementally as submissions were submitted)
                                    try:
                                        from game.technical_practical_scoring import get_technical_practical_total_score
                                        player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                        scores = {}
                                        for pid in player_ids:
                                            score = await get_technical_practical_total_score(match_id, pid)
                                            scores[pid] = score
                                            print(f"[TECHNICAL_PRACTICAL] Player {pid} total score: {score}")
                                        
                                        # Store scores in database for consistency
                                        final_scores, previous_scores = await calculate_and_store_scores(match_id, "technical_practical", player_ids)
                                        print(f"[TECHNICAL_PRACTICAL] Scores retrieved: {final_scores}")
                                        
                                        # Get phase-specific scores for display
                                        db_phase = SessionLocal()
                                        try:
                                            match_record_phase = db_phase.query(OngoingMatch).filter(
                                                OngoingMatch.match_id == match_id
                                            ).first()
                                            phase_scores_for_round = {}
                                            if match_record_phase and match_record_phase.game_state:
                                                game_state_phase = match_record_phase.game_state
                                                if isinstance(game_state_phase, dict):
                                                    phase_scores_data = game_state_phase.get("technical_practical_scores", {})
                                                    if isinstance(phase_scores_data, dict):
                                                        for pid in player_ids:
                                                            player_phase_scores = phase_scores_data.get(pid, {})
                                                            if isinstance(player_phase_scores, dict):
                                                                phase_scores_for_round[pid] = player_phase_scores.get("_total", 0)
                                        finally:
                                            db_phase.close()
                                        
                                        # Broadcast scores and phase completion
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "scores_ready",
                                                "phase": "technical_practical",
                                                "scores": final_scores,
                                                "phase_scores": phase_scores_for_round,
                                                "previous_scores": previous_scores,
                                                "serverTime": datetime.utcnow().timestamp() * 1000
                                            }
                                        )
                                        
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
                                        
                                        # GAME END: Calculate final rankings and determine winners
                                        print(f"[GAME_END] Technical practical complete - calculating final rankings")
                                        
                                        # Get final cumulative scores from database
                                        db_final = SessionLocal()
                                        try:
                                            match_record_final = db_final.query(OngoingMatch).filter(
                                                OngoingMatch.match_id == match_id
                                            ).first()
                                            if match_record_final and match_record_final.game_state:
                                                game_state_final = match_record_final.game_state
                                                if isinstance(game_state_final, dict):
                                                    final_cumulative_scores = game_state_final.get("scores", {})
                                                    if isinstance(final_cumulative_scores, dict):
                                                        # Calculate rankings (sorted by score descending)
                                                        player_rankings = []
                                                        for pid in player_ids:
                                                            player_score = final_cumulative_scores.get(pid, 0)
                                                            player_name = next((p.get("name", pid) if isinstance(p, dict) else str(p)) for p in lobby.players if (p.get("id") if isinstance(p, dict) else str(p)) == pid)
                                                            player_rankings.append({
                                                                "player_id": pid,
                                                                "name": player_name,
                                                                "score": player_score
                                                            })
                                                        
                                                        # Sort by score descending
                                                        player_rankings.sort(key=lambda x: x["score"], reverse=True)
                                                        
                                                        # Assign ranks (handle ties)
                                                        rankings = []
                                                        current_rank = 1
                                                        for idx, player in enumerate(player_rankings):
                                                            if idx > 0 and player["score"] < player_rankings[idx - 1]["score"]:
                                                                current_rank = idx + 1
                                                            rankings.append({
                                                                "player_id": player["player_id"],
                                                                "name": player["name"],
                                                                "score": player["score"],
                                                                "rank": current_rank
                                                            })
                                                        
                                                        print(f"[GAME_END] Final rankings: {rankings}")
                                                        
                                                        # Mark lobby as completed to prevent cleanup during end-game flow
                                                        if lobby:
                                                            lobby.status = "completed"
                                                            print(f"[GAME_END] Marked lobby {lobby_id} as completed")
                                                        
                                                        # Broadcast game_end message to all clients with rankings
                                                        await lobby_manager.broadcast_game_message(
                                                            lobby_id,
                                                            {
                                                                "type": "game_end",
                                                                "rankings": rankings,
                                                                "final_scores": final_cumulative_scores,
                                                                "serverTime": datetime.utcnow().timestamp() * 1000
                                                            }
                                                        )
                                                        
                                                        print(f"[GAME_END] Broadcast game_end with rankings to all players")
                                        finally:
                                            db_final.close()
                                        
                                    except Exception as e:
                                        print(f"[TECHNICAL_PRACTICAL] Error getting scores: {e}")
                                        import traceback
                                        traceback.print_exc()
                                        # Fallback: use RNG scores
                                        import random
                                        player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                        scores = {pid: random.randint(50, 100) for pid in player_ids}
                                        
                                        # Broadcast scores even on error
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "scores_ready",
                                                "phase": "technical_practical",
                                                "scores": scores,
                                                "serverTime": datetime.utcnow().timestamp() * 1000
                                            }
                                        )
                                        
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
                                    # Check parent "technical" phase completion
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
                    # For technical_theory, also include all players' progress
                    broadcast_data = {
                        "type": "player_submitted",
                        "player_id": player_id,
                        "questionId": question_id,
                        "phase": phase,
                        "question_index": question_index
                    }
                    
                    # Add progress info for technical_theory phase
                    if phase == "technical_theory":
                        # Get question count
                        question_count = 10  # Default
                        match_record_check = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                        if match_record_check:
                            game_state_check = match_record_check.game_state or {}
                            if isinstance(game_state_check, dict):
                                phase_metadata = game_state_check.get("phase_metadata", {})
                                if phase in phase_metadata:
                                    question_count = phase_metadata[phase].get("question_count", 10)
                                else:
                                    # Fallback: count from questions cache
                                    questions_cache_check = game_state_check.get("questions", {})
                                    max_idx = -1
                                    for key in questions_cache_check.keys():
                                        if key.startswith(f"{phase}_"):
                                            try:
                                                idx = int(key.split("_")[-1])
                                                max_idx = max(max_idx, idx)
                                            except:
                                                pass
                                    if max_idx >= 0:
                                        question_count = max_idx + 1
                        
                        # Get all players' progress (based on correct answers)
                        phase_state = phase_manager.get_phase_state(match_id, phase)
                        player_progress = {}
                        
                        # Get correct answer counts from technical_theory_scores
                        db_refresh = SessionLocal()
                        try:
                            match_record_progress = db_refresh.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                            if match_record_progress:
                                game_state_progress = match_record_progress.game_state or {}
                                if isinstance(game_state_progress, dict):
                                    technical_theory_scores = game_state_progress.get("technical_theory_scores", {})
                                    
                                    for p in lobby.players:
                                        if isinstance(p, dict):
                                            p_id = p.get("id") or p.get("player_id") or str(p)
                                        else:
                                            p_id = str(p)
                                        
                                        player_submissions = phase_state.player_submissions.get(p_id, set())
                                        submission_count = len(player_submissions)
                                        
                                        # Count correct answers from scores
                                        player_scores = technical_theory_scores.get(p_id, {})
                                        correct_count = 0
                                        if isinstance(player_scores, dict):
                                            for key, score_data in player_scores.items():
                                                if key != "_total" and isinstance(score_data, dict):
                                                    if score_data.get("is_correct", False):
                                                        correct_count += 1
                                        
                                        player_progress[p_id] = {
                                            "submitted": submission_count,
                                            "total": question_count,
                                            "correct": correct_count,
                                            "percentage": int((correct_count / question_count) * 100) if question_count > 0 else 0
                                        }
                        finally:
                            db_refresh.close()
                        
                        broadcast_data["player_progress"] = player_progress
                        broadcast_data["question_count"] = question_count
                    
                    await lobby_manager.broadcast_game_message(lobby_id, broadcast_data)
                    print(f"[SUBMIT] Broadcast player_submitted to all players for player {player_id}")
                elif message.get("type") == "technical_theory_finished":
                    # Player finished all technical theory questions (or died) - track and check completion
                    player_id = message.get("player_id")
                    is_dead = message.get("is_dead", False)  # Flag to indicate if player died
                    print(f"[TECHNICAL_THEORY] Player {player_id} finished all technical theory questions in lobby {lobby_id} (dead: {is_dead})")
                    
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
                            # If player is dead, mark them as dead in game state
                            if is_dead:
                                db_dead = SessionLocal()
                                try:
                                    match_record_dead = db_dead.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).with_for_update().first()
                                    if match_record_dead:
                                        game_state_dead = match_record_dead.game_state or {}
                                        if not isinstance(game_state_dead, dict):
                                            game_state_dead = {}
                                        
                                        # Track dead players
                                        if "technical_theory_dead_players" not in game_state_dead:
                                            game_state_dead["technical_theory_dead_players"] = []
                                        
                                        if player_id not in game_state_dead["technical_theory_dead_players"]:
                                            game_state_dead["technical_theory_dead_players"].append(player_id)
                                            print(f"[TECHNICAL_THEORY] Marked player {player_id} as DEAD")
                                        
                                        from sqlalchemy.orm.attributes import flag_modified
                                        match_record_dead.game_state = game_state_dead
                                        flag_modified(match_record_dead, "game_state")
                                        db_dead.commit()
                                finally:
                                    db_dead.close()
                            # Get question count from game_state with proper fallback
                            db_session = SessionLocal()
                            try:
                                match_record_check = db_session.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                                question_count = 10  # Default fallback
                                if match_record_check and match_record_check.game_state:
                                    game_state_check = match_record_check.game_state
                                    if isinstance(game_state_check, dict):
                                        phase_metadata = game_state_check.get("phase_metadata", {})
                                        if "technical_theory" in phase_metadata:
                                            question_count = phase_metadata["technical_theory"].get("question_count", 10)
                                            print(f"[TECHNICAL_THEORY] Found question_count in phase_metadata: {question_count}")
                                        else:
                                            print(f"[TECHNICAL_THEORY] WARNING: phase_metadata['technical_theory'] not found. Available keys: {list(phase_metadata.keys())}")
                                            # Try to count questions from cache as fallback
                                            questions_cache = game_state_check.get("questions", {})
                                            tech_questions = [k for k in questions_cache.keys() if k.startswith("technical_theory_")]
                                            if tech_questions:
                                                # Get max index + 1
                                                max_idx = -1
                                                for q_key in tech_questions:
                                                    try:
                                                        # Handle format: technical_theory_0, technical_theory_1, etc.
                                                        parts = q_key.split("_")
                                                        if len(parts) >= 3:
                                                            idx = int(parts[-1])
                                                            max_idx = max(max_idx, idx)
                                                    except:
                                                        pass
                                                if max_idx >= 0:
                                                    question_count = max_idx + 1
                                                    print(f"[TECHNICAL_THEORY] Calculated question_count from cache: {question_count}")
                                else:
                                    print(f"[TECHNICAL_THEORY] WARNING: match_record_check or game_state not found")
                            finally:
                                db_session.close()
                            
                            print(f"[TECHNICAL_THEORY] Using question_count: {question_count}")
                            
                            # Get phase state and check all players
                            phase_state = phase_manager.get_phase_state(match_id, "technical_theory")
                            total_players = len(lobby.players)
                            
                            # Get dead players from game state
                            db_dead_check = SessionLocal()
                            dead_players_set = set()
                            try:
                                match_record_dead = db_dead_check.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
                                if match_record_dead:
                                    game_state_dead = match_record_dead.game_state or {}
                                    if isinstance(game_state_dead, dict):
                                        dead_players_set = set(game_state_dead.get("technical_theory_dead_players", []))
                            finally:
                                db_dead_check.close()
                            
                            # Calculate finished players - check all players in the lobby
                            finished_players = []
                            for p in lobby.players:
                                # Handle both dict format {"id": "..."} and direct string format
                                if isinstance(p, dict):
                                    p_id = p.get("id") or p.get("player_id") or str(p)
                                else:
                                    p_id = str(p)
                                
                                # Check if player is dead
                                if p_id in dead_players_set:
                                    finished_players.append(p_id)
                                    print(f"[TECHNICAL_THEORY] Player {p_id} finished (DEAD)")
                                else:
                                    # Check if player submitted all questions
                                    player_submissions = phase_state.player_submissions.get(p_id, set())
                                    submission_count = len(player_submissions)
                                    if submission_count >= question_count:
                                        finished_players.append(p_id)
                                        print(f"[TECHNICAL_THEORY] Player {p_id} finished ({submission_count}/{question_count})")
                                    else:
                                        print(f"[TECHNICAL_THEORY] Player {p_id} not finished yet ({submission_count}/{question_count})")
                            
                            print(f"[TECHNICAL_THEORY] Player {player_id} sent finished message. Finished players: {len(finished_players)}/{total_players}")
                            print(f"[TECHNICAL_THEORY] Player {player_id} submissions: {len(phase_state.player_submissions.get(player_id, set()))}/{question_count}")
                            
                            # Always broadcast the current finished status, even if this player isn't counted yet
                            # This ensures all clients get updated counts
                            await lobby_manager.broadcast_game_message(
                                lobby_id,
                                {
                                    "type": "player_finished_technical_theory",
                                    "player_id": player_id,
                                    "total_finished": len(finished_players),
                                    "total_players": total_players
                                }
                            )
                            
                            # Check if all players finished
                            if len(finished_players) >= total_players:
                                print(f"[TECHNICAL_THEORY] All players finished! Getting pre-calculated scores.")
                                
                                # Get pre-calculated scores (scored incrementally as answers were submitted)
                                try:
                                    from game.technical_theory_scoring import get_technical_theory_total_score
                                    player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                    scores = {}
                                    for pid in player_ids:
                                        score = await get_technical_theory_total_score(match_id, pid)
                                        scores[pid] = score
                                        print(f"[TECHNICAL_THEORY] Player {pid} total score: {score}")
                                    
                                    # Store scores in database for consistency
                                    await calculate_and_store_scores(match_id, "technical_theory", player_ids)
                                    print(f"[TECHNICAL_THEORY] Scores retrieved: {scores}")
                                except Exception as e:
                                    print(f"[TECHNICAL_THEORY] Error getting scores: {e}")
                                    import traceback
                                    traceback.print_exc()
                                    # Fallback: use RNG scores
                                    import random
                                    player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                    scores = {pid: random.randint(50, 100) for pid in player_ids}
                                
                                # Broadcast scores and phase completion
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "scores_ready",
                                        "phase": "technical_theory",
                                        "scores": scores,
                                        "serverTime": datetime.utcnow().timestamp() * 1000
                                    }
                                )
                                
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "show_results",
                                        "phase": "technical_theory",
                                        "reason": "phase_complete",
                                        "phaseComplete": True,
                                        "forceShow": True,
                                        "total_finished": len(finished_players),
                                        "total_players": total_players
                                    }
                                )
                            else:
                                # Not all players finished yet - broadcast updated count anyway
                                # This ensures the waiting screen shows correct progress
                                print(f"[TECHNICAL_THEORY] Not all players finished yet ({len(finished_players)}/{total_players}), but broadcasting update")
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
                            # Initialize tracking structures
                            if lobby_id not in scores_calculating:
                                scores_calculating[lobby_id] = {}
                            if lobby_id not in calculated_scores_cache:
                                calculated_scores_cache[lobby_id] = {}
                            
                            # Check if scores are already being calculated or already calculated
                            if scores_calculating[lobby_id].get(phase, False):
                                print(f"[SCORES] Scores already being calculated for {phase}, waiting...")
                                # Scores are being calculated, use cached result if available
                                if phase in calculated_scores_cache[lobby_id]:
                                    cached = calculated_scores_cache[lobby_id][phase]
                                    print(f"[SCORES] Using cached scores for {phase}")
                                    await lobby_manager.broadcast_game_message(
                                        lobby_id,
                                        {
                                            "type": "scores_ready",
                                            "phase": phase,
                                            "scores": cached["scores"],
                                            "phase_scores": cached["phase_scores"],
                                            "previous_scores": cached["previous_scores"],
                                            "serverTime": cached["timestamp"],
                                            "synchronized": True
                                        }
                                    )
                                return
                            
                            # Check if scores already calculated and cached
                            if phase in calculated_scores_cache[lobby_id]:
                                cached = calculated_scores_cache[lobby_id][phase]
                                print(f"[SCORES] Scores already calculated for {phase}, broadcasting cached scores")
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "scores_ready",
                                        "phase": phase,
                                        "scores": cached["scores"],
                                        "phase_scores": cached["phase_scores"],
                                        "previous_scores": cached["previous_scores"],
                                        "serverTime": cached["timestamp"],
                                        "synchronized": True
                                    }
                                )
                                return
                            
                            # Mark as calculating to prevent duplicate calculations
                            scores_calculating[lobby_id][phase] = True
                            
                            try:
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
                                            # Get previous scores from phase metadata if available
                                            previous_scores = game_state.get("previous_scores", {})
                                            if not isinstance(previous_scores, dict):
                                                previous_scores = {}
                                            print(f"[SCORES] Using existing cumulative scores for {phase}: {scores}")
                                        else:
                                            # Calculate new scores (this uses database locking to prevent race conditions)
                                            print(f"[SCORES] Calculating new scores for {phase}")
                                            
                                            # Calculate scores using standard scoring (or LLM judge for behavioural)
                                            scores, previous_scores = await calculate_and_store_scores(match_id, phase, player_ids)
                                    else:
                                        # No game state yet, calculate scores
                                        print(f"[SCORES] No game state found, calculating new scores for {phase}")
                                        scores, previous_scores = await calculate_and_store_scores(match_id, phase, player_ids)
                                finally:
                                    db_session.close()
                                
                                # Ensure all players have scores (even if 0)
                                final_scores = {}
                                final_previous_scores = {}
                                for pid in player_ids:
                                    final_scores[pid] = scores.get(pid, 0) if isinstance(scores, dict) else 0
                                    final_previous_scores[pid] = previous_scores.get(pid, 0) if isinstance(previous_scores, dict) else 0
                                
                                # Get phase-specific scores from database for round display
                                phase_scores_for_round = {}
                                db_phase = SessionLocal()
                                try:
                                    match_record_phase = db_phase.query(OngoingMatch).filter(
                                        OngoingMatch.match_id == match_id
                                    ).first()
                                    if match_record_phase and match_record_phase.game_state:
                                        game_state_phase = match_record_phase.game_state
                                        if isinstance(game_state_phase, dict):
                                            phase_scores_data = game_state_phase.get(phase_scores_key, {})
                                            if isinstance(phase_scores_data, dict):
                                                for pid in player_ids:
                                                    phase_scores_for_round[pid] = phase_scores_data.get(pid, 0)
                                finally:
                                    db_phase.close()
                                
                                # Store in cache
                                timestamp = datetime.utcnow().timestamp() * 1000
                                calculated_scores_cache[lobby_id][phase] = {
                                    "scores": final_scores,
                                    "phase_scores": phase_scores_for_round,
                                    "previous_scores": final_previous_scores,
                                    "timestamp": timestamp
                                }
                                
                                # First, send a "prepare_for_scores" message to synchronize all clients
                                print(f"[SCORES] Sending prepare_for_scores to synchronize all clients")
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "prepare_for_scores",
                                        "phase": phase,
                                        "serverTime": timestamp
                                    }
                                )
                                
                                # Small delay to ensure all clients receive prepare message
                                await asyncio.sleep(0.1)
                                
                                # Now broadcast scores to ALL players simultaneously
                                # Include synchronized flag to indicate all clients should display together
                                print(f"[SCORES] Broadcasting synchronized scores to all players")
                                await lobby_manager.broadcast_game_message(
                                    lobby_id,
                                    {
                                        "type": "scores_ready",
                                        "phase": phase,
                                        "scores": final_scores,  # Cumulative scores
                                        "phase_scores": phase_scores_for_round,  # Round-specific scores from DB
                                        "previous_scores": final_previous_scores,
                                        "serverTime": timestamp,
                                        "synchronized": True  # Flag indicating synchronized broadcast
                                    }
                                )
                                print(f"[SCORES] Broadcast cumulative scores to all players: {final_scores}")
                            finally:
                                # Mark as no longer calculating
                                scores_calculating[lobby_id][phase] = False
                elif message.get("type") == "ready_for_scores":
                    # Player is ready to receive scores - track readiness and send scores when all ready
                    player_id = message.get("player_id")
                    phase = message.get("phase", "unknown")
                    print(f"[SCORES_READY] Player {player_id} ready for scores in lobby {lobby_id} (phase: {phase})")
                    
                    # Initialize tracking for this lobby/phase if needed
                    if lobby_id not in ready_players_tracker:
                        ready_players_tracker[lobby_id] = {}
                    if phase not in ready_players_tracker[lobby_id]:
                        ready_players_tracker[lobby_id][phase] = set()
                    
                    # Add player to ready set
                    ready_players_tracker[lobby_id][phase].add(player_id)
                    
                    # Get lobby and check if all players are ready
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        total_players = len(lobby.players)
                        ready_count = len(ready_players_tracker[lobby_id][phase])
                        
                        print(f"[SCORES_READY] {ready_count}/{total_players} players ready for scores (phase: {phase})")
                        
                        # Broadcast player ready status to all connections
                        await lobby_manager.broadcast_game_message(
                            lobby_id,
                            {
                                "type": "player_ready_for_scores",
                                "player_id": player_id,
                                "ready_count": ready_count,
                                "total_players": total_players,
                                "phase": phase
                            }
                        )
                        
                        # If all players are ready, trigger score calculation and broadcast
                        if ready_count >= total_players:
                            print(f"[SCORES_READY] All players ready for scores (phase: {phase}), calculating and broadcasting...")
                            
                            # Get match_id for score calculation
                            match_id = None
                            if lobby.match:
                                match_id = lobby.match.match_id
                            else:
                                match_record = get_match_by_lobby_id(lobby_id)
                                if match_record:
                                    match_id = match_record.match_id
                            
                            if match_id:
                                # Check if we're already calculating scores for this phase
                                if lobby_id not in scores_calculating:
                                    scores_calculating[lobby_id] = {}
                                if scores_calculating[lobby_id].get(phase, False):
                                    print(f"[SCORES_READY] Scores already being calculated for {phase}, skipping")
                                else:
                                    scores_calculating[lobby_id][phase] = True
                                    
                                    try:
                                        # Calculate scores for this phase
                                        player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                        
                                        # Calculate phase scores
                                        scores = await calculate_and_store_scores(match_id, phase, player_ids)
                                        
                                        # Get previous cumulative scores
                                        db = SessionLocal()
                                        try:
                                            match_record = db.query(OngoingMatch).filter(
                                                OngoingMatch.match_id == match_id
                                            ).first()
                                            previous_scores = {}
                                            if match_record and match_record.game_state:
                                                game_state = match_record.game_state
                                                if isinstance(game_state, dict):
                                                    cumulative_scores = game_state.get("cumulative_scores", {})
                                                    if isinstance(cumulative_scores, dict):
                                                        previous_scores = cumulative_scores
                                        finally:
                                            db.close()
                                        
                                        # Calculate final cumulative scores
                                        final_scores = {}
                                        final_previous_scores = {}
                                        for pid in player_ids:
                                            phase_score = scores.get(pid, 0)
                                            prev_score = previous_scores.get(pid, 0) if isinstance(previous_scores, dict) else 0
                                            final_scores[pid] = prev_score + phase_score
                                            final_previous_scores[pid] = prev_score
                                        
                                        # Get phase-specific scores from database
                                        phase_scores_for_round = {}
                                        db_phase = SessionLocal()
                                        try:
                                            match_record_phase = db_phase.query(OngoingMatch).filter(
                                                OngoingMatch.match_id == match_id
                                            ).first()
                                            if match_record_phase and match_record_phase.game_state:
                                                game_state_phase = match_record_phase.game_state
                                                if isinstance(game_state_phase, dict):
                                                    phase_scores_key = f"{phase}_scores"
                                                    phase_scores_data = game_state_phase.get(phase_scores_key, {})
                                                    if isinstance(phase_scores_data, dict):
                                                        for pid in player_ids:
                                                            phase_scores_for_round[pid] = phase_scores_data.get(pid, 0)
                                        finally:
                                            db_phase.close()
                                        
                                        # Store in cache
                                        timestamp = datetime.utcnow().timestamp() * 1000
                                        if lobby_id not in calculated_scores_cache:
                                            calculated_scores_cache[lobby_id] = {}
                                        calculated_scores_cache[lobby_id][phase] = {
                                            "scores": final_scores,
                                            "phase_scores": phase_scores_for_round,
                                            "previous_scores": final_previous_scores,
                                            "timestamp": timestamp
                                        }
                                        
                                        # Send prepare message first to synchronize all clients
                                        print(f"[SCORES_READY] Sending prepare_for_scores to synchronize all clients")
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "prepare_for_scores",
                                                "phase": phase,
                                                "serverTime": timestamp
                                            }
                                        )
                                        
                                        # Small delay to ensure all clients receive prepare message
                                        await asyncio.sleep(0.1)
                                        
                                        # Broadcast synchronized scores to all players
                                        print(f"[SCORES_READY] Broadcasting synchronized scores to all players")
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "scores_ready",
                                                "phase": phase,
                                                "scores": final_scores,
                                                "phase_scores": phase_scores_for_round,
                                                "previous_scores": final_previous_scores,
                                                "serverTime": timestamp,
                                                "synchronized": True
                                            }
                                        )
                                        
                                        # Clear ready tracker for this phase after broadcasting
                                        ready_players_tracker[lobby_id][phase] = set()
                                        print(f"[SCORES_READY] Scores broadcast complete, cleared ready tracker for {phase}")
                                    except Exception as e:
                                        print(f"[SCORES_READY] Error calculating/broadcasting scores: {e}")
                                        import traceback
                                        traceback.print_exc()
                                    finally:
                                        scores_calculating[lobby_id][phase] = False
                            else:
                                print(f"[SCORES_READY] No match_id found for lobby {lobby_id}, cannot calculate scores")
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
                    # Player clicked skip on behavioural question - require all players to confirm
                    player_id = message.get("player_id")
                    phase = message.get("phase", "behavioural")
                    print(f"[SKIP] Player {player_id} confirmed skip for behavioural question in lobby {lobby_id}")
                    
                    lobby = lobby_manager.get_lobby(lobby_id)
                    if lobby:
                        # Initialize skip confirmation tracker for this lobby/phase
                        if lobby_id not in skip_confirmation_tracker:
                            skip_confirmation_tracker[lobby_id] = {}
                        if phase not in skip_confirmation_tracker[lobby_id]:
                            skip_confirmation_tracker[lobby_id][phase] = set()
                        
                        # Add player to skip confirmations
                        skip_confirmation_tracker[lobby_id][phase].add(player_id)
                        
                        total_players = len(lobby.players)
                        confirmed_count = len(skip_confirmation_tracker[lobby_id][phase])
                        
                        print(f"[SKIP] Skip confirmations: {confirmed_count}/{total_players} players")
                        
                        # Broadcast skip confirmation status to all players
                        await lobby_manager.broadcast_game_message(
                            lobby_id,
                            {
                                "type": "behavioural_question_skip_confirmed",
                                "player_id": player_id,
                                "confirmed_count": confirmed_count,
                                "total_players": total_players
                            }
                        )
                        
                        # Only skip if ALL players have confirmed
                        if confirmed_count >= total_players:
                            print(f"[SKIP] All {total_players} players confirmed skip - proceeding with skip")
                            
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
                                    "skipped_by": "all_players",
                                    "skipped_at": datetime.utcnow().isoformat(),
                                    "question_index": 0  # First question
                                })
                                
                                # Record skip as submission for phase manager (so phase can complete)
                                # This allows phase to advance even if players skip
                                for p_id in lobby.players:
                                    phase_manager.record_submission(match_id, phase, p_id.get("id") if isinstance(p_id, dict) else p_id, 0)
                            
                            # Broadcast skip to ALL players - they navigate together
                            await lobby_manager.broadcast_game_message(
                                lobby_id,
                                {
                                    "type": "behavioural_question_skipped",
                                    "skipped_by": "all_players"
                                }
                            )
                            
                            # Clear skip confirmations after skip
                            skip_confirmation_tracker[lobby_id][phase] = set()
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
                                        # For technical_theory, skip generic handler - let technical_theory handler process it
                                        # This ensures technical_theory gets proper answer fields and broadcasts all questions
                                        if phase == "technical_theory":
                                            print(f"[QUESTION] Cached technical_theory question found, skipping generic handler to use technical_theory-specific handler")
                                            # Don't continue here - let it fall through to technical_theory handler
                                        else:
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
                                    
                                    # For technical_theory, handle question requests
                                    if phase == "technical_theory":
                                        # Check if questions are already cached
                                        game_state_check = match_record.game_state or {}
                                        questions_cache_check = game_state_check.get("questions", {})
                                        
                                        # Find how many questions are cached (check up to 10)
                                        cached_count = 0
                                        for i in range(10):
                                            if f"{phase}_{i}" in questions_cache_check:
                                                cached_count += 1
                                            else:
                                                break  # Stop at first missing question
                                        
                                        # If we have cached questions, return the requested one
                                        if cached_count > 0:
                                            cached_question = questions_cache_check.get(f"{phase}_{question_index}")
                                            if cached_question:
                                                print(f"[QUESTION] Returning cached technical theory question {question_index}")
                                                
                                                # If this is question_index 0, also broadcast all questions loaded
                                                # This ensures late-joining clients get all questions at once
                                                if question_index == 0:
                                                    print(f"[QUESTION] Question index 0 requested with cached questions, broadcasting all {cached_count} questions")
                                                    
                                                    # Collect all cached questions
                                                    broadcast_questions = []
                                                    for i in range(cached_count):
                                                        cached_q = questions_cache_check.get(f"{phase}_{i}")
                                                        if cached_q:
                                                            broadcast_questions.append({
                                                                "question": cached_q.get("question"),
                                                                "question_id": cached_q.get("question_id"),
                                                                "correct_answer": cached_q.get("correct_answer"),
                                                                "incorrect_answers": cached_q.get("incorrect_answers"),
                                                                "question_index": cached_q.get("question_index", i),
                                                                "role": cached_q.get("role"),
                                                                "level": cached_q.get("level"),
                                                                "shuffled_answers": cached_q.get("shuffled_answers"),
                                                                "option_mapping": cached_q.get("option_mapping"),
                                                                "correct_option_id": cached_q.get("correct_option_id")
                                                            })
                                                    
                                                    # Broadcast all questions loaded message
                                                    await lobby_manager.broadcast_game_message(
                                                        lobby_id,
                                                        {
                                                            "type": "technical_theory_questions_loaded",
                                                            "phase": phase,
                                                            "question_count": cached_count,
                                                            "questions": broadcast_questions
                                                        }
                                                    )
                                                else:
                                                    # For non-zero indices, just send the individual question
                                                    await lobby_manager.broadcast_game_message(
                                                        lobby_id,
                                                        {
                                                            "type": "question_received",
                                                            "phase": phase,
                                                            "question_index": question_index,
                                                            "question": cached_question.get("question"),
                                                            "question_id": cached_question.get("question_id"),
                                                            "correct_answer": cached_question.get("correct_answer"),
                                                            "incorrect_answers": cached_question.get("incorrect_answers"),
                                                            "role": cached_question.get("role"),
                                                            "level": cached_question.get("level"),
                                                            "shuffled_answers": cached_question.get("shuffled_answers"),
                                                            "option_mapping": cached_question.get("option_mapping"),
                                                            "correct_option_id": cached_question.get("correct_option_id")
                                                        }
                                                    )
                                                continue
                                            else:
                                                print(f"[QUESTION] ERROR: Question {question_index} not found in cache")
                                                await safe_send_json(websocket, {
                                                    "type": "question_error",
                                                    "phase": phase,
                                                    "message": f"Question {question_index} not found"
                                                })
                                                continue
                                        
                                        # If this is the first request (index 0), fetch maximum available questions (up to 10)
                                        if question_index == 0:
                                            print(f"[QUESTION] Technical theory phase - fetching maximum available questions (up to 10)")
                                        
                                        # Fetch maximum available questions (up to 10) using deterministic seed (match_id)
                                        role = match_config.get("role", "").lower().strip()
                                        level = match_config.get("level", "").lower().strip().replace("-", "").replace("_", "").replace(" ", "")
                                        
                                        all_questions = question_manager.get_technical_theory_questions(
                                            role=role,
                                            level=level,
                                            count=10,  # Request up to 10, but will return whatever is available
                                            seed=match_id  # Use match_id as seed for deterministic selection
                                        )
                                        
                                        if not all_questions or len(all_questions) == 0:
                                            print(f"[QUESTION] ERROR: Failed to fetch any technical theory questions")
                                            await safe_send_json(websocket, {
                                                "type": "question_error",
                                                "phase": phase,
                                                "message": "Failed to load questions. Please try again."
                                            })
                                            continue
                                        
                                        question_count = len(all_questions)
                                        print(f"[QUESTION] Fetched {question_count} technical theory questions (requested up to 10), storing in cache")
                                        
                                        # Store all questions in game_state with deterministic option mapping
                                        import random
                                        import hashlib
                                        for q_data in all_questions:
                                            q_data["generated_at"] = datetime.utcnow().isoformat()
                                            q_idx = q_data.get("question_index", 0)
                                            
                                            # Create deterministic shuffle for answer options (same for all clients)
                                            # Use match_id + question_index as seed
                                            shuffle_seed = f"{match_id}_{q_idx}"
                                            seed_hash = int(hashlib.md5(shuffle_seed.encode()).hexdigest()[:8], 16)
                                            rng = random.Random(seed_hash)
                                            
                                            # Shuffle answers deterministically
                                            correct_answer = q_data.get("correct_answer", "")
                                            incorrect_answers = q_data.get("incorrect_answers", [])
                                            all_answers = [correct_answer] + incorrect_answers
                                            shuffled_answers = all_answers.copy()
                                            rng.shuffle(shuffled_answers)
                                            
                                            # Create option mapping: A=0, B=1, C=2, D=3
                                            option_mapping = {}
                                            for idx, ans in enumerate(shuffled_answers):
                                                option_id = chr(65 + idx)  # A, B, C, D
                                                option_mapping[option_id] = ans
                                            
                                            # Find which option ID corresponds to the correct answer
                                            correct_option_id = None
                                            for opt_id, ans_text in option_mapping.items():
                                                if ans_text == correct_answer:
                                                    correct_option_id = opt_id
                                                    break
                                            
                                            # Store option mapping and shuffled answers in question data
                                            q_data["option_mapping"] = option_mapping
                                            q_data["shuffled_answers"] = shuffled_answers
                                            q_data["correct_option_id"] = correct_option_id
                                            
                                            question_stored = store_question(
                                                match_id=match_id,
                                                phase=phase,
                                                question_index=q_idx,
                                                question_data=q_data,
                                                is_followup=False,
                                                parent_question_index=None,
                                                player_id=None  # Shared questions
                                            )
                                            
                                            if question_stored:
                                                print(f"[QUESTION] ✓ Stored technical theory question {q_idx}")
                                            else:
                                                print(f"[QUESTION] ✗ WARNING: Failed to store question {q_idx}")
                                        
                                        # Initialize answer tracking for all players for all technical theory questions
                                        # Track all questions even if not attempted (for stats later)
                                        db.refresh(match_record)
                                        game_state_for_count = match_record.game_state or {}
                                        if not isinstance(game_state_for_count, dict):
                                            game_state_for_count = {}
                                        
                                        # Initialize answer_tracking structure for technical_theory
                                        if "answer_tracking" not in game_state_for_count:
                                            game_state_for_count["answer_tracking"] = {}
                                        if "technical_theory" not in game_state_for_count["answer_tracking"]:
                                            game_state_for_count["answer_tracking"]["technical_theory"] = {}
                                        
                                        # Get all player IDs
                                        player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
                                        
                                        # Initialize tracking for all players for all questions
                                        for pid in player_ids:
                                            if pid not in game_state_for_count["answer_tracking"]["technical_theory"]:
                                                game_state_for_count["answer_tracking"]["technical_theory"][pid] = {}
                                            
                                            # Initialize all questions as not attempted
                                            for q_idx in range(len(all_questions)):
                                                q_idx_str = str(q_idx)
                                                if q_idx_str not in game_state_for_count["answer_tracking"]["technical_theory"][pid]:
                                                    game_state_for_count["answer_tracking"]["technical_theory"][pid][q_idx_str] = {
                                                        "attempted": False,
                                                        "answer": None,
                                                        "answer_text": None,
                                                        "correct_answer": all_questions[q_idx].get("correct_answer") if q_idx < len(all_questions) else None,
                                                        "is_correct": None,
                                                        "feedback": None
                                                    }
                                        
                                        # Store updated game_state
                                        import copy
                                        from sqlalchemy.orm.attributes import flag_modified
                                        match_record.game_state = copy.deepcopy(game_state_for_count)
                                        flag_modified(match_record, "game_state")
                                        db.commit()
                                        print(f"[QUESTION] Initialized answer tracking for {len(player_ids)} players across {len(all_questions)} technical theory questions")
                                        
                                        # Store question count in game_state for phase completion checks
                                        db.refresh(match_record)
                                        game_state_for_count = match_record.game_state or {}
                                        if not isinstance(game_state_for_count, dict):
                                            game_state_for_count = {}
                                        
                                        if "phase_metadata" not in game_state_for_count:
                                            game_state_for_count["phase_metadata"] = {}
                                        if phase not in game_state_for_count["phase_metadata"]:
                                            game_state_for_count["phase_metadata"][phase] = {}
                                        
                                        game_state_for_count["phase_metadata"][phase]["question_count"] = question_count
                                        match_record.game_state = game_state_for_count
                                        db.commit()
                                        
                                        print(f"[QUESTION] Stored question_count={question_count} in phase_metadata['{phase}']")
                                        print(f"[QUESTION] Verifying storage - phase_metadata keys: {list(game_state_for_count.get('phase_metadata', {}).keys())}")
                                        if phase in game_state_for_count.get("phase_metadata", {}):
                                            print(f"[QUESTION] Verified: phase_metadata['{phase}']['question_count'] = {game_state_for_count['phase_metadata'][phase].get('question_count')}")
                                        
                                        # Refresh to get latest state
                                        db.refresh(match_record)
                                        
                                        # Broadcast ALL questions to ALL clients immediately
                                        # This ensures all clients see the same questions at the same time
                                        # Include shuffled answers and option mapping so frontend uses deterministic order
                                        print(f"[QUESTION] Broadcasting all {question_count} questions to all clients")
                                        
                                        # Prepare questions for broadcast with shuffled answers
                                        broadcast_questions = []
                                        for q_data in all_questions:
                                            broadcast_q = {
                                                "question": q_data.get("question"),
                                                "question_id": q_data.get("question_id"),
                                                "correct_answer": q_data.get("correct_answer"),
                                                "incorrect_answers": q_data.get("incorrect_answers"),
                                                "question_index": q_data.get("question_index"),
                                                "role": q_data.get("role"),
                                                "level": q_data.get("level"),
                                                # Include shuffled answers and option mapping for frontend
                                                "shuffled_answers": q_data.get("shuffled_answers"),
                                                "option_mapping": q_data.get("option_mapping"),
                                                "correct_option_id": q_data.get("correct_option_id")
                                            }
                                            broadcast_questions.append(broadcast_q)
                                        
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            {
                                                "type": "technical_theory_questions_loaded",
                                                "phase": phase,
                                                "question_count": question_count,
                                                "questions": broadcast_questions  # Send full question objects with shuffled_answers and option_mapping
                                            }
                                        )
                                        continue
                                    
                                    # For non-Q1 questions (Q0, technical, etc.), select from database
                                    print(f"[QUESTION] Calling question_manager.get_question_for_phase for {phase} (index={question_index})")
                                    print(f"[QUESTION] Match type: {match_type}, Match config: {match_config}")
                                    question_data = question_manager.get_question_for_phase(
                                        match_type=match_type,
                                        phase=phase,
                                        match_config=match_config,
                                        question_index=question_index,
                                    )

                                    print(f"[QUESTION] Question manager returned: {question_data is not None}")

                                    # If no question found (e.g., custom role with empty pools), try to generate via LLM once.
                                    # If that fails (e.g., no API key / 401), fall back to a generic seeded role so the game stays playable.
                                    if not question_data and match_type == "generalized":
                                        role = match_config.get("role")
                                        level = match_config.get("level")
                                        # Only generate for custom roles - default roles should have questions
                                        role_normalized = (role or "").lower().strip()
                                        is_custom_role = role_normalized not in DEFAULT_ROLES
                                        
                                        if is_custom_role:
                                            print(f"[QUESTION] No question for custom role={role}, level={level} - attempting LLM-backed generation")
                                            try:
                                                await ensure_questions_for_role_level(role, level)
                                                # Retry after generation
                                                question_data = question_manager.get_question_for_phase(
                                                    match_type=match_type,
                                                    phase=phase,
                                                    match_config=match_config,
                                                    question_index=question_index,
                                                )
                                                print(f"[QUESTION] After LLM generation, question manager returned: {question_data is not None}")
                                            except Exception as e:
                                                print(f"[QUESTION] Error during ensure_questions_for_role_level: {e}")
                                        else:
                                            # Default role missing questions - this shouldn't happen, but log a warning
                                            print(f"[QUESTION] WARNING: Default role '{role}' missing questions for level={level}, phase={phase}. This should not happen - questions should be pre-seeded.")

                                        # Still no question? Fall back to a generic built-in role so the game doesn't hang.
                                        if not question_data:
                                            fallback_role = "software engineering"
                                            fallback_config = dict(match_config)
                                            fallback_config["role"] = fallback_role
                                            print(
                                                f"[QUESTION] Falling back to seeded role='{fallback_role}' for level={level} "
                                                f"for phase={phase}, question_index={question_index}"
                                            )
                                            question_data = question_manager.get_question_for_phase(
                                                match_type=match_type,
                                                phase=phase,
                                                match_config=fallback_config,
                                                question_index=question_index,
                                            )
                                            print(f"[QUESTION] After fallback, question manager returned: {question_data is not None}")

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
                                        broadcast_data = {
                                            "type": "question_received",
                                            "phase": phase,
                                            "question_index": question_index,
                                            "question": question_data.get("question"),
                                            "question_id": question_data.get("question_id"),
                                            "role": question_data.get("role"),
                                            "level": question_data.get("level")
                                        }
                                        
                                        # Add correct_answer and incorrect_answers for technical_theory
                                        if phase == "technical_theory":
                                            broadcast_data["correct_answer"] = question_data.get("correct_answer")
                                            broadcast_data["incorrect_answers"] = question_data.get("incorrect_answers")
                                        
                                        await lobby_manager.broadcast_game_message(
                                            lobby_id,
                                            broadcast_data
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
        print(f"WebSocket disconnected normally for lobby {lobby_id}")
    except Exception as e:
        print(f"WebSocket error in lobby {lobby_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Always remove connection on exit
        lobby_manager.remove_connection(lobby_id, websocket)
        
        # Clean up readiness trackers for disconnected player
        # Get player_id from lobby if possible
        lobby = lobby_manager.get_lobby(lobby_id)
        if lobby:
            # Find which player disconnected by checking connections
            # Note: This is approximate - we clean up all phases for safety
            if lobby_id in ready_players_tracker:
                for phase in list(ready_players_tracker[lobby_id].keys()):
                    # Reset tracker for this phase (players will re-send ready_for_scores on reconnect)
                    ready_players_tracker[lobby_id][phase] = set()
                    print(f"[CLEANUP] Cleared ready_players_tracker for lobby {lobby_id}, phase {phase}")
            
            if lobby_id in ready_to_continue_tracker:
                for phase in list(ready_to_continue_tracker[lobby_id].keys()):
                    # Reset tracker for this phase
                    ready_to_continue_tracker[lobby_id][phase] = set()
                    print(f"[CLEANUP] Cleared ready_to_continue_tracker for lobby {lobby_id}, phase {phase}")
        
        # Broadcast updated state after disconnection
        try:
            await lobby_manager.broadcast_lobby_update(lobby_id)
        except Exception as e:
            print(f"Error broadcasting lobby update after disconnect: {e}")


class CodeRunRequest(BaseModel):
    language: str
    code: str


@router.post("/api/run")
async def run_code(request: CodeRunRequest):
    """
    Execute code in a secure Docker sandbox
    Supports: Python, Java, C, C++, Bash, TypeScript, SQL, and more
    """
    try:
        print(f"[Code Runner] Received request: language={request.language}, code_length={len(request.code)}")
        result = await execute_code(request.language, request.code)
        print(f"[Code Runner] Execution result: exit_code={result.get('exit_code')}, has_stdout={bool(result.get('stdout'))}, has_stderr={bool(result.get('stderr'))}")
        return {
            "success": result.get('exit_code', 1) == 0,
            "stdout": result.get('stdout', ''),
            "stderr": result.get('stderr', ''),
            "exit_code": result.get('exit_code', 1),
            "execution_time": result.get('execution_time', 0),
            "error": result.get('error')
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Code Runner] Error: {str(e)}\n{error_trace}")
        return {
            "success": False,
            "stdout": "",
            "stderr": f"Server error: {str(e)}",
            "exit_code": 1,
            "execution_time": 0,
            "error": str(e)
        }


@router.get("/api/match/{match_id}/rankings")
async def get_match_rankings(match_id: str):
    """
    Get final rankings and scores for a completed match
    """
    db: Session = SessionLocal()
    try:
        match_record = db.query(OngoingMatch).filter(OngoingMatch.match_id == match_id).first()
        if not match_record:
            return {"error": "Match not found", "rankings": []}
        
        game_state = match_record.game_state
        if not game_state or not isinstance(game_state, dict):
            return {"error": "No game state found", "rankings": []}
        
        # Get final cumulative scores
        final_scores = game_state.get("scores", {})
        if not final_scores:
            return {"error": "No scores found", "rankings": []}
        
        # Get lobby_id from match record
        lobby_id = match_record.lobby_id if hasattr(match_record, 'lobby_id') else None
        
        # Get lobby to get player names
        lobby = None
        player_ids = list(final_scores.keys())
        if lobby_id:
            lobby = lobby_manager.get_lobby(lobby_id)
            if lobby and lobby.players:
                player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
        
        # Build rankings
        player_rankings = []
        for player_id in player_ids:
            player_score = final_scores.get(player_id, 0)
            # Get player name from lobby if available
            player_name = player_id
            if lobby and lobby.players:
                for p in lobby.players:
                    p_id = p.get("id") if isinstance(p, dict) else str(p)
                    if p_id == player_id:
                        player_name = p.get("name", player_id) if isinstance(p, dict) else str(p)
                        break
            
            player_rankings.append({
                "player_id": player_id,
                "name": player_name,
                "score": player_score
            })
        
        # Sort by score descending
        player_rankings.sort(key=lambda x: x["score"], reverse=True)
        
        # Assign ranks (handle ties)
        rankings = []
        current_rank = 1
        for idx, player in enumerate(player_rankings):
            if idx > 0 and player["score"] < player_rankings[idx - 1]["score"]:
                current_rank = idx + 1
            rankings.append({
                "player_id": player["player_id"],
                "name": player["name"],
                "score": player["score"],
                "rank": current_rank
            })
        
        print(f"[API] Returning rankings for match {match_id}: {rankings}")
        return {
            "match_id": match_id,
            "rankings": rankings,
            "final_scores": final_scores
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[API] Error getting rankings: {str(e)}\n{error_trace}")
        return {"error": str(e), "rankings": []}
    finally:
        db.close()


@router.get("/api/lobby/{lobby_id}/match-rankings")
async def get_lobby_match_rankings(lobby_id: str):
    """
    Get final rankings and scores for a lobby's match
    """
    db: Session = SessionLocal()
    try:
        match_record = get_match_by_lobby_id(lobby_id)
        if not match_record:
            return {"error": "Match not found for lobby", "rankings": []}
        
        match_id = match_record.match_id
        game_state = match_record.game_state
        if not game_state or not isinstance(game_state, dict):
            return {"error": "No game state found", "rankings": []}
        
        # Get final cumulative scores
        final_scores = game_state.get("scores", {})
        if not final_scores:
            return {"error": "No scores found", "rankings": []}
        
        # Get lobby to get player names
        lobby = lobby_manager.get_lobby(lobby_id)
        player_ids = []
        if lobby and lobby.players:
            player_ids = [p.get("id") if isinstance(p, dict) else str(p) for p in lobby.players]
        else:
            # Fallback: use player_ids from scores
            player_ids = list(final_scores.keys())
        
        # Build rankings
        player_rankings = []
        for player_id in player_ids:
            player_score = final_scores.get(player_id, 0)
            # Get player name from lobby if available
            player_name = player_id
            if lobby and lobby.players:
                for p in lobby.players:
                    p_id = p.get("id") if isinstance(p, dict) else str(p)
                    if p_id == player_id:
                        player_name = p.get("name", player_id) if isinstance(p, dict) else str(p)
                        break
            
            player_rankings.append({
                "player_id": player_id,
                "name": player_name,
                "score": player_score
            })
        
        # Sort by score descending
        player_rankings.sort(key=lambda x: x["score"], reverse=True)
        
        # Assign ranks (handle ties)
        rankings = []
        current_rank = 1
        for idx, player in enumerate(player_rankings):
            if idx > 0 and player["score"] < player_rankings[idx - 1]["score"]:
                current_rank = idx + 1
            rankings.append({
                "player_id": player["player_id"],
                "name": player["name"],
                "score": player["score"],
                "rank": current_rank
            })
        
        print(f"[API] Returning rankings for lobby {lobby_id}: {rankings}")
        return {
            "match_id": match_id,
            "rankings": rankings,
            "final_scores": final_scores
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[API] Error getting rankings: {str(e)}\n{error_trace}")
        return {"error": str(e), "rankings": []}
    finally:
        db.close()
