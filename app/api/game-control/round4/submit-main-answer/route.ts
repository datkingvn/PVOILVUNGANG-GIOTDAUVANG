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

    if (gameState.phase !== "R4_QUESTION_SHOW") {
      return NextResponse.json(
        { error: "Không thể gửi đáp án ở phase hiện tại" },
        { status: 400 }
      );
    }

    const now = Date.now();
    if (
      !gameState.questionTimer ||
      !gameState.questionTimer.running ||
      now > gameState.questionTimer.endsAt
    ) {
      return NextResponse.json(
        { error: "Đã hết thời gian trả lời" },
        { status: 400 }
      );
    }

    const teamId = team.teamId?.toString();
    const r4 = gameState.round4State;

    if (!teamId || r4.currentTeamId !== teamId) {
      return NextResponse.json(
        { error: "Chỉ đội đang thi mới được nhập đáp án" },
        { status: 400 }
      );
    }

    // Last answer wins: chỉ lưu đáp án cuối
    r4.lastMainAnswer = answer.trim();

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi gửi đáp án đội đang thi" },
      { status: 500 }
    );
  }
}


