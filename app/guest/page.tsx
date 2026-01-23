"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { useGameStore } from "@/store/gameStore";
import { Round2StageLayout } from "@/components/round2/Round2StageLayout";
import { GuestPuzzleBoard } from "@/components/round2/GuestPuzzleBoard";
import { CNVPanel } from "@/components/round2/CNVPanel";
import { QuestionPanel } from "@/components/round2/QuestionPanel";
import { AnswersResult } from "@/components/round2/AnswersResult";
import { Round3AnswersResult } from "@/components/round3/Round3AnswersResult";
import { QuestionDisplay } from "@/components/round3/QuestionDisplay";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Scoreboard } from "@/components/game/Scoreboard";
import { Timer } from "@/components/game/Timer";
import type { Round2Meta, Phase, Round } from "@/types/game";

function getRoundLabel(round?: Round) {
  switch (round) {
    case "ROUND1":
      return "Phần thi thứ nhất";
    case "ROUND2":
      return "Phần thi thứ hai";
    case "ROUND3":
      return "Phần thi thứ ba";
    case "ROUND4":
      return "Phần thi thứ tư";
    default:
      return "Chương trình";
  }
}

function getPhaseLabel(phase?: Phase, currentTeamName?: string) {
  switch (phase) {
    case "IDLE":
      return "Đang chờ MC bắt đầu chương trình";
    case "ROUND_READY":
    case "ROUND3_READY":
      return "Chuẩn bị bắt đầu vòng thi";
    case "QUESTION_SHOW":
    case "R4_QUESTION_SHOW":
      return "Đang hiển thị câu hỏi";
    case "TIMER_RUNNING":
    case "ROUND3_QUESTION_ACTIVE":
    case "R4_QUESTION_LOCK_MAIN":
      return currentTeamName
        ? `Đội ${currentTeamName} đang trả lời`
        : "Các đội đang trả lời";
    case "JUDGING":
    case "HORIZONTAL_JUDGING":
    case "CNV_JUDGING":
    case "ROUND3_JUDGING":
    case "R4_JUDGE_MAIN":
    case "R4_JUDGE_STEAL":
      return "MC đang chấm điểm";
    case "REVEAL":
    case "REVEAL_PIECE":
    case "FINAL_PIECE_REVEAL":
      return "Đang công bố đáp án";
    case "ROUND_END":
    case "ROUND3_END":
    case "R4_END":
      return "Kết thúc vòng thi";
    default:
      return "Đang diễn ra chương trình";
  }
}

export default function GuestPage() {
  const state = useGameStore((state) => state.state);
  const serverTimeOffset = useGameStore((state) => state.serverTimeOffset);
  const [question, setQuestion] = useState<any>(null);
  const [packageData, setPackageData] = useState<any>(null);
  const [horizontalQuestions, setHorizontalQuestions] = useState<any[]>([]);

  // Sounds for audience view (mirror main stage)
  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongShortSoundRef = useRef<HTMLAudioElement | null>(null);
  const openTeamAnswerSoundRef = useRef<HTMLAudioElement | null>(null);
  const correctRound3SoundRef = useRef<HTMLAudioElement | null>(null);
  const soundRound4Ref = useRef<HTMLAudioElement | null>(null);
  const openRound2SoundRef = useRef<HTMLAudioElement | null>(null);
  const round1StartSoundRef = useRef<HTMLAudioElement | null>(null);
  const numberCharacterSoundRef = useRef<HTMLAudioElement | null>(null);
  const sound10sRef = useRef<HTMLAudioElement | null>(null);
  const sound20sRef = useRef<HTMLAudioElement | null>(null);
  const sound30sRef = useRef<HTMLAudioElement | null>(null);
  const sound60sRef = useRef<HTMLAudioElement | null>(null);
  const bellRingingSoundRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef<boolean>(false);
  const sound30sTimeoutRef = useRef<number | null>(null);

  // Video tracking for auto-play and scoreboard hiding
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const round3VideoRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isRound3VideoPlaying, setIsRound3VideoPlaying] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Track current time for timer expiration checks
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time periodically to re-evaluate timer expiration
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useHydrateGameState();
  usePusherGameState();

  // Initialize audio elements and enable on first user interaction
  useEffect(() => {
    correctSoundRef.current = new Audio("/sound/correct.mp3");
    correctSoundRef.current.volume = 0.7;
    correctSoundRef.current.preload = "auto";
    wrongSoundRef.current = new Audio("/sound/wrong.mp3");
    wrongSoundRef.current.volume = 0.7;
    wrongSoundRef.current.preload = "auto";
    wrongShortSoundRef.current = new Audio("/sound/wrong-short.mp3");
    wrongShortSoundRef.current.volume = 0.7;
    wrongShortSoundRef.current.preload = "auto";
    openTeamAnswerSoundRef.current = new Audio("/sound/open-team-answer.mp3");
    openTeamAnswerSoundRef.current.volume = 0.7;
    openTeamAnswerSoundRef.current.preload = "auto";
    correctRound3SoundRef.current = new Audio("/sound/correct-round-3.mp3");
    correctRound3SoundRef.current.volume = 0.7;
    correctRound3SoundRef.current.preload = "auto";
    soundRound4Ref.current = new Audio("/sound/sound-round-4.mp3");
    soundRound4Ref.current.volume = 0.7;
    soundRound4Ref.current.preload = "auto";
    openRound2SoundRef.current = new Audio("/sound/open-round-2.mp3");
    openRound2SoundRef.current.volume = 0.7;
    openRound2SoundRef.current.preload = "auto";
    round1StartSoundRef.current = new Audio("/sound/round-1-start.mp3");
    round1StartSoundRef.current.volume = 0.7;
    round1StartSoundRef.current.preload = "auto";
    numberCharacterSoundRef.current = new Audio("/sound/number-character.mp3");
    numberCharacterSoundRef.current.volume = 0.7;
    numberCharacterSoundRef.current.preload = "auto";
    sound10sRef.current = new Audio("/sound/10s.mp3");
    sound10sRef.current.volume = 0.7;
    sound10sRef.current.preload = "auto";
    sound20sRef.current = new Audio("/sound/20s.mp3");
    sound20sRef.current.volume = 0.7;
    sound20sRef.current.preload = "auto";
    sound30sRef.current = new Audio("/sound/30s.mp3");
    sound30sRef.current.volume = 0.7;
    sound30sRef.current.preload = "auto";
    sound60sRef.current = new Audio("/sound/60s.mp3");
    sound60sRef.current.volume = 0.7;
    sound60sRef.current.preload = "auto";
    bellRingingSoundRef.current = new Audio("/sound/bell-ringing.mp3");
    bellRingingSoundRef.current.volume = 0.7;
    bellRingingSoundRef.current.preload = "auto";

    const enableAudio = async () => {
      if (audioEnabledRef.current) return;
      try {
        if (correctSoundRef.current) {
          await correctSoundRef.current.play();
          correctSoundRef.current.pause();
          correctSoundRef.current.currentTime = 0;
        }
        audioEnabledRef.current = true;
        setAudioUnlocked(true);
      } catch {
        // ignore, user will need to interact again
      }
    };

    // Try to auto-unlock audio immediately (for automatic guest screen)
    const tryAutoUnlock = async () => {
      try {
        if (correctSoundRef.current) {
          await correctSoundRef.current.play();
          correctSoundRef.current.pause();
          correctSoundRef.current.currentTime = 0;
        }
        audioEnabledRef.current = true;
        setAudioUnlocked(true);
      } catch (error) {
        // Auto-unlock failed (browser policy), will rely on user interaction fallback
        console.log("Auto-unlock audio failed, will use fallback:", error);
      }
    };

    // Attempt auto-unlock immediately
    tryAutoUnlock();

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

      if (correctSoundRef.current) {
        correctSoundRef.current.pause();
        correctSoundRef.current = null;
      }
      if (wrongSoundRef.current) {
        wrongSoundRef.current.pause();
        wrongSoundRef.current = null;
      }
      if (wrongShortSoundRef.current) {
        wrongShortSoundRef.current.pause();
        wrongShortSoundRef.current = null;
      }
      if (openTeamAnswerSoundRef.current) {
        openTeamAnswerSoundRef.current.pause();
        openTeamAnswerSoundRef.current = null;
      }
      if (correctRound3SoundRef.current) {
        correctRound3SoundRef.current.pause();
        correctRound3SoundRef.current = null;
      }
      if (soundRound4Ref.current) {
        soundRound4Ref.current.pause();
        soundRound4Ref.current = null;
      }
      if (openRound2SoundRef.current) {
        openRound2SoundRef.current.pause();
        openRound2SoundRef.current = null;
      }
      if (round1StartSoundRef.current) {
        round1StartSoundRef.current.pause();
        round1StartSoundRef.current = null;
      }
      if (numberCharacterSoundRef.current) {
        numberCharacterSoundRef.current.pause();
        numberCharacterSoundRef.current = null;
      }
      if (sound10sRef.current) {
        sound10sRef.current.pause();
        sound10sRef.current = null;
      }
      if (sound20sRef.current) {
        sound20sRef.current.pause();
        sound20sRef.current = null;
      }
      if (sound30sRef.current) {
        sound30sRef.current.pause();
        sound30sRef.current = null;
      }
      if (sound60sRef.current) {
        sound60sRef.current.pause();
        sound60sRef.current = null;
      }
      if (bellRingingSoundRef.current) {
        bellRingingSoundRef.current.pause();
        bellRingingSoundRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Không fetch question khi đang chờ xác nhận ngôi sao
    if (state?.round === "ROUND4" && state?.phase === "R4_STAR_CONFIRMATION") {
      setQuestion(null);
      return;
    }
    
    if (state?.currentQuestionId) {
      fetch(`/api/questions/${state.currentQuestionId}`)
        .then((res) => res.json())
        .then(setQuestion)
        .catch(console.error);
    } else {
      // Clear question state when currentQuestionId is undefined
      setQuestion(null);
    }
  }, [state?.currentQuestionId, state?.round, state?.phase]);

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

  // Auto-play video when question changes (or when R4 phase changes to R4_QUESTION_SHOW)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !question?.videoUrl || !state?.currentQuestionId) return;

    // For Round 4, only play when phase is R4_QUESTION_SHOW (video hidden during R4_STAR_CONFIRMATION)
    if (state?.round === "ROUND4" && state?.phase !== "R4_QUESTION_SHOW") return;

    // Reset video state
    setIsVideoPlaying(false);
    
    const isRound4 = state?.round === "ROUND4";
    
    // Function to attempt play
    const attemptPlay = async () => {
      // Check if video element is in DOM
      if (!video.isConnected) {
        console.log("Video element not in DOM yet, will retry");
        return;
      }

      // For Round 4, always start muted to ensure autoplay works
      // Audio will be unmuted after user clicks the unlock button
      if (isRound4) {
        video.muted = !audioUnlocked;
      }

      // Wait for video to be ready with better state checks
      if (video.readyState >= 3) { // HAVE_FUTURE_DATA or higher
        try {
          video.currentTime = 0;
          await video.play();
        } catch (error) {
          console.log("Video auto-play prevented, will retry:", error);
          // Retry after a delay (muted for Round 4 to allow autoplay)
          setTimeout(() => {
            if (video && !video.paused) return; // Already playing
            if (isRound4) {
              video.muted = !audioUnlocked;
            }
            video.play().catch(console.error);
          }, 500);
        }
      } else {
        // Use canplay event for better reliability
        const onCanPlay = async () => {
          try {
            video.currentTime = 0;
            await video.play();
          } catch (error) {
            console.log("Video auto-play prevented:", error);
            // Retry after a delay (muted for Round 4 to allow autoplay)
            setTimeout(() => {
              if (video && !video.paused) return; // Already playing
              if (isRound4) {
                video.muted = !audioUnlocked;
              }
              video.play().catch(console.error);
            }, 500);
          }
          video.removeEventListener('canplay', onCanPlay);
        };
        video.addEventListener('canplay', onCanPlay);
        video.load();
      }
    };

    // Increased delay to ensure video element is mounted and ready
    const timeoutId = setTimeout(attemptPlay, 250);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [question?.videoUrl, state?.currentQuestionId, state?.phase, state?.round, audioUnlocked]);

  // Round 4 video: hard-sync currentTime between clients using server timestamp
  useEffect(() => {
    const video = videoRef.current;
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

  // Sync video muted state when audioUnlocked changes (for Round 4)
  useEffect(() => {
    if (videoRef.current && state?.round === "ROUND4") {
      videoRef.current.muted = !audioUnlocked;
    }
  }, [audioUnlocked, state?.round]);

  // Auto-play video for Round 3 when question changes
  useEffect(() => {
    const video = round3VideoRef.current;
    if (!video || !question?.videoUrl || question?.type !== "video" || state?.round !== "ROUND3") return;

    // Reset video state
    setIsRound3VideoPlaying(false);
    
    // Function to attempt play
    const attemptPlay = async () => {
      // Ensure audio context is enabled
      if (!audioEnabledRef.current && correctSoundRef.current) {
        try {
          await correctSoundRef.current.play();
          correctSoundRef.current.pause();
          correctSoundRef.current.currentTime = 0;
          audioEnabledRef.current = true;
        } catch {
          // Audio not enabled yet, will need user interaction
        }
      }

      // Wait for video to be ready
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        try {
          video.currentTime = 0;
          await video.play();
        } catch (error) {
          console.log("Round 3 video auto-play prevented:", error);
        }
      } else {
        // Wait for video to load
        const onLoadedData = async () => {
          try {
            video.currentTime = 0;
            await video.play();
          } catch (error) {
            console.log("Round 3 video auto-play prevented:", error);
          }
          video.removeEventListener('loadeddata', onLoadedData);
        };
        video.addEventListener('loadeddata', onLoadedData);
        
        // Also try to load video
        video.load();
      }
    };

    // Small delay to ensure video element is mounted
    const timeoutId = setTimeout(attemptPlay, 100);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [question?.videoUrl, question?.type, state?.round, state?.currentQuestionId]);

  // Fetch package data (Round 1 for history, Round 2 for puzzle and history)
  useEffect(() => {
    if (state?.activePackageId && state?.round === "ROUND2") {
      const fetchPackageData = () => {
        fetch(`/api/packages/${state.activePackageId}`)
          .then((res) => res.json())
          .then(setPackageData)
          .catch(console.error);
      };

      fetchPackageData();
      // Poll package data every 1 second when in Round2 to catch history changes (for AnswersResult)
      const interval = setInterval(fetchPackageData, 1000);
      return () => clearInterval(interval);
    } else if (state?.activePackageId && state?.round === "ROUND1") {
      const fetchPackageData = () => {
        fetch(`/api/packages/${state.activePackageId}`)
          .then((res) => res.json())
          .then(setPackageData)
          .catch(console.error);
      };

      fetchPackageData();
      const interval = setInterval(fetchPackageData, 1000);
      return () => clearInterval(interval);
    }
  }, [state?.activePackageId, state?.round, state?.phase]);

  // Fetch horizontal questions for Round 2
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

  // Get current team name (safe when state chưa sẵn sàng)
  const currentTeamName = state?.teams.find(
    (t) => t.teamId === state.activeTeamId
  )?.nameSnapshot;

  const roundLabel = useMemo(
    () => getRoundLabel(state?.round as Round | undefined),
    [state?.round]
  );

  const phaseLabel = useMemo(
    () => getPhaseLabel(state?.phase as Phase | undefined, currentTeamName),
    [state?.phase, currentTeamName]
  );

  // --- Sound reactions for audience ---

  // Round 1: play sound when phase changes to QUESTION_SHOW and when 60-second timer starts
  const prevRound1StateRef = useRef<{ 
    phase: string | null; 
    activePackageId: string | null | undefined;
    timerDuration: number | null;
  }>({
    phase: null,
    activePackageId: null,
    timerDuration: null,
  });
  
  useEffect(() => {
    const currentRound = state?.round || null;
    const currentPhase = state?.phase || null;
    const currentActivePackageId = state?.activePackageId;
    const prevRound1State = prevRound1StateRef.current;
    
    // Handle Round 1: Play sound when phase changes to QUESTION_SHOW with activePackageId (MC has selected team and started game)
    if (currentRound === "ROUND1") {
      // Play sound when phase changes to QUESTION_SHOW and package is active (MC selected team and started game)
      // Check if this is a new game start (phase or package changed to QUESTION_SHOW with activePackageId)
      const isGameStarting = 
        currentPhase === "QUESTION_SHOW" &&
        currentActivePackageId &&
        (prevRound1State.phase !== "QUESTION_SHOW" || prevRound1State.activePackageId !== currentActivePackageId);
      
      if (isGameStarting) {
        if (round1StartSoundRef.current) {
          // Try to unlock audio first if not enabled
          if (!audioEnabledRef.current && correctSoundRef.current) {
            correctSoundRef.current.play()
              .then(() => {
                correctSoundRef.current?.pause();
                if (correctSoundRef.current) {
                  correctSoundRef.current.currentTime = 0;
                }
                audioEnabledRef.current = true;
              })
              .catch(() => {
                // Audio still not unlocked, continue anyway
              });
          }
          
          // Try to play Round 1 sound immediately (don't await to avoid blocking)
          if (round1StartSoundRef.current) {
            round1StartSoundRef.current.currentTime = 0;
            round1StartSoundRef.current.play().catch((error: any) => {
              // If NotAllowedError, audio hasn't been unlocked by user interaction yet
              // This is expected and OK - sound will play once user interacts
              if (error.name !== "NotAllowedError") {
                console.error("Failed to play round-1-start sound (guest):", error);
              }
            });
          }
        }
      }
      
      // Play 60s sound when 60-second timer starts
      if (currentPhase === "QUESTION_SHOW" && state?.questionTimer?.running) {
        const timerDuration = state.questionTimer.endsAt - Date.now();
        const is60SecondTimer = timerDuration >= 59000 && timerDuration <= 61000; // Allow 1 second tolerance
        
        // Check if this is a new 60-second timer (wasn't running before or duration changed)
        const prevTimerDuration = prevRound1StateRef.current.timerDuration;
        const was60SecondTimer = prevTimerDuration && prevTimerDuration >= 59000 && prevTimerDuration <= 61000;
        
        if (is60SecondTimer && !was60SecondTimer && sound60sRef.current && audioEnabledRef.current) {
          sound60sRef.current.currentTime = 0;
          sound60sRef.current.play().catch((error: any) => {
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play 60s sound (guest):", error);
            }
          });
        }
        
        // Update timer duration in ref
        prevRound1StateRef.current.timerDuration = timerDuration;
      } else {
        // Stop countdown sounds when phase changes away from QUESTION_SHOW or timer stops
        if (prevRound1StateRef.current.phase === "QUESTION_SHOW" && currentPhase !== "QUESTION_SHOW") {
          // Phase changed away from QUESTION_SHOW, stop all countdown sounds
          if (sound10sRef.current) {
            sound10sRef.current.pause();
            sound10sRef.current.currentTime = 0;
          }
          if (sound20sRef.current) {
            sound20sRef.current.pause();
            sound20sRef.current.currentTime = 0;
          }
          if (sound30sRef.current) {
            sound30sRef.current.pause();
            sound30sRef.current.currentTime = 0;
          }
          if (sound60sRef.current) {
            sound60sRef.current.pause();
            sound60sRef.current.currentTime = 0;
          }
        }
        
        // Stop sounds when timer stops running
        if (prevRound1StateRef.current.timerDuration !== null && (!state?.questionTimer?.running)) {
          if (sound10sRef.current) {
            sound10sRef.current.pause();
            sound10sRef.current.currentTime = 0;
          }
          if (sound20sRef.current) {
            sound20sRef.current.pause();
            sound20sRef.current.currentTime = 0;
          }
          if (sound30sRef.current) {
            sound30sRef.current.pause();
            sound30sRef.current.currentTime = 0;
          }
          if (sound60sRef.current) {
            sound60sRef.current.pause();
            sound60sRef.current.currentTime = 0;
          }
        }
        
        prevRound1StateRef.current.timerDuration = null;
      }
      
      // Update previous state reference for Round 1
      prevRound1StateRef.current = {
        phase: currentPhase,
        activePackageId: currentActivePackageId,
        timerDuration: prevRound1StateRef.current.timerDuration,
      };
    } else {
      // Reset when not in Round 1
      prevRound1StateRef.current = {
        phase: null,
        activePackageId: null,
        timerDuration: null,
      };
      
      // Stop all countdown sounds when leaving Round 1
      if (sound10sRef.current) {
        sound10sRef.current.pause();
        sound10sRef.current.currentTime = 0;
      }
      if (sound20sRef.current) {
        sound20sRef.current.pause();
        sound20sRef.current.currentTime = 0;
      }
      if (sound30sRef.current) {
        sound30sRef.current.pause();
        sound30sRef.current.currentTime = 0;
      }
      if (sound60sRef.current) {
        sound60sRef.current.pause();
        sound60sRef.current.currentTime = 0;
      }
    }
  }, [state?.round, state?.phase, state?.activePackageId, state?.questionTimer]);

  // Round 1: play sound when new CORRECT/WRONG history entries appear
  const prevHistoryLengthRef = useRef<number>(0);
  useEffect(() => {
    if (state?.round === "ROUND1" && packageData?.history) {
      const history = packageData.history || [];
      const prevLength = prevHistoryLengthRef.current;

      if (history.length > prevLength) {
        const newEntries = history.slice(prevLength);
        const hasNewCorrect = newEntries.some(
          (entry: any) => entry.result === "CORRECT"
        );
        const hasNewWrong = newEntries.some(
          (entry: any) => entry.result === "WRONG"
        );

        if (hasNewCorrect && correctSoundRef.current && audioEnabledRef.current) {
          correctSoundRef.current.play().catch((error) => {
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play correct sound (guest):", error);
            }
          });
        }
        if (
          hasNewWrong &&
          wrongShortSoundRef.current &&
          audioEnabledRef.current
        ) {
          wrongShortSoundRef.current.play().catch((error) => {
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play wrong-short sound (guest):", error);
            }
          });
        }
      }

      prevHistoryLengthRef.current = history.length;
    }
  }, [packageData?.history, state?.round]);

  // Round 2 & 3: play sound when all answers judged and at least one is correct
  const prevPendingAnswersLengthRef = useRef<{ round2: number; round3: number }>(
    { round2: 0, round3: 0 }
  );
  const hasHadAnswersRef = useRef<{ round2: boolean; round3: boolean }>({
    round2: false,
    round3: false,
  });

  useEffect(() => {
    // Round 2
    if (state?.round === "ROUND2") {
      const currentPending = state.round2State?.pendingAnswers || [];
      const currentLength = currentPending.length;
      const prevLength = prevPendingAnswersLengthRef.current.round2;

      if (currentLength > 0 && !hasHadAnswersRef.current.round2) {
        hasHadAnswersRef.current.round2 = true;
      }

      if (
        prevLength > 0 &&
        currentLength === 0 &&
        hasHadAnswersRef.current.round2 &&
        openTeamAnswerSoundRef.current &&
        audioEnabledRef.current
      ) {
        const hasCorrectAnswer = state?.phase === "REVEAL_PIECE";
        if (hasCorrectAnswer) {
          openTeamAnswerSoundRef.current.play().catch((error) => {
            if (error.name !== "NotAllowedError") {
              console.error(
                "Failed to play open-team-answer sound (guest):",
                error
              );
            }
          });
        }
        hasHadAnswersRef.current.round2 = false;
      }

      prevPendingAnswersLengthRef.current.round2 = currentLength;
    } else {
      prevPendingAnswersLengthRef.current.round2 = 0;
      hasHadAnswersRef.current.round2 = false;
    }

    // Round 3
    if (state?.round === "ROUND3") {
      const currentPending = state.round3State?.pendingAnswers || [];
      const currentLength = currentPending.length;
      const prevLength = prevPendingAnswersLengthRef.current.round3;

      if (currentLength > 0 && !hasHadAnswersRef.current.round3) {
        hasHadAnswersRef.current.round3 = true;
      }

      if (
        prevLength > 0 &&
        currentLength === 0 &&
        hasHadAnswersRef.current.round3 &&
        openTeamAnswerSoundRef.current &&
        audioEnabledRef.current
      ) {
        const currentQuestionIndex = state.round3State?.currentQuestionIndex;
        if (currentQuestionIndex !== undefined && currentQuestionIndex >= 0) {
          const questionIndexKey = String(currentQuestionIndex);
          const questionResultsMap = state.round3State?.questionResults;
          let hasCorrectAnswer = false;

          if (questionResultsMap) {
            let questionResults: any[] = [];
            if (questionResultsMap instanceof Map) {
              questionResults = questionResultsMap.get(questionIndexKey) || [];
            } else if (typeof questionResultsMap === "object") {
              const resultsObj = questionResultsMap as Record<string, any>;
              questionResults =
                resultsObj[questionIndexKey] ||
                resultsObj[currentQuestionIndex] ||
                [];
            }
            hasCorrectAnswer = questionResults.some(
              (r: any) => r.isCorrect === true
            );
          }

          if (hasCorrectAnswer) {
            openTeamAnswerSoundRef.current.play().catch((error) => {
              if (error.name !== "NotAllowedError") {
                console.error(
                  "Failed to play open-team-answer sound (guest):",
                  error
                );
              }
            });
          }
        }
        hasHadAnswersRef.current.round3 = false;
      }

      prevPendingAnswersLengthRef.current.round3 = currentLength;
    } else {
      prevPendingAnswersLengthRef.current.round3 = 0;
      hasHadAnswersRef.current.round3 = false;
    }
  }, [
    state?.round,
    state?.round2State?.pendingAnswers?.length,
    state?.round3State?.pendingAnswers?.length,
    state?.round3State?.currentQuestionIndex,
    state?.phase,
    state?.currentQuestionId,
  ]);

  // Round 3: play per-judge sounds (correct / wrong) as answers are judged
  const prevRound3QuestionResultsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (state?.round === "ROUND3" && state?.round3State?.questionResults) {
      const currentQuestionIndex = state.round3State.currentQuestionIndex;
      if (currentQuestionIndex !== undefined && currentQuestionIndex >= 0) {
        const questionIndexKey = String(currentQuestionIndex);
        const questionResultsMap = state.round3State.questionResults;

        let currentQuestionResults: any[] = [];
        if (questionResultsMap instanceof Map) {
          currentQuestionResults = questionResultsMap.get(questionIndexKey) || [];
        } else if (typeof questionResultsMap === "object") {
          const resultsObj = questionResultsMap as Record<string, any>;
          currentQuestionResults =
            resultsObj[questionIndexKey] ||
            resultsObj[currentQuestionIndex] ||
            [];
        }

        const prevCount =
          prevRound3QuestionResultsRef.current.get(questionIndexKey) || 0;
        const currentCount = currentQuestionResults.length;

        if (currentCount > prevCount) {
          const newEntries = currentQuestionResults.slice(prevCount);

          newEntries.forEach((entry: any) => {
            if (
              entry.isCorrect === true &&
              correctRound3SoundRef.current &&
              audioEnabledRef.current
            ) {
              correctRound3SoundRef.current.play().catch((error) => {
                if (error.name !== "NotAllowedError") {
                  console.error(
                    "Failed to play correct-round-3 sound when MC judges correct (guest):",
                    error
                  );
                }
              });
            } else if (
              entry.isCorrect === false &&
              wrongSoundRef.current &&
              audioEnabledRef.current
            ) {
              wrongSoundRef.current.play().catch((error) => {
                if (error.name !== "NotAllowedError") {
                  console.error("Failed to play wrong sound (guest):", error);
                }
              });
            }
          });
        }

        prevRound3QuestionResultsRef.current.set(questionIndexKey, currentCount);
      }
    }
  }, [
    state?.round,
    state?.round3State?.currentQuestionIndex,
    state?.currentQuestionId,
    state?.round3State?.questionResults
      ? state.round3State.questionResults instanceof Map
        ? state.round3State.questionResults.get(
            String(state.round3State.currentQuestionIndex ?? -1)
          )?.length ?? 0
        : (
            state.round3State.questionResults as Record<string, any>
          )[String(state.round3State.currentQuestionIndex ?? -1)]?.length ?? 0
      : 0,
  ]);

  // Round 3: play 30s sound when question starts
  const prevRound3QuestionStateRef = useRef<{
    phase: string | null;
    currentQuestionIndex: number | undefined;
  }>({
    phase: null,
    currentQuestionIndex: undefined,
  });

  useEffect(() => {
    if (state?.round !== "ROUND3") {
      prevRound3QuestionStateRef.current = { phase: null, currentQuestionIndex: undefined };
      return;
    }

    const currentPhase = state?.phase || null;
    const currentQuestionIndex = state?.round3State?.currentQuestionIndex;
    const prevState = prevRound3QuestionStateRef.current;

    // Play 30s sound when question starts (phase changes to ROUND3_QUESTION_ACTIVE and question index changes)
    const isQuestionStarting = 
      currentPhase === "ROUND3_QUESTION_ACTIVE" &&
      currentQuestionIndex !== undefined &&
      (prevState.phase !== "ROUND3_QUESTION_ACTIVE" || 
       prevState.currentQuestionIndex !== currentQuestionIndex);

    if (isQuestionStarting && sound30sRef.current) {
      // Ensure audio is enabled first
      if (!audioEnabledRef.current && correctSoundRef.current) {
        correctSoundRef.current.play()
          .then(() => {
            correctSoundRef.current?.pause();
            if (correctSoundRef.current) {
              correctSoundRef.current.currentTime = 0;
            }
            audioEnabledRef.current = true;
          })
          .catch(() => {});
      }

      sound30sRef.current.currentTime = 0;
      sound30sRef.current.play().catch((error) => {
        if (error.name !== "NotAllowedError") {
          console.error("Failed to play 30s sound for Round 3 (guest):", error);
        }
      });

      // Clear previous timeout if exists
      if (sound30sTimeoutRef.current !== null) {
        clearTimeout(sound30sTimeoutRef.current);
        sound30sTimeoutRef.current = null;
      }

      // Set timeout to stop sound after 30 seconds
      sound30sTimeoutRef.current = window.setTimeout(() => {
        if (sound30sRef.current && !sound30sRef.current.paused) {
          sound30sRef.current.pause();
          sound30sRef.current.currentTime = 0;
        }
        sound30sTimeoutRef.current = null;
      }, 30000); // 30 seconds = 30000ms
    }

    prevRound3QuestionStateRef.current = {
      phase: currentPhase,
      currentQuestionIndex: currentQuestionIndex,
    };

    // Stop sound when timer expires
    if (
      currentPhase === "ROUND3_QUESTION_ACTIVE" &&
      state?.questionTimer &&
      (currentTime > state.questionTimer.endsAt || !state.questionTimer.running) &&
      sound30sRef.current &&
      !sound30sRef.current.paused
    ) {
      sound30sRef.current.pause();
      sound30sRef.current.currentTime = 0;
      if (sound30sTimeoutRef.current !== null) {
        clearTimeout(sound30sTimeoutRef.current);
        sound30sTimeoutRef.current = null;
      }
    }

    // Ensure sound30s continues playing if timer is still running and not expired
    if (
      currentPhase === "ROUND3_QUESTION_ACTIVE" &&
      state?.questionTimer?.running &&
      currentTime <= state.questionTimer.endsAt &&
      sound30sRef.current &&
      sound30sRef.current.paused
    ) {
      // Resume sound if it was paused (e.g., due to browser behavior or other reasons)
      sound30sRef.current.play().catch((error) => {
        if (error.name !== "NotAllowedError") {
          console.error("Failed to resume 30s sound for Round 3 (guest):", error);
        }
      });
    }

    // Cleanup timeout when round changes or component unmounts
    return () => {
      if (sound30sTimeoutRef.current !== null) {
        clearTimeout(sound30sTimeoutRef.current);
        sound30sTimeoutRef.current = null;
      }
    };
  }, [state?.round, state?.phase, state?.round3State?.currentQuestionIndex, state?.questionTimer, currentTime]);

  // Round 2: play sound when entering Round 2 and when horizontal row is selected
  const prevRoundRef = useRef<string | null>(null);
  const round2SoundPlayedRef = useRef<boolean>(false);
  const round4SoundPlayedRef = useRef<boolean>(false);
  const prevHorizontalSelectionRef = useRef<{ phase: string | null; currentHorizontalOrder: number | null | undefined }>({
    phase: null,
    currentHorizontalOrder: null,
  });

  useEffect(() => {
    const currentRound = state?.round || null;
    const prevRound = prevRoundRef.current;

    // Handle Round 2: Reset flag when leaving Round 2
    if (prevRound === "ROUND2" && currentRound !== "ROUND2") {
      round2SoundPlayedRef.current = false;
    }

    // Handle Round 4: Reset flag when leaving Round 4
    if (prevRound === "ROUND4" && currentRound !== "ROUND4") {
      round4SoundPlayedRef.current = false;
    }

    // Play Round 2 sound when FIRST entering Round 2 (from a different round or from null)
    if (currentRound === "ROUND2" && prevRound !== "ROUND2" && !round2SoundPlayedRef.current) {
      if (openRound2SoundRef.current) {
        // Try to unlock audio first if not enabled
        if (!audioEnabledRef.current && correctSoundRef.current) {
          correctSoundRef.current.play()
            .then(() => {
              correctSoundRef.current?.pause();
              if (correctSoundRef.current) {
                correctSoundRef.current.currentTime = 0;
              }
              audioEnabledRef.current = true;
            })
            .catch(() => {
              // Audio still not unlocked, continue anyway
            });
        }
        
        // Try to play Round 2 sound immediately (don't await to avoid blocking)
        if (openRound2SoundRef.current) {
          openRound2SoundRef.current.currentTime = 0;
          openRound2SoundRef.current.play().catch((error: any) => {
            // If NotAllowedError, audio hasn't been unlocked by user interaction yet
            // This is expected and OK - sound will play once user interacts
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play open-round-2 sound (guest):", error);
            }
          });
          // Mark as played after attempting to play
          round2SoundPlayedRef.current = true;
        }
      }
    }

    // Disabled: Round 4 start sound
    // if (
    //   currentRound === "ROUND4" &&
    //   prevRound !== "ROUND4" &&
    //   !round4SoundPlayedRef.current
    // ) {
    //   if (soundRound4Ref.current) {
    //     if (!audioEnabledRef.current && correctSoundRef.current) {
    //       correctSoundRef.current
    //         .play()
    //         .then(() => {
    //           correctSoundRef.current?.pause();
    //           if (correctSoundRef.current) {
    //             correctSoundRef.current.currentTime = 0;
    //           }
    //           audioEnabledRef.current = true;
    //         })
    //         .catch(() => {});
    //     }

    //     soundRound4Ref.current.currentTime = 0;
    //     soundRound4Ref.current.play().catch((error: any) => {
    //       if (error.name !== "NotAllowedError") {
    //         console.error("Failed to play sound-round-4 (guest):", error);
    //       }
    //     });
    //     round4SoundPlayedRef.current = true;
    //   }
    // }

    prevRoundRef.current = currentRound;
  }, [state?.round]);

  // Round 4: play sounds for question start, main answer judging, and steal answer judging
  const prevRound4PhaseRef = useRef<string | null>(null);
  const prevMainTeamScoreRef = useRef<number | null>(null);
  const prevStealTeamScoreRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (state?.round !== "ROUND4") {
      prevRound4PhaseRef.current = null;
      prevMainTeamScoreRef.current = null;
      prevStealTeamScoreRef.current = null;
      return;
    }

    const currentPhase = state?.phase || null;
    const prevPhase = prevRound4PhaseRef.current;
    const r4 = state.round4State;

    // Play wrong sound when main answer is judged as wrong (phase changes to R4_STEAL_WINDOW)
    if (prevPhase !== null && currentPhase !== prevPhase && currentPhase === "R4_STEAL_WINDOW") {
      // Main answer was wrong, play wrong sound
      if (wrongSoundRef.current && audioEnabledRef.current) {
        wrongSoundRef.current.play().catch((error) => {
          if (error.name !== "NotAllowedError") {
            console.error("Failed to play wrong sound for Round 4 (guest):", error);
          }
        });
      }
    }

    // Track main team score when entering judging phase
    if (currentPhase === "R4_QUESTION_LOCK_MAIN" || currentPhase === "R4_JUDGE_MAIN") {
      if (prevPhase !== currentPhase) {
        // Just entered judging phase, track score
        const mainTeamId = r4?.currentTeamId?.toString();
        if (mainTeamId) {
          const mainTeam = state.teams.find((t: any) => t.teamId?.toString() === mainTeamId);
          if (mainTeam) {
            prevMainTeamScoreRef.current = mainTeam.score;
          }
        }
      }
    }

    // Play correct sound when main answer is judged as correct
    // Check score change when phase moves forward from judging phase
    if (prevPhase !== null && currentPhase !== prevPhase) {
      const isMainJudgingPhase = prevPhase === "R4_QUESTION_LOCK_MAIN" || prevPhase === "R4_JUDGE_MAIN";
      const isNotStealWindow = currentPhase !== "R4_STEAL_WINDOW";
      const isForwardPhase = currentPhase === "R4_STAR_CONFIRMATION" || currentPhase === "R4_QUESTION_SHOW" || currentPhase === "R4_IDLE" || currentPhase === "R4_END";
      
      if (isMainJudgingPhase && isNotStealWindow && isForwardPhase) {
        const mainTeamId = r4?.currentTeamId?.toString();
        if (mainTeamId) {
          const mainTeam = state.teams.find((t: any) => t.teamId?.toString() === mainTeamId);
          
          // Check score change to confirm correct answer
          if (mainTeam && prevMainTeamScoreRef.current !== null) {
            const prevScore = prevMainTeamScoreRef.current;
            const currentScore = mainTeam.score;
            
            if (currentScore > prevScore) {
              // Score increased → main answer was correct
              if (correctSoundRef.current && audioEnabledRef.current) {
                correctSoundRef.current.play().catch((error) => {
                  if (error.name !== "NotAllowedError") {
                    console.error("Failed to play correct sound for Round 4 (guest):", error);
                  }
                });
              }
              
              // Reset score tracking
              prevMainTeamScoreRef.current = null;
            }
          }
        }
      }
    }

    // Play sound based on points when Round 4 question starts (phase changes to R4_QUESTION_SHOW)
    if (prevPhase !== null && currentPhase !== prevPhase && currentPhase === "R4_QUESTION_SHOW") {
      const currentQuestionIndex = r4?.currentQuestionIndex;
      const questions = r4?.questions;
      if (currentQuestionIndex !== undefined && questions && questions[currentQuestionIndex]) {
        const points = questions[currentQuestionIndex].points;
        let soundToPlay: HTMLAudioElement | null = null;
        
        if (points === 10 && sound10sRef.current) {
          soundToPlay = sound10sRef.current;
        } else if (points === 20 && sound20sRef.current) {
          soundToPlay = sound20sRef.current;
        } else if (points === 30 && sound30sRef.current) {
          soundToPlay = sound30sRef.current;
        }
        
        if (soundToPlay) {
          // Ensure audio is enabled first if needed
          if (!audioEnabledRef.current && correctSoundRef.current) {
            correctSoundRef.current.play()
              .then(() => {
                if (correctSoundRef.current) {
                  correctSoundRef.current.pause();
                  correctSoundRef.current.currentTime = 0;
                }
                audioEnabledRef.current = true;
              })
              .catch(() => {
                // Audio unlock failed, continue anyway
              });
          }
          
          soundToPlay.currentTime = 0;
          soundToPlay.play().catch((error) => {
            if (error.name !== "NotAllowedError") {
              console.error(`Failed to play ${points}s sound (guest):`, error);
            }
          });
        }
      }
    }

    // Track score when entering R4_STEAL_LOCKED phase to detect if steal answer was correct/wrong
    if (currentPhase === "R4_STEAL_LOCKED" && prevPhase !== "R4_STEAL_LOCKED") {
      const buzzedTeamId = r4?.stealWindow?.buzzLockedTeamId?.toString();
      if (buzzedTeamId) {
        const stealTeam = state.teams.find((t: any) => t.teamId?.toString() === buzzedTeamId);
        if (stealTeam) {
          prevStealTeamScoreRef.current = stealTeam.score;
        }
      }
    }

    // Play correct or wrong sound when steal answer is judged
    // When phase changes from R4_STEAL_LOCKED to something else (not R4_STEAL_WINDOW)
    if (prevPhase === "R4_STEAL_LOCKED" && currentPhase !== "R4_STEAL_LOCKED" && currentPhase !== "R4_STEAL_WINDOW") {
      const buzzedTeamId = r4?.stealWindow?.buzzLockedTeamId?.toString();
      if (buzzedTeamId && prevStealTeamScoreRef.current !== null) {
        const stealTeam = state.teams.find((t: any) => t.teamId?.toString() === buzzedTeamId);
        
        if (stealTeam) {
          const prevScore = prevStealTeamScoreRef.current;
          const currentScore = stealTeam.score;
          
          if (currentScore > prevScore) {
            // Score increased → steal answer was correct
            if (correctSoundRef.current && audioEnabledRef.current) {
              correctSoundRef.current.play().catch((error) => {
                if (error.name !== "NotAllowedError") {
                  console.error("Failed to play correct sound for Round 4 steal answer (guest):", error);
                }
              });
            }
          } else if (currentScore < prevScore && wrongSoundRef.current && audioEnabledRef.current) {
            // Score decreased → steal answer was wrong
            wrongSoundRef.current.play().catch((error) => {
              if (error.name !== "NotAllowedError") {
                console.error("Failed to play wrong sound for Round 4 steal answer (guest):", error);
              }
            });
          }
          
          // Reset score tracking
          prevStealTeamScoreRef.current = null;
        }
      }
    }

    // Update previous phase
    prevRound4PhaseRef.current = currentPhase;
  }, [state?.round, state?.phase, state?.round4State, state?.teams]);

  // Round 2: play sound when horizontal row is selected
  useEffect(() => {
    if (state?.round !== "ROUND2") {
      prevHorizontalSelectionRef.current = {
        phase: null,
        currentHorizontalOrder: null,
      };
      return;
    }

    const currentPhase = state?.phase || null;
    const currentHorizontalOrder = state?.round2State?.currentHorizontalOrder;
    const prevState = prevHorizontalSelectionRef.current;

    // Play sound when phase changes to HORIZONTAL_SELECTED and a horizontal order is set
    // Only play if this is a new selection (phase or horizontal order changed)
    const isHorizontalSelected = 
      currentPhase === "HORIZONTAL_SELECTED" && 
      currentHorizontalOrder !== undefined && 
      currentHorizontalOrder !== null &&
      (prevState.phase !== "HORIZONTAL_SELECTED" || prevState.currentHorizontalOrder !== currentHorizontalOrder);

    if (isHorizontalSelected && numberCharacterSoundRef.current) {
      // Try to unlock audio first if not enabled
      if (!audioEnabledRef.current && correctSoundRef.current) {
        correctSoundRef.current.play()
          .then(() => {
            correctSoundRef.current?.pause();
            if (correctSoundRef.current) {
              correctSoundRef.current.currentTime = 0;
            }
            audioEnabledRef.current = true;
          })
          .catch(() => {
            // Audio still not unlocked, continue anyway
          });
      }

      // Try to play number-character sound immediately (don't await to avoid blocking)
      if (numberCharacterSoundRef.current) {
        numberCharacterSoundRef.current.currentTime = 0;
        numberCharacterSoundRef.current.play().catch((error: any) => {
          // If NotAllowedError, audio hasn't been unlocked by user interaction yet
          if (error.name !== "NotAllowedError") {
            console.error("Failed to play number-character sound (guest):", error);
          }
        });
      }
    }

    // Update previous state reference
    prevHorizontalSelectionRef.current = {
      phase: currentPhase,
      currentHorizontalOrder: currentHorizontalOrder,
    };
  }, [state?.round, state?.phase, state?.round2State?.currentHorizontalOrder]);

  // Round 2: play bell sound when CNV or keyword is buzzed
  const prevCNVStateRef = useRef<{
    phase: string | null;
    cnvLockTeamId: string | null | undefined;
    keywordBuzzQueueLength: number;
  }>({
    phase: null,
    cnvLockTeamId: null,
    keywordBuzzQueueLength: 0,
  });

  const playBellSound = () => {
    if (!bellRingingSoundRef.current) return;

    // Try to unlock audio first if not enabled
    if (!audioEnabledRef.current && correctSoundRef.current) {
      correctSoundRef.current
        .play()
        .then(() => {
          correctSoundRef.current?.pause();
          if (correctSoundRef.current) {
            correctSoundRef.current.currentTime = 0;
          }
          audioEnabledRef.current = true;
          // Play bell sound after unlocking
          if (bellRingingSoundRef.current) {
            bellRingingSoundRef.current.currentTime = 0;
            bellRingingSoundRef.current.play().catch((error: any) => {
              if (error.name !== "NotAllowedError") {
                console.error("Failed to play bell ringing sound (guest):", error);
              }
            });
          }
        })
        .catch(() => {
          // Audio still not unlocked, continue anyway
        });
    } else if (audioEnabledRef.current) {
      // Audio already enabled, play immediately
      bellRingingSoundRef.current.currentTime = 0;
      bellRingingSoundRef.current.play().catch((error: any) => {
        if (error.name !== "NotAllowedError") {
          console.error("Failed to play bell ringing sound (guest):", error);
        }
      });
    }
  };

  useEffect(() => {
    if (state?.round !== "ROUND2") {
      prevCNVStateRef.current = { phase: null, cnvLockTeamId: null, keywordBuzzQueueLength: 0 };
      return;
    }

    const currentPhase = state?.phase || null;
    const round2Meta = packageData?.round2Meta;
    const cnvLockTeamId = round2Meta?.buzzState?.cnvLockTeamId;
    const keywordBuzzQueue = round2Meta?.buzzState?.keywordBuzzQueue || [];
    const keywordBuzzQueueLength = keywordBuzzQueue.length;
    const prevCNVState = prevCNVStateRef.current;

    // Play bell sound when CNV is buzzed (phase changes to CNV_ACTIVE and CNV is locked)
    const isCNVActivated =
      currentPhase === "CNV_ACTIVE" &&
      cnvLockTeamId &&
      (prevCNVState.phase !== "CNV_ACTIVE" || prevCNVState.cnvLockTeamId !== cnvLockTeamId);

    if (isCNVActivated) {
      playBellSound();
    }

    // Play bell sound when keyword buzzer is pressed (new team added to queue)
    const isKeywordBuzzed = keywordBuzzQueueLength > prevCNVState.keywordBuzzQueueLength;
    if (isKeywordBuzzed) {
      playBellSound();
    }

    // Update previous state reference
    prevCNVStateRef.current = {
      phase: currentPhase,
      cnvLockTeamId: cnvLockTeamId,
      keywordBuzzQueueLength: keywordBuzzQueueLength,
    };
  }, [state?.round, state?.phase, packageData?.round2Meta]);

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
      // Lấy các đội chưa được chấm (unjudged teams)
      const unjudgedTeams = keywordQueue.slice(currentIndex + 1);
      return unjudgedTeams.map((item, index) => ({
        teamId: item.teamId,
        order: index + 1,
      }));
    }
    
    return [];
  }, [state?.round, packageData?.round2Meta]);

  // Keep buzzingTeamId for backward compatibility (for non-Round2 usage)
  // Must be before early return to maintain hooks order
  const buzzingTeamId = useMemo(() => {
    if (buzzingTeams.length > 0) {
      return buzzingTeams[0].teamId;
    }
    return undefined;
  }, [buzzingTeams]);

  if (!state) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-white"
        style={{
          fontFamily: "'Times New Roman', serif",
          backgroundImage: "url('/system/bg-link.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <img
          src="/system/logo.png"
          alt="PVOIL Logo"
          className="h-16 md:h-20 w-auto mb-6"
        />
        <div>Chưa bắt đầu - chờ MC</div>
      </div>
    );
  }

  const isRound2 = state.round === "ROUND2";
  const round2Meta: Round2Meta | undefined = packageData?.round2Meta;

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

  // Get CNV input (if any team is answering CNV)
  // Get the first pending answer if available (for display purposes)
  const cnvInput = state.round2State?.pendingAnswers?.[0]?.answer || "";

  // Render Round 2 layout
  if (isRound2 && round2Meta) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" style={{ fontFamily: "'Times New Roman', serif" }}>
        <div className="flex-1 flex items-center justify-center p-2 md:p-4">
          <Round2StageLayout
            puzzleBoard={
              <GuestPuzzleBoard
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
                selectedHorizontalOrder={
                  state.round2State?.currentHorizontalOrder
                }
                phase={state.phase}
              />
            }
            questionPanel={
              <QuestionPanel
                questionText={state.currentQuestionId ? question?.text : undefined}
                timer={state.questionTimer}
                phase={state.phase as Phase}
                currentTeamName={currentTeamName}
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
        </div>
      </div>
    );
  }

  // Round 3 Layout
  const isRound3 = state.round === "ROUND3";
  if (isRound3) {
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
                {question.type === "video" && question.videoUrl ? (
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">{question.text}</div>
                    <div className="w-full">
                      <video
                        ref={round3VideoRef}
                        src={question.videoUrl}
                        controls
                        autoPlay
                        muted
                        className="w-full max-w-4xl mx-auto rounded-lg shadow-lg"
                        onLoadedData={async () => {
                          if (round3VideoRef.current && !isRound3VideoPlaying) {
                            try {
                              await round3VideoRef.current.play();
                            } catch (error) {
                              console.log("Round 3 video auto-play on load prevented:", error);
                            }
                          }
                        }}
                        onPlay={() => setIsRound3VideoPlaying(true)}
                        onPause={() => setIsRound3VideoPlaying(false)}
                        onEnded={() => setIsRound3VideoPlaying(false)}
                      >
                        Trình duyệt của bạn không hỗ trợ video.
                      </video>
                    </div>
                  </div>
                ) : (
                  <QuestionDisplay question={question} />
                )}
              </div>
            </div>
          )}

          {/* Answers and Scores Display - 2 columns */}
          {(() => {
            const isTimerExpired = state.questionTimer 
              ? (currentTime > state.questionTimer.endsAt || !state.questionTimer.running)
              : false;
            
            return (state.phase === "ROUND3_RESULTS" || 
              state.phase === "ROUND3_JUDGING" ||
              (state.phase === "ROUND3_QUESTION_ACTIVE" && isTimerExpired));
          })() && !isRound3VideoPlaying && (
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
      </div>
    );
  }

  // Regular Round 1 UI
  const isGameActive = state && state.phase !== "IDLE" && state.currentQuestionId;
  const backgroundImage = isGameActive ? "/system/match.jpg" : "/system/background-fix.png";
  const isWaitingScreen = !isGameActive;

  // Round 4: Check star usage and get question points
  const isRound4 = state?.round === "ROUND4";
  const r4 = state?.round4State;
  const hasStarOnCurrentR4 = (() => {
    if (!isRound4 || !r4 || !r4.currentTeamId || !r4.starUsages) return false;
    const teamKey = r4.currentTeamId.toString();
    let starUsage = null;
    if (typeof (r4.starUsages as any).get === 'function') {
      starUsage = (r4.starUsages as any).get(teamKey);
    } else {
      starUsage = (r4.starUsages as any)?.[teamKey];
    }
    return !!(
      starUsage &&
      starUsage.used &&
      starUsage.questionIndex === r4.currentQuestionIndex
    );
  })();

  const currentQuestionRef = 
    r4 && r4.currentQuestionIndex !== undefined && r4.questions
      ? r4.questions[r4.currentQuestionIndex]
      : undefined;

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{
        fontFamily: "'Times New Roman', serif",
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: isWaitingScreen ? "contain" : "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      >
      {/* Question points and star indicator - top right (Round 4) */}
      {isRound4 && r4 && currentQuestionRef && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm">
          <div className="text-right">
            <div className="text-sm text-gray-300">
              Câu {r4.currentQuestionIndex !== undefined ? r4.currentQuestionIndex + 1 : "?"}
            </div>
            <div className="text-xl font-semibold text-cyan-300">
              {currentQuestionRef.points} điểm
            </div>
          </div>
          {hasStarOnCurrentR4 && (
            <div className="relative">
              <span className="text-3xl animate-pulse">⭐</span>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 flex flex-col items-center px-4 pb-6 pt-4 md:pt-6">
        {state.questionTimer && (
          <div className="flex justify-center mb-4">
            <Timer timer={state.questionTimer} size="lg" />
          </div>
        )}

        {state.currentQuestionId && 
         !(state.round === "ROUND4" && state.phase === "R4_STAR_CONFIRMATION") && (
          <div className="mb-4 w-full max-w-3xl">
            {question?.videoUrl ? (
              <div className="question-depth-card p-4">
                <div className="relative z-10">
                  <div className="text-sm text-white/70 mb-2">Câu hỏi</div>
                  <div className="text-lg font-semibold text-white mb-4">
                    {question.text}
                  </div>
                  <video
                    ref={videoRef}
                    src={question.videoUrl}
                    autoPlay
                    muted={state.round !== "ROUND4" || !audioUnlocked}
                    loop={false}
                    className="w-full max-w-4xl mx-auto rounded-xl shadow-2xl"
                    style={{ pointerEvents: "none" }}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onEnded={async () => {
                      setIsVideoPlaying(false);
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
            ) : (
              <QuestionCard
                questionText={question?.text || "Đang tải câu hỏi..."}
                questionNumber={question?.index}
                totalQuestions={12}
              />
            )}
          </div>
        )}

        <div className="w-full max-w-4xl mt-2">
          <Scoreboard
            teams={state.teams}
            activeTeamId={state.activeTeamId?.toString()}
            buzzingTeamId={buzzingTeamId}
            buzzingTeams={buzzingTeams}
          />
        </div>
      </div>
    </div>
  );
}
