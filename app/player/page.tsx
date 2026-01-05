"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useAuthStore } from "@/store/authStore";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { Round2StageLayout } from "@/components/round2/Round2StageLayout";
import { PuzzleBoard } from "@/components/round2/PuzzleBoard";
import { CNVPanel } from "@/components/round2/CNVPanel";
import { QuestionPanel } from "@/components/round2/QuestionPanel";
import { AnswersResult } from "@/components/round2/AnswersResult";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import { PackageCard } from "@/components/game/PackageCard";
import type { Round2Meta, Phase } from "@/types/game";

export default function PlayerPage() {
  const router = useRouter();
  const state = useGameStore((state) => state.state);
  const user = useAuthStore((state) => state.user);
  const [question, setQuestion] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [packageData, setPackageData] = useState<any>(null);
  const [horizontalQuestions, setHorizontalQuestions] = useState<any[]>([]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    } else {
      setQuestion(null);
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
    if (state?.activePackageId && state?.round === "ROUND2") {
      fetch(`/api/packages/${state.activePackageId}`)
        .then((res) => res.json())
        .then(setPackageData)
        .catch(console.error);
    }
  }, [state?.activePackageId, state?.round, state?.phase, state?.round2State?.pendingAnswers?.length ?? 0]);

  useEffect(() => {
    if (state?.activePackageId && state?.round === "ROUND2") {
      fetch(`/api/questions/public?packageId=${state.activePackageId}&round=ROUND2`)
        .then((res) => res.json())
        .then((questions) => {
          if (Array.isArray(questions)) {
            const horizontals = questions
              .filter((q: any) => q.type === "horizontal")
              .sort((a: any, b: any) => a.index - b.index);
            setHorizontalQuestions(horizontals);
          }
        })
        .catch(console.error);
    }
  }, [state?.activePackageId, state?.round]);

  useEffect(() => {
    fetch("/api/teams/public")
      .then((res) => res.json())
      .then(setTeams)
      .catch(console.error);
  }, []);

  // Track current time for timer updates - must be before early return
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second when timer is running - must be before early return
  useEffect(() => {
    if (!state?.questionTimer || !state.questionTimer.running) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [state?.questionTimer]);

  // Check if current question has been judged - must be before early return
  const currentQuestionJudged = useMemo(() => {
    if (!state?.currentQuestionId || !packageData?.history) return null;
    const historyEntry = packageData.history.find(
      (h: any) => h.questionId === state.currentQuestionId
    );
    if (historyEntry) {
      return historyEntry.result; // "CORRECT" or "WRONG"
    }
    return null;
  }, [state?.currentQuestionId, packageData?.history]);

  // Check if timer is up - must be before early return
  const isTimeUp = useMemo(() => {
    if (!state?.questionTimer || !state.questionTimer.running) return false;
    return currentTime >= state.questionTimer.endsAt;
  }, [state?.questionTimer, currentTime]);

  if (!user || !state) {
    return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;
  }

  const userTeamId = user.teamId?.toString();
  const userTeam = state.teams.find((t) => t.teamId.toString() === userTeamId);
  const isFinished = userTeam?.status === "finished";
  const isRound2 = state.round === "ROUND2";
  const round2Meta: Round2Meta | undefined = packageData?.round2Meta;

  // Round2 specific checks
  const eliminatedTeamIds = round2Meta?.eliminatedTeamIds || [];
  const isEliminated = userTeamId ? eliminatedTeamIds.includes(userTeamId) : false;
  const teamsUsedAttempt = round2Meta?.turnState?.teamsUsedHorizontalAttempt || {};
  const userUsedHorizontalAttempt = userTeamId ? teamsUsedAttempt[userTeamId] : false;
  const currentTeamId = round2Meta?.turnState?.currentTeamId || state.activeTeamId;
  const isMyTurn = currentTeamId === userTeamId;
  const cnvLockTeamId = round2Meta?.buzzState?.cnvLockTeamId;
  const isCNVLocked = cnvLockTeamId === userTeamId;
  const canBuzzCNV = !isEliminated && !cnvLockTeamId && state.phase !== "CNV_ACTIVE" && state.phase !== "CNV_JUDGING" && state.phase !== "ROUND_END";
  
  // Keyword buzz logic
  const keywordBuzzQueue = round2Meta?.buzzState?.keywordBuzzQueue || [];
  const hasBuzzedKeyword = userTeamId ? keywordBuzzQueue.some((item) => item.teamId === userTeamId) : false;
  const canBuzzKeyword = !isEliminated && !hasBuzzedKeyword && state.phase !== "KEYWORD_BUZZ_JUDGING" && state.phase !== "ROUND_END";

  // All non-eliminated teams can answer during HORIZONTAL_ACTIVE or CNV_ACTIVE
  const isHorizontalActive = state.phase === "HORIZONTAL_ACTIVE";
  const isCNVActive = state.phase === "CNV_ACTIVE";
  // Check if this team already submitted
  const pendingAnswers = state.round2State?.pendingAnswers || [];
  const alreadySubmitted = userTeamId ? pendingAnswers.some((pa) => pa.teamId === userTeamId) : false;

  // Cannot answer if question has been judged (either CORRECT or WRONG) or time is up
  const canAnswer = !isEliminated && (isHorizontalActive || isCNVActive) && !alreadySubmitted && !currentQuestionJudged && !isTimeUp;

  // Get horizontal answers status
  const getHorizontalAnswers = () => {
    if (!round2Meta || !horizontalQuestions.length) return [];
    const history = packageData?.history || [];
    const revealedPieces: any = round2Meta.revealedPieces || {};
    const isPieceRevealed = (index: number): boolean => {
      if (!revealedPieces) return false;
      if (revealedPieces instanceof Map) {
        return revealedPieces.get(String(index)) === true || revealedPieces.get(index) === true;
      }
      return revealedPieces[String(index)] === true || revealedPieces[index] === true;
    };
    
    return horizontalQuestions.map((q) => {
      // Find the mapping for this question's horizontal order (index)
      const mapping = round2Meta.mapping?.find((m: any) => m.horizontalOrder === q.index);
      const pieceIndex = mapping?.pieceIndex;
      
      // Only mark as answered if the piece is revealed (meaning all teams were judged and at least one answered correctly)
      const answered = pieceIndex !== undefined && isPieceRevealed(pieceIndex);
      
      // Rejected: piece not revealed but there are WRONG entries in history (all teams answered wrong)
      const historyEntries = history.filter((h: any) => h.questionId === q._id?.toString());
      const rejected = !answered && historyEntries.length > 0 && historyEntries.every((h: any) => h.result === "WRONG");
      
      return {
        order: q.index,
        answer: q.answerText || "",
        answered,
        rejected,
      };
    });
  };

  const handleBuzzKeyword = async () => {
    if (!userTeamId) return;
    try {
      const res = await fetch("/api/game-control/round2/buzz-keyword", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Lỗi rung chuông dự đoán từ khóa");
      }
    } catch (error) {
      console.error("Error buzzing keyword:", error);
      alert("Lỗi rung chuông dự đoán từ khóa");
    }
  };

  const handleBuzzCNV = async () => {
    if (!canBuzzCNV) return;
    try {
      const res = await fetch("/api/game-control/round2/buzz-cnv", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Không thể bấm chuông CNV");
      }
    } catch (error) {
      console.error("Error buzzing CNV:", error);
      alert("Lỗi bấm chuông CNV");
    }
  };

  const handleSubmitAnswer = async (answerText: string) => {
    if (!answerText.trim() || !canAnswer) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/game-control/round2/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Lỗi submit đáp án");
      } else {
        setAnswer("");
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      alert("Lỗi submit đáp án");
    } finally {
      setSubmitting(false);
    }
  };

  // Get current team name
  const currentTeamName = state.teams.find(
    (t) => t.teamId === state.activeTeamId
  )?.nameSnapshot;

  // Get CNV input (if any team is answering CNV)
  // Get the first pending answer if available (for display purposes)
  const cnvInput = state.round2State?.pendingAnswers?.[0]?.answer || "";

  // Round 2 Layout - Broadcast style
  if (isRound2 && round2Meta) {
    return (
      <Round2StageLayout
        puzzleBoard={
          <PuzzleBoard
            image={round2Meta.image}
            revealedPieces={round2Meta.revealedPieces}
          />
        }
        cnvPanel={
          <CNVPanel
            round2Meta={round2Meta}
            cnvInput={state.phase === "CNV_ACTIVE" ? cnvInput : ""}
            horizontalAnswers={getHorizontalAnswers()}
          />
        }
        questionPanel={
          <QuestionPanel
            questionText={question?.text}
            timer={state.questionTimer}
            phase={state.phase as Phase}
            currentTeamName={currentTeamName}
            canAnswer={canAnswer}
            onSubmit={handleSubmitAnswer}
            submitting={submitting}
            alreadySubmitted={alreadySubmitted}
            questionJudged={currentQuestionJudged}
            onBuzzKeyword={handleBuzzKeyword}
            canBuzzKeyword={canBuzzKeyword}
            hasBuzzedKeyword={hasBuzzedKeyword}
          />
        }
        liveView={
          <AnswersResult
            phase={state.phase}
            pendingAnswers={state.round2State?.pendingAnswers || []}
            currentQuestionId={state.currentQuestionId}
            teams={state.teams}
            packageHistory={packageData?.history || []}
          />
        }
        phase={state.phase}
        round2Meta={round2Meta}
        teams={state.teams}
      />
    );
  }

  // Regular Round 1 UI
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
      {/* Status Banner */}
      {state.activeTeamId && !state.currentQuestionId && !isRound2 ? (
        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-600/20 to-yellow-700/20 border border-yellow-500/50 rounded-lg">
          <p className="text-white text-center font-bold text-lg">
            ĐỘI ĐƯỢC MC CHỌN: {selectedTeam?.nameSnapshot || "N/A"}
          </p>
        </div>
      ) : (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-600/20 to-blue-700/20 border border-blue-500/50 rounded-lg">
          <p className="text-white text-center font-bold text-lg">ĐANG CHỜ</p>
        </div>
      )}

      {state.questionTimer && (
        <div className="flex justify-center mb-4">
          <Timer timer={state.questionTimer} size="lg" />
        </div>
      )}

      {/* Regular Round1 UI */}
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
