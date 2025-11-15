import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";

import Landing from "./pages/onboarding/Landing";
import LobbyCreation from "./pages/onboarding/LobbyCreation";
import LobbyJoin from "./pages/onboarding/LobbyJoin";
import JobInputSelection from "./pages/onboarding/JobInputSelection";
import LobbySetup from "./pages/onboarding/LobbySetup";
import WaitingRoom from "./pages/WaitingRoom";
import RoundStartCounter from "./pages/game-phase/RoundStartCounter";
import BehaviouralQuestion from "./pages/game-phase/BehaviouralQuestion";
import BehaviouralAnswer from "./pages/game-phase/BehaviouralAnswer";
import CurrentScore from "./pages/game-phase/CurrentScore";
import TechnicalTheory from "./pages/game-phase/TechnicalTheory";
import TechnicalPractical from "./pages/game-phase/TechnicalPractical";
import WinLose from "./pages/WinLose";
import Analytics from "./pages/Analytics";

const App: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route
          path="/"
          element={<Navigate to="/landing" replace />}
        />
        <Route path="/landing" element={<Landing />} />
        <Route path="/lobby-creation" element={<LobbyCreation />} />
        <Route path="/lobby-join" element={<LobbyJoin />} />
        <Route path="/job-input" element={<JobInputSelection />} />
        <Route path="/lobby-setup" element={<LobbySetup />} />
        <Route path="/waiting-room" element={<WaitingRoom />} />
        <Route path="/round-start-counter" element={<RoundStartCounter />} />
        <Route
          path="/behavioural-question"
          element={<BehaviouralQuestion />}
        />
        <Route path="/behavioural-answer" element={<BehaviouralAnswer />} />
        <Route path="/current-score" element={<CurrentScore />} />
        <Route path="/technical-theory" element={<TechnicalTheory />} />
        <Route path="/technical-practical" element={<TechnicalPractical />} />
        <Route path="/win-lose" element={<WinLose />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </div>
  );
};

export default App;
