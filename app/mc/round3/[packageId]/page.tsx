"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { Card } from "@/components/ui/card";
import { QuestionDisplay } from "@/components/round3/QuestionDisplay";
import { JudgingPanel } from "@/components/round3/JudgingPanel";
import { Timer } from "@/components/game/Timer";
import { Scoreboard } from "@/components/game/Scoreboard";
import type { PendingAnswer, Round3AnswerResult } from "@/types/game";
import { Play, CheckCircle2 } from "lucide-react";

export default function Round3ManagementPage() {
  const router = useRouter();
  const params = useParams();
  const packageId = params?.packageId as string;
  const state = useGameStore((state) => state.state);
  const serverTimeOffset = useGameStore((state) => state.serverTimeOffset);

  const [packageData, setPackageData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [judgingTeamId, setJudgingTeamId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useHydrateGameState();
  usePusherGameState();

  // Update current time for timer display - use server time offset
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now() + serverTimeOffset);
    }, 100);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

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
    if (packageId) {
      fetch(`/api/packages/${packageId}`)
        .then((res) => res.json())
        .then(setPackageData)
        .catch(console.error);

      fetch(`/api/questions/public?packageId=${packageId}&round=ROUND3`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const sorted = data.sort((a: any, b: any) => a.index - b.index);
            setQuestions(sorted);
          }
        })
        .catch(console.error);
    }
  }, [packageId]);

  useEffect(() => {
    fetch("/api/teams/public")
      .then((res) => res.json())
      .then(setTeams)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (state?.currentQuestionId) {
      const question = questions.find(
        (q: any) => q._id.toString() === state.currentQuestionId
      );
      setCurrentQuestion(question);
    } else {
      setCurrentQuestion(null);
    }
  }, [state?.currentQuestionId, questions]);

  const currentQuestionIndex = state?.round3State?.currentQuestionIndex ?? -1;
  const pendingAnswers = state?.round3State?.pendingAnswers || [];
  const questionIndexKey = String(currentQuestionIndex); // Mongoose Map uses string keys
  
  // Debug: Log questionResults structure
  
  // Access questionResults - handle both Map and object
  const questionResults = (() => {
    if (!state?.round3State?.questionResults) return [];
    if (state.round3State.questionResults instanceof Map) {
      return state.round3State.questionResults.get(questionIndexKey) || [];
    } else {
      const resultsObj = state.round3State.questionResults as Record<string, any>;
      return resultsObj[questionIndexKey] || resultsObj[currentQuestionIndex] || [];
    }
  })();

  const handleStartQuestion = async (questionIndex: number) => {
    try {
      const res = await fetch("/api/game-control/round3/start-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, questionIndex }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Lỗi bắt đầu câu hỏi");
      }
    } catch (error) {
      console.error("Error starting question:", error);
      alert("Lỗi bắt đầu câu hỏi");
    }
  };

  const handleJudge = async (teamId: string, isCorrect: boolean) => {
    setJudgingTeamId(teamId);
    try {
      const res = await fetch("/api/game-control/round3/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, isCorrect }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Lỗi chấm đáp án");
      }
    } catch (error) {
      console.error("Error judging:", error);
      alert("Lỗi chấm đáp án");
    } finally {
      setJudgingTeamId(null);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const handleEndQuestion = async () => {
    try {
      // First, end the current question
      const endRes = await fetch("/api/game-control/round3/end-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!endRes.ok) {
        const error = await endRes.json();
        alert(error.error || "Lỗi kết thúc câu hỏi");
        return;
      }

      // Then, automatically move to next question if not the last one
      if (currentQuestionIndex < 3) {
        const nextQuestionIndex = currentQuestionIndex + 1;
        const startRes = await fetch("/api/game-control/round3/start-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId, questionIndex: nextQuestionIndex }),
        });
        if (!startRes.ok) {
          const error = await startRes.json();
          alert(error.error || "Lỗi chuyển sang câu tiếp");
        }
      }
    } catch (error) {
      console.error("Error ending question:", error);
      alert("Lỗi kết thúc câu hỏi");
    }
  };

  const handleEndRound3 = async () => {
    try {
      const res = await fetch("/api/game-control/round3/end-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Lỗi kết thúc Round 3");
      }
    } catch (error) {
      console.error("Error ending Round 3:", error);
      alert("Lỗi kết thúc Round 3");
    }
  };

  const isQuestionActive = (index: number) => {
    return (
      state?.phase === "ROUND3_QUESTION_ACTIVE" &&
      state?.round3State?.currentQuestionIndex === index
    );
  };

  const isQuestionCompleted = (index: number) => {
    if (!state?.round3State) return false;
    
    // If Round 3 has ended, all questions are completed
    if (state.phase === "ROUND3_END") {
      return true;
    }
    
    const currentQuestionIndex = state.round3State.currentQuestionIndex ?? -1;
    
    // Question is completed if:
    // 1. It has results (at least one team submitted) OR
    // 2. It was previously active (index < currentQuestionIndex) OR
    // 3. Phase is ROUND3_RESULTS and it's not the current question
    
    // Check if this question has results
    const questionIndexKey = String(index);
    let questionResults: any[] = [];
    
    if (state.round3State.questionResults) {
      if (state.round3State.questionResults instanceof Map) {
        questionResults = state.round3State.questionResults.get(questionIndexKey) || [];
      } else {
        const resultsObj = state.round3State.questionResults as Record<string, any>;
        questionResults = resultsObj[questionIndexKey] || resultsObj[index] || [];
      }
    }
    
    const hasResults = questionResults.length > 0;
    const isNotCurrent = currentQuestionIndex !== index;
    const wasPreviouslyActive = currentQuestionIndex > index; // Already moved to next question
    const isInResultsPhase = state.phase === "ROUND3_RESULTS" && isNotCurrent;
    
    // Question is completed if it has results OR was previously active OR phase indicates completion
    return (hasResults || wasPreviouslyActive || isInResultsPhase) && isNotCurrent;
  };

  if (!state || state.round !== "ROUND3") {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div>Vui lòng bắt đầu Round 3 từ dashboard</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Round 3 - Gói {packageData?.number}</h1>
        <button
          onClick={() => router.push("/mc/dashboard")}
          className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 rounded-lg text-white font-medium"
        >
          ← Về Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Questions List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <h2 className="text-xl font-bold mb-4">4 Câu hỏi</h2>
            <div className="space-y-3">
              {questions.map((question, index) => {
                const isActive = isQuestionActive(index);
                const isCompleted = isQuestionCompleted(index);
                const canStart =
                  (state.phase === "ROUND3_READY" ||
                  state.phase === "ROUND3_RESULTS") &&
                  !isCompleted &&
                  !isActive;

                return (
                  <div
                    key={question._id}
                    className={`p-4 rounded-lg border-2 ${
                      isActive
                        ? "bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-cyan-400"
                        : isCompleted
                        ? "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-600/50"
                        : "bg-gray-800 border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">
                        Câu {index + 1}: {question.type === "video" ? "Đoạn băng" : question.type === "arrange" ? "Sắp xếp" : "Suy luận"}
                      </div>
                      {isCompleted && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          <span className="text-sm text-green-400 font-medium">Hoàn thành</span>
                        </div>
                      )}
                      {isActive && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                          <span className="text-sm text-cyan-300 font-medium">Đang thi...</span>
                        </div>
                      )}
                    </div>
                    {canStart && !isActive && !isCompleted && (
                      <button
                        onClick={() => handleStartQuestion(index)}
                        className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Bắt đầu
                      </button>
                    )}
                    {isActive && (
                      <div className="space-y-1">
                        {state.questionTimer && state.questionTimer.running && (
                          <div className="text-xs text-gray-400">
                            Còn {Math.max(0, Math.ceil((state.questionTimer.endsAt - currentTime) / 1000))} giây
                          </div>
                        )}
                        {state.questionTimer && (!state.questionTimer.running || currentTime > state.questionTimer.endsAt) && (
                          <div className="text-xs text-red-400 font-semibold">
                            ⏱️ Đã hết thời gian
                          </div>
                        )}
                      </div>
                    )}
                    {isCompleted && (
                      <div className="text-sm text-green-400 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Đã hoàn thành
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Scoreboard teams={state.teams || []} />
        </div>

        {/* Right Column: Current Question & Judging */}
        <div className="lg:col-span-2 space-y-6">
          {currentQuestion && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  Câu {currentQuestionIndex + 1}
                </h2>
                {state.questionTimer && (
                  <div className="flex flex-col items-end gap-2">
                    <Timer timer={state.questionTimer} size="md" />
  
                    {!state.questionTimer.running && Date.now() > state.questionTimer.endsAt && (
                      <div className="text-sm text-red-400 font-semibold">
                        Đã hết thời gian
                      </div>
                    )}
                  </div>
                )}
              </div>
              <QuestionDisplay question={currentQuestion} />
            </Card>
          )}

          {(state.phase === "ROUND3_QUESTION_ACTIVE" ||
            state.phase === "ROUND3_JUDGING" ||
            state.phase === "ROUND3_RESULTS") && (
            <JudgingPanel
              pendingAnswers={pendingAnswers}
              questionResults={questionResults}
              teams={state.teams || []}
              onJudge={handleJudge}
              question={currentQuestion}
            />
          )}

          {(state.phase === "ROUND3_RESULTS" || 
            (state.phase === "ROUND3_QUESTION_ACTIVE" && 
             state.questionTimer && 
             (!state.questionTimer.running || currentTime > state.questionTimer.endsAt))) && (
            <Card>
              <div className="p-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-lg border border-green-600/50">
                <h3 className="text-xl font-bold mb-4">
                  {state.phase === "ROUND3_RESULTS" 
                    ? "Đã chấm xong câu hỏi này" 
                    : "Đã hết thời gian câu hỏi"}
                </h3>
                {state.phase === "ROUND3_QUESTION_ACTIVE" && 
                 state.questionTimer && 
                 (!state.questionTimer.running || currentTime > state.questionTimer.endsAt) && (
                  <p className="text-gray-300 mb-4">
                    {currentQuestionIndex < 3 
                      ? "Bấm nút bên dưới để chuyển sang câu tiếp"
                      : "Bấm nút bên dưới để kết thúc vòng thi"}
                  </p>
                )}
                <div className="flex gap-3">
                  {state.phase === "ROUND3_QUESTION_ACTIVE" && 
                   state.questionTimer && 
                   (!state.questionTimer.running || currentTime > state.questionTimer.endsAt) ? (
                    currentQuestionIndex === 3 ? (
                      <button
                        onClick={handleEndRound3}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white transition-all"
                      >
                        Kết thúc vòng thi này
                      </button>
                    ) : (
                      <button
                        onClick={handleEndQuestion}
                        className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5" />
                        Chuyển sang câu tiếp
                      </button>
                    )
                  ) : currentQuestionIndex < 3 ? (
                    <button
                      onClick={() => handleStartQuestion(currentQuestionIndex + 1)}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Play className="w-5 h-5" />
                      Chuyển sang câu tiếp
                    </button>
                  ) : currentQuestionIndex === 3 ? (
                    <button
                      onClick={handleEndRound3}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white transition-all"
                    >
                      Kết thúc vòng thi này
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>
          )}

          {state.phase === "ROUND3_END" && (
            <Card>
              <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-600/50">
                <h3 className="text-xl font-bold mb-2">Round 3 đã kết thúc</h3>
                <p className="text-gray-300">
                  Tất cả 4 câu hỏi đã được hoàn thành
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

