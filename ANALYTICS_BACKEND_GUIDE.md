# Analytics Backend Integration Guide

## Overview

**Single-player personal recap** showing individual performance with AI feedback for each phase. Player competes against opponent but analytics only returns data for ONE player (the requesting player).

**Frontend Status:** ✅ Fully built and ready  
**Backend Task:** Implement `GET /api/lobby/{lobby_id}/history` endpoint

---

## CRITICAL: Game Structure

The game has **4 rounds** (NOT 5):

1. **Behavioural** - STAR method question
2. **Follow-up** - Follow-up to behavioural answer
3. **Rapid-fire** - Quick multiple choice questions
4. **Practical** - Coding challenge

**NOTE:** There is NO separate "technical theory" round. Rapid-fire covers theory questions.

---

## Required Endpoint

```python
@app.get("/api/lobby/{lobby_id}/history")
async def get_game_history(lobby_id: str) -> GameHistory:
    """
    Returns personal analytics for the requesting player only.
    Even though the game is multiplayer, this endpoint returns
    data for ONE player - their questions, answers, scores, and AI feedback.

    Args:
        lobby_id: The lobby identifier

    Returns:
        GameHistory object containing single player's performance data
    """
    return game_histories.get(lobby_id)
```

---

## Complete API Contract

### Request

```http
GET /api/lobby/{lobby_id}/history
```

### Response (JSON)

```json
{
  "lobbyId": "string",
  "gameMode": "competitive" | "casual",
  "timestamp": "2024-01-01T00:00:00Z",
  "duration": 720,

  "player": {
    "id": "string",
    "name": "string",
    "jobTitle": "string",
    "totalScore": 3500,
    "finalResult": "HIRED" | "FIRED",
    "stats": {
      "totalWordsTyped": 485,
      "avgResponseTime": 42,
      "fastestResponse": 18,
      "slowestResponse": 58,
      "totalCorrect": 12,
      "totalAttempted": 15,
      "accuracy": 80,
      "livesRemaining": 2,
      "avgWordCount": 97,
      "longestAnswer": 145,
      "winStreak": 3,
      "biggestComeback": 250,
      "perfectRounds": 2
    }
  },

  "rounds": [
    {
      "roundNumber": 1,
      "phase": "behavioural",
      "title": "Tell me about a time...",
      "question": "Full question text here",
      "results": [{
        "playerId": "player1",
        "score": 450,
        "scoreDelta": 450,
        "breakdown": {
          "wordCount": 125,
          "aiScore": 85
        },
        "responseTime": 45
      }]
    }
  ],

  "feedback": [
    {
      "phase": "behavioural",
      "roundNumber": 1,
      "score": 450,
      "maxScore": 1000,
      "feedback": {
        "strengths": ["...", "..."],
        "improvements": ["...", "..."],
        "keyInsight": "...",
        "tone": "praise"
      },
      "metrics": {
        "wordCount": 125,
        "clarity": 85,
        "relevance": 90,
        "depth": 80
      }
    }
  ],

  "skillAssessment": {
    "categories": [
      {
        "name": "Communication",
        "score": 88,
        "level": "Proficient",
        "description": "..."
      }
    ]
  },

  "highlights": [
    {
      "type": "best_answer",
      "phase": "Follow-up Question",
      "roundNumber": 2,
      "title": "Best Answer of the Session",
      "description": "...",
      "stat": 92,
      "icon": "💯"
    }
  ],

  "overallRating": {
    "score": 77,
    "letter": "B+",
    "summary": "Strong performance...",
    "topStrength": "Communication",
    "focusArea": "Technical Depth",
    "interviewReadiness": 82
  }
}
```

```typescript
interface GameHistory {
  lobbyId: string;
  gameMode: "competitive" | "casual";
  timestamp: Date;
  duration: number; // seconds

  player: AnalyticsPlayer; // Single player stats
  rounds: RoundHistory[]; // 5 phases of gameplay
  feedback: PhaseFeedback[]; // AI feedback per phase (5 items)
  skillAssessment: SkillAssessment; // 5 skill categories scored
  highlights: PersonalHighlight[]; // Achievement badges
  overallRating: OverallRating; // Final grade & summary
}
```

---

## TypeScript Interface Reference

Complete type definitions available in `frontend/src/types/analytics.ts`:

```typescript
interface GameHistory {
  lobbyId: string;
  gameMode: "competitive" | "casual";
  timestamp: Date;
  duration: number; // seconds

  player: AnalyticsPlayer; // Single player stats
  rounds: RoundHistory[]; // 4 rounds of gameplay
  feedback: PhaseFeedback[]; // AI feedback per phase (4 items)
  skillAssessment: SkillAssessment; // 5 skill categories scored
  highlights: PersonalHighlight[]; // Achievement badges
  overallRating: OverallRating; // Final grade & summary
}
```

---

## Data Collection Points

### When to Capture Data

1. **Game Start**: Initialize analytics object with player info
2. **After Behavioural Round**: Save answer text, score, word count
3. **After Follow-up Round**: Save answer text, score, word count
4. **After Rapid-fire Round**: Save correct/incorrect answers, time per question
5. **After Practical Round**: Save code submission, test results
6. **Game End**: Calculate final stats, generate all AI feedback

### What to Store Per Round

```python
round_data = {
    'roundNumber': 1-4,
    'phase': 'behavioural' | 'followup' | 'rapid-fire' | 'practical',
    'title': 'Round title',
    'question': 'Full question text',  # IMPORTANT: Store the actual question
    'playerAnswer': 'Player typed answer or code',  # For AI analysis
    'results': [{
        'playerId': player_id,
        'score': score_earned,
        'scoreDelta': change_from_previous_round,
        'breakdown': {
            # Behavioural/Followup
            'wordCount': len(answer.split()),
            'aiScore': ai_evaluation_score,
            'submissionTime': seconds_taken,

            # Rapid-fire
            'correctAnswers': correct_count,
            'timeBonus': bonus_points,
            'livesBonus': lives_remaining_bonus,

            # Practical
            'testsPassed': passed_test_count,
            'codeQuality': quality_score
        },
        'responseTime': seconds_to_submit
    }]
}
```

---

## Player Stats Calculation

### 1. Player Stats (accumulate throughout)

```typescript
totalWordsTyped; // Sum of all text in answers
avgResponseTime; // Average seconds to submit
fastestResponse; // Best time
longestAnswer; // Max words in single answer
accuracy; // Rapid-fire percentage (0-100)
```

### 2. Round Results Structure

**CRITICAL**: Each round in the `rounds` array MUST include:

- `question`: The actual question text shown to the player
- This is displayed in the UI so players can review what they answered

```python
{
  'roundNumber': 1-4,  # Only 4 rounds total
  'phase': 'behavioural' | 'followup' | 'rapid-fire' | 'practical',
  'title': 'Human-readable round name',
  'question': 'The actual question asked',  # Required for UI
  'results': [{
    'playerId': player_id,
    'score': score_earned,
    'scoreDelta': score_change,
    'breakdown': {...},
    'responseTime': seconds
  }]
}
```

### 3. AI Feedback Generation

**CRITICAL**: Generate feedback for all 4 rounds (behavioural, followup, rapid-fire, practical)

Each phase needs AI-generated feedback:

```typescript
PhaseFeedback {
  phase: string,
  score: number,
  maxScore: number,
  feedback: {
    strengths: string[],      // ["Clear communication", "Well-structured"]
    improvements: string[],   // ["Add more examples", "Elaborate on X"]
    keyInsight: string        // Main takeaway
  },
  tone: 'praise' | 'constructive' | 'encouraging',
  metrics: {
    wordCount: number,
    clarity: number,          // 0-100
    relevance: number,        // 0-100
    depth: number,           // 0-100
    accuracy: number,        // 0-100 (for rapid-fire)
    speed: number            // Response time in seconds
  }
}
```

**Phase-Specific Feedback:**

- **Behavioural/Followup**: Focus on clarity, STAR method usage, storytelling
- **Rapid-fire**: Focus on accuracy, speed, fundamental knowledge
- **Practical**: Focus on code quality, edge cases, problem-solving approach

### 4. Skill Assessment

Calculate 5 skill scores at game end:

```typescript
SkillAssessment {
  categories: [{
    name: 'Communication' | 'Technical Knowledge' | 'Problem Solving' | 'Speed & Accuracy' | 'Critical Thinking',
    score: number,            // 0-100
    level: 'Needs Work' | 'Developing' | 'Proficient' | 'Expert',
    description: string       // Short summary
  }]
}
```

**Calculation Guide:**

- Communication: Average of behavioural + followup scores
- Technical Knowledge: Average of rapid-fire + practical scores
- Problem Solving: Weight practical heavily, some rapid-fire
- Speed & Accuracy: Rapid-fire accuracy + avg response time
- Critical Thinking: Behavioural depth + practical approach

### 5. Personal Highlights

Detect and return 3-5 achievement badges:

```typescript
PersonalHighlight {
  type: 'best_answer' | 'fastest_response' | 'most_detailed' | 'perfect_accuracy' | 'consistency' | 'improvement',
  title: string,              // "Speed Demon ⚡"
  description: string,        // "Blazing fast responses!"
  stat: number,              // The impressive number
  icon: string               // Emoji
}
```

**Detection Logic:**

- `fastest_response`: Any response < 20s
- `most_detailed`: Answer with 150+ words
- `perfect_accuracy`: 100% on rapid-fire
- `consistency`: All scores within 20% of average

### 6. Overall Rating (final calculation)

```typescript
OverallRating {
  score: number,              // 0-100
  letter: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F',
  summary: string,            // "Excellent performance across all areas"
  topStrength: string,        // "Problem Solving"
  focusArea: string,          // "Speed & Accuracy"
  interviewReadiness: number  // 0-100 percentage
}
```

## Frontend Expectations

The frontend (`Analytics.tsx`) displays:

1. **Score Summary** - Total points and rating letter
2. **Round Breakdown** - For each of 4 rounds:
   - Round number and phase name
   - The question asked (from `round.question`)
   - Score earned
   - AI feedback card (expanded by default) showing:
     - Strengths bullets
     - Improvements bullets
     - Key insight
     - Metrics (word count, clarity, accuracy, etc.)
3. **Skill Assessment** - 5 skill categories with scores
4. **Action Buttons** - Play Again / Main Menu

### Required Fields

Frontend requires these fields to display properly:

- `rounds[].question` - Must be populated for all rounds
- `feedback[].feedback.strengths` - Array of 3-5 strings
- `feedback[].feedback.improvements` - Array of 2-3 strings
- `feedback[].feedback.keyInsight` - Single string summary
- `feedback[].metrics` - Object with relevant metrics for the phase

---

## Implementation Flow

```python
# 1. Initialize on game start
game_histories[lobby_id] = {
    'lobbyId': lobby_id,
    'timestamp': datetime.now(),
    'startTime': time.time(),
    'player': {
        'id': player_id,
        'name': player_name,
        'jobTitle': job_title,
        'totalScore': 0,
        'finalResult': None,
        'stats': {
            'totalWordsTyped': 0,
            'avgResponseTime': 0,
            'fastestResponse': float('inf'),
            'slowestResponse': 0,
            'totalCorrect': 0,
            'totalAttempted': 0,
            'accuracy': 0,
            'avgWordCount': 0,
            'longestAnswer': 0,
            'perfectRounds': 0
        }
    },
    'rounds': [],
    'feedback': [],
    'highlights': [],
    'questionsAsked': []  # Store for later feedback generation
}

# 2. After each phase completion
async def save_round_result(lobby_id: str, phase: str, question: str,
                            player_answer: str, score: int, breakdown: dict):
    history = game_histories[lobby_id]
    round_number = len(history['rounds']) + 1

    # Save round with question
    history['rounds'].append({
        'roundNumber': round_number,
        'phase': phase,
        'title': get_phase_title(phase),
        'question': question,  # CRITICAL: Include the question
        'results': [{
            'playerId': history['player']['id'],
            'score': score,
            'scoreDelta': score - (history['rounds'][-1]['results'][0]['score'] if history['rounds'] else 0),
            'breakdown': breakdown,
            'responseTime': breakdown.get('submissionTime', 0)
        }]
    })

    # Store answer for later AI feedback
    history['questionsAsked'].append({
        'phase': phase,
        'roundNumber': round_number,
        'question': question,
        'answer': player_answer,
        'score': score,
        'breakdown': breakdown
    })

    # Update player stats
    update_stats(history['player']['stats'], breakdown, player_answer)

# 3. Finalize on game end
async def finalize_analytics(lobby_id: str):
    history = game_histories[lobby_id]

    # Generate AI feedback for ALL 4 rounds
    for qa in history['questionsAsked']:
        feedback = await generate_phase_feedback(
            phase=qa['phase'],
            roundNumber=qa['roundNumber'],
            question=qa['question'],
            answer=qa['answer'],
            score=qa['score'],
            breakdown=qa['breakdown']
        )
        history['feedback'].append(feedback)

    # Calculate skill assessment
    history['skillAssessment'] = calculate_skills(history['rounds'], history['feedback'])

    # Detect highlights
    history['highlights'] = detect_achievements(history)

    # Calculate overall rating
    history['overallRating'] = calculate_rating(history)

    # Set duration
    history['duration'] = int(time.time() - history['startTime'])

    # Determine final result
    total_score = sum(r['results'][0]['score'] for r in history['rounds'])
    history['player']['totalScore'] = total_score
    history['player']['finalResult'] = 'HIRED' if total_score >= 2500 else 'FIRED'

    # Clean up temporary data
    del history['questionsAsked']
```

## AI Feedback Generation

Generate feedback at **game end** for all 4 rounds:

```python
async def generate_phase_feedback(phase: str, roundNumber: int, question: str,
                                   answer: str, score: int, breakdown: dict) -> dict:
    """
    Generate AI feedback for a single phase.
    Called 4 times at game end (once per round).
    """

    # Customize prompt based on phase
    if phase in ['behavioural', 'followup']:
        prompt = f"""Analyze this behavioural interview response:

Question: {question}
Answer: {answer}
Score: {score}/1000

Provide:
- 3-5 specific strengths (what they did well)
- 2-3 areas for improvement (constructive advice)
- One key insight (main takeaway)

Focus on: STAR method, clarity, storytelling, specific examples."""

    elif phase == 'rapid-fire':
        prompt = f"""Analyze this rapid-fire quiz performance:

Correct: {breakdown['correctAnswers']}/{breakdown.get('totalQuestions', 15)}
Time: {breakdown.get('avgTime', 'N/A')}s per question
Score: {score}/1500

Provide:
- 3-5 strengths (speed, accuracy, knowledge areas)
- 2-3 improvements (knowledge gaps, strategy)
- One key insight"""

    elif phase == 'practical':
        prompt = f"""Analyze this coding challenge submission:

Challenge: {question}
Tests Passed: {breakdown.get('testsPassed', 0)}/10
Code Quality: {breakdown.get('codeQuality', 0)}/100
Score: {score}/1000

Provide:
- 3-5 strengths (code quality, approach, testing)
- 2-3 improvements (edge cases, optimization, errors)
- One key insight"""

    # Call your existing AI service
    ai_response = await call_openai(prompt)
    parsed = parse_ai_response(ai_response)  # Extract strengths, improvements, insight

    return {
        'phase': phase,
        'roundNumber': roundNumber,
        'score': score,
        'maxScore': get_max_score_for_phase(phase),
        'feedback': {
            'strengths': parsed['strengths'],      # Array of strings
            'improvements': parsed['improvements'], # Array of strings
            'keyInsight': parsed['insight'],       # Single string
            'tone': determine_tone(score)          # praise/constructive/encouraging
        },
        'metrics': calculate_metrics(phase, breakdown, answer)
    }

def calculate_metrics(phase: str, breakdown: dict, answer: str = '') -> dict:
    """Calculate phase-specific metrics for display."""
    if phase in ['behavioural', 'followup']:
        return {
            'wordCount': len(answer.split()),
            'clarity': breakdown.get('clarity', 75),
            'relevance': breakdown.get('relevance', 80),
            'depth': breakdown.get('depth', 70)
        }
    elif phase == 'rapid-fire':
        return {
            'accuracy': breakdown.get('accuracy', 0),
            'speed': breakdown.get('avgTime', 0)
        }
    elif phase == 'practical':
        return {
            'accuracy': breakdown.get('testsPassed', 0) * 10,
            'clarity': breakdown.get('codeQuality', 0),
            'depth': breakdown.get('approach', 70)
        }

def determine_tone(score: int) -> str:
    """Determine feedback tone based on score."""
    if score >= 800:
        return 'praise'
    elif score >= 500:
        return 'constructive'
    else:
        return 'encouraging'
```

## Testing

### Using Mock Data

Frontend has mock data generator in `frontend/src/types/analytics.ts`:

```typescript
createMockGameHistory(); // Returns sample 4-round GameHistory
```

### Test Your Endpoint

```bash
# Should return full analytics object with 4 rounds
curl http://localhost:8000/api/lobby/test123/history

# Verify response includes:
# - player object with stats
# - 4 rounds (behavioural, followup, rapid-fire, practical)
# - 4 feedback items (one per round)
# - skillAssessment with 5 categories
# - highlights array
# - overallRating object
```

### Frontend Integration

Uncomment in `frontend/src/pages/Analytics.tsx`:

```typescript
fetch(`http://localhost:8000/api/lobby/${lobbyId}/history`)
  .then((res) => res.json())
  .then((data) => setGameHistory(data))
  .catch((err) => console.error("Analytics fetch failed:", err));
```

---

## Common Issues & Solutions

### Issue: "No AI feedback showing"

**Solution**: Ensure `feedback` array has 4 items with proper structure:

```python
{
    'feedback': {
        'strengths': ['...', '...'],  # Must be array
        'improvements': ['...'],      # Must be array
        'keyInsight': '...'           # Must be string
    }
}
```

### Issue: "Questions not displaying"

**Solution**: Add `question` field to each round:

```python
{
    'question': 'The actual question text',  # Required!
    'title': 'Human readable title'
}
```

### Issue: "Wrong number of rounds"

**Solution**: Game has 4 rounds (behavioural, followup, rapid-fire, practical). NOT 5.

---

## Checklist

- [ ] Create `GET /api/lobby/{lobby_id}/history` endpoint
- [ ] Track player stats during gameplay (words typed, response times, etc.)
- [ ] Save round results after each phase **including question text**
- [ ] Store player answers for AI analysis at game end
- [ ] Generate AI feedback for all 4 phases at game end
- [ ] Calculate 5 skill categories (Communication, Technical Knowledge, etc.)
- [ ] Detect 3-5 personal highlights (achievements/badges)
- [ ] Calculate overall rating with letter grade
- [ ] Set `finalResult` based on total score threshold
- [ ] Test endpoint returns valid JSON matching contract
- [ ] Verify frontend displays all 4 rounds with AI feedback

**Complete type definitions:** `frontend/src/types/analytics.ts`  
**UI implementation:** `frontend/src/pages/Analytics.tsx`  
**Mock data example:** `createMockGameHistory()` in types file

---

## Key Reminders

1. **4 Rounds Total**: behavioural, followup, rapid-fire, practical (NO theory round)
2. **Include Questions**: Each round must have `question` field with actual question text
3. **Single Player**: Returns data for ONE player only, even in multiplayer game
4. **AI at End**: Generate all 4 feedback items at game end, not during gameplay
5. **Frontend Ready**: UI is complete and waiting for your API data
