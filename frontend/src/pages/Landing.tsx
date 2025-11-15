import React, { useState } from "react";
import Lobby from "../components/Lobby";

const Landing: React.FC = () => {
  const [showLobby, setShowLobby] = useState(false);

  if (showLobby) {
    return <Lobby />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4">Landing</h1>
      <p className="text-gray-600 mb-6">
        TODO: Team fills in UI for this page.
      </p>
      <button
        onClick={() => setShowLobby(true)}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Join Lobby
      </button>
    </div>
  );
};

export default Landing;
