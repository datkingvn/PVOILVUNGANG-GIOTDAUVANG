import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

export async function POST() {
  try {
    await requireMC();
    await connectDB();

    // Reset all packages
    await Package.updateMany(
      { round: "ROUND1" },
      {
        $set: {
          status: "unassigned",
          assignedTeamId: null,
          currentQuestionIndex: 0,
          history: [],
        },
      }
    );

    // Reset game state
    let gameState = await GameState.findOne();
    if (gameState) {
      gameState.round = "ROUND1";
      gameState.phase = "IDLE";
      gameState.activeTeamId = undefined;
      gameState.activePackageId = undefined;
      gameState.currentQuestionId = undefined;
      gameState.questionTimer = undefined;

      // Reset team scores and status
      gameState.teams = gameState.teams.map((team) => ({
        ...team,
        score: 0,
        status: "waiting" as const,
      }));

      await gameState.save();
    }

    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

