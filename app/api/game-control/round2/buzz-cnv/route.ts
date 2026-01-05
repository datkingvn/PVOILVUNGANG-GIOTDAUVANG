import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Team from "@/lib/db/models/Team";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

export async function POST(request: NextRequest) {
  try {
    const team = await requireTeam();
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

    // CNV can be buzzed at any time except during judging or if already locked
    if (
      gameState.phase === "CNV_LOCKED" ||
      gameState.phase === "CNV_ACTIVE" ||
      gameState.phase === "CNV_JUDGING" ||
      gameState.phase === "ROUND_END"
    ) {
      return NextResponse.json(
        { error: "CNV đã được bấm chuông hoặc vòng đã kết thúc" },
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

    const teamId = team.teamId?.toString();
    if (!teamId) {
      return NextResponse.json(
        { error: "Không xác định được đội" },
        { status: 400 }
      );
    }

    // Check if team is eliminated
    if (pkg.round2Meta.eliminatedTeamIds?.includes(teamId)) {
      return NextResponse.json(
        { error: "Đội đã bị loại" },
        { status: 400 }
      );
    }

    // First-come lock mechanism (server timestamp)
    if (pkg.round2Meta.buzzState?.cnvLockTeamId) {
      return NextResponse.json(
        { error: "CNV đã được đội khác bấm chuông" },
        { status: 400 }
      );
    }

    // Lock CNV for this team
    const now = Date.now();
    pkg.round2Meta.buzzState = {
      cnvLockTeamId: teamId,
      cnvLockEndsAt: now + 15 * 1000, // 15 seconds
    };

    // Set phase to CNV_LOCKED then CNV_ACTIVE
    gameState.phase = "CNV_ACTIVE";
    gameState.activeTeamId = teamId;

    // Start 15-second timer
    gameState.questionTimer = {
      endsAt: now + 15 * 1000,
      running: true,
    };

    // Clear current question (if any)
    gameState.currentQuestionId = undefined;

    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error buzzing CNV:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi bấm chuông CNV" },
      { status: 500 }
    );
  }
}

