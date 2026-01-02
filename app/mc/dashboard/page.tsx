"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/hooks/useConfirm";
import { ConfirmModal } from "@/components/ui/confirm-modal";

type Round = "ROUND1" | "ROUND2" | "ROUND3" | "ROUND4";

const ROUNDS: { value: Round; label: string }[] = [
  { value: "ROUND1", label: "Vòng 1" },
  // { value: "ROUND2", label: "Vòng 2" },
  // { value: "ROUND3", label: "Vòng 3" },
  // { value: "ROUND4", label: "Vòng 4" },
];

export default function MCDashboardPage() {
  const router = useRouter();
  const state = useGameStore((state) => state.state);
  const [teams, setTeams] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [question, setQuestion] = useState<any>(null);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const { confirm } = useConfirm();

  useHydrateGameState();
  usePusherGameState();

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

  useEffect(() => {
    fetch("/api/teams")
      .then((res) => res.json())
      .then(setTeams)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedRound) {
      fetch(`/api/packages?round=${selectedRound}`)
        .then((res) => res.json())
        .then(setPackages)
        .catch(console.error);
    }
  }, [selectedRound, state?.phase ?? "", state?.activePackageId ?? ""]);

  useEffect(() => {
    if (state?.currentQuestionId) {
      fetch(`/api/questions/${state.currentQuestionId}`)
        .then((res) => res.json())
        .then(setQuestion)
        .catch(console.error);
    }
  }, [state?.currentQuestionId]);

  // Sync selectedRound with gameState
  useEffect(() => {
    if (state?.round) {
      setSelectedRound(state.round as Round);
    }
  }, [state?.round]);

  // Sync selectedTeamId and selectedPackageId with gameState
  useEffect(() => {
    if (!state) return;
    
    // Sync activeTeamId from gameState
    if (state.activeTeamId) {
      setSelectedTeamId(state.activeTeamId);
    }
    
    // Sync activePackageId from gameState
    if (state.activePackageId) {
      setSelectedPackageId(state.activePackageId);
    }
    
    // Only clear selections when game is truly reset (IDLE, no currentQuestionId, no activeTeamId, no activePackageId)
    // This happens after reset game, not when selecting team/package
    if (
      state.phase === "IDLE" &&
      !state.currentQuestionId &&
      !state.activeTeamId &&
      !state.activePackageId
    ) {
      setSelectedTeamId("");
      setSelectedPackageId("");
    }
  }, [
    state?.activeTeamId ?? "",
    state?.activePackageId ?? "",
    state?.phase ?? "",
    state?.currentQuestionId ?? "",
  ]);

  async function selectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    await fetch("/api/game-control/round1/select-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
  }

  async function selectPackage(packageId: string) {
    setSelectedPackageId(packageId);
    await fetch("/api/game-control/round1/select-package-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
  }

  async function startGame() {
    if (!selectedTeamId || !selectedPackageId) {
      alert("Vui lòng chọn đội và gói câu hỏi");
      return;
    }

    await fetch("/api/game-control/round1/start-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selectedTeamId, packageId: selectedPackageId }),
    });
  }

  async function judgeQuestion(result: "CORRECT" | "WRONG") {
    if (!state?.currentQuestionId) return;

    await fetch("/api/game-control/question/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: state.currentQuestionId, result }),
    });
  }

  async function startRound(round: Round) {
    setSelectedRound(round);
    await fetch("/api/game-control/round1/start", {
      method: "POST",
    });
  }

  async function resetGame() {
    confirm("Bạn có chắc chắn muốn reset game? Tất cả điểm số và trạng thái sẽ được đặt lại về ban đầu.", async () => {
      try {
        const res = await fetch("/api/game-control/reset", { method: "POST" });
        if (res.ok) {
          // Reset local state
          setSelectedRound(null);
          setSelectedTeamId("");
          setSelectedPackageId("");
          setQuestion(null);
          // Reload packages to reflect reset status
          if (selectedRound) {
            fetch(`/api/packages?round=${selectedRound}`)
              .then((res) => res.json())
              .then(setPackages)
              .catch(console.error);
          }
        }
      } catch (error) {
        console.error("Reset game failed:", error);
      }
    });
  }

  if (!state) {
    return <div className="p-8 text-white">Đang tải...</div>;
  }

  // Show round selection ONLY if no round is selected yet
  // Once a round is selected, show the management interface for that round
  const showRoundSelection = !selectedRound;
  
  // Show team/package selection if a round is selected
  const showTeamPackageSelection = !!selectedRound;

  const availableTeams = teams.filter((team) => {
    const teamInState = state.teams.find(
      (t) => t.teamId.toString() === team._id.toString()
    );
    return !teamInState || teamInState.status !== "finished";
  });

  // Get assigned team names for packages
  const getAssignedTeamName = (pkg: any) => {
    if (!pkg.assignedTeamId) return null;
    const assignedTeam = teams.find(
      (t) => t._id.toString() === pkg.assignedTeamId.toString()
    );
    return assignedTeam?.name || null;
  };

  const timerExpired =
    state.questionTimer &&
    state.questionTimer.running &&
    Date.now() > state.questionTimer.endsAt;

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          MC Dashboard{selectedRound ? ` - ${ROUNDS.find(r => r.value === selectedRound)?.label || selectedRound}` : ""}
        </h1>
        {(state.phase !== "IDLE" || state.currentQuestionId || state.activeTeamId || state.activePackageId) && (
          <button
            onClick={resetGame}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg font-semibold shadow-md transition-all"
          >
            Reset Game
          </button>
        )}
      </div>

      {/* Round Selection - Show ONLY if no round selected */}
      {showRoundSelection ? (
        <div className="mb-6">
          <Card>
            <h2 className="text-xl font-bold mb-4">Chọn vòng thi</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {ROUNDS.map((round) => (
                <button
                  key={round.value}
                  onClick={() => startRound(round.value)}
                  className="px-6 py-4 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 rounded-xl font-bold text-lg text-white transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {round.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <>
          {/* Back button to return to round selection */}
          <div className="mb-4">
            <button
              onClick={() => {
                setSelectedRound(null);
                setSelectedTeamId("");
                setSelectedPackageId("");
              }}
              className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 rounded-lg text-white font-medium shadow-md transition-all"
            >
              ← Quay lại chọn vòng
            </button>
          </div>
        </>
      )}

      {/* Team and Package Selection - Show after a round is selected */}
      {showTeamPackageSelection && (
        <div className="space-y-4 mb-6">
          <Card>
            <h2 className="text-xl font-bold mb-4">Chọn đội</h2>
            <Select
              options={availableTeams.map((team) => {
                const teamInState = state.teams.find(
                  (t) => t.teamId.toString() === team._id.toString()
                );
                const label =
                  teamInState && teamInState.status === "finished"
                    ? `${team.name} (Đã thi)`
                    : team.name;
                return {
                  value: team._id,
                  label,
                };
              })}
              value={selectedTeamId}
              onChange={selectTeam}
              placeholder="Chọn đội"
            />
          </Card>

          {selectedTeamId && (
            <Card>
              <h2 className="text-xl font-bold mb-4">Chọn gói câu hỏi</h2>
              <div className="grid grid-cols-2 gap-4">
                {packages.map((pkg) => {
                  const isAssigned = pkg.status !== "unassigned";
                  const isCompleted = pkg.status === "completed";
                  const isSelected = pkg._id.toString() === selectedPackageId;
                  const assignedTeamName = getAssignedTeamName(pkg);
                  const canSelect = !isAssigned && !isCompleted;

                  return (
                    <button
                      key={pkg._id}
                      onClick={() => canSelect && selectPackage(pkg._id)}
                      disabled={!canSelect && !isSelected}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? "bg-gradient-to-br from-cyan-600 to-blue-600 border-cyan-400 shadow-lg shadow-cyan-500/50"
                          : isCompleted
                          ? "bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 opacity-50 cursor-not-allowed"
                          : isAssigned
                          ? "bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 opacity-50 cursor-not-allowed"
                          : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-cyan-500 hover:shadow-md"
                      }`}
                    >
                      <div className="font-bold">Gói {pkg.number}</div>
                      {isCompleted && (
                        <div className="text-sm text-gray-400 mt-1">Đã thi</div>
                      )}
                      {isAssigned && !isCompleted && assignedTeamName && (
                        <div className="text-sm text-gray-400 mt-1">
                          {assignedTeamName} chọn
                        </div>
                      )}
                      {!isAssigned && !isCompleted && (
                        <div className="text-sm text-gray-400 mt-1">Chưa chọn</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {selectedTeamId && selectedPackageId && !state?.currentQuestionId && (
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              Bắt đầu
            </button>
          )}
        </div>
      )}


      {state.currentQuestionId && (
        <div className="space-y-4 mb-6">
          <Card>
            <div className="mb-4 flex justify-end">
              <Timer timer={state.questionTimer} size="sm" />
            </div>
            {timerExpired && (
              <p className="text-yellow-500 mb-4 text-center">
                Thời gian đã hết - Chấm điểm câu này sẽ kết thúc bài thi
              </p>
            )}

            <QuestionCard
              questionText={question?.text || "Đang tải..."}
              questionNumber={question?.index}
              totalQuestions={12}
              packageNumber={
                packages.find((p) => p._id.toString() === state.activePackageId)?.number
              }
            />

            <div className="flex gap-4 mt-4">
              <button
                onClick={() => judgeQuestion("CORRECT")}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                ✓ ĐÚNG
              </button>
              <button
                onClick={() => judgeQuestion("WRONG")}
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                ✗ SAI
              </button>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <h2 className="text-xl font-bold mb-4">Bảng điểm</h2>
        <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId?.toString()} />
      </Card>

      <ConfirmModal />
    </div>
  );
}

