import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId, questionIndex } = body as {
      teamId?: string;
      questionIndex?: number;
    };

    if (!teamId || typeof questionIndex !== "number") {
      return NextResponse.json(
        { error: "Thiếu teamId hoặc questionIndex" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState || gameState.round !== "ROUND4" || !gameState.round4State) {
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;
    const teamIdStr = teamId.toString();

    if (r4.currentTeamId?.toString() !== teamIdStr) {
      return NextResponse.json(
        { error: "Chỉ đội đang thi mới được đặt Ngôi sao hy vọng" },
        { status: 400 }
      );
    }

    if (!r4.questions || questionIndex < 0 || questionIndex >= r4.questions.length) {
      return NextResponse.json(
        { error: "questionIndex không hợp lệ" },
        { status: 400 }
      );
    }

    // Chỉ cho đặt star trước khi bắt đầu câu đó
    if (
      gameState.phase === "R4_QUESTION_SHOW" &&
      r4.currentQuestionIndex === questionIndex
    ) {
      return NextResponse.json(
        { error: "Phải đặt Ngôi sao hy vọng trước khi bắt đầu câu hỏi" },
        { status: 400 }
      );
    }

    // Mongoose Map: sử dụng .get() để đọc giá trị
    let existing = null;
    if (r4.starUsages && typeof (r4.starUsages as any).get === 'function') {
      existing = (r4.starUsages as any).get(teamIdStr);
    } else {
      // Fallback cho trường hợp không phải Map
      existing = (r4.starUsages as any)?.[teamIdStr];
    }
    
    if (existing?.used || existing?.optedOut) {
      return NextResponse.json(
        { error: "Đội đã có quyết định về Ngôi sao hy vọng trong Round 4" },
        { status: 400 }
      );
    }

    const newStarUsage = {
      used: true,
      questionIndex,
    };
    
    // Mongoose Map: sử dụng .set() để ghi giá trị
    if (r4.starUsages && typeof (r4.starUsages as any).set === 'function') {
      (r4.starUsages as any).set(teamIdStr, newStarUsage);
    } else {
      // Fallback cho trường hợp không phải Map
      (r4.starUsages as any)[teamIdStr] = newStarUsage;
    }
    
    // Mark modified để đảm bảo Mongoose lưu thay đổi
    gameState.markModified('round4State.starUsages');

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi đặt Ngôi sao hy vọng" },
      { status: 500 }
    );
  }
}


