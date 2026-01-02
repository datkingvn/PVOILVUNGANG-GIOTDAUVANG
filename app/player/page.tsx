"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useAuthStore } from "@/store/authStore";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import { PackageCard } from "@/components/game/PackageCard";
import { Card } from "@/components/ui/card";

export default function PlayerPage() {
  const router = useRouter();
  const state = useGameStore((state) => state.state);
  const user = useAuthStore((state) => state.user);
  const [question, setQuestion] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  useHydrateGameState();
  usePusherGameState();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/team", { method: "GET" });
        if (!res.ok) {
          router.push("/login/team");
          return;
        }
        const data = await res.json();
        useAuthStore.getState().setUser(data.user);
      } catch {
        router.push("/login/team");
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (state?.currentQuestionId) {
      fetch(`/api/questions/${state.currentQuestionId}`)
        .then((res) => res.json())
        .then(setQuestion)
        .catch(console.error);
    }
  }, [state?.currentQuestionId]);

  useEffect(() => {
    if (state?.round) {
      fetch(`/api/packages/public?round=${state.round}`)
        .then((res) => res.json())
        .then(setPackages)
        .catch(console.error);
    }
  }, [state?.round, state?.phase, state?.activePackageId]);

  useEffect(() => {
    fetch("/api/teams/public")
      .then((res) => res.json())
      .then(setTeams)
      .catch(console.error);
  }, []);

  if (!user || !state) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  }

  const userTeam = state.teams.find(
    (t) => t.teamId.toString() === user.teamId?.toString()
  );
  const isFinished = userTeam?.status === "finished";
  const isOtherTeamTurn =
    state.activeTeamId &&
    state.activeTeamId.toString() !== user.teamId?.toString() &&
    state.currentQuestionId;

  const selectedTeamFromState = state.teams.find(
    (t) => t.teamId.toString() === state.activeTeamId?.toString()
  );
  const selectedTeamFromAPI = teams.find(
    (t) => t._id.toString() === state.activeTeamId?.toString()
  );
  const selectedTeam =
    selectedTeamFromState ||
    (selectedTeamFromAPI ? { nameSnapshot: selectedTeamFromAPI.name } : null);

  const isGameActive = state && state.phase !== "IDLE" && state.currentQuestionId;
  const backgroundImage = isGameActive ? "/system/match.jpg" : "/system/bg.png";

  return (
    <div
      className="min-h-screen p-4 md:p-6 relative"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {isFinished ? (
        <Card className="mb-4 bg-gradient-to-r from-gray-600/20 to-gray-700/20 border-gray-500/50">
          <p className="text-white text-center font-bold text-lg">ĐÃ THI XONG</p>
        </Card>
      ) : state.activeTeamId && !state.currentQuestionId ? (
        <Card className="mb-4 bg-gradient-to-r from-yellow-600/20 to-yellow-700/20 border-yellow-500/50">
          <p className="text-white text-center font-bold text-lg">
            ĐỘI ĐƯỢC MC CHỌN: {selectedTeam?.nameSnapshot || "N/A"}
          </p>
        </Card>
      ) : isOtherTeamTurn ? (
        <Card className="mb-4 bg-gradient-to-r from-red-600/20 to-red-700/20 border-red-500/50">
          <p className="text-white text-center font-bold text-lg">
            ĐÂY LÀ PHẦN THI CỦA ĐỘI KHÁC
          </p>
        </Card>
      ) : (
        <Card className="mb-4 bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-500/50">
          <p className="text-white text-center font-bold text-lg">ĐANG CHỜ LƯỢT</p>
        </Card>
      )}

      {state.questionTimer && (
        <div className="flex justify-center mb-4">
          <Timer timer={state.questionTimer} size="lg" />
        </div>
      )}

      {state.activeTeamId && state.phase !== "IDLE" && !state.currentQuestionId && (
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-4">Gói câu hỏi</h2>
          {packages.length === 0 ? (
            <p className="text-gray-400 text-center py-4">Đang tải danh sách gói...</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {packages.map((pkg) => {
                const isAssigned = pkg.status !== "unassigned";
                const assignedTeamIdStr = pkg.assignedTeamId?.toString();
                const assignedTeam = assignedTeamIdStr
                  ? teams.find((t) => t._id.toString() === assignedTeamIdStr)
                  : null;
                const isCurrentPackage =
                  state.activePackageId?.toString() === pkg._id.toString();

                return (
                  <PackageCard
                    key={pkg._id}
                    packageNumber={pkg.number}
                    assignedTeamName={assignedTeam?.name}
                    isAssigned={isAssigned}
                    isCurrentPackage={isCurrentPackage}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {state.currentQuestionId && (
        <div className="mb-4">
          <QuestionCard
            questionText={question?.text || "Đang tải câu hỏi..."}
            questionNumber={question?.index}
            totalQuestions={12}
          />
        </div>
      )}

      <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId?.toString()} />
    </div>
  );
}

