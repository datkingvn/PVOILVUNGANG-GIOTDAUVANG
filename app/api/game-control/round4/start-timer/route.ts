import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { broadcastGameState } from "@/lib/socket/server";
import { getRound4QuestionDuration } from "@/lib/utils/round4-engine";

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const gameState = await GameState.findOne();
    if (!gameState || gameState.round !== "ROUND4" || !gameState.round4State) {
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;

    // Chỉ cho phép start timer khi:
    // - Phase là R4_QUESTION_SHOW
    // - Chưa có timer hoặc timer chưa running
    if (gameState.phase !== "R4_QUESTION_SHOW") {
      return NextResponse.json(
        { error: "Không thể start timer ở phase hiện tại" },
        { status: 400 }
      );
    }

    if (gameState.questionTimer && gameState.questionTimer.running) {
      return NextResponse.json({ success: true, alreadyRunning: true });
    }

    if (r4.currentQuestionIndex === undefined || !r4.questions) {
      return NextResponse.json(
        { error: "Không xác định được câu hỏi hiện tại" },
        { status: 400 }
      );
    }

    const qRef = r4.questions[r4.currentQuestionIndex];
    const duration = getRound4QuestionDuration(qRef.points);
    const now = Date.now();

    gameState.questionTimer = {
      endsAt: now + duration,
      running: true,
    };

    await gameState.save();
    await broadcastGameState();

    console.log("[Round4 Timer] Timer started after video ended:", {
      questionPoints: qRef.points,
      duration,
      timerEndsAt: gameState.questionTimer.endsAt,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Round4 Timer] Error starting timer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi start timer" },
      { status: 500 }
    );
  }
}
