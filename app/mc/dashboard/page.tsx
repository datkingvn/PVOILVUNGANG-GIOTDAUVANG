"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
import { Modal } from "@/components/ui/modal";
import { suggestAnswerMatch } from "@/lib/utils/round2-engine";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Users, Grid3x3, XCircle, CheckCircle2, Clock, Trophy, AlertCircle, Play, ArrowRight } from "lucide-react";

type Round = "ROUND1" | "ROUND2" | "ROUND3" | "ROUND4";

const ROUNDS: { value: Round; label: string }[] = [
  { value: "ROUND1", label: "Vòng 1" },
  { value: "ROUND2", label: "Vòng 2" },
  { value: "ROUND3", label: "Vòng 3" },
  { value: "ROUND4", label: "Vòng 4" },
];

export default function MCDashboardPage() {
  const router = useRouter();
  const state = useGameStore((state) => state.state);
  const serverTimeOffset = useGameStore((state) => state.serverTimeOffset);
  const [teams, setTeams] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [question, setQuestion] = useState<any>(null);
  const [packageData, setPackageData] = useState<any>(null);
  const [horizontalQuestions, setHorizontalQuestions] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [showJudgingModal, setShowJudgingModal] = useState(false);
  const [selectedTeamIdForJudging, setSelectedTeamIdForJudging] = useState<string | null>(null);
  const [judgingAnswer, setJudgingAnswer] = useState("");
  const [judgingSuggestion, setJudgingSuggestion] = useState<"exact" | "near" | "no_match" | null>(null);
  const [isSwitchingRound, setIsSwitchingRound] = useState(false);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isJudging, setIsJudging] = useState(false);
  const { confirm } = useConfirm();

  useHydrateGameState();
  usePusherGameState();

  // Track when state has been loaded (even if it's null)
  useEffect(() => {
    // State is considered loaded if it's not undefined
    // null means no game state exists, which is valid
    if (state !== undefined) {
      setIsLoadingState(false);
    }
  }, [state]);

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
    fetch("/api/teams", { cache: "no-store" })
      .then((res) => res.json())
      .then(setTeams)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const roundToFetch = selectedRound || (state?.round as Round | null);
    if (roundToFetch) {
      setIsLoadingPackages(true);
      fetch(`/api/packages?round=${roundToFetch}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          setPackages(data);
          setIsLoadingPackages(false);
        })
        .catch((error) => {
          console.error(error);
          setIsLoadingPackages(false);
        });
    } else {
      setPackages([]);
      setIsLoadingPackages(false);
    }
  }, [selectedRound, state?.round]);

  // Refresh packages when package completes (phase becomes IDLE and activePackageId is cleared)
  useEffect(() => {
    const roundToFetch = selectedRound || (state?.round as Round | null);
    // When phase becomes IDLE and activePackageId is cleared, it means a package just completed
    if (roundToFetch && state?.phase === "IDLE" && !state?.activePackageId && !state?.currentQuestionId) {
      fetch(`/api/packages?round=${roundToFetch}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          setPackages(data);
        })
        .catch(console.error);
    }
  }, [state?.phase, state?.activePackageId, state?.currentQuestionId, selectedRound, state?.round]);

  useEffect(() => {
    if (state?.currentQuestionId) {
      fetch(`/api/questions/${state.currentQuestionId}`, { cache: "no-store" })
        .then((res) => res.json())
        .then(setQuestion)
        .catch(console.error);
    }
  }, [state?.currentQuestionId]);

  // Fetch package data when activePackageId or phase changes
  useEffect(() => {
    if (state?.activePackageId && state?.round === "ROUND2") {
      const fetchPackageData = () => {
        fetch(`/api/packages/${state.activePackageId}`, { cache: "no-store" })
          .then((res) => res.json())
          .then((data) => {
            setPackageData(data);
          })
          .catch(console.error);
        
        // Fetch horizontal questions to check which ones are answered
        fetch(`/api/questions/public?packageId=${state.activePackageId}&round=ROUND2`, { cache: "no-store" })
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
      };

      fetchPackageData();

      // Poll package data every 1 second when in Round2 to catch buzz state changes
      const interval = setInterval(fetchPackageData, 1000);
      return () => clearInterval(interval);
    } else if (state?.activePackageId && state?.round === "ROUND1") {
      // Fetch package data for Round 1 to track history changes
      const fetchPackageData = () => {
        fetch(`/api/packages/${state.activePackageId}`, { cache: "no-store" })
          .then((res) => res.json())
          .then((data) => {
            setPackageData(data);
          })
          .catch(console.error);
      };

      fetchPackageData();

      // Poll package data every 1 second when in Round 1 to catch history changes
      const interval = setInterval(fetchPackageData, 1000);
      return () => clearInterval(interval);
    }
  }, [state?.activePackageId, state?.round, state?.phase]);


  // Calculate judging suggestion when answer changes
  useEffect(() => {
    if (showJudgingModal && question && judgingAnswer) {
      const suggestion = suggestAnswerMatch(
        judgingAnswer,
        question.answerText || "",
        question.acceptedAnswers
      );
      setJudgingSuggestion(suggestion);
    } else {
      setJudgingSuggestion(null);
    }
  }, [judgingAnswer, question, showJudgingModal]);

  // Track if user manually cleared selectedRound
  const [userClearedRound, setUserClearedRound] = useState(false);

  // Clear selectedTeamId when package completes (activeTeamId is cleared)
  useEffect(() => {
    if (state?.round === "ROUND1" && !state?.activeTeamId && !state?.activePackageId && state?.phase === "IDLE") {
      // Package completed, clear selected team to require selecting new team
      setSelectedTeamId("");
      setSelectedPackageId("");
    }
  }, [state?.activeTeamId, state?.activePackageId, state?.phase, state?.round]);

  // Sync selectedRound with gameState
  // Sync when round is set in state, even if game is not active yet (e.g., when user selects a round)
  useEffect(() => {
    // Don't sync if user manually cleared the round selection or if switching round
    if (userClearedRound || isSwitchingRound) return;
    
    const isGameActive = state?.phase && state.phase !== "IDLE" || 
                        state?.currentQuestionId || 
                        state?.activeTeamId || 
                        state?.activePackageId;
    
    if (state?.round) {
      // Only sync if different to avoid unnecessary updates
      if (selectedRound !== state.round) {
        setSelectedRound(state.round as Round);
        setUserClearedRound(false); // Reset flag when round is set
      }
    } else if (!isGameActive && !state?.round && selectedRound !== null && state) {
      // Only clear selectedRound when game is not active AND no round is set in state
      // This allows showing round selection screen when truly idle
      setSelectedRound(null);
      setUserClearedRound(false); // Reset flag when game becomes inactive
    }
  }, [state?.round, state?.phase, state?.currentQuestionId, state?.activeTeamId, state?.activePackageId, userClearedRound, isSwitchingRound, selectedRound]);

  // Sync selectedTeamId and selectedPackageId with gameState
  useEffect(() => {
    if (!state) return;
    
    if (state?.activeTeamId) {
      setSelectedTeamId(state.activeTeamId);
    }
    
    if (state?.activePackageId) {
      setSelectedPackageId(state.activePackageId);
    }
    
    if (
      state?.phase === "IDLE" &&
      !state?.currentQuestionId &&
      !state?.activeTeamId &&
      !state?.activePackageId
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

  // Get stable references for dependencies - always use defined values
  const pendingAnswersArray = state?.round2State?.pendingAnswers ?? null;
  const phaseValue = state?.phase ?? "";

  // Memoize pending answers to ensure stable reference
  const pendingAnswers = useMemo(() => {
    const answers = pendingAnswersArray || [];
    // Debug: log when answers change
    console.log("Pending answers in MC dashboard:", answers.length, answers);
    console.log("Full round2State:", state?.round2State);
    return answers;
  }, [pendingAnswersArray, state?.round2State]);

  // Memoize phase to ensure stable reference
  const currentPhase = useMemo(() => {
    return phaseValue || "";
  }, [phaseValue]);

  // Auto-select first team and open modal when pending answers change
  useEffect(() => {
    if (pendingAnswers.length > 0) {
      // Auto-open modal when there are new answers (only if not already open)
      if (!showJudgingModal) {
        setShowJudgingModal(true);
      }
      // Auto-select first team if none selected
      if (!selectedTeamIdForJudging) {
        setSelectedTeamIdForJudging(pendingAnswers[0].teamId);
      } else if (!pendingAnswers.find(pa => pa.teamId === selectedTeamIdForJudging)) {
        // Selected team's answer was removed (judged), select first available
        if (pendingAnswers.length > 0) {
          setSelectedTeamIdForJudging(pendingAnswers[0].teamId);
        }
      }
    } else {
      // Only close modal when no more answers at all
      if (pendingAnswers.length === 0) {
        setShowJudgingModal(false);
        setSelectedTeamIdForJudging(null);
        setJudgingAnswer("");
      }
    }
  }, [pendingAnswers]);
  
  // Update judging answer when selected team changes
  useEffect(() => {
    if (selectedTeamIdForJudging && pendingAnswers.length > 0) {
      const teamAnswer = pendingAnswers.find(
        (pa) => pa.teamId === selectedTeamIdForJudging
      );
      if (teamAnswer) {
        setJudgingAnswer(teamAnswer.answer);
      } else {
        setJudgingAnswer("");
      }
    } else {
      setJudgingAnswer("");
    }
  }, [selectedTeamIdForJudging, pendingAnswers]);

  async function selectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    if (state?.round === "ROUND1" || selectedRound === "ROUND1") {
      await fetch("/api/game-control/round1/select-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
    } else if (state?.round === "ROUND2") {
      await fetch("/api/game-control/round2/select-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
    }
  }

  async function selectPackage(packageId: string) {
    setSelectedPackageId(packageId);
    if (state?.round === "ROUND1" || selectedRound === "ROUND1") {
      await fetch("/api/game-control/round1/select-package-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
    } else if (state?.round === "ROUND2" || selectedRound === "ROUND2") {
      // For Round2, navigate to setup page if package doesn't have round2Meta
      const pkg = packages.find((p) => p._id.toString() === packageId);
      if (pkg && !pkg.round2Meta) {
        router.push(`/mc/round2/${packageId}`);
      }
      // If package has round2Meta, just select it (no API call needed for preview)
      // The package will be activated when starting the game
    } else if (state?.round === "ROUND3" || selectedRound === "ROUND3") {
      // For Round3, navigate to management page
      router.push(`/mc/round3/${packageId}`);
    }
  }

  async function startGame() {
    if (!selectedPackageId) {
      alert("Vui lòng chọn gói câu hỏi");
      return;
    }

    if (state?.round === "ROUND1" || selectedRound === "ROUND1") {
      if (!selectedTeamId) {
        alert("Vui lòng chọn đội");
        return;
      }
      await fetch("/api/game-control/round1/start-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: selectedTeamId, packageId: selectedPackageId }),
      });
    } else if (state?.round === "ROUND2" || selectedRound === "ROUND2") {
      const res = await fetch("/api/game-control/round2/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: selectedPackageId }),
      });
    }
  }

  async function judgeQuestion(result: "CORRECT" | "WRONG", teamId?: string) {
    if (!state) return;
    if (!state.currentQuestionId && state.round !== "ROUND2") return;
    if (isJudging) return; // Prevent double click

    setIsJudging(true);
    try {
    if (state.round === "ROUND2") {
      const targetTeamId = teamId || selectedTeamIdForJudging;
      if (!targetTeamId) {
        alert("Vui lòng chọn đội để chấm");
        return;
      }
      const res = await fetch("/api/game-control/round2/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          isCorrect: result === "CORRECT",
          teamId: targetTeamId,
        }),
      });
      
      if (res.ok) {
        // Wait a bit for state to update, then check remaining answers
        // The useEffect will handle selecting next team and keeping modal open
        // Modal will only close when pendingAnswers becomes empty (handled by useEffect)
      }
    } else {
      if (state.currentQuestionId) {
          const res = await fetch("/api/game-control/question/judge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: state.currentQuestionId, result }),
        });
          if (res.ok) {
            // Sound is played on player screen, not MC screen
          } else {
            const error = await res.json();
            alert(error.error || "Lỗi khi chấm điểm");
      }
        }
      }
    } finally {
      setIsJudging(false);
    }
  }

  async function selectHorizontal(horizontalOrder: number) {
    await fetch("/api/game-control/round2/select-horizontal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horizontalOrder }),
    });
  }

  async function startHorizontalQuestion() {
    await fetch("/api/game-control/round2/start-horizontal-question", {
      method: "POST",
    });
  }

  async function continueHorizontal() {
    await fetch("/api/game-control/round2/continue-horizontal", {
      method: "POST",
    });
  }

  async function nextTurn() {
    await fetch("/api/game-control/round2/next-turn", {
      method: "POST",
    });
  }



  async function startRound(round: Round) {
    setIsSwitchingRound(true);
    setUserClearedRound(false); // Reset flag when user selects a round
    
    try {
      if (round === "ROUND1") {
        await fetch("/api/game-control/round1/start", {
          method: "POST",
        });
      } else if (round === "ROUND2") {
        await fetch("/api/game-control/round2/start-round", {
          method: "POST",
        });
      } else if (round === "ROUND3") {
        await fetch("/api/game-control/round3/start-round", {
          method: "POST",
        });
      } else if (round === "ROUND4") {
        await fetch("/api/game-control/round4/start", {
          method: "POST",
        });
        // Round 4 doesn't have package selection, navigate directly to round4 page
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push("/mc/round4");
        return;
      }
      
      // Wait a bit for state to sync before updating selectedRound
      // This prevents UI jump
      await new Promise(resolve => setTimeout(resolve, 100));
      setSelectedRound(round);
    } catch (error) {
      console.error("Error starting round:", error);
    } finally {
      // Give time for packages to load before hiding loading state
      setTimeout(() => {
        setIsSwitchingRound(false);
      }, 300);
    }
  }

  async function resetGame() {
    confirm("Bạn có chắc chắn muốn reset game? Tất cả điểm số và trạng thái sẽ được đặt lại về ban đầu.", async () => {
      try {
        const res = await fetch("/api/game-control/reset", { method: "POST" });
        if (res.ok) {
          setSelectedRound(null);
          setSelectedTeamId("");
          setSelectedPackageId("");
          setQuestion(null);
          if (selectedRound) {
            fetch(`/api/packages?round=${selectedRound}`, { cache: "no-store" })
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

  // Show loading only while state is being fetched (undefined)
  // null state means no game exists, which is fine - show round selection
  if (isLoadingState || state === undefined) {
    return <div className="p-8 text-white">Đang tải...</div>;
  }

  // Show round selection when game is IDLE or no game is active, or when user manually cleared
  // Also show when state is null (no game state exists in database)
  const isGameActive = state?.phase && state.phase !== "IDLE" || 
                      state?.currentQuestionId || 
                      state?.activeTeamId || 
                      state?.activePackageId;
  
  const showRoundSelection = userClearedRound || 
                             !state || // No game state exists
                             (!isGameActive && (!selectedRound && !state?.round));
  const showTeamPackageSelection = !userClearedRound && (isGameActive || !!selectedRound || !!state?.round);
  const isRound2 = state?.round === "ROUND2" || selectedRound === "ROUND2";
  const isRound4 = state?.round === "ROUND4" || selectedRound === "ROUND4";

  const availableTeams = teams.filter((team) => {
    if (!state?.teams) return true;
    const teamInState = state.teams.find(
      (t) => t.teamId.toString() === team._id.toString()
    );
    return !teamInState || teamInState.status !== "finished";
  });

  const getAssignedTeamName = (pkg: any) => {
    if (!pkg.assignedTeamId) return null;
    const assignedTeam = teams.find(
      (t) => t._id.toString() === pkg.assignedTeamId.toString()
    );
    return assignedTeam?.name || null;
  };

  const timerExpired =
    state?.questionTimer &&
    state.questionTimer.running &&
    (Date.now() + serverTimeOffset) > state.questionTimer.endsAt;
  
  // Check if timer has expired (even if running flag is still true)
  const isTimerExpiredOrNoTimer =
    !state?.questionTimer ||
    !state.questionTimer.running ||
    (Date.now() + serverTimeOffset) > state.questionTimer.endsAt;

  // Round2 specific data
  const round2Meta = packageData?.round2Meta;
  const currentTeamName = state?.teams?.find((t) => t.teamId === state?.activeTeamId)?.nameSnapshot;
  const eliminatedTeamIds = round2Meta?.eliminatedTeamIds || [];
  const teamsUsedAttempt = round2Meta?.turnState?.teamsUsedHorizontalAttempt || {};
  const currentTeamId = round2Meta?.turnState?.currentTeamId || state?.activeTeamId;

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          MC Dashboard{selectedRound ? ` - ${ROUNDS.find(r => r.value === selectedRound)?.label || selectedRound}` : ""}
        </h1>
        {(state && (state.phase !== "IDLE" || state.currentQuestionId || state.activeTeamId || state.activePackageId)) && (
          <button
            onClick={resetGame}
            className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-lg font-semibold shadow-md transition-all"
          >
            Reset Game
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isSwitchingRound ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mb-6 flex items-center justify-center py-12"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400">Đang chuyển vòng...</p>
            </div>
          </motion.div>
        ) : showRoundSelection ? (
          <motion.div
            key="round-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
          >
            <Card>
              <h2 className="text-xl font-bold mb-4">Chọn vòng thi</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROUNDS.map((round, index) => (
                  <motion.button
                    key={round.value}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.2 }}
                    onClick={() => startRound(round.value)}
                    className="px-6 py-4 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 rounded-xl font-bold text-lg text-white transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {round.label}
                  </motion.button>
                ))}
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="round-control"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-4">
              <button
                onClick={() => {
                  setUserClearedRound(true);
                  setSelectedRound(null);
                  setSelectedTeamId("");
                  setSelectedPackageId("");
                }}
                className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 rounded-lg text-white font-medium shadow-md transition-all"
              >
                ← Quay lại chọn vòng
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTeamPackageSelection && !isSwitchingRound && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-4 mb-6"
          >
          {(state?.round === "ROUND1" || selectedRound === "ROUND1") && !isRound2 && (
            <Card>
              <h2 className="text-xl font-bold mb-4">Chọn đội</h2>
              <Select
                options={availableTeams.map((team) => {
                  const teamInState = state?.teams?.find(
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
          )}

          {!isRound4 && (
          <Card>
            <h2 className="text-xl font-bold mb-4">Chọn gói câu hỏi</h2>
            {isLoadingPackages ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
                  <p className="text-gray-400 text-sm">Đang tải gói câu hỏi...</p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-4">
              {packages.map((pkg) => {
                const isAssigned = pkg.status !== "unassigned";
                const isCompleted = pkg.status === "completed";
                const isSelected = pkg._id.toString() === selectedPackageId;
                const assignedTeamName = getAssignedTeamName(pkg);
                const needsSetup =
                  (state?.round === "ROUND2" || selectedRound === "ROUND2") &&
                  !pkg.round2Meta;
                const isRound2 =
                  state?.round === "ROUND2" || selectedRound === "ROUND2";
                const isRound3 =
                  state?.round === "ROUND3" || selectedRound === "ROUND3";
                const isRound3Ended = state?.round === "ROUND3" && state?.phase === "ROUND3_END";
                
                // Simplified logic:
                // Round 2: can select if not completed AND (not assigned OR needs setup OR is selected)
                // Round 1: can select if not assigned AND not completed
                let canSelect = false;
                let isDisabled = false;
                
                if (isRound2) {
                  // Round 2: allow selecting any package that is not completed
                  // Can always select if not completed (regardless of assigned status)
                  canSelect = !isCompleted;
                  // Disabled only if completed
                  isDisabled = isCompleted;
                } else if (isRound3) {
                  // Round 3: allow selecting any package when Round 3 is active
                  // Only disable when Round 3 has ended (ROUND3_END) OR package is completed
                  canSelect = !isRound3Ended && !isCompleted;
                  isDisabled = isRound3Ended || isCompleted;
                } else {
                  // Round 1: only allow if not assigned and not completed
                  canSelect = !isAssigned && !isCompleted;
                  isDisabled = isAssigned || isCompleted;
                }
                
                return (
                  <motion.button
                    key={pkg._id}
                    whileHover={!isDisabled ? { scale: 1.02 } : {}}
                    whileTap={!isDisabled ? { scale: 0.98 } : {}}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (needsSetup) {
                        router.push(`/mc/round2/${pkg._id}`);
                      } else if (isRound3 && canSelect && !isDisabled) {
                        router.push(`/mc/round3/${pkg._id}`);
                      } else if (canSelect && !isDisabled) {
                        selectPackage(pkg._id);
                      }
                    }}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isDisabled
                        ? "bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "bg-gradient-to-br from-cyan-600 to-blue-600 border-cyan-400 shadow-lg shadow-cyan-500/50 cursor-pointer"
                        : needsSetup
                        ? "bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400 hover:border-yellow-300 cursor-pointer"
                        : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 hover:border-cyan-500 hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div className="font-bold">Gói {pkg.number}</div>
                    {needsSetup && (
                      <div className="text-sm text-yellow-200 mt-1">Cần setup →</div>
                    )}
                    {isCompleted && (
                      <div className="text-sm text-gray-400 mt-1">Đã thi</div>
                    )}
                    {isAssigned && !isCompleted && assignedTeamName && (
                      <div className="text-sm text-gray-400 mt-1">
                        {assignedTeamName} chọn
                      </div>
                    )}
                    {!isAssigned && !isCompleted && !needsSetup && (
                      <div className="text-sm text-gray-400 mt-1">Chưa chọn</div>
                    )}
                  </motion.button>
                );
              })}
            </div>
            )}
          </Card>
          )}

          {selectedPackageId && 
           (((state?.round === "ROUND1" || selectedRound === "ROUND1") && selectedTeamId) || 
            (state?.round === "ROUND2" || selectedRound === "ROUND2") ||
            (state?.round === "ROUND3" || selectedRound === "ROUND3")) && 
           (!state?.currentQuestionId) && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transition-all"
            >
              Bắt đầu
            </motion.button>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Round2 Control Panel */}
      {isRound2 && (state?.phase !== "IDLE" || selectedRound === "ROUND2") && (
        <div className="space-y-4 mb-6">
          {/* Keyword Buzz Queue - Show prominently at top */}
          {(() => {
            const keywordQueue = round2Meta?.buzzState?.keywordBuzzQueue;
            const hasQueue = Array.isArray(keywordQueue) && keywordQueue.length > 0;
            if (hasQueue) {
              return (
            <Card className="border-orange-500/50 bg-gradient-to-br from-orange-950/30 to-amber-950/30 shadow-xl shadow-orange-500/10">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-lg">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-orange-300">Đội đã rung chuông dự đoán từ khóa</h3>
                    <p className="text-sm text-orange-400/70">Danh sách đội đã bấm chuông</p>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  {round2Meta.buzzState.keywordBuzzQueue
                    .sort((a: { teamId: string; buzzedAt: number }, b: { teamId: string; buzzedAt: number }) => a.buzzedAt - b.buzzedAt)
                    .map((item: { teamId: string; buzzedAt: number }, index: number) => {
                      const team = teams.find(t => t._id.toString() === item.teamId);
                      const currentIndex = round2Meta.buzzState?.currentKeywordBuzzIndex;
                      const isCurrentJudging = currentIndex === index && state?.phase === "KEYWORD_BUZZ_JUDGING";
                      
                      // Xác định đội đã được chấm:
                      // 1. Nếu index < currentIndex: đội đã được chấm (trong quá trình judging)
                      // 2. Nếu đội bị loại (trong eliminatedTeamIds): đội đã được chấm sai
                      // 3. Nếu Round 2 kết thúc với keyword đúng: tất cả đã được chấm
                      // 4. Nếu phase là TURN_SELECT và có đội bị loại: đội đó đã được chấm
                      const isEliminated = eliminatedTeamIds.includes(item.teamId);
                      const keywordWinnerTeamId = round2Meta.buzzState?.keywordWinnerTeamId;
                      const isWinner = keywordWinnerTeamId === item.teamId;
                      
                      const isJudged = 
                        (currentIndex !== undefined && index < currentIndex) ||
                        isEliminated ||
                        isWinner ||
                        (state?.phase === "ROUND_END" && keywordWinnerTeamId);
                      
                      const buzzedDate = new Date(item.buzzedAt);
                      const timeStr = `${String(buzzedDate.getHours()).padStart(2, '0')}:${String(buzzedDate.getMinutes()).padStart(2, '0')}:${String(buzzedDate.getSeconds()).padStart(2, '0')}`;
                      const canStartJudging = state?.phase !== "KEYWORD_BUZZ_JUDGING" && state?.phase !== "ROUND_END" && index === 0 && !isJudged;
                      
                      return (
                        <motion.div
                          key={item.teamId}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            isCurrentJudging
                              ? "bg-gradient-to-r from-orange-600/60 to-amber-600/60 border-orange-400 shadow-lg shadow-orange-500/30"
                              : isJudged
                              ? "bg-gradient-to-r from-gray-800/40 to-gray-700/40 border-gray-600/30"
                              : "bg-gradient-to-r from-orange-900/30 to-amber-900/30 border-orange-600/40 hover:border-orange-500/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                                isCurrentJudging
                                  ? "bg-orange-500 text-white"
                                  : isJudged
                                  ? "bg-gray-600 text-gray-300"
                                  : "bg-orange-600/50 text-orange-300"
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <span className={`font-semibold block ${isJudged ? "text-gray-400" : "text-white"}`}>
                                  {team?.name || item.teamId}
                                </span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Clock className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-500 text-xs">{timeStr}</span>
                                </div>
                              </div>
                              {isCurrentJudging && (
                                <motion.span
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ repeat: Infinity, duration: 2 }}
                                  className="px-3 py-1 bg-orange-500 text-white text-xs rounded-lg font-bold shadow-md"
                                >
                                  Đang chấm
                                </motion.span>
                              )}
                              {isJudged && (
                                <span className="px-3 py-1 bg-gray-600/50 text-gray-300 text-xs rounded-lg font-bold border border-gray-500/30">
                                  Đã chấm
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {canStartJudging && (
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch("/api/game-control/round2/start-keyword-judging", {
                                        method: "POST",
                                      });
                                      if (!res.ok) {
                                        const error = await res.json();
                                        alert(error.error || "Lỗi bắt đầu chấm từ khóa");
                                      }
                                    } catch (error) {
                                      console.error("Error starting keyword judging:", error);
                                      alert("Lỗi bắt đầu chấm từ khóa");
                                    }
                                  }}
                                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg text-sm font-medium shadow-lg transition-all"
                                >
                                  Bắt đầu chấm
                                </motion.button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
                {state?.phase === "KEYWORD_BUZZ_JUDGING" && round2Meta.buzzState.currentKeywordBuzzIndex !== undefined && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-4 mt-4 border-t border-orange-600/30"
                  >
                    <div className="mb-4 p-3 bg-gradient-to-r from-orange-600/20 to-amber-600/20 rounded-lg border border-orange-500/30">
                      <p className="text-orange-300 font-semibold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Đang chấm đội: <span className="font-bold text-orange-200">
                          {teams.find(t => t._id.toString() === round2Meta.buzzState?.keywordBuzzQueue?.[round2Meta.buzzState.currentKeywordBuzzIndex ?? 0]?.teamId)?.name}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-gray-300 text-sm mb-2 font-medium">Đáp án đội đưa ra:</label>
                        <input
                          type="text"
                          value={judgingAnswer}
                          onChange={(e) => setJudgingAnswer(e.target.value)}
                          placeholder="Nhập đáp án đội đã đưa ra"
                          className="w-full px-4 py-3 bg-gray-800/50 border-2 border-orange-500/50 rounded-lg text-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20 transition-all"
                        />
                      </div>
                      {packageData?.round2Meta?.cnvAnswer && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 bg-gradient-to-br from-cyan-950/40 to-blue-950/40 rounded-xl border-2 border-cyan-500/40 shadow-lg"
                        >
                          <p className="text-gray-400 text-sm mb-2 font-medium">Đáp án CNV (từ khóa):</p>
                          <p className="text-cyan-300 font-bold text-xl">{packageData.round2Meta.cnvAnswer}</p>
                        </motion.div>
                      )}
                      <div className="flex gap-3">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={async () => {
                            const currentTeamId = round2Meta.buzzState?.keywordBuzzQueue?.[round2Meta.buzzState.currentKeywordBuzzIndex ?? 0]?.teamId;
                            if (!currentTeamId) return;
                            try {
                              const res = await fetch("/api/game-control/round2/judge", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  teamId: currentTeamId,
                                  isCorrect: true,
                                }),
                              });
                              if (!res.ok) {
                                const error = await res.json();
                                alert(error.error || "Lỗi chấm điểm");
                              } else {
                                setJudgingAnswer("");
                                setShowJudgingModal(false);
                              }
                            } catch (error) {
                              console.error("Error judging:", error);
                              alert("Lỗi chấm điểm");
                            }
                          }}
                          className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          ĐÚNG
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={async () => {
                            const currentTeamId = round2Meta.buzzState?.keywordBuzzQueue?.[round2Meta.buzzState.currentKeywordBuzzIndex ?? 0]?.teamId;
                            if (!currentTeamId) return;
                            try {
                              const res = await fetch("/api/game-control/round2/judge", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  teamId: currentTeamId,
                                  isCorrect: false,
                                }),
                              });
                              if (!res.ok) {
                                const error = await res.json();
                                alert(error.error || "Lỗi chấm điểm");
                              } else {
                                setJudgingAnswer("");
                                setShowJudgingModal(false);
                              }
                            } catch (error) {
                              console.error("Error judging:", error);
                              alert("Lỗi chấm điểm");
                            }
                          }}
                          className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          SAI
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </Card>
              );
            }
            return null;
          })()}

          <Card className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-cyan-500/30 shadow-xl shadow-cyan-500/10">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-cyan-500/20">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                <Grid3x3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Round 2 Control
                </h2>
                <p className="text-sm text-gray-400">Điều khiển vòng thi CNV</p>
              </div>
            </div>
            
            {/* Current Turn */}
            {(state?.phase === "TURN_SELECT" || state?.phase === "HORIZONTAL_SELECTED") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                {/* Select Team Section */}
                {!currentTeamId && state?.phase === "TURN_SELECT" && (
                  <div className="mb-6 p-4 bg-gradient-to-br from-blue-950/30 to-indigo-950/30 rounded-xl border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-blue-400" />
                      <p className="text-lg font-semibold text-white">Chọn đội:</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {state?.teams
                        ?.filter((t) => !eliminatedTeamIds.includes(t.teamId))
                        .map((team, index) => (
                          <motion.button
                            key={team.teamId}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05, duration: 0.2 }}
                            onClick={() => selectTeam(team.teamId)}
                            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-xl hover:scale-105 transform"
                          >
                            {team.nameSnapshot}
                          </motion.button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Selected Team and Horizontal Selection */}
                {currentTeamId && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="p-4 bg-gradient-to-br from-cyan-950/30 to-blue-950/30 rounded-xl border border-cyan-500/20"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                        <Trophy className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-lg font-semibold text-white">
                        Đội đang lượt: <span className="font-bold text-cyan-400">{currentTeamName}</span>
                      </p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-3 font-medium">Chọn hàng ngang:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map((order) => {
                          // Find the question with this index
                          const question = horizontalQuestions.find((q: any) => q.index === order);
                          
                          // Check if this horizontal has been attempted (any entry in history)
                          const isAttempted = question && packageData?.history?.some((h: any) => {
                            return h.questionId === question._id?.toString();
                          });
                          
                          // Check if answered correctly
                          const isAnsweredCorrectly = question && packageData?.history?.some((h: any) => {
                            return h.questionId === question._id?.toString() && h.result === "CORRECT";
                          });
                          
                          // Check if attempted but not correctly answered
                          const isAttemptedButNotCorrect = isAttempted && !isAnsweredCorrectly;
                          
                          const teamUsedAttempt = currentTeamId && teamsUsedAttempt[currentTeamId];
                          const currentHorizontalOrder = state?.round2State?.currentHorizontalOrder;
                          const isSelected = state?.phase === "HORIZONTAL_SELECTED" && currentHorizontalOrder === order;
                          // Disable if attempted, team used attempt, or another horizontal is selected
                          const isDisabled = isAttempted || teamUsedAttempt || (state?.phase === "HORIZONTAL_SELECTED" && !isSelected);
                          
                          return (
                            <motion.button
                              key={order}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: order * 0.05, duration: 0.2 }}
                              onClick={() => selectHorizontal(order)}
                              disabled={isDisabled}
                              className={`px-4 py-3 rounded-lg font-medium transition-all shadow-lg ${
                                isAnsweredCorrectly
                                  ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white cursor-not-allowed"
                                  : isAttemptedButNotCorrect
                                  ? "bg-gradient-to-r from-orange-600 to-red-600 text-white cursor-not-allowed"
                                  : teamUsedAttempt
                                  ? "bg-gradient-to-r from-gray-700 to-gray-800 text-gray-400 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-800"
                                  : state?.phase === "HORIZONTAL_SELECTED"
                                  ? "bg-gradient-to-r from-gray-700 to-gray-800 text-gray-400 cursor-not-allowed"
                                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white hover:scale-105 transform"
                              }`}
                              title={
                                isAnsweredCorrectly 
                                  ? "Hàng ngang này đã được trả lời đúng" 
                                  : isAttemptedButNotCorrect
                                  ? "Hàng ngang này đã được thi (không có đáp án đúng)" 
                                  : teamUsedAttempt 
                                  ? "Đội này đã sử dụng lượt chọn hàng ngang" 
                                  : isSelected
                                  ? "Hàng ngang đã được chọn - Bấm 'Bắt đầu' để hiển thị câu hỏi"
                                  : state?.phase === "HORIZONTAL_SELECTED"
                                  ? "Đã chọn hàng ngang khác"
                                  : ""
                              }
                            >
                              <div className="flex items-center justify-center gap-2">
                                <span>Hàng {order}</span>
                                {isAnsweredCorrectly && <CheckCircle2 className="w-4 h-4" />}
                                {isAttemptedButNotCorrect && <XCircle className="w-4 h-4" />}
                                {isSelected && <Clock className="w-4 h-4" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Show "Bắt đầu" button when horizontal is selected */}
                    {state?.phase === "HORIZONTAL_SELECTED" && state?.round2State?.currentHorizontalOrder && (
                      <div className="mb-4">
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={startHorizontalQuestion}
                          className="w-full px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                          <Play className="w-5 h-5" />
                          Bắt đầu câu hỏi
                        </motion.button>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={nextTurn}
                        className="px-6 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white rounded-lg font-medium transition-all shadow-lg"
                      >
                        Chuyển lượt
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Continue button when timer expired and no answers in Round 2 */}
            {(state?.phase === "HORIZONTAL_ACTIVE" || state?.phase === "HORIZONTAL_JUDGING") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                {(() => {
                  const hasPendingAnswers = (state?.round2State?.pendingAnswers?.length || 0) > 0;
                  // Show continue button if timer expired and no pending answers
                  // This allows MC to continue and select new team/horizontal when no one answered
                  const shouldShowContinue = isTimerExpiredOrNoTimer && !hasPendingAnswers;
                  
                  if (shouldShowContinue) {
                    return (
                      <div className="p-4 bg-gradient-to-br from-yellow-950/30 to-orange-950/30 rounded-xl border border-yellow-500/20">
                        <div className="mb-4 text-center">
                          <p className="text-yellow-400 font-semibold mb-2">Thời gian đã hết</p>
                          <p className="text-gray-300 text-sm">Không có ai trả lời</p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={continueHorizontal}
                          className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                          <ArrowRight className="w-5 h-5" />
                          Tiếp tục phần thi
                        </motion.button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </motion.div>
            )}

            {/* CNV Buzzer Status */}
            {round2Meta?.buzzState?.cnvLockTeamId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 p-4 bg-gradient-to-r from-yellow-900/40 to-orange-900/40 rounded-xl border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Bell className="w-5 h-5 text-yellow-400 animate-pulse" />
                  </div>
                  <p className="text-yellow-300 font-medium">
                    Đội <span className="font-bold text-yellow-200">{teams.find(t => t._id.toString() === round2Meta.buzzState.cnvLockTeamId)?.name}</span> đã bấm chuông CNV
                  </p>
                </div>
              </motion.div>
            )}

            {/* Revealed Pieces Count */}
            <div className="mb-4 p-4 bg-gradient-to-br from-purple-950/30 to-pink-950/30 rounded-xl border border-purple-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Grid3x3 className="w-5 h-5 text-purple-400" />
                  <p className="text-gray-300 font-medium">Mảnh đã mở</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {round2Meta?.openedClueCount || 0}
                  </span>
                  <span className="text-gray-400">/ 4</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {[1, 2, 3, 4].map((num) => (
                  <div
                    key={num}
                    className={`flex-1 h-2 rounded-full transition-all ${
                      num <= (round2Meta?.openedClueCount || 0)
                        ? "bg-gradient-to-r from-purple-500 to-pink-500"
                        : "bg-gray-700"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Eliminated Teams */}
            {eliminatedTeamIds.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 bg-gradient-to-br from-red-950/30 to-rose-950/30 rounded-xl border border-red-500/20"
              >
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-red-400" />
                  <p className="text-red-400 font-semibold">Đội đã bị loại</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {eliminatedTeamIds.map((teamId: string, index: number) => (
                    <motion.span
                      key={teamId}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="px-3 py-1.5 bg-gradient-to-r from-red-900/60 to-rose-900/60 rounded-lg text-red-300 font-medium border border-red-500/30 shadow-md"
                    >
                      {state?.teams?.find(t => t.teamId === teamId)?.nameSnapshot}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}


          </Card>
        </div>
      )}

      {/* Question Display & Judging (Round1 style) */}
      {state?.currentQuestionId && state?.round === "ROUND1" && (
        <div className="space-y-4 mb-6">
          <Card>
            <div className="mb-4 flex justify-end">
              <Timer timer={state?.questionTimer} size="sm" />
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
                packages.find((p) => p._id.toString() === state?.activePackageId)?.number
              }
            />

            <div className="flex gap-4 mt-4">
              <button
                onClick={() => judgeQuestion("CORRECT")}
                disabled={isJudging}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isJudging ? "Đang xử lý..." : "✓ ĐÚNG"}
              </button>
              <button
                onClick={() => judgeQuestion("WRONG")}
                disabled={isJudging}
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isJudging ? "Đang xử lý..." : "✗ SAI"}
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Round2 Judging Modal */}
      <Modal
        isOpen={showJudgingModal}
        onClose={() => {
          setShowJudgingModal(false);
          setSelectedTeamIdForJudging(null);
        }}
        title="Chấm Điểm - Tất cả các đội"
        maxWidth="700px"
      >
        <div className="space-y-4">
          {/* List of all pending answers */}
          <div>
            <p className="text-white mb-3 font-semibold">Danh sách đáp án đã nhận:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(state?.round2State?.pendingAnswers || []).map((pa) => {
                const team = state?.teams.find((t) => t.teamId === pa.teamId);
                const isSelected = selectedTeamIdForJudging === pa.teamId;
                return (
                  <button
                    key={pa.teamId}
                    onClick={() => setSelectedTeamIdForJudging(pa.teamId)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? "bg-gradient-to-br from-cyan-600 to-blue-600 border-cyan-400 shadow-lg"
                        : "bg-gray-800 border-gray-700 hover:border-cyan-500"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-white">{team?.nameSnapshot || "Unknown"}</p>
                        <p className={`text-sm ${isSelected ? "text-cyan-100" : "text-gray-400"}`}>
                          {pa.answer}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-cyan-300 font-bold">✓</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected team's answer details */}
          {selectedTeamIdForJudging && (
            <>
              <div className="border-t border-gray-700 pt-4">
          <div>
            <p className="text-white mb-2">Đáp án của đội:</p>
            <p className="text-xl font-bold text-cyan-400">{judgingAnswer}</p>
          </div>

          {question && (
                  <div className="mt-4">
              <p className="text-white mb-2">Đáp án đúng:</p>
              <p className="text-lg text-gray-300">{question.answerText}</p>
            </div>
          )}

          {judgingSuggestion && (
                  <div className={`mt-4 p-3 rounded ${
              judgingSuggestion === "exact" ? "bg-green-900/50 border border-green-500" :
              judgingSuggestion === "near" ? "bg-yellow-900/50 border border-yellow-500" :
              "bg-red-900/50 border border-red-500"
            }`}>
              <p className={`font-bold ${
                judgingSuggestion === "exact" ? "text-green-400" :
                judgingSuggestion === "near" ? "text-yellow-400" :
                "text-red-400"
              }`}>
                Gợi ý: {judgingSuggestion === "exact" ? "Khớp chính xác" :
                        judgingSuggestion === "near" ? "Gần đúng" :
                        "Không khớp"}
              </p>
            </div>
          )}
              </div>

          <div className="flex gap-4">
            <button
              onClick={() => judgeQuestion("CORRECT")}
              disabled={isJudging}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 rounded-xl font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJudging ? "Đang xử lý..." : "✓ CÔNG NHẬN ĐÚNG"}
            </button>
            <button
              onClick={() => judgeQuestion("WRONG")}
              disabled={isJudging}
              className="flex-1 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 rounded-xl font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJudging ? "Đang xử lý..." : "✗ KHÔNG CÔNG NHẬN"}
            </button>
          </div>
            </>
          )}
        </div>
      </Modal>

      <Card>
        <h2 className="text-xl font-bold mb-4">Bảng điểm</h2>
        <Scoreboard teams={state?.teams || []} activeTeamId={state?.activeTeamId?.toString()} />
      </Card>

      <ConfirmModal />
    </div>
  );
}
