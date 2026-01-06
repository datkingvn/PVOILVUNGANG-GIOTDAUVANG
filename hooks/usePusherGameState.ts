"use client";

import { useEffect } from "react";
import { pusherClient } from "@/lib/pusher/client";
import { useGameStore } from "@/store/gameStore";
import type { GameState } from "@/types/game";

export function usePusherGameState() {
  const setState = useGameStore((state) => state.setState);
  const setServerTimeOffset = useGameStore((state) => state.setServerTimeOffset);

  useEffect(() => {
    const channel = pusherClient.subscribe("game-state");
    const handleUpdate = (data: { state: GameState; serverTime?: number }) => {
      setState(data.state);
      
      // Calculate server time offset if serverTime is provided
      if (data.serverTime !== undefined) {
        const clientTime = Date.now();
        const offset = data.serverTime - clientTime;
        setServerTimeOffset(offset);
      }
    };

    channel.bind("state:update", handleUpdate);

    return () => {
      channel.unbind("state:update", handleUpdate);
      pusherClient.unsubscribe("game-state");
    };
  }, [setState, setServerTimeOffset]);
}

export async function useHydrateGameState() {
  const setState = useGameStore((state) => state.setState);
  const setServerTimeOffset = useGameStore((state) => state.setServerTimeOffset);

  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch("/api/game-state");
        const data = await res.json();
        if (data.state) {
          setState(data.state);
        }
        
        // Calculate server time offset if serverTime is provided
        if (data.serverTime !== undefined) {
          const clientTime = Date.now();
          const offset = data.serverTime - clientTime;
          setServerTimeOffset(offset);
        }
      } catch (error) {
        console.error("Failed to fetch game state:", error);
      }
    }

    fetchState();
  }, [setState, setServerTimeOffset]);
}

