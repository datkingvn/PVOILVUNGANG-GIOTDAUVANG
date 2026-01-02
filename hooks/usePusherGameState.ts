"use client";

import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher/client";
import { useGameStore } from "@/store/gameStore";
import type { GameState } from "@/types/game";

export function usePusherGameState() {
  const setState = useGameStore((state) => state.setState);

  useEffect(() => {
    const channel = pusherClient.subscribe("game-state");

    channel.bind("state:update", (data: { state: GameState }) => {
      setState(data.state);
    });

    return () => {
      pusherClient.unsubscribe("game-state");
    };
  }, [setState]);
}

export async function useHydrateGameState() {
  const setState = useGameStore((state) => state.setState);

  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch("/api/game-state");
        const data = await res.json();
        if (data.state) {
          setState(data.state);
        }
      } catch (error) {
        console.error("Failed to fetch game state:", error);
      }
    }

    fetchState();
  }, [setState]);
}

