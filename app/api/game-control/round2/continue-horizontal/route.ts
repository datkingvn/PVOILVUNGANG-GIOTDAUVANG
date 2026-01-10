import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { PackageHistory } from "@/types/game";

export async function POST() {
  try {
    await requireMC();
    await connectDB();

    const gameState = await GameState.findOne();
    if (!gameState || !gameState.activePackageId) {
      return NextResponse.json(
        { error: "Không có game đang active" },
        { status: 400 }
      );
    }

    if (gameState.round !== "ROUND2") {
      return NextResponse.json(
        { error: "Không phải Round 2" },
        { status: 400 }
      );
    }

    // Only allow continue when phase is HORIZONTAL_ACTIVE or HORIZONTAL_JUDGING
    if (gameState.phase !== "HORIZONTAL_ACTIVE" && gameState.phase !== "HORIZONTAL_JUDGING") {
      return NextResponse.json(
        { error: "Không thể tiếp tục ở phase này" },
        { status: 400 }
      );
    }

    const pkg = await Package.findById(gameState.activePackageId);
    if (!pkg || !pkg.round2Meta) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    // Store current question info before clearing state
    const currentQuestionId = gameState.currentQuestionId;
    const currentHorizontalOrder = gameState.round2State?.currentHorizontalOrder;
    const pendingAnswers = gameState.round2State?.pendingAnswers || [];

    // If there's a current question and no pending answers (timer expired with no submissions),
    // mark the question as attempted with TIMEOUT result
    if (currentQuestionId && currentHorizontalOrder && pendingAnswers.length === 0) {
      const question = await Question.findById(currentQuestionId);
      if (question) {
        // Check if history entry already exists for this question
        const existingHistory = pkg.history.find(
          (h: PackageHistory) => h.questionId === question._id.toString()
        );

        // Only create history entry if it doesn't exist yet
        if (!existingHistory) {
          pkg.history.push({
            index: question.index,
            questionId: question._id.toString(),
            result: "TIMEOUT",
            judgedAt: new Date(),
          });
          pkg.markModified('history');
        }
      }
    }

    // Clear current question and timer, go back to TURN_SELECT
    gameState.phase = "TURN_SELECT";
    gameState.currentQuestionId = undefined;
    gameState.questionTimer = undefined;
    
    // Clear pending answers if they exist (no one answered or all answered were wrong)
    if (!gameState.round2State) {
      gameState.round2State = {};
    }
    gameState.round2State.pendingAnswers = [];
    // Keep currentHorizontalOrder undefined to allow selecting new horizontal
    gameState.round2State.currentHorizontalOrder = undefined;

    // Mark round2State as modified for Mongoose
    gameState.markModified('round2State');

    // Save package first (with history update if any), then gameState
    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error continuing horizontal question:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi tiếp tục phần thi" },
      { status: 500 }
    );
  }
}
