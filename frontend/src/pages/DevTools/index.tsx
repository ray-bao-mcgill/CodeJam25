import React from "react";
import { Link } from "react-router-dom";

const DevTools: React.FC = () => {
  const quickLinks = [
    { to: "/lobby-creation", label: "Lobby Creation", description: "Create a new game lobby" },
    { to: "/analytics", label: "Match Results", description: "View match analytics and results" },
  ];

  const questionSections = [
    { to: "/tutorial", label: "Tutorial", description: "Game tutorial slideshow" },
    { to: "/round-start-counter/behavioural", label: "Round Start (Behavioural)", description: "Countdown before behavioural round" },
    { to: "/round-start-counter/technical-theory", label: "Round Start (Quickfire)", description: "Countdown before quickfire round" },
    { to: "/round-start-counter/technical-practical", label: "Round Start (Practical)", description: "Countdown before practical round" },
    { to: "/behavioural-question", label: "Behavioural Question", description: "Initial behavioural interview question" },
    { to: "/behavioural-answer", label: "Behavioural Answer", description: "Follow-up behavioural question" },
    { to: "/quickfire-round", label: "Quick Fire Round", description: "10 rapid-fire multiple choice questions" },
    { to: "/technical-practical", label: "Technical Practical", description: "Practical coding question" },
    { to: "/current-score", label: "Current Score", description: "View current round scores" },
    { to: "/win-lose", label: "Win/Lose", description: "Final game result screen" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Development Tools
          </h1>
          <p className="text-gray-600 mb-8">
            Quick access to development pages and admin tools
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 transition-colors">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Quick Links
              </h2>
              <div className="space-y-3">
                {quickLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors border border-purple-200"
                  >
                    <div className="font-medium text-purple-900">{link.label}</div>
                    <div className="text-sm text-purple-700 mt-1">{link.description}</div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-2 border-green-200 rounded-lg p-6 hover:border-green-400 transition-colors">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Question Sections
              </h2>
              <div className="space-y-3">
                {questionSections.map((section) => (
                  <Link
                    key={section.to}
                    to={section.to}
                    className="block p-4 bg-green-50 hover:bg-green-100 rounded-md transition-colors border border-green-200"
                  >
                    <div className="font-medium text-green-900">{section.label}</div>
                    <div className="text-sm text-green-700 mt-1">{section.description}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition-colors">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">
                Database Admin
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Manage database operations and view match data
              </p>
              <Link
                to="/admin"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                Open Database Admin →
              </Link>
            </div>

            <div className="border-2 border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                API Links
              </h2>
              <div className="space-y-2">
                <a
                  href="/api/lobby/create"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline text-sm"
                >
                  API: Create Lobby
                </a>
                <a
                  href="/api/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline text-sm"
                >
                  API Documentation (Swagger)
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevTools;

