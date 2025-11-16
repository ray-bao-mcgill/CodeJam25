import React, { useEffect, useState } from "react";

interface ProgressBarProps {
  value: number; // 0-100
  maxValue?: number;
  color?: "blue" | "red" | "yellow" | "green";
  height?: "sm" | "md" | "lg";
  label?: string;
  showPercentage?: boolean;
  delay?: number;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  maxValue = 100,
  color = "blue",
  height = "md",
  label,
  showPercentage = true,
  delay = 0,
  className = "",
}) => {
  const [progress, setProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const percentage = Math.min((value / maxValue) * 100, 100);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setHasStarted(true);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [delay]);

  useEffect(() => {
    if (!hasStarted) return;

    const startTime = Date.now();
    const duration = 1500;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const animProgress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - animProgress, 3);
      setProgress(percentage * easeProgress);

      if (animProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        setProgress(percentage);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage, hasStarted]);

  const colorClasses = {
    blue: "bg-[var(--game-blue)]",
    red: "bg-[var(--game-red)]",
    yellow: "bg-[var(--game-yellow)]",
    green: "bg-[var(--game-green)]",
  };

  const heightClasses = {
    sm: "h-3",
    md: "h-6",
    lg: "h-10",
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="game-label-text text-sm">{label}</span>
          {showPercentage && (
            <span className="game-label-text text-sm">
              {Math.round(progress)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full ${heightClasses[height]} game-sharp border-4 border-black bg-gray-200 overflow-hidden game-shadow-hard`}
      >
        <div
          className={`${heightClasses[height]} ${colorClasses[color]} transition-all duration-300 ease-out game-shadow-hard-sm`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
