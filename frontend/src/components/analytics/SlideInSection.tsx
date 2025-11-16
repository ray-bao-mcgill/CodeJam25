import React, { ReactNode, useEffect, useState, useRef } from "react";

interface SlideInSectionProps {
  children: ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
  className?: string;
}

export const SlideInSection: React.FC<SlideInSectionProps> = ({
  children,
  direction = "up",
  delay = 0,
  className = "",
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  const directionClasses = {
    left: "translate-x-[-100px]",
    right: "translate-x-[100px]",
    up: "translate-y-[50px]",
    down: "translate-y-[-50px]",
  };

  return (
    <div
      ref={ref}
      className={`
        transition-all 
        duration-700 
        ease-out
        ${
          isVisible
            ? "opacity-100 translate-x-0 translate-y-0"
            : `opacity-0 ${directionClasses[direction]}`
        }
        ${className}
      `}
    >
      {children}
    </div>
  );
};
