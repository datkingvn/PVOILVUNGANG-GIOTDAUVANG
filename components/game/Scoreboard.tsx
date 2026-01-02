"use client";

import { TeamScore } from "@/types/game";
import { motion } from "framer-motion";

interface ScoreboardProps {
  teams: TeamScore[];
  activeTeamId?: string;
}

function getTeamColor(isActive: boolean) {
  if (isActive) return { top: "#b01f2c", bottom: "#6f1018" };
  return { top: "#1f3f86", bottom: "#142b5f" };
}

export function Scoreboard({ teams, activeTeamId }: ScoreboardProps) {
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  const H = 64;
  const LEFT_CUT = 18;
  const RIGHT_TOP_CUT = 30;
  const BORDER = 4;
  const TRI = 20;

  const OUTER_CLIP = `polygon(
    ${LEFT_CUT}px 0%,
    calc(100% - ${RIGHT_TOP_CUT}px) 0%,
    100% ${RIGHT_TOP_CUT}px,
    100% 100%,
    ${LEFT_CUT}px 100%,
    0% calc(100% - ${LEFT_CUT}px),
    0% ${LEFT_CUT}px
  )`;

  const innerLeft = Math.max(LEFT_CUT - BORDER, 10);
  const innerRightTop = Math.max(RIGHT_TOP_CUT - BORDER, 18);

  const INNER_CLIP = `polygon(
    ${innerLeft}px 0%,
    calc(100% - ${innerRightTop}px) 0%,
    100% ${innerRightTop}px,
    100% 100%,
    ${innerLeft}px 100%,
    0% calc(100% - ${innerLeft}px),
    0% ${innerLeft}px
  )`;

  return (
    <div className="w-full space-y-3">
      {sortedTeams.map((team, index) => {
        const rank = index + 1;
        const isActive =
          team.teamId === activeTeamId && team.status === "active";
        const fill = getTeamColor(isActive);

        return (
          <motion.div
            key={team.teamId}
            className="relative w-full"
            style={{ height: H }}
            animate={isActive ? { scale: [1, 1.01, 1] } : undefined}
            transition={isActive ? { duration: 1.6, repeat: Infinity } : undefined}
          >
            <div
              className="absolute inset-0"
              style={{
                clipPath: OUTER_CLIP,
                background:
                  "linear-gradient(180deg, rgba(190,250,255,1) 0%, rgba(70,210,245,1) 100%)",
                boxShadow: "0 10px 18px rgba(0,0,0,0.22)",
              }}
            />

            <div
              className="absolute pointer-events-none"
              style={{
                top: 0,
                right: 0,
                width: TRI,
                height: TRI,
                background: "linear-gradient(135deg, #d7fbff 0%, #4bd5f0 100%)",
                clipPath: "polygon(100% 0%, 0% 0%, 100% 100%)",
                opacity: 0.98,
                boxShadow: "inset 0 0 0 1px rgba(10,18,40,0.18)",
              }}
            />

            <div
              className="absolute"
              style={{
                inset: BORDER,
                clipPath: INNER_CLIP,
                background: `linear-gradient(180deg, ${fill.top} 0%, ${fill.bottom} 100%)`,
                boxShadow:
                  "inset 0 2px 0 rgba(255,255,255,0.16), inset 0 -3px 0 rgba(0,0,0,0.40)",
              }}
            >
              <div
                className="absolute left-0 right-0 top-0 pointer-events-none"
                style={{
                  height: "42%",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0))",
                }}
              />

              <div className="h-full w-full flex items-center justify-between px-6">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white font-extrabold text-xl shrink-0">
                    {rank}.
                  </span>
                  <span className="text-white font-extrabold text-2xl truncate">
                    {team.nameSnapshot}
                  </span>
                </div>

                <span className="text-white font-extrabold text-2xl tabular-nums shrink-0">
                  {team.score}
                </span>
              </div>

              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    clipPath: INNER_CLIP,
                    boxShadow:
                      "0 0 0 2px rgba(120,240,255,0.55) inset, 0 0 18px rgba(120,240,255,0.22)",
                  }}
                />
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

