import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ResultsSummary, {
  ResultsSummaryProps,
  RoundType,
} from "../../components/ResultsSummary";

// Lightweight wrapper page for reusable ResultsSummary.
// Expects navigation state to contain a partial ResultsSummaryProps; merges defaults.

const ResultsPage: React.FC = () => {
  const { phase } = useParams<{ phase: RoundType }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as Partial<ResultsSummaryProps>;

  const roundType: RoundType = (phase as RoundType) || "rapid-fire";

  const onNextTarget = nextRouteFor(roundType);

  const props: ResultsSummaryProps = {
    roundType,
    questionMeta: state.questionMeta,
    players: state.players || [],
    results: state.results || [],
    totals: state.totals,
    timing: state.timing,
    flags: { isInLobby: false, ...state.flags },
    actions: {
      onNext: () => navigate(onNextTarget),
      onReviewQuestion: undefined,
      onShare: undefined,
    },
  };

  return (
    <div className="min-h-screen game-bg p-6">
      <ResultsSummary {...props} />
    </div>
  );
};

function nextRouteFor(round: RoundType): string {
  // Define default phase progression for Next button
  switch (round) {
    case "rapid-fire":
      return "/technical-practical";
    case "behavioural":
    case "followup":
      return "/technical-theory";
    case "theory":
      return "/technical-practical";
    case "practical":
      return "/current-score";
    default:
      return "/landing";
  }
}

export default ResultsPage;
