import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { error: "Không tìm thấy game state" },
        { status: 404 }
      );
    }

    if (gameState.round !== "ROUND3") {
      return NextResponse.json(
        { error: "Không phải Round 3" },
        { status: 400 }
      );
    }

    if (gameState.phase !== "ROUND3_QUESTION_ACTIVE" && gameState.phase !== "ROUND3_JUDGING") {
      return NextResponse.json(
        { error: "Không thể kết thúc câu hỏi ở phase này" },
        { status: 400 }
      );
    }

    // Stop timer
    if (gameState.questionTimer) {
      gameState.questionTimer.running = false;
    }

    // Scores are already calculated and added to teams when MC judges answers
    // No need to recalculate here - just move to results phase

    // Move to results phase
    gameState.phase = "ROUND3_RESULTS";

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error ending question:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

