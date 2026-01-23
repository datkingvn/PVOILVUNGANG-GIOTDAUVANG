import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import {
  calculateRound3Score,
  sortAnswersByTimestamp,
  normalizeArrangeAnswer,
} from "@/lib/utils/round3-engine";
import { normalizeAnswer } from "@/lib/utils/round2-engine";
import type { PendingAnswer, Round3AnswerResult, TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    const team = await requireTeam();
    await connectDB();

    const body = await request.json();
    const { answer } = body;

    if (!answer || typeof answer !== "string") {
      return NextResponse.json(
        { error: "Vui lòng nhập đáp án" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState || !gameState.activePackageId) {
      return NextResponse.json(
        { error: "Không có game đang active" },
        { status: 400 }
      );
    }

    if (gameState.round !== "ROUND3") {
      return NextResponse.json(
        { error: "Không phải Round 3" },
        { status: 400 }
      );
    }

    if (gameState.phase !== "ROUND3_QUESTION_ACTIVE") {
      return NextResponse.json(
        { error: "Không thể submit đáp án ở phase này" },
        { status: 400 }
      );
    }

    // Check if timer has expired
    const now = Date.now();
    if (
      !gameState.questionTimer ||
      !gameState.questionTimer.running ||
      now > gameState.questionTimer.endsAt
    ) {
      return NextResponse.json(
        { error: "Đã hết thời gian" },
        { status: 400 }
      );
    }

    const teamId = team.teamId?.toString();
    if (!teamId) {
      return NextResponse.json(
        { error: "Không xác định được đội" },
        { status: 400 }
      );
    }

    // Get existing pending answers
    const currentPendingAnswers = gameState.round3State?.pendingAnswers || [];

    // Check if team already submitted - if yes, update instead of reject
    const existingIndex = currentPendingAnswers.findIndex(
      (pa: PendingAnswer) => pa.teamId === teamId
    );

    let updatedAnswers: PendingAnswer[];
    if (existingIndex >= 0) {
      // Update existing answer
      updatedAnswers = [...currentPendingAnswers];
      updatedAnswers[existingIndex] = {
        teamId,
        answer: answer.trim(),
        submittedAt: now, // Update timestamp
      };
    } else {
      // Add new answer
      const newAnswer: PendingAnswer = {
        teamId,
        answer: answer.trim(),
        submittedAt: now,
      };
      updatedAnswers = [...currentPendingAnswers, newAnswer];
    }

    // Initialize round3State if not exists
    if (!gameState.round3State) {
      gameState.round3State = {
        currentQuestionIndex: 0,
        pendingAnswers: [],
        questionResults: {},
      };
    }

    // Update pending answers
    gameState.round3State.pendingAnswers = updatedAnswers;

    // Mark modified for nested objects
    gameState.markModified("round3State");

    // Save using Mongoose save() - handles Map correctly
    await gameState.save();

    // Fetch updated state for response and broadcast
    const updatedState = await GameState.findById(gameState._id);

    if (!updatedState) {
      return NextResponse.json(
        { error: "Không thể cập nhật game state" },
        { status: 500 }
      );
    }

    await broadcastGameState();

    return NextResponse.json({
      success: true,
      pendingAnswersCount: gameState.round3State.pendingAnswers?.length || 0,
    });
  } catch (error: any) {
    console.error("Error submitting answer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi submit đáp án" },
      { status: 500 }
    );
  }
}

