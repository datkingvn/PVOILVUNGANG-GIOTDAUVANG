import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import { getNextTeam } from "@/lib/utils/round2-engine";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
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

    const pkg = await Package.findById(gameState.activePackageId);
    if (!pkg || !pkg.round2Meta) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    // Get next team
    const currentTeamId = pkg.round2Meta.turnState?.currentTeamId || gameState.activeTeamId;
    const nextTeamId = getNextTeam(
      currentTeamId,
      gameState.teams,
      pkg.round2Meta.eliminatedTeamIds || []
    );

    if (!nextTeamId) {
      return NextResponse.json(
        { error: "Không còn đội nào để chuyển lượt" },
        { status: 400 }
      );
    }

    // Update turn state
    if (!pkg.round2Meta.turnState) {
      pkg.round2Meta.turnState = {
        teamsUsedHorizontalAttempt: {},
      };
    }
    pkg.round2Meta.turnState.currentTeamId = nextTeamId;

    // Update game state
    gameState.activeTeamId = nextTeamId;
    gameState.phase = "TURN_SELECT";
    gameState.currentQuestionId = undefined;
    gameState.questionTimer = undefined;
    if (!gameState.round2State) {
      gameState.round2State = {};
    }
    gameState.round2State.currentHorizontalOrder = undefined;
    // Keep pendingAnswers if they exist
    // gameState.round2State.pendingAnswers is preserved

    // Mark round2State as modified for Mongoose
    gameState.markModified('round2State');

    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true, nextTeamId });
  } catch (error: any) {
    console.error("Error moving to next turn:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi chuyển lượt" },
      { status: 500 }
    );
  }
}

