import React from "react";
import { Link, Route, Routes, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import LobbyCreation from "./pages/LobbyCreation";
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
  const links = [
    { to: "/landing", label: "Landing" },
    { to: "/lobby-creation", label: "LobbyCreation" },
    { to: "/waiting-room", label: "WaitingRoom" },
    { to: "/round-start-counter", label: "RoundStartCounter" },
    { to: "/behavioural-question", label: "BehaviouralQuestion" },
    { to: "/behavioural-answer", label: "BehaviouralAnswer" },
    { to: "/current-score", label: "CurrentScore" },
    { to: "/technical-theory", label: "TechnicalTheory" },
    { to: "/technical-practical", label: "TechnicalPractical" },
    { to: "/win-lose", label: "WinLose" },
    { to: "/analytics", label: "Analytics" },
  ];

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
          <Route
            path="/"
            element={<Navigate to="/round-start-counter" replace />}
          />
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
        </Routes>
      </main>

      <aside className="border-t p-4">
        <div className="max-w-6xl mx-auto">
          <p className="font-medium mb-2">Quick links</p>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-1 rounded border hover:bg-gray-50 text-sm"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default App;
