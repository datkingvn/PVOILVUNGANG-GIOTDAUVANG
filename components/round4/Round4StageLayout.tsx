"use client";

import { Timer } from "@/components/game/Timer";
import type { GameState, Round4State } from "@/types/game";

interface Round4StageLayoutProps {
  state: GameState;
}

export function Round4StageLayout({ state }: Round4StageLayoutProps) {
  if (state.round !== "ROUND4" || !state.round4State) {
    return null;
  }

  const r4: Round4State = state.round4State;
  const currentTeam = state.teams.find((t) => t.teamId === r4.currentTeamId);
  const currentQuestionRef =
    r4.currentQuestionIndex !== undefined && r4.questions
      ? r4.questions[r4.currentQuestionIndex]
      : undefined;

  const hasStarOnCurrent = (() => {
    if (!r4.starUsages || !r4.currentTeamId) return false;
    const usage = (r4.starUsages as any)[r4.currentTeamId];
    return (
      usage?.used &&
      usage.questionIndex !== undefined &&
      usage.questionIndex === r4.currentQuestionIndex
    );
  })();

  const isStealWindow =
    state.phase === "R4_STEAL_WINDOW" && r4.stealWindow && r4.stealWindow.active;

  return (
    <div className="w-full aspect-video bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white flex flex-col transition-colors duration-300 ease-out">
      <div className="flex justify-between items-center px-10 pt-6">
        <div>
          <div className="text-sm uppercase tracking-wide text-gray-400">
            Đội đang thi
          </div>
          <div className="text-2xl font-bold">
            {currentTeam ? currentTeam.nameSnapshot : "Đang chuẩn bị"}
          </div>
        </div>
        <div className="flex items-center gap-6">
          {currentQuestionRef && (
            <div className="text-right">
              <div className="text-sm text-gray-400">
                Câu{" "}
                {r4.currentQuestionIndex !== undefined
                  ? r4.currentQuestionIndex + 1
                  : "-"}
              </div>
              <div className="text-xl font-semibold text-cyan-300">
                {currentQuestionRef.points} điểm{" "}
                {hasStarOnCurrent && (
                  <span className="ml-2 text-yellow-300 font-bold">★</span>
                )}
              </div>
            </div>
          )}
          {state.questionTimer && (
            <div className="flex flex-col items-end transition-opacity duration-200">
              <Timer timer={state.questionTimer} size="lg" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-16">
        {isStealWindow ? (
          <div className="px-10 py-6 rounded-2xl bg-gradient-to-r from-amber-700 to-red-700 shadow-2xl">
            <div className="text-3xl font-extrabold text-white mb-2 text-center">
              BẤM CHUÔNG 5 GIÂY
            </div>
            <div className="text-sm text-amber-100 text-center">
              Các đội còn lại bấm chuông để giành quyền trả lời và cướp điểm.
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-300 text-xl">
            Đang diễn ra lượt thi Round 4
          </div>
        )}
      </div>
    </div>
  );
}


