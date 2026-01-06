"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { QuestionTimer } from "@/types/game";

interface TimerProps {
  timer?: QuestionTimer;
  size?: "sm" | "md" | "lg";
}

export function Timer({ timer, size = "md" }: TimerProps) {
  const [seconds, setSeconds] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const serverTimeOffset = useGameStore((state) => state.serverTimeOffset);

  useEffect(() => {
    // Hủy loop cũ nếu timer thay đổi
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!timer || !timer.running) {
      setSeconds(null);
      return;
    }

    const updateTimer = () => {
      // Use server time offset to sync with server time
      const now = Date.now() + serverTimeOffset;
      const remaining = Math.max(0, Math.floor((timer.endsAt - now) / 1000));
      setSeconds(remaining);
      rafRef.current = requestAnimationFrame(updateTimer);
    };

    updateTimer();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [timer, serverTimeOffset]);

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

