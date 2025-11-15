import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";

import Landing from "./pages/onboarding/Landing";
import LobbyCreation from "./pages/onboarding/LobbyCreation";
import LobbyJoin from "./pages/onboarding/LobbyJoin";
import JobInputSelection from "./pages/onboarding/JobInputSelection";
import LobbySetup from "./pages/onboarding/LobbySetup";
import LobbyWaitingRoomPage from "./pages/LobbyWaitingRoomPage";
import RoundStartCounter from "./pages/game-phase/RoundStartCounter";
import Tutorial from "./pages/game-phase/Tutorial";
import BehaviouralQuestion from "./pages/game-phase/behavioural/BehaviouralQuestion";
import BehaviouralAnswer from "./pages/game-phase/behavioural/BehaviouralAnswer";
import RapidFireQuiz from "./pages/game-phase/quickfire/RapidFireQuiz";
import CurrentScore from "./pages/game-phase/CurrentScore";
import Winner from "./pages/game-phase/Winner";
import WinLose from "./pages/WinLose";
import Analytics from "./pages/Analytics";
import DevTools from "./pages/DevTools";
import DatabaseAdmin from "./pages/DevTools/DatabaseAdmin";

const App: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Navigate to="/landing" replace />} />
        <Route path="/landing" element={<Landing />} />
        <Route path="/lobby-creation" element={<LobbyCreation />} />
        <Route path="/lobby-join" element={<LobbyJoin />} />
        <Route path="/lobby-join/:lobbyId" element={<LobbyJoin />} />
        <Route path="/job-input" element={<JobInputSelection />} />
        <Route path="/lobby-setup" element={<LobbySetup />} />
        <Route path="/lobby-waiting" element={<LobbyWaitingRoomPage />} />
        <Route path="/tutorial" element={<Tutorial />} />
        <Route
          path="/round-start-counter/:type"
          element={<RoundStartCounter />}
        />
        <Route
          path="/behavioural-question"
          element={<BehaviouralQuestion />}
        />
        <Route path="/behavioural-answer" element={<BehaviouralAnswer />} />
        <Route path="/technical-theory" element={<RapidFireQuiz />} />
        <Route path="/quickfire-round" element={<RapidFireQuiz />} />
        <Route path="/rapid-fire-quiz" element={<RapidFireQuiz />} />
        <Route path="/current-score" element={<CurrentScore />} />
        <Route path="/winner" element={<Winner />} />
        <Route path="/win-lose" element={<WinLose />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/dev" element={<DevTools />} />
        <Route path="/admin" element={<DatabaseAdmin />} />
      </Routes>
    </div>
  );
};

export default App;

