# Game Phase Documentation

## Flow

**Behavioural Round**: Round Start → Question → Answer → Score  
**Technical Round**: Round Start → Theory → Practical → Score

## Components

| Component           | Route                        | Status      |
| ------------------- | ---------------------------- | ----------- |
| RoundStartCounter   | `/round-start-counter/:type` | ✅ Complete |
| BehaviouralQuestion | `/behavioural-question`      | 🚧 TODO     |
| BehaviouralAnswer   | `/behavioural-answer`        | 🚧 TODO     |
| TechnicalTheory     | `/technical-theory`          | 🚧 TODO     |
| TechnicalPractical  | `/technical-practical`       | 🚧 TODO     |
| CurrentScore        | `/current-score`             | 🚧 TODO     |

## RoundStartCounter

- 60-second countdown with auto-navigation
- Dynamic styling: Behavioural (cyan) vs Technical (red)
- Routes to `/behavioural-question` or `/technical-theory` based on type param

## Styling

Use these classes from `index.css`:

- `.game-bg` - Purple gradient background
- `.game-text-glow-cyan` / `.game-text-glow-red` - Glowing text
- `.game-border-glow-cyan` / `.game-border-glow-red` - Glowing borders
- `.game-rem-10` - Wrapper for 1rem = 10px sizing
- `.container` - Max-width centered container

## Timer Pattern

```typescript
const [remaining, setRemaining] = useState<number>(COUNTDOWN_SECONDS);

useEffect(() => {
  if (remaining <= 0) {
    navigate(nextRoute);
    return;
  }
  const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
  return () => clearTimeout(id);
}, [remaining]);
```

## TODO

- [ ] Create `RoundPhaseContext` for shared timer state
- [ ] Implement question/answer components
- [ ] Connect to backend API for questions
- [ ] Add scoring system
