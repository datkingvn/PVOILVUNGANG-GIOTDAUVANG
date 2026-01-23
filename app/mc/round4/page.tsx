"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { Card } from "@/components/ui/card";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import { getRound4TeamOrder } from "@/lib/utils/round4-engine";
import { useGameStore as useGameStoreHook } from "@/store/gameStore";
import type { GameState, Round4State } from "@/types/game";

// Lightweight countdown component for the 5s steal window to keep re-renders isolated
function StealCountdown({
  endsAt,
  active,
  onComplete,
}: {
  endsAt?: number;
  active: boolean;
  onComplete?: () => void;
}) {
  const serverTimeOffset = useGameStoreHook((s) => s.serverTimeOffset);
  const [seconds, setSeconds] = useState<number>(() => {
    if (!endsAt || !active) return 0;
    const now = Date.now() + serverTimeOffset;
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  });

  useEffect(() => {
    if (!endsAt || !active) {
      setSeconds(0);
      return;
    }

    const update = () => {
      const now = Date.now() + serverTimeOffset;
      const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
      setSeconds((prev) => {
        if (prev !== 0 && remaining === 0 && onComplete) {
          onComplete();
        }
        return remaining;
      });
    };

    update();
    const id = setInterval(update, 200);
    return () => clearInterval(id);
  }, [endsAt, active, serverTimeOffset, onComplete]);

  return (
    <div className="text-3xl font-extrabold text-amber-300 tabular-nums">
      {seconds}s
    </div>
  );
}

export default function Round4ManagementPage() {
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const serverTimeOffset = useGameStore((state) => state.serverTimeOffset);
  const currentTime = Date.now() + (serverTimeOffset || 0);
  const [stealWindowExpired, setStealWindowExpired] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [selectingTeamId, setSelectingTeamId] = useState<string | null>(null);
  const [selectingPackage, setSelectingPackage] = useState<40 | 60 | 80 | null>(
    null
  );
  const [actionLoading, setActionLoading] = useState({
    startQuestion: false,
    judgeMain: false,
    judgeSteal: false,
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useHydrateGameState();
  usePusherGameState();

  useEffect(() => {
    if (!state || state.round !== "ROUND4" || !state.round4State) {
      setIsTeamModalOpen(false);
      return;
    }
    // Mở overlay chọn đội khi:
    // - Phase là R4_IDLE (chưa chọn đội) HOẶC
    // - Phase là R4_TURN_SELECT_PACKAGE nhưng chưa có currentTeamId (sau khi team hoàn thành)
    const phase = state.phase;
    const round4State = state.round4State;
    const selectedPackage = round4State.selectedPackage;
    const currentTeamId = round4State.currentTeamId;
    
    const shouldOpenTeamModal = 
      (phase === "R4_IDLE" || 
       (phase === "R4_TURN_SELECT_PACKAGE" && !currentTeamId)) &&
      !selectedPackage;
    
    setIsTeamModalOpen(shouldOpenTeamModal);
  }, [state, state?.round4State]);

  useEffect(() => {
    if (!state || state.round !== "ROUND4" || !state.round4State) {
      setIsPackageModalOpen(false);
      return;
    }
    // Sau khi đã chọn đội nhưng chưa chọn gói thì mở overlay gói
    if (
      state.phase === "R4_TURN_SELECT_PACKAGE" &&
      state.round4State.currentTeamId &&
      !state.round4State.selectedPackage
    ) {
      setIsPackageModalOpen(true);
    } else {
      setIsPackageModalOpen(false);
    }
  }, [state, state?.round4State]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/mc", { method: "GET" });
        if (!res.ok) {
          router.push("/login/mc");
        }
      } catch {
        router.push("/login/mc");
      }
    }
    checkAuth();
  }, [router]);

  const r4: Round4State | undefined = state?.round4State;

  const currentQuestionRef = useMemo(() => {
    if (!r4 || r4.currentQuestionIndex === undefined || !r4.questions) {
      return undefined;
    }
    return r4.questions[r4.currentQuestionIndex];
  }, [r4]);

  // Hiển thị steal window khi phase là R4_STEAL_WINDOW và có stealWindow
  const isStealWindowPhase =
    state?.phase === "R4_STEAL_WINDOW" && !!r4?.stealWindow;

  useEffect(() => {
    if (!isStealWindowPhase) {
      setStealWindowExpired(false);
    } else {
      // reset khi mở steal window mới
      setStealWindowExpired(false);
    }
  }, [isStealWindowPhase, r4?.stealWindow?.endsAt]);

  const currentTeam = useMemo(
    () => (state && r4 ? state.teams.find((t) => t.teamId === r4.currentTeamId) : undefined),
    [state, r4]
  );

  // Tính toán orderedTeamIds để so sánh chính xác
  const orderedTeamIds = useMemo(() => {
    if (!state) return [];
    const ids = (state.teams || []).map((t) => t.teamId.toString());
    return ids;
  }, [state?.teams]);

  const finishedTeams = useMemo(() => {
    if (!state || !r4) return [];
    
    // Sử dụng completedTeamIds nếu có, fallback về logic cũ nếu không có (backward compatibility)
    const completedTeamIds = r4.completedTeamIds || [];
    
    if (completedTeamIds.length === 0) return [];
    
    // Tìm teams tương ứng với completedTeamIds
    const finished = state.teams.filter((team) => 
      completedTeamIds.includes(team.teamId.toString())
    );
    
    return finished;
  }, [state, r4]);

  // Kiểm tra trạng thái Ngôi sao hy vọng cho câu hỏi hiện tại
  const currentStarStatus = useMemo(() => {
    if (!r4 || r4.currentQuestionIndex === undefined || !r4.currentTeamId) return null;
    // Đảm bảo key matching đúng với format trong confirm-star API (teamId.toString())
    const teamKey = r4.currentTeamId.toString();
    const starUsage = (r4.starUsages as any)?.[teamKey];
    if (!starUsage) return null;
    // Chỉ kiểm tra xem đội có dùng ngôi sao cho câu hỏi hiện tại không
    const hasStarOnCurrent = starUsage.used && starUsage.questionIndex === r4.currentQuestionIndex;
    return hasStarOnCurrent;
  }, [r4?.currentTeamId, r4?.currentQuestionIndex, r4?.starUsages]);

  if (!state || state.round !== "ROUND4" || !r4) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div>Vui lòng bắt đầu Round 4 từ dashboard</div>
      </div>
    );
  }

  const handleSelectTeam = async (teamId: string) => {
    try {
      setSelectingTeamId(teamId);
      setStatusMessage(null);
      const res = await fetch("/api/game-control/round4/select-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Lỗi chọn đội");
      } else {
        setIsTeamModalOpen(false);
        setIsPackageModalOpen(true);
        setStatusMessage("Đã chọn đội, vui lòng chọn gói.");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Lỗi chọn đội");
    } finally {
      setSelectingTeamId(null);
    }
  };

  const handleSelectPackage = async (points: 40 | 60 | 80) => {
    try {
      setSelectingPackage(points);
      setStatusMessage(null);
      const res = await fetch("/api/game-control/round4/select-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: r4.currentTeamId,
          packagePoints: points,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Lỗi chọn gói");
      } else {
        setStatusMessage("Đã chọn gói, có thể bắt đầu câu.");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Lỗi chọn gói");
    } finally {
      setSelectingPackage(null);
    }
  };

  const handleSetStar = async (questionIndex: number) => {
    try {
      const res = await fetch("/api/game-control/round4/set-star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: r4.currentTeamId,
          questionIndex,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Lỗi đặt Ngôi sao hy vọng");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi đặt Ngôi sao hy vọng");
    }
  };

  const handleStartQuestion = async (questionIndex: number) => {
    try {
      setActionLoading((prev) => ({ ...prev, startQuestion: true }));
      setStatusMessage("Đang bắt đầu câu hỏi...");
      const res = await fetch("/api/game-control/round4/start-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Lỗi bắt đầu câu hỏi");
      } else {
        setStatusMessage("Đã bắt đầu câu hỏi");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Lỗi bắt đầu câu hỏi");
    } finally {
      setActionLoading((prev) => ({ ...prev, startQuestion: false }));
    }
  };

  const handleJudgeMain = async (isCorrect: boolean) => {
    try {
      setActionLoading((prev) => ({ ...prev, judgeMain: true }));
      setStatusMessage("Đang chấm đáp án đội đang thi...");
      const res = await fetch("/api/game-control/round4/judge-main", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCorrect }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Lỗi chấm đáp án đội đang thi");
      } else {
        setStatusMessage(isCorrect ? "Đã chấm: Đúng" : "Đã chấm: Sai");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Lỗi chấm đáp án đội đang thi");
    } finally {
      setActionLoading((prev) => ({ ...prev, judgeMain: false }));
    }
  };

  const handleJudgeSteal = async (isCorrect: boolean) => {
    try {
      setActionLoading((prev) => ({ ...prev, judgeSteal: true }));
      setStatusMessage("Đang chấm đáp án giành quyền...");
      const res = await fetch("/api/game-control/round4/judge-steal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCorrect }),
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(err.error || "Lỗi chấm đáp án giành quyền");
      } else {
        setStatusMessage(isCorrect ? "Giành quyền: Đúng" : "Giành quyền: Sai");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Lỗi chấm đáp án giành quyền");
    } finally {
      setActionLoading((prev) => ({ ...prev, judgeSteal: false }));
    }
  };

  const handleSkipNoSteal = async () => {
    try {
      setStatusMessage("Không có đội giành quyền - đang chuyển sang câu tiếp theo...");
      const res = await fetch("/api/game-control/round4/next-question", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        setStatusMessage(
          err.error ||
            "Không thể chuyển sang câu tiếp theo. Vui lòng kiểm tra trạng thái vòng chơi."
        );
      } else {
        setStatusMessage("Đã chuyển sang câu tiếp theo.");
      }
    } catch (e) {
      console.error(e);
      setStatusMessage("Lỗi chuyển sang câu tiếp theo Round 4");
    }
  };

  const hasStarOnQuestion = (index: number) => {
    if (!r4.starUsages || !r4.currentTeamId) return false;
    // Đảm bảo key matching đúng với format trong confirm-star API (teamId.toString())
    const teamKey = r4.currentTeamId.toString();
    const usage = (r4.starUsages as any)[teamKey];
    return usage?.used && usage.questionIndex === index;
  };

  return (
    <div className="min-h-screen p-8 text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Round 4 - Chinh phục đỉnh cao</h1>
        <button
          onClick={() => router.push("/mc/dashboard")}
          className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 rounded-lg text-white font-medium"
        >
          ← Về Dashboard
        </button>
      </div>
      {statusMessage && (
        <div className="mb-4 px-4 py-2 rounded-lg border border-cyan-700/60 bg-cyan-900/30 text-sm text-cyan-100 transition-colors duration-300 ease-out">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: thông tin lượt & chọn gói */}
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="text-sm text-gray-400">Đội đang thi</div>
            <div className="text-xl font-bold">
              {currentTeam ? currentTeam.nameSnapshot : "Chưa chọn"}
            </div>
            <div className="text-sm text-gray-300">
              Lượt { (r4.completedTeamIds?.length ?? r4.turnIndex ?? 0) + 1 } / {state.teams.length}
            </div>
            {finishedTeams.length > 0 && (
              <div className="mt-2 text-xs text-gray-400">
                <div className="font-semibold text-gray-300 mb-1">
                  Đội đã thi:
                </div>
                <div className="space-y-0.5">
                  {finishedTeams.map((team) => (
                    <div key={team.teamId} className="flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>{team.nameSnapshot}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setIsTeamModalOpen(true)}
              disabled={!!r4.selectedPackage || !!state.currentQuestionId}
              className="w-full px-3 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700"
            >
              Chọn đội đang thi
            </button>
          </Card>

          <Card className="p-4 space-y-3">
            <div className="text-sm text-gray-400">Gói điểm</div>
            {r4.selectedPackage ? (
              <div className="space-y-3">
                <div className="text-2xl font-bold text-cyan-400">
                  {r4.selectedPackage} điểm
                </div>
                <button
                  onClick={() => handleStartQuestion(0)}
                  disabled={
                    !r4.questions ||
                    state.currentQuestionId !== undefined ||
                    actionLoading.startQuestion
                  }
                  className="w-full px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed font-semibold transition-colors duration-200"
                >
                  {actionLoading.startQuestion
                    ? "Đang bắt đầu..."
                    : state.currentQuestionId
                      ? "Đang diễn ra câu hỏi"
                      : "Bắt đầu gói (câu 1)"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[40, 60, 80].map((pts) => (
                  <button
                    key={pts}
                    onClick={() => handleSelectPackage(pts as 40 | 60 | 80)}
                    disabled={selectingPackage === pts}
                    className="w-full px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed text-left"
                  >
                    Gói {pts} điểm
                  </button>
                ))}
                <button
                  onClick={() => setIsPackageModalOpen(true)}
                  className="w-full px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left"
                >
                  Mở overlay chọn gói
                </button>
              </div>
            )}
          </Card>

          <Scoreboard teams={state.teams || []} />
        </div>

        {/* Right: điều khiển câu hỏi & steal */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-sm text-gray-400">Câu hiện tại</div>
                  <div className="text-xl font-bold flex items-center gap-2">
                    {r4.currentQuestionIndex !== undefined
                      ? `Câu ${r4.currentQuestionIndex + 1}`
                      : "Chưa bắt đầu"}
                    {r4.currentQuestionIndex !== undefined &&
                      currentStarStatus === true && (
                        <span
                          className="text-yellow-400 text-lg"
                          title="Đội đã sử dụng Ngôi sao hy vọng cho câu này"
                        >
                          ⭐
                        </span>
                      )}
                  </div>
                </div>
              </div>
          {state.questionTimer && (
                <div className="flex flex-col items-end gap-1">
                  <Timer timer={state.questionTimer} size="md" />
                  <div className="text-xs text-gray-400">
                    Còn{" "}
                    {Math.max(
                      0,
                      Math.ceil((state.questionTimer.endsAt - currentTime) / 1000)
                    )}{" "}
                    giây
                  </div>
                </div>
              )}
            </div>

            {/* Trạng thái xác nhận Ngôi sao hy vọng */}
            {state.phase === "R4_STAR_CONFIRMATION" && r4.currentTeamId && (
              <div className="p-4 rounded-lg border border-yellow-500/50 bg-yellow-900/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⭐</span>
                  <div>
                    <div className="text-sm text-yellow-200 font-semibold">
                      Đang chờ đội xác nhận Ngôi sao hy vọng
                    </div>
                    <div className="text-xs text-yellow-100/80 mt-1">
                      Đội {currentTeam?.nameSnapshot || r4.currentTeamId} đang quyết định có sử dụng Ngôi sao hy vọng không
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hiển thị kết quả xác nhận Ngôi sao hy vọng cho câu hỏi hiện tại */}
            {state.phase === "R4_QUESTION_SHOW" &&
              r4.currentQuestionIndex !== undefined &&
              r4.currentTeamId &&
              currentStarStatus !== null && (
                <div className={`p-4 rounded-lg border ${
                  currentStarStatus
                    ? "border-yellow-500/50 bg-yellow-900/30"
                    : "border-gray-500/50 bg-gray-800/30"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {currentStarStatus ? "⭐" : "✗"}
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${
                        currentStarStatus ? "text-yellow-200" : "text-gray-300"
                      }`}>
                        {currentStarStatus
                          ? "Đội đã chọn sử dụng Ngôi sao hy vọng cho câu hỏi này"
                          : "Đội đã chọn không sử dụng Ngôi sao hy vọng cho câu hỏi này"}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Mỗi câu hỏi sẽ hỏi lại đội về việc sử dụng Ngôi sao hy vọng (chỉ được dùng 1 lần trong Vòng 4).
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {r4.selectedPackage && r4.questions && (
              <div className="grid grid-cols-3 gap-3">
                {r4.questions.map((q, idx) => {
                  const isCurrent = r4.currentQuestionIndex === idx;
                  const starred = hasStarOnQuestion(idx);
                  const isDone =
                    r4.currentQuestionIndex !== undefined &&
                    idx < (r4.currentQuestionIndex ?? 0);
                  // Chưa bắt đầu khi chưa có currentQuestionId và currentQuestionIndex
                  const hasNotStarted = r4.currentQuestionIndex === undefined && state.currentQuestionId === undefined;
                  const isDisabled = isDone || hasNotStarted;

                  const disabledClasses = isDisabled
                    ? "opacity-60 cursor-not-allowed pointer-events-none border-slate-700 bg-slate-800"
                    : "cursor-pointer border-slate-600 bg-slate-800 hover:border-cyan-400/80 hover:bg-slate-700";

                  return (
                    <div
                      key={q.questionId}
                      role="button"
                      tabIndex={isDisabled ? -1 : 0}
                      onClick={() => {
                        if (!isDisabled) handleStartQuestion(idx);
                      }}
                      onKeyDown={(e) => {
                        if (isDisabled) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleStartQuestion(idx);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left space-y-1 transition ${isCurrent ? "border-cyan-400 bg-cyan-900/30" : disabledClasses}`}
                    >
                      <div className="text-sm font-semibold flex items-center justify-between">
                        <span>
                          Câu {idx + 1} - {q.points} điểm
                        </span>
                        {isDone && (
                          <span className="text-xs px-2 py-1 rounded bg-slate-700 text-gray-200">
                            Đã thi
                          </span>
                        )}
                      </div>
                      {starred && (
                        <div className="text-xs text-yellow-300 font-semibold">
                          ★ Ngôi sao hy vọng
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleJudgeMain(true)}
                disabled={actionLoading.judgeMain || !state.currentQuestionId}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {actionLoading.judgeMain ? "Đang chấm..." : "Đúng"}
              </button>
              <button
                onClick={() => handleJudgeMain(false)}
                disabled={actionLoading.judgeMain || !state.currentQuestionId}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {actionLoading.judgeMain ? "Đang chấm..." : "Sai"}
              </button>
            </div>
          </Card>

          {isStealWindowPhase && r4.stealWindow && (
            <Card className="p-4 bg-gradient-to-r from-amber-900/40 to-red-900/40 border border-amber-500/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-amber-200">
                    Cửa sổ giành quyền trả lời (5 giây)
                  </div>
                  <div className="text-sm text-amber-100">
                    Các đội còn lại bấm chuông để cướp điểm.
                  </div>
                </div>
                <StealCountdown
                  endsAt={r4.stealWindow.endsAt}
                  active={r4.stealWindow.active}
                  onComplete={() => setStealWindowExpired(true)}
                />
              </div>
              {stealWindowExpired &&
                !r4.stealWindow.buzzLockedTeamId && (
                <div className="flex items-center justify-between pt-2 border-t border-amber-500/40">
                  <div className="text-sm text-amber-100/90">
                    Hết thời gian giành quyền, không có đội nào bấm chuông.
                  </div>
                  <button
                    type="button"
                    onClick={handleSkipNoSteal}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold"
                  >
                    Sang câu tiếp theo
                  </button>
                </div>
              )}
            </Card>
          )}

          {state.phase === "R4_STEAL_LOCKED" && r4.stealWindow && (
            <Card className="p-4 bg-gradient-to-r from-cyan-900/40 to-emerald-900/40 border border-cyan-500/60 space-y-2">
              <div className="text-lg font-bold text-cyan-200">
                Đội giành quyền:{" "}
                {
                  state.teams.find(
                    (t) => t.teamId === r4.stealWindow?.buzzLockedTeamId
                  )?.nameSnapshot
                }
              </div>
              <div className="text-sm text-gray-200">
                MC chấm đúng / sai cho đáp án giành quyền (đáp án đầu tiên).
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleJudgeSteal(true)}
                  disabled={actionLoading.judgeSteal}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {actionLoading.judgeSteal ? "Đang chấm..." : "Đúng (cướp điểm)"}
                </button>
                <button
                  onClick={() => handleJudgeSteal(false)}
                  disabled={actionLoading.judgeSteal}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {actionLoading.judgeSteal ? "Đang chấm..." : "Sai (trừ 1/2 điểm)"}
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {isTeamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400 uppercase tracking-wide">
                  Chọn đội thi
                </div>
                <div className="text-2xl font-bold text-white">
                  Vòng 4 - Lượt hiện tại
                </div>
              </div>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {state.teams.map((team, index) => {
                // Tính toán hasPlayed dựa trên completedTeamIds
                // Team đã thi nếu teamId có trong completedTeamIds
                const teamIdStr = team.teamId.toString();
                const completedTeamIds = r4.completedTeamIds || [];
                const hasPlayed = completedTeamIds.includes(teamIdStr);
                const isActive = team.teamId === r4.currentTeamId;
                const cannotChange = !!r4.selectedPackage || !!state.currentQuestionId;
                const isDisabled = hasPlayed || selectingTeamId === team.teamId || cannotChange;
                return (
                  <button
                    key={team.teamId}
                    disabled={isDisabled}
                    onClick={() => handleSelectTeam(team.teamId)}
                    className={`p-4 rounded-xl border text-left transition ${
                      isActive
                        ? "border-cyan-400 bg-cyan-900/30"
                        : "border-slate-700 bg-slate-800/60 hover:border-cyan-500 hover:bg-slate-800"
                    } ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-lg font-semibold text-white">
                        {team.nameSnapshot}
                      </div>
                      {hasPlayed && (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-100 font-semibold">
                          ĐÃ THI
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-300">
                      Điểm: {team.score}
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                      {cannotChange
                        ? "Đã chọn gói, không thể đổi đội"
                        : hasPlayed
                          ? "Đã hoàn thành lượt thi"
                          : selectingTeamId === team.teamId
                            ? "Đang chọn..."
                            : "Bấm để chọn làm đội thi"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isPackageModalOpen && !r4.selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400 uppercase tracking-wide">
                  Chọn gói điểm
                </div>
                <div className="text-2xl font-bold text-white">
                  Đội: {currentTeam?.nameSnapshot || "Chưa chọn"}
                </div>
              </div>
              <button
                onClick={() => setIsPackageModalOpen(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[40, 60, 80].map((pts) => (
                <button
                  key={pts}
                  disabled={selectingPackage === pts}
                  onClick={() => handleSelectPackage(pts as 40 | 60 | 80)}
                  className="p-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:border-cyan-500 hover:bg-slate-800 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="text-xl font-bold text-white">Gói {pts}</div>
                  <div className="text-sm text-gray-300 mt-1">
                    Chọn cho đội đang thi
                  </div>
                </button>
              ))}
            </div>
            <div className="text-xs text-gray-400">
              MC chọn đội trước, sau đó chọn một gói điểm (40/60/80) cho lượt này.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


