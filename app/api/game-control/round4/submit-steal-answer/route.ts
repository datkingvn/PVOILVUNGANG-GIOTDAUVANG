import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";

export async function POST(request: NextRequest) {
  try {
    const team = await requireTeam();
    await connectDB();

    const body = await request.json();
    const { answer } = body as { answer?: string };

    if (!answer || typeof answer !== "string") {
      return NextResponse.json(
        { error: "Vui lòng nhập đáp án" },
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

    if (gameState.phase !== "R4_STEAL_LOCKED") {
      return NextResponse.json(
        { error: "Chưa có đội nào giành quyền trả lời" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;
    if (!r4.stealWindow || !r4.stealWindow.buzzLockedTeamId) {
      return NextResponse.json(
        { error: "Không xác định được đội giành quyền" },
        { status: 400 }
      );
    }

    const teamId = team.teamId?.toString();
    if (!teamId || r4.stealWindow.buzzLockedTeamId !== teamId) {
      return NextResponse.json(
        { error: "Chỉ đội đã giành quyền mới được trả lời" },
        { status: 400 }
      );
    }

    // First answer wins: chỉ cho phép ghi nhận lần đầu
    if (r4.stealAnswer) {
      return NextResponse.json(
        { error: "Đội đã gửi đáp án giành quyền" },
        { status: 400 }
      );
    }

    r4.stealAnswer = {
      teamId,
      answer: answer.trim(),
      submittedAt: Date.now(),
    };

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi gửi đáp án giành quyền" },
      { status: 500 }
    );
  }
}


