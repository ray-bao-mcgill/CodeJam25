# Analytics Backend Integration Guide

## Overview

**Single-player personal recap** showing individual performance with AI feedback for each phase. Spotify Wrapped-style scrollable sections with animated stats reveals.

**Frontend Status:** ✅ Fully built and ready  
**Backend Task:** Implement `GET /api/lobby/{lobby_id}/history` endpoint

---

## Required Endpoint

```python
@app.get("/api/lobby/{lobby_id}/history")
async def get_game_history(lobby_id: str) -> GameHistory:
    """Returns personal analytics for single player"""
    return game_histories.get(lobby_id)
```

---

## Data Structure (see `frontend/src/types/analytics.ts`)

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

## Track During Gameplay

### 1. Player Stats (accumulate throughout)

```typescript
totalWordsTyped; // Sum of all text in answers
avgResponseTime; // Average seconds to submit
fastestResponse; // Best time
longestAnswer; // Max words in single answer
accuracy; // Rapid-fire percentage (0-100)
```

### 2. Round Results (after each phase)

```typescript
{
  roundNumber: 1-5,
  phase: 'behavioural' | 'followup' | 'theory' | 'practical' | 'rapid-fire',
  score: number,       // Score earned this round
  breakdown: {
    wordCount?: number,
    aiScore?: number,
    correctAnswers?: number,
    timeBonus?: number
  }
}
```

### 3. AI Feedback (generate per phase)

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

### 4. Skill Assessment (calculate at end)

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

### 5. Personal Highlights (detect achievements)

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

---

## Implementation Flow

```python
# 1. Initialize on game start
game_histories[lobby_id] = {
    'lobbyId': lobby_id,
    'timestamp': datetime.now(),
    'startTime': time.time(),
    'player': {...},
    'rounds': [],
    'feedback': [],
    'highlights': []
}

# 2. After each phase completion
async def save_round_result(lobby_id: str, phase: str, score: int, breakdown: dict):
    history = game_histories[lobby_id]

    # Save round
    history['rounds'].append({
        'roundNumber': len(history['rounds']) + 1,
        'phase': phase,
        'score': score,
        'breakdown': breakdown
    })

    # Generate AI feedback (call your AI service)
    feedback = await generate_phase_feedback(phase, breakdown)
    history['feedback'].append(feedback)

    # Update player stats
    update_stats(history['player']['stats'], breakdown)

# 3. Finalize on game end
async def finalize_analytics(lobby_id: str):
    history = game_histories[lobby_id]

    # Calculate skill assessment
    history['skillAssessment'] = calculate_skills(history['rounds'])

    # Detect highlights
    history['highlights'] = detect_achievements(history)

    # Calculate overall rating
    history['overallRating'] = calculate_rating(history)

    # Set duration
    history['duration'] = int(time.time() - history['startTime'])

    # Determine final result
    history['player']['finalResult'] = 'HIRED' if history['player']['totalScore'] >= 4000 else 'FIRED'
```

---

## AI Feedback Generation

Each phase needs AI-generated feedback with 3-5 strengths and 2-3 improvements:

```python
async def generate_phase_feedback(phase: str, player_answer: str, score: int) -> PhaseFeedback:
    # Use your existing AI service
    prompt = f"""Analyze this {phase} interview response:

    Answer: {player_answer}
    Score: {score}/1000

    Provide:
    - 3-5 specific strengths
    - 2-3 areas for improvement
    - One key insight
    """

    ai_response = await call_openai(prompt)

    return {
        'phase': phase,
        'score': score,
        'maxScore': 1000,
        'feedback': parse_ai_response(ai_response),
        'tone': determine_tone(score),
        'metrics': calculate_metrics(player_answer, score)
    }
```

---

## Testing

Mock data generator already exists in frontend:

```typescript
// frontend/src/types/analytics.ts
createMockGameHistory(); // Returns sample GameHistory
```

Test endpoint manually:

```bash
# Should return full analytics object
curl http://localhost:8000/api/lobby/test123/history
```

---

## Frontend Integration

Already implemented in `frontend/src/pages/Analytics.tsx`:

```typescript
// Uncomment when backend ready:
fetch(`http://localhost:8000/api/lobby/${lobbyId}/history`)
  .then((res) => res.json())
  .then((data) => setGameHistory(data));
```

---

## Checklist

- [ ] Create `GET /api/lobby/{lobby_id}/history` endpoint
- [ ] Track player stats during gameplay
- [ ] Save round results after each phase
- [ ] Generate AI feedback per phase (5 total)
- [ ] Calculate skill assessment (5 categories)
- [ ] Detect personal highlights (achievements)
- [ ] Calculate overall rating and final result
- [ ] Test with frontend at `http://localhost:3000/analytics`

**Complete type definitions:** `frontend/src/types/analytics.ts`  
**UI already built:** `frontend/src/pages/Analytics.tsx`
