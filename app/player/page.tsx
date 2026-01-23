"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { useAuthStore } from "@/store/authStore";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { useToastStore } from "@/store/toastStore";
import { Round2StageLayout } from "@/components/round2/Round2StageLayout";
import { PuzzleBoard } from "@/components/round2/PuzzleBoard";
import { PlayerPuzzleBoard } from "@/components/round2/PlayerPuzzleBoard";
import { CNVPanel } from "@/components/round2/CNVPanel";
import { QuestionPanel } from "@/components/round2/QuestionPanel";
import { AnswersResult } from "@/components/round2/AnswersResult";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import { PackageCard } from "@/components/game/PackageCard";
import { QuestionDisplay } from "@/components/round3/QuestionDisplay";
import { Round3AnswersResult } from "@/components/round3/Round3AnswersResult";
import { Modal } from "@/components/ui/modal";
import type { Round2Meta, Phase } from "@/types/game";

export default function PlayerPage() {
  const router = useRouter();
  const state = useGameStore((state) => state.state);
  const serverTimeOffset = useGameStore((state) => state.serverTimeOffset);
  const user = useAuthStore((state) => state.user);
  const showToast = useToastStore((state) => state.showToast);
  const [question, setQuestion] = useState<any>(null);
  const questionCacheRef = useRef<Record<string, any>>({});
  const [packages, setPackages] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [packageData, setPackageData] = useState<any>(null);
  const [horizontalQuestions, setHorizontalQuestions] = useState<any[]>([]);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const [localResult, setLocalResult] = useState<{ isCorrect: boolean; score: number; submissionOrder: number } | null>(null);
  const [showCongratulationsModal, setShowCongratulationsModal] = useState(false);

  useHydrateGameState();
  usePusherGameState();

  const isBuzzingRef = useRef<boolean>(false);
  const round4VideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Audio refs for Round 3 sound
  const sound30sRef = useRef<HTMLAudioElement | null>(null);
  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef<boolean>(false);

  // Initialize audio elements
  useEffect(() => {
    sound30sRef.current = new Audio("/sound/30s.mp3");
    sound30sRef.current.volume = 0.7;
    sound30sRef.current.preload = "auto";
    
    correctSoundRef.current = new Audio("/sound/correct.mp3");
    correctSoundRef.current.volume = 0.7;
    correctSoundRef.current.preload = "auto";

    const enableAudio = async () => {
      if (audioEnabledRef.current) return;
      try {
        if (correctSoundRef.current) {
          await correctSoundRef.current.play();
          correctSoundRef.current.pause();
          correctSoundRef.current.currentTime = 0;
        }
        audioEnabledRef.current = true;
      } catch {
        // ignore, user will need to interact again
      }
    };

    const handleUserInteraction = () => {
      if (!audioEnabledRef.current) {
        enableAudio();
      }
    };

    document.addEventListener("click", handleUserInteraction, {
      once: true,
      capture: true,
    });
    document.addEventListener("touchstart", handleUserInteraction, {
      once: true,
      capture: true,
    });
    document.addEventListener("keydown", handleUserInteraction, {
      once: true,
      capture: true,
    });

    return () => {
      document.removeEventListener("click", handleUserInteraction, {
        capture: true,
      } as any);
      document.removeEventListener("touchstart", handleUserInteraction, {
        capture: true,
      } as any);
      document.removeEventListener("keydown", handleUserInteraction, {
        capture: true,
      } as any);

      if (sound30sRef.current) {
        sound30sRef.current.pause();
        sound30sRef.current = null;
      }
      if (correctSoundRef.current) {
        correctSoundRef.current.pause();
        correctSoundRef.current = null;
      }
    };
  }, []);

  // Show congratulations modal when Round 3 ends
  useEffect(() => {
    if (state?.round === "ROUND3" && state?.phase === "ROUND3_END") {
      setShowCongratulationsModal(true);
    }
  }, [state?.round, state?.phase]);

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
    const qId = state?.currentQuestionId;
    if (!qId) {
      setQuestion(null);
      return;
    }

    const cached = questionCacheRef.current[qId];
    if (cached) {
      setQuestion(cached);
      return;
    }

    let canceled = false;
    fetch(`/api/questions/${qId}`)
      .then((res) => res.json())
      .then((data) => {
        if (canceled) return;
        questionCacheRef.current[qId] = data;
        setQuestion(data);
      })
      .catch(console.error);

    return () => {
      canceled = true;
    };
  }, [state?.currentQuestionId]);

  // Start timer immediately if question has no video (Round 4)
  useEffect(() => {
    if (
      state?.round === "ROUND4" &&
      state?.phase === "R4_QUESTION_SHOW" &&
      question &&
      !question.videoUrl &&
      (!state.questionTimer || !state.questionTimer.running)
    ) {
      // Question has no video, start timer immediately
      fetch("/api/game-control/round4/start-timer", {
        method: "POST",
      }).catch((error) => {
        console.error("Error starting timer for non-video question:", error);
      });
    }
  }, [state?.round, state?.phase, question, state?.questionTimer]);

  useEffect(() => {
    if (!state?.round || state.round === "ROUND4") return;

    fetch(`/api/packages/public?round=${state.round}`)
      .then((res) => res.json())
      .then(setPackages)
      .catch(console.error);
  }, [state?.round, state?.phase, state?.activePackageId]);

  useEffect(() => {
    if (state?.activePackageId && state?.round === "ROUND2") {
      const fetchPackageData = () => {
        fetch(`/api/packages/${state.activePackageId}`)
          .then((res) => res.json())
          .then(setPackageData)
          .catch(console.error);
      };

      fetchPackageData();
      // Poll package data every 1 second when in Round 2 to catch buzzState changes
      const interval = setInterval(fetchPackageData, 1000);
      return () => clearInterval(interval);
    } else if (state?.activePackageId && state?.round === "ROUND1") {
      // Fetch package data for Round 1 to track history changes
      const fetchPackageData = () => {
        fetch(`/api/packages/${state.activePackageId}`)
          .then((res) => res.json())
          .then(setPackageData)
          .catch(console.error);
      };

      fetchPackageData();

      // Poll package data every 1 second when in Round 1 to catch history changes
      const interval = setInterval(fetchPackageData, 1000);
      return () => clearInterval(interval);
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

  // Track current time for timer updates (câu hỏi + steal window) - đặt trước early return
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time định kỳ để phục vụ cả question timer và Round4 steal window
  // Use server time offset to sync with server
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now() + serverTimeOffset), 500);
    return () => clearInterval(interval);
  }, [serverTimeOffset]);

  // Round 4 video: hard-sync currentTime between clients using server timestamp
  useEffect(() => {
    const video = round4VideoRef.current;
    const videoStartedAt = state?.round4State?.videoStartedAt;
    const isActive =
      state?.round === "ROUND4" &&
      state?.phase === "R4_QUESTION_SHOW" &&
      !!question?.videoUrl &&
      typeof videoStartedAt === "number";

    if (!video || !isActive) return;

    const syncTick = () => {
      const serverNow = Date.now() + (serverTimeOffset || 0);
      const targetSeconds = Math.max(0, (serverNow - (videoStartedAt as number)) / 1000);

      // Only seek after metadata is available
      if (video.readyState >= 1 && Number.isFinite(targetSeconds)) {
        const drift = Math.abs(video.currentTime - targetSeconds);
        if (drift > 0.4) {
          try {
            video.currentTime = targetSeconds;
          } catch {
            // ignore seek errors
          }
        }
      }

      // Ensure it keeps playing (muted autoplay should be allowed)
      if (video.paused) {
        video.play().catch(() => {});
      }
    };

    syncTick();
    const intervalId = window.setInterval(syncTick, 500);
    return () => window.clearInterval(intervalId);
  }, [
    state?.round,
    state?.phase,
    state?.round4State?.videoStartedAt,
    question?.videoUrl,
    serverTimeOffset,
  ]);

  // Reset local submitted state when question changes (not when phase changes)
  useEffect(() => {
    setLocalSubmitted(false);
    setLocalResult(null);
    setAnswer(""); // Reset answer when question changes
  }, [state?.currentQuestionId]);

  // Load current answer from pendingAnswers when already submitted (Round 3)
  useEffect(() => {
    if (state?.round === "ROUND3" && state?.round3State?.pendingAnswers && user?.teamId) {
      const userTeamId = user.teamId.toString();
      const pendingAnswer = state.round3State.pendingAnswers.find(
        (pa: any) => pa.teamId === userTeamId
      );
      if (pendingAnswer && pendingAnswer.answer) {
        // Only update if answer is different to avoid unnecessary re-renders
        if (answer !== pendingAnswer.answer) {
          setAnswer(pendingAnswer.answer);
        }
      } else if (!pendingAnswer && answer) {
        // If no pending answer but we have answer in state, keep it (user is typing)
        // Don't clear it
      }
    }
  }, [state?.round, state?.round3State?.pendingAnswers, user?.teamId]);


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

  // Reset buzzing flag when phase changes to indicate buzz was processed or round ended
  // Use state properties directly instead of computed values to avoid hooks order issues
  // This must be before early return to maintain hooks order
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state?.round) {
      isBuzzingRef.current = false;
      prevPhaseRef.current = null;
      return;
    }

    const currentPhase = state.phase || null;
    const prevPhase = prevPhaseRef.current;

    // Only reset flag when phase actually changes to a phase that indicates buzz was processed
    // For Round 2: reset when phase changes to KEYWORD_BUZZ_JUDGING, CNV_ACTIVE, CNV_JUDGING, or ROUND_END
    // This means the buzz was successful and user can't buzz again in this round
    if (state.round === "ROUND2") {
      if (prevPhase !== null && currentPhase !== prevPhase) {
        // Reset flag when phase changes to indicate buzz was processed or round ended
        const isBuzzProcessedPhase = 
          currentPhase === "KEYWORD_BUZZ_JUDGING" ||
          currentPhase === "CNV_ACTIVE" ||
          currentPhase === "CNV_JUDGING" ||
          currentPhase === "ROUND_END" ||
          currentPhase === "REVEAL_PIECE" ||
          currentPhase === "FINAL_PIECE_REVEAL";
        
        if (isBuzzProcessedPhase) {
          isBuzzingRef.current = false;
        }
      }
    } else if (state.round === "ROUND4") {
      const r4 = state.round4State;
      const isRound4StealWindow = currentPhase === "R4_STEAL_WINDOW" && !!r4?.stealWindow;
      
      // Reset when phase changes away from steal window (buzz was processed or window closed)
      if (prevPhase !== null && prevPhase === "R4_STEAL_WINDOW" && currentPhase !== "R4_STEAL_WINDOW") {
        isBuzzingRef.current = false;
      }
      // Also reset if steal window becomes inactive
      if (prevPhase === "R4_STEAL_WINDOW" && !isRound4StealWindow) {
        isBuzzingRef.current = false;
      }
    } else {
      // Not in a round where buzzing is possible, reset flag
      isBuzzingRef.current = false;
    }

    // Update previous phase
    prevPhaseRef.current = currentPhase;
  }, [state?.round, state?.phase, state?.round4State]);

  // Calculate buzzingTeams with order: prioritize CNV buzzer, then keyword buzzer queue
  // Must be before early return to maintain hooks order
  const buzzingTeams = useMemo(() => {
    const isRound2 = state?.round === "ROUND2";
    const round2Meta: Round2Meta | undefined = packageData?.round2Meta;
    
    if (!isRound2 || !round2Meta?.buzzState) return [];
    
    // Priority 1: CNV buzzer (chỉ 1 đội)
    if (round2Meta.buzzState.cnvLockTeamId) {
      return [{ teamId: round2Meta.buzzState.cnvLockTeamId, order: 1 }];
    }
    
    // Priority 2: Keyword buzzer queue
    const keywordQueue = round2Meta.buzzState.keywordBuzzQueue || [];
    if (keywordQueue.length > 0) {
      const currentIndex = round2Meta.buzzState.currentKeywordBuzzIndex ?? -1;
      const unjudgedTeams = keywordQueue.slice(currentIndex + 1);
      return unjudgedTeams.map((item, index) => ({
        teamId: item.teamId,
        order: index + 1,
      }));
    }
    
    return [];
  }, [state?.round, packageData?.round2Meta]);

  if (!user || !state) {
    return <div className="min-h-screen flex items-center justify-center" style={{ fontFamily: "'Times New Roman', serif" }}>Đang tải...</div>;
  }

  const userTeamId = user.teamId?.toString();
  const userTeam = state.teams.find((t) => t.teamId.toString() === userTeamId);
  const isFinished = userTeam?.status === "finished";
  const isRound2 = state.round === "ROUND2";
  const isRound3 = state.round === "ROUND3";
  const isRound4 = state.round === "ROUND4";
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
  // Check if this team already submitted (combine server state and local state)
  const pendingAnswers = state.round2State?.pendingAnswers || [];
  const serverSubmitted = userTeamId ? pendingAnswers.some((pa) => pa.teamId === userTeamId) : false;
  const alreadySubmitted = serverSubmitted || localSubmitted;

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
    if (!userTeamId || isBuzzingRef.current) return;
    
    // Prevent multiple clicks
    isBuzzingRef.current = true;
    
    try {
      const res = await fetch("/api/game-control/round2/buzz-keyword", {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Lỗi rung chuông dự đoán từ khóa");
        isBuzzingRef.current = false; // Reset on error
      } else {
        // Keep isBuzzingRef true to prevent multiple buzzes until state updates
        // Reset will happen when canBuzzKeyword becomes false
      }
    } catch (error) {
      console.error("Error buzzing keyword:", error);
      alert("Lỗi rung chuông dự đoán từ khóa");
      isBuzzingRef.current = false; // Reset on error
    }
  };

  const handleBuzzCNV = async () => {
    if (!canBuzzCNV || isBuzzingRef.current) return;
    
    // Prevent multiple clicks
    isBuzzingRef.current = true;
    
    try {
      const res = await fetch("/api/game-control/round2/buzz-cnv", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Không thể bấm chuông CNV");
        isBuzzingRef.current = false; // Reset on error
      } else {
        // Keep isBuzzingRef true to prevent multiple buzzes until state updates
        // Reset will happen when canBuzzCNV becomes false
      }
    } catch (error) {
      console.error("Error buzzing CNV:", error);
      alert("Lỗi bấm chuông CNV");
      isBuzzingRef.current = false; // Reset on error
    }
  };

  // Round 4: steal window & Ngôi sao hy vọng
  const r4 = state.round4State;
  // Đảm bảo key matching đúng với format trong confirm-star API (teamId.toString())
  const userTeamKey = userTeamId?.toString();
  const starUsage = r4 && userTeamKey && r4.starUsages ? (r4.starUsages as any)[userTeamKey] : null;
  const hasStarOnCurrentR4 = !!(
    isRound4 &&
    r4 &&
    userTeamKey &&
    starUsage &&
    starUsage.used &&
    starUsage.questionIndex === r4.currentQuestionIndex
  );

  // Banner steal window hiển thị cho các đội còn lại
  const isRound4StealWindow =
    isRound4 && state.phase === "R4_STEAL_WINDOW" && !!r4?.stealWindow;

  // Countdown thô theo milliseconds server (có thể lệch do clock client/server)
  const rawRound4StealCountdown =
    isRound4StealWindow && r4?.stealWindow
      ? Math.max(0, Math.ceil((r4.stealWindow.endsAt - currentTime) / 1000))
      : 0;

  // Clamp hiển thị về tối đa 5s để luôn đúng với cửa sổ 5 giây, tránh lệch giờ hệ thống
  const round4StealCountdown =
    rawRound4StealCountdown > 0 ? Math.min(5, rawRound4StealCountdown) : 0;

  // Đảm bảo so sánh đúng với key matching (convert cả hai sang string)
  const isMainTeamRound4 =
    isRound4 && r4?.currentTeamId && userTeamKey && r4.currentTeamId.toString() === userTeamKey;

  // Chỉ cho phép bấm chuông khi cửa sổ còn active, còn thời gian và không phải đội đang thi
  const canBuzzRound4 =
    isRound4StealWindow &&
    !!r4?.stealWindow?.active &&
    round4StealCountdown > 0 &&
    !isMainTeamRound4;

  const handleBuzzRound4 = async () => {
    if (!isRound4 || !userTeamId || !canBuzzRound4 || isBuzzingRef.current) return;
    
    // Prevent multiple clicks
    isBuzzingRef.current = true;
    
    try {
      const res = await fetch("/api/game-control/round4/buzz", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Không thể bấm chuông giành quyền Round 4");
        isBuzzingRef.current = false; // Reset on error
      } else {
        // Keep isBuzzingRef true to prevent multiple buzzes until state updates
        // Reset will happen when canBuzzRound4 becomes false
      }
    } catch (error) {
      console.error("Error buzzing Round 4:", error);
      alert("Lỗi bấm chuông giành quyền Round 4");
      isBuzzingRef.current = false; // Reset on error
    }
  };

  // Thông tin Ngôi sao hy vọng cho đội hiện tại (Round 4) - sử dụng lại userTeamKey đã khai báo ở trên
  const currentStarRecordRound4 =
    isRound4 && r4 && userTeamKey && r4.starUsages
      ? (r4.starUsages as any)[userTeamKey]
      : null;
  // Kiểm tra xem đội đã dùng ngôi sao ở câu nào chưa (chỉ được dùng 1 lần trong vòng 4)
  const hasUsedStarBefore =
    !!currentStarRecordRound4 && !!currentStarRecordRound4.used;

  // Kiểm tra xem có đang ở phase chờ xác nhận ngôi sao không
  // Luôn hiển thị popup ở mỗi câu hỏi mới (trừ khi đội đã dùng ngôi sao rồi thì không hỏi nữa)
  const isStarConfirmationPhase =
    isRound4 &&
    state.phase === "R4_STAR_CONFIRMATION" &&
    isMainTeamRound4 &&
    !hasUsedStarBefore; // Chỉ không hỏi nếu đã dùng ngôi sao rồi

  const handleConfirmStar = async (useStar: boolean) => {
    if (!isRound4 || !userTeamId || !isMainTeamRound4) return;
    
    try {
      const res = await fetch("/api/player/round4/confirm-star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useStar }),
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.error || "Không thể xác nhận Ngôi sao hy vọng");
      }
    } catch (error) {
      console.error("Error confirming star Round 4:", error);
      alert("Lỗi xác nhận Ngôi sao hy vọng");
    }
  };

  const handleSubmitAnswer = async (answerText: string) => {
    if (!answerText.trim()) return;
    
    // Tính toán điều kiện submit dựa trên round
    let canSubmit = false;
    if (isRound3) {
      const canSubmitRound3 = !!(
        state.phase === "ROUND3_QUESTION_ACTIVE" &&
        state.questionTimer &&
        state.questionTimer.running &&
        Date.now() <= state.questionTimer.endsAt
      );
      const serverSubmittedRound3 = state.round3State?.pendingAnswers?.some(
        (pa: any) => pa.teamId === userTeamId
      );
      const alreadySubmittedRound3 = serverSubmittedRound3 || localSubmitted;
      // Cho phép submit lại nếu chưa hết thời gian (để update đáp án)
      canSubmit = canSubmitRound3;
    } else {
      canSubmit = canAnswer;
    }
    
    if (!canSubmit) return;
    
    setSubmitting(true);
    try {
      const endpoint = isRound3
        ? "/api/game-control/round3/submit-answer"
        : "/api/game-control/round2/submit-answer";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answerText.trim() }),
      });
      if (!res.ok) {
        const error = await res.json();
        showToast(error.error || "Lỗi submit đáp án", "error");
      } else {
        const data = await res.json();
        // Không xóa answer trong Round 3 vì sẽ được load lại từ server
        // Chỉ xóa nếu là Round 2 hoặc round khác
        if (!isRound3) {
          setAnswer("");
        }
        setLocalSubmitted(true); // Update local state immediately for instant UI feedback
        // Không lưu kết quả từ response vì chưa được judge
        setLocalResult(null);
        // Không hiển thị toast, chỉ hiển thị "Đã gửi đáp án"
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      showToast("Lỗi kết nối khi submit đáp án. Vui lòng thử lại.", "error");
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

  // Round 3 Layout
  if (isRound3) {
    const canSubmitRound3 = !!(
      state.phase === "ROUND3_QUESTION_ACTIVE" &&
      state.questionTimer &&
      state.questionTimer.running &&
      Date.now() <= state.questionTimer.endsAt
    );
    const currentQuestionIndex = state.round3State?.currentQuestionIndex ?? -1;
    const questionIndexKey = String(currentQuestionIndex); // Mongoose Map uses string keys
    // Access questionResults - handle both Map and object
    const questionResults = (() => {
      if (!state?.round3State?.questionResults) return [];
      const qr = state.round3State.questionResults;
      if (qr instanceof Map) {
        return qr.get(questionIndexKey) || [];
      } else {
        const resultsObj = qr as Record<string, any>;
        return resultsObj[questionIndexKey] || resultsObj[currentQuestionIndex] || [];
      }
    })();
    const userResult = questionResults.find(
      (r: any) => r.teamId === userTeamId
    );
    // Đã submit nếu có trong questionResults (đã được chấm tự động) hoặc pendingAnswers
    const serverSubmittedRound3 = 
      userResult !== undefined || 
      state.round3State?.pendingAnswers?.some(
        (pa: any) => pa.teamId === userTeamId
      );
    const alreadySubmittedRound3 = serverSubmittedRound3 || localSubmitted;
    // Chỉ ẩn form khi đã công bố kết quả (phase === ROUND3_RESULTS) và có kết quả
    // Hoặc khi đã hết thời gian
    const isTimeUp = state.questionTimer && Date.now() > state.questionTimer.endsAt;
    const shouldShowResult = state.phase === "ROUND3_RESULTS" && userResult;
    const shouldHideForm = shouldShowResult || (isTimeUp && alreadySubmittedRound3);

    return (
      <div
        className="min-h-screen p-4 md:p-6 relative"
        style={{
          fontFamily: "'Times New Roman', serif",
          backgroundImage: `url('/system/match.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-3 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Vòng 3 - Tăng tốc vận hành</h1>
            {state.questionTimer && (
              <div className="flex justify-center">
                <Timer timer={state.questionTimer} size="lg" />
              </div>
            )}
          </div>

          {/* Question Display */}
          {question && (
            <div className="mb-3">
              <div className="bg-gray-900/90 rounded-lg p-4 border border-gray-700">
                <div className="mb-2 text-sm text-gray-400">
                  Câu {state.round3State?.currentQuestionIndex !== undefined ? state.round3State.currentQuestionIndex + 1 : "?"} / 4
                </div>
                <QuestionDisplay question={question} muted />
              </div>
            </div>
          )}

          {/* Answer Submission */}
          {question && (
            <div className="mb-3">
              <div className="bg-gray-900/90 rounded-lg p-4 border border-gray-700">
                {shouldHideForm ? (
                  // Chỉ hiển thị kết quả chi tiết khi đã công bố (phase === ROUND3_RESULTS)
                  shouldShowResult ? (
                    <div className="text-center py-4">
                      <div className={`font-bold text-xl mb-2 ${userResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {userResult.isCorrect ? '✓ Đáp án đúng!' : '✗ Đáp án sai'}
                      </div>
                      {userResult.isCorrect && userResult.score > 0 && (
                        <div className="text-yellow-400 font-bold text-3xl mb-2">
                          +{userResult.score} điểm
                        </div>
                      )}
                      {!userResult.isCorrect && (
                        <div className="text-gray-400 text-sm">
                          0 điểm
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="text-green-400 font-semibold mb-2">
                        ✓ Đã gửi đáp án
                      </div>
                      <div className="text-gray-400 text-sm">
                        Chờ MC công bố kết quả...
                      </div>
                    </div>
                  )
                ) : (
                  <div>
                    {alreadySubmittedRound3 && (
                      <div className="mb-2 text-sm text-green-400 font-semibold">
                        ✓ Đã gửi đáp án - Bạn có thể sửa trước khi hết thời gian
                      </div>
                    )}
                    <label className="block text-white font-semibold mb-2">
                      Nhập đáp án:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && !submitting && answer.trim() && canSubmitRound3) {
                            handleSubmitAnswer(answer);
                          }
                        }}
                        className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        placeholder="Nhập đáp án của bạn..."
                        disabled={submitting || !canSubmitRound3}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSubmitAnswer(answer)}
                        disabled={!answer.trim() || submitting || !canSubmitRound3}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? "Đang gửi..." : "Gửi"}
                      </button>
                    </div>
                    {state.questionTimer && state.questionTimer.running && (
                      <div className="mt-2 text-sm text-gray-400">
                        Thời gian còn lại: {Math.max(0, Math.ceil((state.questionTimer.endsAt - Date.now()) / 1000))}s
                      </div>
                    )}
                    {!canSubmitRound3 && (
                      <div className="mt-2 text-sm text-yellow-400">
                        {state.phase === "ROUND3_QUESTION_ACTIVE" && state.questionTimer && !state.questionTimer.running
                          ? "⚠ Đã hết thời gian"
                          : state.phase === "ROUND3_READY"
                          ? "⏳ Chờ MC bắt đầu câu hỏi..."
                          : "⏳ Chờ MC bắt đầu câu hỏi..."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Display - Hiển thị kết quả chi tiết khi phase là RESULTS */}
          {state.phase === "ROUND3_RESULTS" && userResult && (
            <div className="mb-6">
              <div
                className={`rounded-lg p-6 border-2 ${
                  userResult.isCorrect
                    ? "bg-gradient-to-r from-green-900/30 to-emerald-900/30 border-green-600/50"
                    : "bg-gradient-to-r from-red-900/30 to-rose-900/30 border-red-600/50"
                }`}
              >
                <div className="text-center">
                  {userResult.isCorrect ? (
                    <>
                      <div className="text-green-400 font-bold text-2xl mb-2">
                        Đáp án đúng!
                      </div>
                      {userResult.score > 0 && (
                        <div className="text-yellow-400 font-bold text-3xl mb-2">
                          +{userResult.score} điểm
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-red-400 font-bold text-xl">
                      Đáp án sai - 0 điểm
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Answers and Scores Display - 2 columns */}
          {(state.phase === "ROUND3_RESULTS" || 
            state.phase === "ROUND3_JUDGING" ||
            (state.phase === "ROUND3_QUESTION_ACTIVE" && state.questionTimer && Date.now() > state.questionTimer.endsAt)) && (
            <div className="mb-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left column: Answers */}
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-2 text-center">SHOW ĐÁP ÁN</h2>
                <div style={{ height: "280px" }}>
                  <Round3AnswersResult
                    phase={state.phase}
                    questionResults={state.round3State?.questionResults}
                    teams={state.teams}
                    currentQuestionIndex={state.round3State?.currentQuestionIndex}
                    pendingAnswers={state.round3State?.pendingAnswers || []}
                    questionTimer={state.questionTimer}
                  />
                </div>
              </div>
              
              {/* Right column: Scores */}
              <div className="flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-2 text-center">ĐIỂM</h2>
                <div className="flex-1">
                  <Scoreboard teams={state.teams} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Congratulations Modal - Show when Round 3 ends */}
        {state.phase === "ROUND3_END" && (
          <Modal
            isOpen={showCongratulationsModal}
            onClose={() => setShowCongratulationsModal(false)}
            title="🎉 Chúc mừng các đội chơi!"
            maxWidth="48rem"
          >
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Round 3 đã kết thúc!
                </h3>
                <p className="text-gray-300">
                  Dưới đây là kết quả cuối cùng của các đội
                </p>
              </div>

              <div className="space-y-3">
                {[...(state?.teams || [])]
                  .sort((a, b) => b.score - a.score)
                  .map((team, index) => (
                    <div
                      key={team.teamId}
                      className={`p-4 rounded-lg border-2 ${
                        index === 0
                          ? "bg-gradient-to-r from-yellow-900/30 to-amber-900/30 border-yellow-500/50"
                          : index === 1
                          ? "bg-gradient-to-r from-gray-700/30 to-gray-600/30 border-gray-500/50"
                          : index === 2
                          ? "bg-gradient-to-r from-orange-900/30 to-amber-900/30 border-orange-500/50"
                          : "bg-gradient-to-r from-gray-800/30 to-gray-700/30 border-gray-600/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${
                              index === 0
                                ? "bg-gradient-to-br from-yellow-400 to-amber-600 text-white"
                                : index === 1
                                ? "bg-gradient-to-br from-gray-400 to-gray-600 text-white"
                                : index === 2
                                ? "bg-gradient-to-br from-orange-400 to-amber-600 text-white"
                                : "bg-gradient-to-br from-gray-500 to-gray-700 text-white"
                            }`}
                          >
                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-white text-lg">
                              {team.nameSnapshot || team.teamId}
                            </div>
                            {index === 0 && (
                              <div className="text-sm text-yellow-400 font-medium">
                                Vô địch Round 3!
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-yellow-400">
                            {team.score} điểm
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCongratulationsModal(false)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white transition-all"
                >
                  Đóng
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  // Round 2 Layout - Broadcast style
  if (isRound2 && round2Meta) {
    return (
      <Round2StageLayout
        puzzleBoard={
          <PlayerPuzzleBoard
            image={round2Meta.image}
            revealedPieces={round2Meta.revealedPieces}
            teams={state.teams}
            activeTeamId={state.activeTeamId?.toString()}
            buzzingTeams={buzzingTeams}
            phase={state.phase}
          />
        }
        cnvPanel={
          <CNVPanel
            round2Meta={round2Meta}
            cnvInput={state.phase === "CNV_ACTIVE" ? cnvInput : ""}
            horizontalAnswers={getHorizontalAnswers()}
            selectedHorizontalOrder={state.round2State?.currentHorizontalOrder}
            phase={state.phase}
          />
        }
        questionPanel={
          <QuestionPanel
            questionText={state.currentQuestionId ? question?.text : undefined}
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
        fontFamily: "'Times New Roman', serif",
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Round 4 - Steal window banner for other teams */}
      {isRound4StealWindow && !isMainTeamRound4 && (
        <div
          className={`mb-4 p-4 rounded-lg border border-amber-500/70 bg-gradient-to-r from-amber-700/60 to-red-700/60 shadow-lg transition-opacity duration-300 ${
            !canBuzzRound4 ? "opacity-50" : ""
          }`}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-wide text-amber-100/90">
                Cửa sổ giành quyền trả lời
              </div>
              <div className="text-lg md:text-2xl font-bold text-white">
                Bấm chuông để giành quyền trả lời và cướp điểm!
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-3xl font-extrabold text-amber-200 tabular-nums">
                {round4StealCountdown}s
              </div>
              <button
                onClick={handleBuzzRound4}
                disabled={!canBuzzRound4}
                className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                RUNG CHUÔNG NGAY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {(() => {
        // Round 4: Don't show "ĐANG CHỜ" when in valid phases with question
        if (isRound4 && state.currentQuestionId) {
          const validRound4Phases = ["R4_STAR_CONFIRMATION", "R4_QUESTION_SHOW", "R4_QUESTION_LOCK_MAIN", "R4_JUDGE_MAIN"];
          if (validRound4Phases.includes(state.phase)) {
            return null; // Don't show banner, question will be displayed
          }
        }
        
        // Default logic for other cases
        if (state.activeTeamId && !state.currentQuestionId && !isRound2) {
          return (
            <div className="mb-4 p-4 bg-gradient-to-r from-yellow-600/20 to-yellow-700/20 border border-yellow-500/50 rounded-lg">
              <p className="text-white text-center font-bold text-lg">
                ĐỘI ĐƯỢC MC CHỌN: {selectedTeam?.nameSnapshot || "N/A"}
              </p>
            </div>
          );
        }
        
        return (
          <div className="mb-4 p-4 bg-gradient-to-r from-blue-600/20 to-blue-700/20 border border-blue-500/50 rounded-lg">
            <p className="text-white text-center font-bold text-lg">ĐANG CHỜ</p>
          </div>
        );
      })()}

      {state.questionTimer && (
        <div className="flex justify-center mb-4">
          <Timer timer={state.questionTimer} size="lg" />
        </div>
      )}

      {/* Round 4 - Ngôi sao hy vọng banner cho đội đang thi */}
      {isRound4 && hasStarOnCurrentR4 && (
        <div className="mb-4 max-w-3xl mx-auto p-3 rounded-xl border border-yellow-400/70 bg-yellow-500/15 backdrop-blur-sm">
          <div className="flex items-center gap-3 justify-center">
            <span className="text-xl">★</span>
            <span className="text-sm md:text-base text-yellow-100 font-semibold">
              Ngôi sao hy vọng đang được sử dụng cho câu hỏi hiện tại. Nếu trả lời đúng, đội sẽ được nhân đôi số điểm!
            </span>
          </div>
        </div>
      )}


      {/* Hiển thị gói cho Round 1/3 (dùng PackageCard) hoặc Round 4 (hiển thị 40/60/80 điểm, chỉ đọc) */}
      {state.activeTeamId && state.phase !== "IDLE" && !state.currentQuestionId && (
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-4">Gói câu hỏi</h2>
          {isRound4 ? (
            <div className="max-w-4xl mx-auto">
              <div className="rounded-2xl bg-blue-900/60 border border-blue-400/60 px-6 py-4 text-center shadow-xl">
                <div className="text-sm uppercase tracking-wide text-blue-100">
                  Gói đang được MC chọn cho đội thi
                </div>
                <div className="mt-2 text-3xl font-extrabold text-white">
                  {state.round4State?.selectedPackage
                    ? `Gói ${state.round4State.selectedPackage} điểm`
                    : "Chưa chọn gói"}
                </div>
                <div className="mt-3 flex items-center justify-center gap-4 text-sm text-blue-100/80">
                  {[40, 60, 80].map((pts) => {
                    const isSelected = state.round4State?.selectedPackage === pts;
                    return (
                      <div
                        key={pts}
                        className={`min-w-[90px] px-4 py-2 rounded-full border text-center text-base font-semibold ${
                          isSelected
                            ? "border-yellow-300 bg-yellow-400/20 text-yellow-100"
                            : "border-blue-300/50 bg-blue-800/60 text-blue-100/80"
                        }`}
                      >
                        Gói {pts}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-blue-100/70">
                  Đội thi chỉ xem thông tin gói; MC là người lựa chọn gói trên màn hình điều khiển.
                </p>
              </div>
            </div>
          ) : packages.length === 0 ? (
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

      {/* Round 4: Hiển thị câu hỏi sau khi đội đã xác nhận ngôi sao, hoặc nếu đã dùng ngôi sao thì hiển thị ngay */}
      {state.currentQuestionId && 
       !(isRound4 && state.phase === "R4_STAR_CONFIRMATION" && isMainTeamRound4 && !hasUsedStarBefore) && (
        <div className="mb-4">
          {isRound4 && question?.videoUrl ? (
            <div className="w-full max-w-4xl mx-auto">
              <div className="question-depth-card p-4 mb-4">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-white/70">Câu hỏi</div>
                    {hasStarOnCurrentR4 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-400/50">
                        <span className="text-xl animate-pulse">⭐</span>
                        <span className="text-xs font-semibold text-yellow-200">
                          Ngôi sao hy vọng
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-lg font-semibold text-white mb-4">
                    {question.text}
                  </div>
                  <video
                    ref={round4VideoRef}
                    src={question.videoUrl}
                    autoPlay
                    muted
                    className="w-full max-w-4xl mx-auto rounded-xl shadow-2xl"
                    style={{ pointerEvents: "none" }}
                    onEnded={async () => {
                      // Start timer after video ends
                      if (
                        state.round === "ROUND4" &&
                        state.phase === "R4_QUESTION_SHOW"
                      ) {
                        try {
                          await fetch("/api/game-control/round4/start-timer", {
                            method: "POST",
                          });
                        } catch (error) {
                          console.error("Error starting timer after video:", error);
                        }
                      }
                    }}
                  >
                    Trình duyệt của bạn không hỗ trợ video.
                  </video>
                </div>
              </div>
            </div>
          ) : (
            <QuestionCard
              questionText={question?.text || "Đang tải câu hỏi..."}
              questionNumber={question?.index}
              totalQuestions={12}
              hasStar={isRound4 && hasStarOnCurrentR4}
            />
          )}
        </div>
      )}

      <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId?.toString()} />

      {/* Question points - top right (Round 4) */}
      {isRound4 && r4 && r4.currentQuestionIndex !== undefined && r4.questions && (
        <div className="fixed top-4 right-4 z-50 text-right bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
          <div className="text-sm text-gray-300">
            Câu {r4.currentQuestionIndex + 1}
          </div>
          <div className="text-xl font-semibold text-cyan-300">
            {r4.questions[r4.currentQuestionIndex].points} điểm
          </div>
        </div>
      )}

      {/* Star animation - top right (Round 4) */}
      {isRound4 && hasStarOnCurrentR4 && (
        <div className="fixed top-4 right-20 z-50">
          <span className="text-3xl animate-pulse">⭐</span>
        </div>
      )}

      {/* Round 4 - Star Confirmation Modal */}
      {isStarConfirmationPhase && (
        <Modal
          isOpen={true}
          onClose={() => {}} // Không cho đóng modal, phải chọn
          title="★ Ngôi sao hy vọng"
          maxWidth="32rem"
        >
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⭐</div>
              <h3 className="text-xl font-bold text-white mb-4">
                Bạn có muốn sử dụng Ngôi sao hy vọng cho câu hỏi này không?
              </h3>
              <div className="space-y-3 text-left bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-4">
                <p className="text-yellow-100 text-sm">
                  <strong className="text-yellow-200">Ngôi sao hy vọng:</strong>
                </p>
                <ul className="text-yellow-100/90 text-sm space-y-2 list-disc list-inside">
                  <li>Nếu trả lời đúng câu hỏi này, điểm sẽ được <strong className="text-yellow-200">nhân đôi</strong></li>
                  <li>Nếu trả lời sai, điểm sẽ bị <strong className="text-yellow-200">trừ đầy đủ</strong> số điểm của câu hỏi</li>
                  <li>Mỗi đội chỉ được sử dụng Ngôi sao hy vọng <strong className="text-yellow-200">một lần</strong> trong Vòng 4</li>
                  {hasUsedStarBefore && (
                    <li className="text-red-300 font-semibold">
                      ⚠️ Bạn đã sử dụng Ngôi sao hy vọng rồi, không thể sử dụng lại
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleConfirmStar(false)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 rounded-lg font-semibold text-white transition-all"
              >
                Không, không sử dụng
              </button>
              <button
                onClick={() => handleConfirmStar(true)}
                disabled={hasUsedStarBefore}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Có, sử dụng Ngôi sao
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
