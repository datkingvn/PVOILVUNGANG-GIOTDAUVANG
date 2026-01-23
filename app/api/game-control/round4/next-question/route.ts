import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import { advanceRound4QuestionOrTeam } from "@/lib/utils/round4-engine";

export async function POST(request: NextRequest) {
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

    const r4 = gameState.round4State;

    if (
      r4.currentQuestionIndex === undefined ||
      !r4.questions ||
      !r4.questions[r4.currentQuestionIndex]
    ) {
      return NextResponse.json(
        { error: "Không xác định được câu hỏi hiện tại để chuyển tiếp" },
        { status: 400 }
      );
    }

    // Chỉ cho phép khi đang ở phase STEAL_WINDOW và cửa sổ đã hết hạn (không active hoặc hết thời gian) và không có đội giành quyền
    const now = Date.now();
    const isStealWindowExpired = r4.stealWindow && 
      (!r4.stealWindow.active || (r4.stealWindow.endsAt && now > r4.stealWindow.endsAt));
    
    if (
      !(
        gameState.phase === "R4_STEAL_WINDOW" &&
        r4.stealWindow &&
        isStealWindowExpired &&
        !r4.stealWindow.buzzLockedTeamId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Chỉ có thể chuyển sang câu tiếp theo khi cửa sổ giành quyền đã hết mà không có đội nào bấm chuông.",
        },
        { status: 400 }
      );
    }

    advanceRound4QuestionOrTeam(gameState as any);

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          "Lỗi chuyển sang câu tiếp theo Round 4 (không có đội giành quyền)",
      },
      { status: 500 }
    );
  }
}


