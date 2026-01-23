"use client";

import { PuzzleBoard } from "./PuzzleBoard";
import type { Round2Image, TeamScore, Phase } from "@/types/game";

interface BuzzingTeam {
  teamId: string;
  order: number;
}

interface PlayerPuzzleBoardProps {
  image?: Round2Image;
  revealedPieces?: { [pieceIndex: number]: boolean } | Map<string, boolean>;
  teams: TeamScore[];
  activeTeamId?: string;
  buzzingTeams?: BuzzingTeam[];
  phase?: Phase;
}

export function PlayerPuzzleBoard({
  image,
  revealedPieces,
  teams,
  activeTeamId,
  buzzingTeams = [],
  phase,
}: PlayerPuzzleBoardProps) {
  // Create a map for quick lookup
  const buzzingTeamsMap = new Map<string, number>();
  buzzingTeams.forEach((bt) => buzzingTeamsMap.set(bt.teamId, bt.order));
  return (
    <div className="w-full h-full flex flex-col">
      {/* Logo section - top */}
      <div className="flex-shrink-0 flex items-center justify-center py-1">
        <img
          src="/system/logo.png"
          alt="PVOIL Logo"
          className="h-10 md:h-12 w-auto"
        />
      </div>

      {/* PuzzleBoard section - middle, takes remaining space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PuzzleBoard image={image} revealedPieces={revealedPieces} phase={phase} />
      </div>

      {/* Teams score section - bottom (horizontal format) */}
      <div className="flex-shrink-0 py-2 px-4">
        <div className="w-full flex flex-wrap items-center justify-center gap-6 text-white text-base md:text-lg font-semibold">
          {teams.map((team, index) => {
            const isLast = index === teams.length - 1;
            const buzzOrder = buzzingTeamsMap.get(team.teamId);
            const isBuzzing = buzzOrder !== undefined;
            return (
              <span 
                key={team.teamId} 
                className="relative inline-flex items-center gap-2 px-3 py-1 rounded"
                style={{
                  animation: isBuzzing ? "buzzBlink 1s ease-in-out infinite" : undefined,
                  background: isBuzzing ? "rgba(255,179,0,0.35)" : "transparent",
                }}
              >
                <span>Đội {index + 1}: {team.score} điểm</span>
                {isBuzzing && buzzOrder !== undefined && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center text-[10px] font-bold text-white rounded"
                    style={{
                      width: "18px",
                      height: "18px",
                      background: "linear-gradient(180deg, #ffd700 0%, #ff8c00 100%)",
                      boxShadow: "0 0 6px rgba(255,215,0,0.8), 0 0 12px rgba(255,140,0,0.5)",
                    }}
                  >
                    {buzzOrder}
                  </span>
                )}
                {!isLast && <span className="opacity-50">|</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
