import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { Round4BuzzInfo } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    const team = await requireTeam();
    await connectDB();

    const gameState = await GameState.findOne();
    if (!gameState || gameState.round !== "ROUND4" || !gameState.round4State) {
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    if (gameState.phase !== "R4_STEAL_WINDOW") {
      return NextResponse.json(
        { error: "Không thể bấm chuông ở phase hiện tại" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;
    const teamId = team.teamId?.toString();
    if (!teamId) {
      return NextResponse.json(
        { error: "Không xác định được đội" },
        { status: 400 }
      );
    }

    // Không cho main team bấm
    if (r4.currentTeamId === teamId) {
      return NextResponse.json(
        { error: "Đội đang thi không được giành quyền" },
        { status: 400 }
      );
    }

    if (!r4.stealWindow || !r4.stealWindow.active) {
      return NextResponse.json(
        { error: "Cửa sổ giành quyền không hoạt động" },
        { status: 400 }
      );
    }

    const now = Date.now();
    if (now > r4.stealWindow.endsAt) {
      return NextResponse.json(
        { error: "Đã hết thời gian giành quyền" },
        { status: 400 }
      );
    }

    // Nếu đã lock đội khác thì từ chối
    if (r4.stealWindow.buzzLockedTeamId) {
      return NextResponse.json(
        { error: "Đã có đội khác giành được quyền trả lời" },
        { status: 400 }
      );
    }

    // Nếu đội này đã buzz rồi thì bỏ qua
    if (
      r4.stealWindow.buzzedTeams.some((b: Round4BuzzInfo) => b.teamId === teamId)
    ) {
      return NextResponse.json(
        { error: "Đội đã bấm chuông rồi" },
        { status: 400 }
      );
    }

    // Lock quyền cho đội nhanh nhất (atomic trong 1 request)
    r4.stealWindow.buzzedTeams.push({
      teamId,
      buzzedAt: now,
    });
    r4.stealWindow.buzzLockedTeamId = teamId;
    gameState.phase = "R4_STEAL_LOCKED";

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi giành quyền trả lời Round 4" },
      { status: 500 }
    );
  }
}


