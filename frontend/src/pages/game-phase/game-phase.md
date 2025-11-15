# Game Phase Documentation

This document explains how the game phase flow works in the CodeJam interview practice app.

## Overview

The game phase consists of multiple rounds where players answer either **Behavioural** or **Technical** interview questions. Each round follows a specific flow with timed phases and automatic navigation.

---

## Game Flow Architecture

### Round Types

1. **Behavioural Round**

   - Tests soft skills and past experiences
   - Flow: Round Start → Behavioural Question → Behavioural Answer → Score

2. **Technical Round**
   - Tests coding knowledge and problem-solving
   - Flow: Round Start → Technical Theory → Technical Practical → Score

---

## Phase Components

### 1. RoundStartCounter (`/round-start-counter/:type`)

**Purpose**: Display countdown before a round begins, giving players time to prepare.

**Route Parameter**:

- `:type` - Either `"behavioural"` or `"technical"`

**Features**:

- 60-second countdown timer (configurable via `COUNTDOWN_SECONDS`)
- Dynamic title with glow effect based on round type:
  - Behavioural → Cyan glow (`.game-text-glow-cyan`)
  - Technical → Red glow (`.game-text-glow-red`)
- Auto-navigation when countdown reaches 0
- Skip button to advance early
- Accessibility: `aria-live="polite"` for screen readers
- Error handling for invalid round types

**Navigation Logic**:

```typescript
const nextRouteForType: Record<string, string> = {
  behavioural: "/behavioural-question",
  technical: "/technical-theory",
};
```

**State Management**:

- `remaining` - Tracks countdown seconds
- `useEffect` - Decrements counter every second, navigates at 0

**Styling**:

- Uses `.game-bg` gradient background (dark purple → mid purple → purple)
- Full viewport height (`min-height: 100vh`)
- Flexbox centering for content
- CSS variables from `index.css` for theming

---

### 2. BehaviouralQuestion (`/behavioural-question`)

**Purpose**: Display a behavioural interview question for the player to answer.

**Status**: 🚧 Placeholder - TODO

**Expected Features**:

- Display random behavioural question
- Timer for question reading/thinking phase
- Navigation to answer phase
- Question categories (e.g., "Tell me about a time when...")

---

### 3. BehaviouralAnswer (`/behavioural-answer`)

**Purpose**: Record/display the player's answer to the behavioural question.

**Status**: 🚧 Placeholder - TODO

**Expected Features**:

- Text input or voice recording for answer
- Timer for answering phase
- Submit button to proceed
- Auto-navigation when time expires

---

### 4. TechnicalTheory (`/technical-theory`)

**Purpose**: Display a theoretical technical question (e.g., algorithms, data structures).

**Status**: 🚧 Placeholder - TODO

**Expected Features**:

- Display technical theory question
- Multiple choice or short answer input
- Timer for answering
- Navigation to practical phase

---

### 5. TechnicalPractical (`/technical-practical`)

**Purpose**: Coding challenge or practical technical problem.

**Status**: 🚧 Placeholder - TODO

**Expected Features**:

- Code editor interface
- Test cases to validate solution
- Timer for coding phase
- Syntax highlighting and error checking

---

### 6. CurrentScore (`/current-score`)

**Purpose**: Display score feedback after completing a round.

**Status**: 🚧 Placeholder - TODO

**Expected Features**:

- Points earned in the round
- Cumulative score
- Performance breakdown (speed, accuracy, etc.)
- Navigation to next round or end game

---

## Routing Configuration

Routes are defined in `App.tsx`:

```tsx
<Routes>
  <Route path="/round-start-counter/:type" element={<RoundStartCounter />} />
  <Route path="/behavioural-question" element={<BehaviouralQuestion />} />
  <Route path="/behavioural-answer" element={<BehaviouralAnswer />} />
  <Route path="/technical-theory" element={<TechnicalTheory />} />
  <Route path="/technical-practical" element={<TechnicalPractical />} />
  <Route path="/current-score" element={<CurrentScore />} />
</Routes>
```

---

## Styling System

### CSS Variables (from `index.css`)

**Colors**:

```css
--game-bg-dark: #0f0a1f     /* Dark purple base */
--game-bg-mid: #1a1436      /* Mid purple */
--game-bg-purple: #2d1b69   /* Light purple */

--game-cyan: #00d9ff        /* Primary action color */
--game-red: #ff3366         /* Secondary action color */

--game-text-primary: #ffffff
--game-text-secondary: rgba(255, 255, 255, 0.7)
--game-text-dim: rgba(255, 255, 255, 0.4)
```

### Utility Classes

**`.game-bg`** - Gradient background for game screens

```css
background: linear-gradient(
  135deg,
  var(--game-bg-dark) 0%,
  var(--game-bg-mid) 50%,
  var(--game-bg-purple) 100%
);
```

**`.game-text-glow-cyan`** - Cyan text glow effect

```css
text-shadow: 0 0 2rem var(--game-cyan-glow), 0 0 4rem var(--game-cyan-glow);
```

**`.game-text-glow-red`** - Red text glow effect

```css
text-shadow: 0 0 2rem var(--game-red-glow), 0 0 4rem var(--game-red-glow);
```

**`.game-border-glow-cyan`** - Cyan border glow

```css
box-shadow: 0 0 2rem var(--game-cyan-glow), inset 0 0 2rem rgba(0, 217, 255, 0.1);
```

**`.game-border-glow-red`** - Red border glow

```css
box-shadow: 0 0 2rem var(--game-red-glow), inset 0 0 2rem rgba(255, 51, 102, 0.1);
```

**`.game-rem-10`** - Scoped rem sizing (1rem = 10px)

```css
font-size: 62.5%; /* Apply to wrapper element */
```

Use this class on container elements to enable easy math with rem units.

**`.container`** - Max-width content container

```css
max-width: 120rem; /* 1200px when inside .game-rem-10 */
margin: 0 auto;
padding: 1rem;
```

---

## Timer System

### Current Implementation

**RoundStartCounter** uses a simple `useEffect` + `setTimeout` pattern:

```typescript
const [remaining, setRemaining] = useState<number>(COUNTDOWN_SECONDS);

useEffect(() => {
  if (remaining <= 0) {
    navigate(nextRoute);
    return;
  }
  const id = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
  return () => window.clearTimeout(id);
}, [remaining]);
```

### Future Enhancement: RoundPhaseContext

**TODO**: Create a context provider to manage timers across all phases.

**Benefits**:

- Centralized timer logic
- Coordinated phase transitions
- Pause/resume functionality
- Shared state across question/answer phases

**Proposed Structure**:

```typescript
interface RoundPhaseContextType {
  currentPhase: "start" | "question" | "answer" | "score";
  roundType: "behavioural" | "technical";
  timeRemaining: number;
  isPaused: boolean;
  startTimer: (duration: number) => void;
  pauseTimer: () => void;
  skipPhase: () => void;
}
```

---

## Navigation Patterns

### Auto-Navigation

Components automatically navigate when:

- Timer reaches 0
- User submits an answer
- Error conditions require redirect

### Manual Navigation

Players can:

- Skip countdown with "Skip" button
- Navigate via quick links (dev mode)
- Return home on errors

### Error Handling

Invalid routes or parameters show error screens with:

- Clear error message
- Valid options displayed
- "Return Home" button

---

## Accessibility Features

- **Semantic HTML**: Proper heading hierarchy, button elements
- **ARIA Live Regions**: `aria-live="polite"` on countdown for screen reader updates
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Color Independence**: Not relying solely on color for information
- **Focus Management**: Proper focus states on buttons and inputs

---

## Development Guidelines

### Adding a New Phase

1. Create component in `/pages/game-phase/`
2. Add route in `App.tsx`
3. Update navigation logic in previous phase
4. Add quick link for testing
5. Update this documentation

### Styling Guidelines

- **Always use** CSS variables from `index.css`
- **Prefer** utility classes over inline styles
- **Apply** `.game-bg` for consistent backgrounds
- **Use** `.game-rem-10` wrapper for scoped rem sizing
- **Follow** the established color scheme (cyan for behavioural, red for technical)

### Timer Guidelines

- Use `useEffect` + `setTimeout` for countdown timers
- Always clean up timers in effect cleanup function
- Handle edge cases (0 seconds, navigation during countdown)
- Consider extracting to custom hook if reused

---

## Testing Checklist

### RoundStartCounter

- ✅ Navigate to `/round-start-counter/behavioural` - verify cyan glow
- ✅ Navigate to `/round-start-counter/technical` - verify red glow
- ✅ Countdown decrements every second
- ✅ Auto-navigate at 0 seconds
- ✅ Skip button works and is disabled after countdown
- ✅ Invalid type shows error message
- ✅ Full viewport gradient background
- ✅ Content is centered

### Future Phases (TODO)

- [ ] Question displays correctly
- [ ] Answer input/recording works
- [ ] Timers function properly
- [ ] Score calculation is accurate
- [ ] Navigation flow is seamless

---

## File Structure

```
frontend/src/pages/game-phase/
├── RoundStartCounter.tsx      ✅ Complete
├── BehaviouralQuestion.tsx    🚧 Placeholder
├── BehaviouralAnswer.tsx      🚧 Placeholder
├── TechnicalTheory.tsx        🚧 Placeholder
├── TechnicalPractical.tsx     🚧 Placeholder
├── CurrentScore.tsx           🚧 Placeholder
└── game-phase.md              📖 This file
```

---

## Quick Reference

### Start a Behavioural Round

```
http://localhost:3000/round-start-counter/behavioural
```

### Start a Technical Round

```
http://localhost:3000/round-start-counter/technical
```

### Key Constants

- `COUNTDOWN_SECONDS = 60` (in RoundStartCounter.tsx)
- Timer interval: 1000ms (1 second)

### Color Themes

- Behavioural: Cyan (`#00d9ff`)
- Technical: Red (`#ff3366`)

---

## Future Improvements

1. **Context Provider**: Create `RoundPhaseContext` for shared state
2. **Timer Hook**: Extract `useCountdownTimer` custom hook
3. **Question API**: Integrate backend for dynamic questions
4. **Scoring System**: Implement point calculation logic
5. **Sound Effects**: Add audio feedback for timers/events
6. **Animations**: Smooth transitions between phases
7. **Persistence**: Save progress to localStorage or backend
8. **Multiplayer**: Real-time score updates for all players

---

_Last Updated: November 15, 2025_
