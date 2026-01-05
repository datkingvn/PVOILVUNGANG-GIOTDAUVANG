"use client";

import { motion } from "framer-motion";

interface TeamPodiumsProps {
  teams: Array<{
    teamId: string;
    nameSnapshot: string;
    score: number;
    status: string;
  }>;
  activeTeamId?: string;
  eliminatedTeamIds?: string[];
}

export function TeamPodiums({ teams, activeTeamId, eliminatedTeamIds = [] }: TeamPodiumsProps) {
  // Sort teams by score (descending) then by name
  const sortedTeams = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.nameSnapshot.localeCompare(b.nameSnapshot);
  });

  // Take top 4 teams, or all teams if less than 4
  const displayTeams = sortedTeams.slice(0, 4);

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-red-950 via-red-900 to-red-950 rounded-lg overflow-hidden">
      {/* Background Pattern - geometric patterns */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px),
                             repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba(255,255,255,0.03) 20px, rgba(255,255,255,0.03) 40px)`,
          }} 
        />
      </div>

      {/* THACO Logo at top center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="text-white/40 text-3xl font-bold tracking-widest drop-shadow-lg">THACO</div>
      </div>

      {/* Podiums Grid - 4 podiums in a row */}
      <div className="relative z-20 h-full flex items-end justify-center gap-6 pb-12 pt-20 px-4">
        {displayTeams.map((team, index) => {
          const isActive = team.teamId === activeTeamId;
          const isEliminated = eliminatedTeamIds.includes(team.teamId);
          const teamIndex = sortedTeams.findIndex((t) => t.teamId === team.teamId);

          return (
            <motion.div
              key={team.teamId}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="flex flex-col items-center flex-1 max-w-32"
            >
              {/* Podium - White box with score */}
              <div
                className={`w-full aspect-[3/4] bg-white rounded-t-xl shadow-2xl flex flex-col items-center justify-center mb-3 transition-all relative ${
                  isActive ? "ring-4 ring-cyan-400 ring-offset-2 ring-offset-red-900 scale-105 shadow-cyan-400/50" : ""
                } ${
                  isEliminated ? "opacity-50 grayscale" : ""
                }`}
                style={{
                  boxShadow: isActive 
                    ? "0 20px 40px rgba(0,0,0,0.4), 0 0 0 4px rgba(34,211,238,0.5)"
                    : "0 10px 30px rgba(0,0,0,0.3)"
                }}
              >
                {/* Logo/Symbol at top - placeholder */}
                <div className="text-gray-400 text-lg font-bold mb-3 tracking-tight" style={{ fontFamily: "monospace" }}>
                  μβπ
                </div>
                
                {/* Score - Large number */}
                <div className={`text-5xl font-black ${isActive ? "text-cyan-600" : "text-gray-800"} tabular-nums`}>
                  {team.score}
                </div>
              </div>

              {/* Team Name below podium */}
              <div className={`text-white text-xs font-semibold text-center px-2 truncate w-full ${
                isEliminated ? "line-through opacity-50" : ""
              }`}>
                {team.nameSnapshot}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

