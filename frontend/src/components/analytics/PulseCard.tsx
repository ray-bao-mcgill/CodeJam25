import React, { ReactNode } from "react";

interface PulseCardProps {
  children: ReactNode;
  highlight?: boolean;
  color?: "blue" | "red" | "yellow" | "green" | "purple";
  className?: string;
  onClick?: () => void;
}

export const PulseCard: React.FC<PulseCardProps> = ({
  children,
  highlight = false,
  color = "blue",
  className = "",
  onClick,
}) => {
  const colorClasses = {
    blue: "border-[var(--game-blue)] bg-gradient-to-br from-blue-50 to-blue-100",
    red: "border-[var(--game-red)] bg-gradient-to-br from-red-50 to-red-100",
    yellow:
      "border-[var(--game-yellow)] bg-gradient-to-br from-yellow-50 to-yellow-100",
    green:
      "border-[var(--game-green)] bg-gradient-to-br from-green-50 to-green-100",
    purple: "border-purple-600 bg-gradient-to-br from-purple-50 to-purple-100",
  };

  return (
    <div
      className={`
        game-sharp 
        border-6 
        ${colorClasses[color]}
        p-6 
        game-shadow-hard-lg
        ${highlight ? "animate-pulse-slow" : ""}
        ${onClick ? "cursor-pointer hover:scale-105 transition-transform" : ""}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
