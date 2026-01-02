"use client";

import { useEffect, useState } from "react";
import type { QuestionTimer } from "@/types/game";

interface TimerProps {
  timer?: QuestionTimer;
  size?: "sm" | "md" | "lg";
}

export function Timer({ timer, size = "md" }: TimerProps) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!timer || !timer.running) {
      setSeconds(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((timer.endsAt - now) / 1000));
      setSeconds(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);

    return () => clearInterval(interval);
  }, [timer]);

  if (seconds === null) return null;

  const sizeClasses = {
    sm: "text-2xl",
    md: "text-4xl",
    lg: "text-6xl md:text-8xl",
  };

  const colorClass =
    seconds <= 10
      ? "text-red-500"
      : seconds <= 30
      ? "text-yellow-500"
      : "text-green-500";

  return (
    <div
      className={`${sizeClasses[size]} font-bold ${colorClass} tabular-nums`}
    >
      {seconds}s
    </div>
  );
}

