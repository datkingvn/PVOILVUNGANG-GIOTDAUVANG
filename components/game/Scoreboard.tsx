"use client";

import { TeamScore } from "@/types/game";

interface BuzzingTeam {
  teamId: string;
  order: number;
}

interface ScoreboardProps {
  teams: TeamScore[];
  activeTeamId?: string;
  buzzingTeamId?: string; // Keep for backward compatibility
  buzzingTeams?: BuzzingTeam[]; // New prop for multiple buzzing teams
}

export function Scoreboard({ teams, activeTeamId, buzzingTeamId, buzzingTeams }: ScoreboardProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
  
  // Support both old (buzzingTeamId) and new (buzzingTeams) props
  const buzzingTeamsMap = new Map<string, number>();
  if (buzzingTeams && buzzingTeams.length > 0) {
    buzzingTeams.forEach((bt) => buzzingTeamsMap.set(bt.teamId, bt.order));
  } else if (buzzingTeamId) {
    buzzingTeamsMap.set(buzzingTeamId, 1);
  }

  return (
    <div className="w-full flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-4 text-white text-lg md:text-xl font-semibold">
        {sortedTeams.map((team, index) => {
          const isActive = team.teamId === activeTeamId && team.status === "active";
          const buzzOrder = buzzingTeamsMap.get(team.teamId);
          const isBuzzing = buzzOrder !== undefined;
          const isLast = index === sortedTeams.length - 1;
          
          return (
            <span key={team.teamId} className="flex items-center gap-2">
              <span 
                className={
                  isActive 
                    ? "font-bold animate-pulse bg-yellow-500/40 px-2 py-1 rounded" 
                    : isBuzzing 
                    ? "font-bold" 
                    : ""
                }
              >
                Đội {index + 1}: {team.score} Điểm
              </span>
              {!isLast && <span className="opacity-50">|</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

