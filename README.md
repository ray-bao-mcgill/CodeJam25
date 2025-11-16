# CodeJam25 - Hire or Fire Interview Game

A competitive multiplayer interview game where players battle through behavioural questions, follow-ups, and technical challenges to prove their skills.

## Project Structure

```
CodeJam25/
├── frontend/          # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── onboarding/        # Landing, lobby creation/join
│   │   │   └── game-phase/        # Tutorial, rounds, scoring
│   │   ├── components/
│   │   ├── hooks/
│   │   └── styles/
│   └── package.json
├── backend/           # FastAPI + WebSocket
│   ├── app/
│   │   ├── llm/              # AI question generation
│   │   └── main.py
│   └── requirements.txt
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **npm** or **yarn**

### Installation

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend runs on `http://localhost:8000`

## Game Workflow

### User Journey

1. **Landing Page** (`/landing` or `/landing-v1`)

   - Purple "?" button (top-left): View tutorial in standalone mode
   - Blue "Start Game" button: Create a lobby

2. **Lobby Creation** (`/lobby-creation`)

   - Enter player name and job title
   - System generates unique lobby code
   - Navigate to waiting room

3. **Lobby Waiting Room** (`/lobby-waiting`)

   - Share lobby code with opponent
   - Second player joins via `/lobby-join/:lobbyId`
   - Host starts game when ready

4. **Tutorial** (`/tutorial`)

   - **In Lobby Context**: Auto-plays tutorial slides (5 steps), auto-advances every second, then navigates to Round Start Counter
   - **Standalone (from Landing)**: Manual navigation with "Next" and "Back to Main Menu" buttons

5. **Round Start Counter** (`/round-start-counter/:type`)

   - 60-second synchronized countdown
   - Displays round type (behavioural/technical)
   - Auto-navigates to first question

6. **Behavioural Round**

   - **Question Display** (`/behavioural-question`): 30s to read question, auto-navigates to answer phase
   - **Answer Phase** (`/behavioural-answer`): 60s to type answer
   - **Follow-up Question**: Cycle repeats with AI-generated follow-up
   - After both questions answered, navigate to `/current-score`

7. **Technical Round** (Planned)

   - Theory questions (`/technical-theory`)
   - Practical challenges (`/technical-practical`)

8. **Quick Fire Round** (`/quickfire-round`)

   - 10 rapid-fire questions
   - Speed and accuracy scoring

9. **Scoring & Results** (`/current-score`)

   - AI evaluates answers
   - Displays round scores
   - Transitions to next round or winner screen

10. **Winner Screen** (`/win-lose`)
    - Final scores
    - Declared winner

## Testing Guide

### Test 1: Standalone Tutorial (from Landing)

1. Navigate to `http://localhost:5173/landing-v1`
2. Click purple "?" button in top-left
3. **Expected**: Tutorial loads with manual "Next" and "Back to Main Menu" buttons
4. Click "Next" to advance through slides
5. Click "Back to Main Menu" to return to landing page
6. **Pass Criteria**: No auto-advance, no navigation to round start, can return to landing

### Test 2: Lobby Tutorial (In-Game Flow)

1. Navigate to `http://localhost:5173/landing-v1`
2. Click "Start Game" button
3. Enter player details, create lobby
4. Have second player join via lobby code
5. Host clicks "Start Game"
6. **Expected**: Tutorial auto-plays through 5 slides, advances every ~1 second
7. After final slide, auto-navigates to `/round-start-counter/behavioural`
8. **Pass Criteria**: Auto-advance works, navigates to round start, no manual controls visible

### Test 3: Behavioural Round Flow

1. Complete lobby setup and tutorial (Test 2)
2. Wait for 60s countdown on Round Start Counter
3. **Expected**: Auto-navigate to `/behavioural-question`
4. Question displays for 30s, then auto-navigates to `/behavioural-answer`
5. Type answer within 60s, click "Submit"
6. **Expected**: Shows "Waiting for other players..." if opponent hasn't submitted
7. Once both submit, navigate to follow-up question
8. After follow-up answered, navigate to `/current-score`
9. **Pass Criteria**: Timers sync, navigation works, wait states handled

### Test 4: WebSocket Synchronization

1. Open two browser windows
2. Create lobby in Window 1, join from Window 2
3. Start game from Window 1
4. **Expected**: Both windows show tutorial simultaneously
5. Tutorial advances in sync
6. Both navigate to round start at same time
7. **Pass Criteria**: All timers and transitions synchronized across clients

### Test 5: Landing Page Design

1. Navigate to `http://localhost:5173/landing-v1`
2. **Expected**:
   - Yellow sticky note with "HIRE OR FIRE" (green/orange letters)
   - Black "INTERVIEW BATTLE" subtitle
   - Blue "Start Game" button
   - Purple "?" tutorial button (80x80px square, giant "?")
   - No emojis visible
   - Thick black borders and hard shadows
3. **Pass Criteria**: Matches design spec, no layout issues on desktop/mobile

## Current Features

- ✅ Landing page redesign (LandingV1)
- ✅ Lobby creation and joining
- ✅ WebSocket real-time synchronization
- ✅ Tutorial (standalone + in-lobby modes)
- ✅ Round Start Counter with countdown
- ✅ Behavioural Question & Answer flow
- ✅ Question/Answer timer synchronization
- ✅ Follow-up question handling
- 🚧 Technical rounds (planned)
- 🚧 Quick Fire round (UI exists, integration pending)
- 🚧 AI scoring integration
- 🚧 Analytics dashboard

## Development Notes

### Styling System

All pages use a consistent design language:

- **Classes**: `game-bg`, `game-paper`, `game-title`, `game-label-text`, `game-sharp`, `game-shadow-hard-lg`, `game-block-blue/green/yellow`
- **Colors**: Green (#138a36), Orange (#ff6600), Blue (CSS var), Purple (#9966ff), Yellow (#ffe63b)
- **Borders**: Thick (6-10px), black (#000)
- **Shadows**: Hard drop shadows (8-12px offsets)

### State Management

- **useLobby**: Lobby ID, player ID, lobby details
- **useGameSync**: Game state, timers, submitted players, phase tracking
- **useGameFlow**: Submit answers, navigation helpers
- **useLobbyWebSocket**: Real-time updates, synchronization

### Routes

| Route                        | Component            | Purpose                  |
| ---------------------------- | -------------------- | ------------------------ |
| `/landing`                   | Landing              | Original landing page    |
| `/landing-v1`                | LandingV1            | Redesigned landing (new) |
| `/lobby-creation`            | LobbyCreation        | Create new lobby         |
| `/lobby-join/:lobbyId?`      | LobbyJoin            | Join existing lobby      |
| `/lobby-waiting`             | LobbyWaitingRoomPage | Pre-game waiting room    |
| `/tutorial`                  | Tutorial             | Game instructions        |
| `/round-start-counter/:type` | RoundStartCounter    | Countdown before rounds  |
| `/behavioural-question`      | BehaviouralQuestion  | Display question (30s)   |
| `/behavioural-answer`        | BehaviouralAnswer    | Answer input (60s)       |
| `/technical-theory`          | TechnicalTheory      | Theory questions         |
| `/technical-practical`       | TechnicalPractical   | Practical challenges     |
| `/quickfire-round`           | QuickFireRound       | Rapid-fire questions     |
| `/current-score`             | CurrentScore         | Round scoring            |
| `/win-lose`                  | WinLose              | Final results            |
| `/analytics`                 | Analytics            | Game analytics           |

## Known Issues

- Tutorial WebSocket messages may not be fully implemented on backend
- Technical rounds UI not yet implemented
- AI scoring integration pending
- Mobile responsiveness needs testing on all pages

## Contributing

1. Create feature branch from `main`
2. Make changes and test locally
3. Open PR with description of changes
4. Ensure no lint/compile errors before merging

## License

CodeJam25 - Internal Project
