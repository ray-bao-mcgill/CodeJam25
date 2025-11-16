import type {
  RoundType,
  ResultsSummaryProps,
} from "../../components/ResultsSummary";

// NOTE: These functions normalize phase-specific state into a common Results shape.
// Implementations are intentionally stubbed for now; wire each to your actual game state later.

export function computeResultsFromBehavioural(
  gameState: any,
  submissions: any
) {
  return baseEmpty("behavioural");
}

export function computeResultsFromFollowup(gameState: any, submissions: any) {
  // Follow-up results mirror Behavioural; compute once, reuse here
  return computeResultsFromBehavioural(gameState, submissions);
}

export function computeResultsFromTheory(gameState: any, submissions: any) {
  return baseEmpty("theory");
}

export function computeResultsFromPractical(gameState: any, submissions: any) {
  return baseEmpty("practical");
}

export function computeResultsFromRapidFire(gameState: any, submissions: any) {
  return baseEmpty("rapid-fire");
}

function baseEmpty(roundType: RoundType) {
  const empty: ResultsSummaryProps = {
    roundType,
    players: [],
    results: [],
    actions: { onNext: () => {} },
    flags: { isInLobby: false },
  };
  return empty;
}
