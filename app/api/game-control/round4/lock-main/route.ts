import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";

export async function POST() {
  try {
    await requireMC();
    await connectDB();

    const gameState = await GameState.findOne();
    if (!gameState || gameState.round !== "ROUND4" || !gameState.round4State) {
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    if (gameState.phase !== "R4_QUESTION_SHOW") {
      return NextResponse.json(
        { error: "Chỉ có thể khóa đáp án khi đang hiển thị câu hỏi" },
        { status: 400 }
      );
    }

    // Khóa đồng hồ, chốt phase để MC chấm
    if (gameState.questionTimer) {
      gameState.questionTimer.running = false;
    }
    gameState.phase = "R4_QUESTION_LOCK_MAIN";

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi khóa đáp án đội đang thi" },
      { status: 500 }
    );
  }
}


