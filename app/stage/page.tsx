"use client";

import { useEffect, useState, useRef } from "react";
import { usePusherGameState, useHydrateGameState } from "@/hooks/usePusherGameState";
import { useGameStore } from "@/store/gameStore";
import { Round2StageLayout } from "@/components/round2/Round2StageLayout";
import { PuzzleBoard } from "@/components/round2/PuzzleBoard";
import { CNVPanel } from "@/components/round2/CNVPanel";
import { QuestionPanel } from "@/components/round2/QuestionPanel";
import { LiveView } from "@/components/round2/LiveView";
import type { Round2Meta, Phase } from "@/types/game";

export default function StagePage() {
  const state = useGameStore((state) => state.state);
  const [packageData, setPackageData] = useState<any>(null);
  const [question, setQuestion] = useState<any>(null);
  const [horizontalQuestions, setHorizontalQuestions] = useState<any[]>([]);

  // Initialize sounds for Round 1, Round 3, Round 4, and team answer completion
  const correctSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongSoundRef = useRef<HTMLAudioElement | null>(null);
  const wrongShortSoundRef = useRef<HTMLAudioElement | null>(null);
  const openTeamAnswerSoundRef = useRef<HTMLAudioElement | null>(null);
  const correctRound3SoundRef = useRef<HTMLAudioElement | null>(null);
  const soundRound4Ref = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef<boolean>(false);

  useHydrateGameState();
  usePusherGameState();

  // Initialize audio elements and enable on first user interaction
  useEffect(() => {
    // Create audio elements immediately (but don't play yet)
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

    // Enable audio on first user interaction
    const enableAudio = async () => {
      if (audioEnabledRef.current) return;
      
      // Try to play and immediately pause to "unlock" audio
      // This must be done in response to user interaction
      try {
        if (correctSoundRef.current) {
          await correctSoundRef.current.play();
          correctSoundRef.current.pause();
          correctSoundRef.current.currentTime = 0;
        }
        audioEnabledRef.current = true;
      } catch (error) {
        // Audio will be enabled on next interaction
        // Silently fail - user may need to interact again
      }
    };

    const handleUserInteraction = () => {
      if (!audioEnabledRef.current) {
        enableAudio();
      }
    };

    // Use capture phase and once option to ensure we catch it early
    document.addEventListener("click", handleUserInteraction, { once: true, capture: true });
    document.addEventListener("touchstart", handleUserInteraction, { once: true, capture: true });
    document.addEventListener("keydown", handleUserInteraction, { once: true, capture: true });

    return () => {
      document.removeEventListener("click", handleUserInteraction, { capture: true } as any);
      document.removeEventListener("touchstart", handleUserInteraction, { capture: true } as any);
      document.removeEventListener("keydown", handleUserInteraction, { capture: true } as any);
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
    };
  }, []);


  // Fetch package data when activePackageId or phase changes (to refresh revealedPieces)
  useEffect(() => {
    if (state?.activePackageId && state?.round === "ROUND2") {
      fetch(`/api/packages/${state.activePackageId}`)
        .then((res) => res.json())
        .then(setPackageData)
        .catch(console.error);
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
  }, [state?.activePackageId, state?.round, state?.phase]);

  // Fetch current question
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

  // Fetch horizontal questions
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

  // Track Round 1 package history changes to play sound when CORRECT or WRONG
  const prevHistoryLengthRef = useRef<number>(0);
  useEffect(() => {
    if (state?.round === "ROUND1" && packageData?.history) {
      const history = packageData.history || [];
      const prevLength = prevHistoryLengthRef.current;
      
      // Check if a new entry was added
      if (history.length > prevLength) {
        const newEntries = history.slice(prevLength);
        const hasNewCorrect = newEntries.some((entry: any) => entry.result === "CORRECT");
        const hasNewWrong = newEntries.some((entry: any) => entry.result === "WRONG");
        
        if (hasNewCorrect && correctSoundRef.current && audioEnabledRef.current) {
          correctSoundRef.current.play().catch((error) => {
            // Silently fail - audio may not be enabled yet
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play correct sound:", error);
            }
          });
        }
        if (hasNewWrong && wrongShortSoundRef.current && audioEnabledRef.current) {
          wrongShortSoundRef.current.play().catch((error) => {
            // Silently fail - audio may not be enabled yet
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play wrong-short sound:", error);
            }
          });
        }
      }
      
      prevHistoryLengthRef.current = history.length;
    }
  }, [packageData?.history, state?.round]);

  // Track round changes to play sounds when entering new rounds
  const prevRoundRef = useRef<string | null>(null);
  const round4SoundPlayedRef = useRef<boolean>(false);

  // Track pending answers to play sound when all answers are judged (Round 2 & 3)
  const prevPendingAnswersLengthRef = useRef<{ round2: number; round3: number }>({
    round2: 0,
    round3: 0,
  });
  const hasHadAnswersRef = useRef<{ round2: boolean; round3: boolean }>({
    round2: false,
    round3: false,
  });

  useEffect(() => {
    // Round 2: Track pendingAnswers changes
    if (state?.round === "ROUND2") {
      const currentPending = state.round2State?.pendingAnswers || [];
      const currentLength = currentPending.length;
      const prevLength = prevPendingAnswersLengthRef.current.round2;

      // Track if we've ever had answers (at least one team responded)
      if (currentLength > 0 && !hasHadAnswersRef.current.round2) {
        hasHadAnswersRef.current.round2 = true;
      }

      // Play sound when all answers are judged (went from > 0 to 0) and we had answers
      // Only play if at least one answer is correct (phase becomes REVEAL_PIECE, not TURN_SELECT)
      if (
        prevLength > 0 &&
        currentLength === 0 &&
        hasHadAnswersRef.current.round2 &&
        openTeamAnswerSoundRef.current &&
        audioEnabledRef.current
      ) {
        // Check if at least one answer is correct by checking phase
        // REVEAL_PIECE means at least one answer was correct
        // TURN_SELECT means all answers were wrong
        const hasCorrectAnswer = state?.phase === "REVEAL_PIECE";
        
        if (hasCorrectAnswer) {
          openTeamAnswerSoundRef.current.play().catch((error) => {
            if (error.name !== "NotAllowedError") {
              console.error("Failed to play open-team-answer sound:", error);
            }
          });
        }
        // Reset flag for next question
        hasHadAnswersRef.current.round2 = false;
      }

      prevPendingAnswersLengthRef.current.round2 = currentLength;
    } else {
      // Reset when not in Round 2
      prevPendingAnswersLengthRef.current.round2 = 0;
      hasHadAnswersRef.current.round2 = false;
    }

    // Round 3: Track pendingAnswers changes
    if (state?.round === "ROUND3") {
      const currentPending = state.round3State?.pendingAnswers || [];
      const currentLength = currentPending.length;
      const prevLength = prevPendingAnswersLengthRef.current.round3;

      // Track if we've ever had answers (at least one team responded)
      if (currentLength > 0 && !hasHadAnswersRef.current.round3) {
        hasHadAnswersRef.current.round3 = true;
      }

      // Play sound when all answers are judged (went from > 0 to 0) and we had answers
      // Only play if at least one answer is correct
      if (
        prevLength > 0 &&
        currentLength === 0 &&
        hasHadAnswersRef.current.round3 &&
        openTeamAnswerSoundRef.current &&
        audioEnabledRef.current
      ) {
        // Check if at least one answer is correct by checking questionResults for current question
        const currentQuestionIndex = state.round3State?.currentQuestionIndex;
        if (currentQuestionIndex !== undefined && currentQuestionIndex >= 0) {
          const questionIndexKey = String(currentQuestionIndex);
          const questionResultsMap = state.round3State?.questionResults;
          let hasCorrectAnswer = false;
          
          if (questionResultsMap) {
            let questionResults: any[] = [];
            
            // Get results for current question
            if (questionResultsMap instanceof Map) {
              questionResults = questionResultsMap.get(questionIndexKey) || [];
            } else if (typeof questionResultsMap === 'object') {
              const resultsObj = questionResultsMap as Record<string, any>;
              questionResults = resultsObj[questionIndexKey] || resultsObj[currentQuestionIndex] || [];
            }
            
            // Check if any result has isCorrect === true
            hasCorrectAnswer = questionResults.some((r: any) => r.isCorrect === true);
          }
          
          if (hasCorrectAnswer) {
            openTeamAnswerSoundRef.current.play().catch((error) => {
              if (error.name !== "NotAllowedError") {
                console.error("Failed to play open-team-answer sound:", error);
              }
            });
          }
        }
        // Reset flag for next question
        hasHadAnswersRef.current.round3 = false;
      }

      prevPendingAnswersLengthRef.current.round3 = currentLength;
    } else {
      // Reset when not in Round 3
      prevPendingAnswersLengthRef.current.round3 = 0;
      hasHadAnswersRef.current.round3 = false;
    }
  }, [
    state?.round,
    state?.round2State?.pendingAnswers?.length,
    state?.round3State?.pendingAnswers?.length,
    state?.round3State?.currentQuestionIndex,
    state?.phase,
    state?.currentQuestionId, // Reset when question changes
    // Note: questionResults is checked inside the effect, not as a dependency
    // to avoid array size changes causing dependency array issues
  ]);

  // Reset tracking when question changes
  const prevQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentQuestionId = state?.currentQuestionId || null;
    if (currentQuestionId !== prevQuestionIdRef.current) {
      // Question changed - reset tracking
      hasHadAnswersRef.current.round2 = false;
      hasHadAnswersRef.current.round3 = false;
      prevPendingAnswersLengthRef.current.round2 = state?.round2State?.pendingAnswers?.length || 0;
      prevPendingAnswersLengthRef.current.round3 = state?.round3State?.pendingAnswers?.length || 0;
      prevQuestionIdRef.current = currentQuestionId;
    }
  }, [state?.currentQuestionId, state?.round2State?.pendingAnswers?.length, state?.round3State?.pendingAnswers?.length]);

  // Track Round 3 questionResults changes to play sound when answers are judged
  const prevRound3QuestionResultsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (state?.round === "ROUND3" && state?.round3State?.questionResults) {
      const currentQuestionIndex = state.round3State.currentQuestionIndex;
      if (currentQuestionIndex !== undefined && currentQuestionIndex >= 0) {
        const questionIndexKey = String(currentQuestionIndex);
        const questionResultsMap = state.round3State.questionResults;
        
        // Get current questionResults
        let currentQuestionResults: any[] = [];
        if (questionResultsMap instanceof Map) {
          currentQuestionResults = questionResultsMap.get(questionIndexKey) || [];
        } else if (typeof questionResultsMap === 'object') {
          const resultsObj = questionResultsMap as Record<string, any>;
          currentQuestionResults = resultsObj[questionIndexKey] || resultsObj[currentQuestionIndex] || [];
        }

        // Get previous count
        const prevCount = prevRound3QuestionResultsRef.current.get(questionIndexKey) || 0;
        const currentCount = currentQuestionResults.length;

        // Check if new entries were added
        if (currentCount > prevCount) {
          const newEntries = currentQuestionResults.slice(prevCount);
          
          // Play sounds for each new entry
          newEntries.forEach((entry: any) => {
            if (entry.isCorrect === true && correctRound3SoundRef.current && audioEnabledRef.current) {
              correctRound3SoundRef.current.play().catch((error) => {
                if (error.name !== "NotAllowedError") {
                  console.error("Failed to play correct-round-3 sound:", error);
                }
              });
            } else if (entry.isCorrect === false && wrongSoundRef.current && audioEnabledRef.current) {
              wrongSoundRef.current.play().catch((error) => {
                if (error.name !== "NotAllowedError") {
                  console.error("Failed to play wrong sound:", error);
                }
              });
            }
          });
        }

        // Update previous count
        prevRound3QuestionResultsRef.current.set(questionIndexKey, currentCount);
      }
    }

    // Reset when question changes
    if (state?.currentQuestionId) {
      const currentQuestionIndex = state?.round3State?.currentQuestionIndex;
      if (currentQuestionIndex !== undefined) {
        const questionIndexKey = String(currentQuestionIndex);
        // Keep tracking for current question, reset others
        const newMap = new Map<string, number>();
        newMap.set(questionIndexKey, prevRound3QuestionResultsRef.current.get(questionIndexKey) || 0);
        prevRound3QuestionResultsRef.current = newMap;
      } else {
        prevRound3QuestionResultsRef.current = new Map();
      }
    }
  }, [
    state?.round,
    state?.round3State?.currentQuestionIndex,
    state?.currentQuestionId,
    // Track questionResults length for current question to detect changes
    state?.round3State?.questionResults ? 
      (state.round3State.questionResults instanceof Map ?
        state.round3State.questionResults.get(String(state.round3State.currentQuestionIndex ?? -1))?.length ?? 0 :
        ((state.round3State.questionResults as Record<string, any>)[String(state.round3State.currentQuestionIndex ?? -1)]?.length ?? 0)) :
      0,
  ]);

  // Track Round 4 start to play sound when first entering Round 4
  useEffect(() => {
    const currentRound = state?.round || null;
    const prevRound = prevRoundRef.current;

    // Handle Round 4: Reset flag when leaving Round 4
    if (prevRound === "ROUND4" && currentRound !== "ROUND4") {
      round4SoundPlayedRef.current = false;
    }

    // Disabled: Round 4 start sound
    // Play Round 4 sound when FIRST entering Round 4 (from a different round or from null)
    // if (currentRound === "ROUND4" && prevRound !== "ROUND4" && !round4SoundPlayedRef.current) {
    //   if (soundRound4Ref.current) {
    //     // Try to unlock audio first if not enabled
    //     if (!audioEnabledRef.current && correctSoundRef.current) {
    //       correctSoundRef.current.play()
    //         .then(() => {
    //           correctSoundRef.current?.pause();
    //           if (correctSoundRef.current) {
    //             correctSoundRef.current.currentTime = 0;
    //           }
    //           audioEnabledRef.current = true;
    //         })
    //         .catch(() => {
    //           // Audio still not unlocked, continue anyway
    //         });
    //     }

    //     // Try to play Round 4 sound immediately (don't await to avoid blocking)
    //     if (soundRound4Ref.current) {
    //       soundRound4Ref.current.currentTime = 0;
    //       soundRound4Ref.current.play().catch((error: any) => {
    //         // If NotAllowedError, audio hasn't been unlocked by user interaction yet
    //         // This is expected and OK - sound will play once user interacts
    //         if (error.name !== "NotAllowedError") {
    //           console.error("Failed to play sound-round-4 sound:", error);
    //         }
    //       });
    //       // Mark as played after attempting to play
    //       round4SoundPlayedRef.current = true;
    //     }
    //   }
    // }

    // Update previous round reference
    prevRoundRef.current = currentRound;
  }, [state?.round]);

  if (!state) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white text-4xl"
        style={{
          backgroundImage: "url('/system/bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        Chưa bắt đầu - chờ MC
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

  // Get current team name
  const currentTeamName = state.teams.find(
    (t) => t.teamId === state.activeTeamId
  )?.nameSnapshot;

  // Get CNV input (if any team is answering CNV)
  const cnvInput = state.round2State?.pendingAnswers?.[0]?.answer || "";

  // Render Round 2 layout
  if (isRound2 && round2Meta) {
    return (
      <Round2StageLayout
        puzzleBoard={
          <PuzzleBoard
            image={round2Meta.image}
            revealedPieces={round2Meta.revealedPieces}
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
            questionText={question?.text}
            timer={state.questionTimer}
            phase={state.phase as Phase}
            currentTeamName={currentTeamName}
          />
        }
        liveView={<LiveView />}
        phase={state.phase}
        round2Meta={round2Meta}
        teams={state.teams}
      />
    );
  }

  // Render default layout for other rounds
  const isGameActive = state && state.phase !== "IDLE" && state.currentQuestionId;
  const backgroundImage = isGameActive ? "/system/match.jpg" : "/system/bg.png";

  return (
    <div
      className="min-h-screen p-8 relative overflow-hidden"
      style={{
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-5xl mx-auto text-white">
        <h1 className="text-4xl font-bold mb-4">Round {state.round}</h1>
        <p className="text-xl">Chế độ này đang được phát triển</p>
      </div>
    </div>
  );
}
