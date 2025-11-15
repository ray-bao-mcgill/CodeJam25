import { useState } from "react";
import Lobby from "./components/Lobby";
import "./App.css";

export default function App() {
  const [showLobby, setShowLobby] = useState(false);

  if (showLobby) {
    return (
      <div className="landing-page">
        <div className="geometric-bg">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
          <div className="shape shape-5"></div>
          <div className="grid-overlay"></div>
        </div>
        <Lobby />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <div className="geometric-bg">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
        <div className="shape shape-4"></div>
        <div className="shape shape-5"></div>
        <div className="grid-overlay"></div>
      </div>

      <div className="container">
        <div className="content-center">
          <h1 className="main-title">Interview Prep</h1>
          <button onClick={() => setShowLobby(true)} className="btn btn-large">
            Join Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
