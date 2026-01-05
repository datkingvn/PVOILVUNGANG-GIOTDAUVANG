"use client";

import { useEffect, useState } from "react";
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

  useHydrateGameState();
  usePusherGameState();

  // Fetch package data when activePackageId or phase changes (to refresh revealedPieces)
  useEffect(() => {
    if (state?.activePackageId && state?.round === "ROUND2") {
      fetch(`/api/packages/${state.activePackageId}`)
        .then((res) => res.json())
        .then(setPackageData)
        .catch(console.error);
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
