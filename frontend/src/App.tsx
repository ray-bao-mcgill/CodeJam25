import React from "react";
import { Link, Route, Routes, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import LobbyCreation from "./pages/LobbyCreation";
import WaitingRoom from "./pages/WaitingRoom";
import RoundStartCounter from "./pages/RoundStartCounter";
import BehaviouralQuestion from "./pages/BehaviouralQuestion";
import BehaviouralAnswer from "./pages/BehaviouralAnswer";
import CurrentScore from "./pages/CurrentScore";
import TechnicalTheory from "./pages/TechnicalTheory";
import TechnicalPractical from "./pages/TechnicalPractical";
import WinLose from "./pages/WinLose";
import Analytics from "./pages/Analytics";
import DevTools from "./pages/DevTools";
import DatabaseAdmin from "./pages/DevTools/DatabaseAdmin";

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 border-b">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">Frontend Scaffold</h1>
          <nav className="text-sm">
            <Link className="text-blue-600 hover:underline" to="/landing">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/landing" replace />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/lobby-creation" element={<LobbyCreation />} />
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
          <Route path="/dev" element={<DevTools />} />
          <Route path="/admin" element={<DatabaseAdmin />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
