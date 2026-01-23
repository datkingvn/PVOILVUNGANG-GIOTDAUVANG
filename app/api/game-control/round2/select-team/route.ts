import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Team from "@/lib/db/models/Team";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import type { TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId } = body;

    // Allow clearing team selection (empty string)
    if (teamId === "") {
      const gameState = await GameState.findOne();
      if (!gameState || !gameState.activePackageId) {
        return NextResponse.json(
          { error: "Không có game đang active" },
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

      // Clear team selection
      if (pkg.round2Meta.turnState) {
        pkg.round2Meta.turnState.currentTeamId = undefined;
      }
      gameState.activeTeamId = undefined;

      await pkg.save();
      await gameState.save();
      await broadcastGameState();

      return NextResponse.json({ success: true });
    }

    if (!teamId) {
      return NextResponse.json(
        { error: "Vui lòng chọn đội" },
        { status: 400 }
      );
    }

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

    if (gameState.phase !== "TURN_SELECT") {
      return NextResponse.json(
        { error: "Không thể chọn đội ở phase này" },
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

    // Verify team exists and is not eliminated
    const team = await Team.findById(teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Không tìm thấy đội" },
        { status: 404 }
      );
    }

    const teamIdStr = teamId.toString();
    if (pkg.round2Meta.eliminatedTeamIds?.includes(teamIdStr)) {
      return NextResponse.json(
        { error: "Đội này đã bị loại" },
        { status: 400 }
      );
    }

    // Check if team exists in gameState
    const teamInState = gameState.teams.find(
      (t: TeamScore) => t.teamId === teamIdStr
    );
    if (!teamInState) {
      return NextResponse.json(
        { error: "Đội không có trong game" },
        { status: 400 }
      );
    }

    // Update turn state
    if (!pkg.round2Meta.turnState) {
      pkg.round2Meta.turnState = {
        teamsUsedHorizontalAttempt: {},
      };
    }
    pkg.round2Meta.turnState.currentTeamId = teamIdStr;

    // Update game state
    gameState.activeTeamId = teamIdStr;
    gameState.phase = "TURN_SELECT"; // Keep in TURN_SELECT so MC can choose horizontal

    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error selecting team:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi chọn đội" },
      { status: 500 }
    );
  }
}

