import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { TeamScore } from "@/types/game";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function POST() {
  try {
    await requireMC();
    await connectDB();

    // Reset all Round 1 packages
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

    // Reset all Round 2 packages
    const round2Packages = await Package.find({ round: "ROUND2" });
    for (const pkg of round2Packages) {
      if (pkg.round2Meta) {
        pkg.status = "unassigned";
        pkg.assignedTeamId = undefined;
        pkg.currentQuestionIndex = 0;
        pkg.history = [];
        
        // Reset round2Meta game state (keep setup data like image, cnvAnswer, questions, etc.)
        pkg.round2Meta.revealedPieces = new Map();
        pkg.round2Meta.openedClueCount = 0;
        pkg.round2Meta.eliminatedTeamIds = [];
        pkg.round2Meta.turnState = {
          currentTeamId: undefined,
          teamsUsedHorizontalAttempt: {},
        };
        pkg.round2Meta.buzzState = {};
        
        await pkg.save();
      }
    }

    // Reset all Round 3 packages
    await Package.updateMany(
      { round: "ROUND3" },
      {
        $set: {
          status: "unassigned",
          assignedTeamId: null,
          currentQuestionIndex: 0,
          history: [],
        },
      }
    );

    // Reset game state (bao gồm cả Round 4)
    let gameState = await GameState.findOne();
    if (gameState) {
      gameState.round = "ROUND1";
      gameState.phase = "IDLE";
      gameState.activeTeamId = undefined;
      gameState.activePackageId = undefined;
      gameState.currentQuestionId = undefined;
      gameState.questionTimer = undefined;
      gameState.round2State = undefined;
      gameState.round3State = undefined;
      gameState.round4State = undefined;

      // Reset team scores and status
      gameState.teams = gameState.teams.map((team: TeamScore) => ({
        ...team,
        score: 0,
        status: "waiting" as const,
      }));

      await gameState.save();
    }

    const timing = await broadcastGameState();

    return NextResponse.json(
      { 
        success: true,
        timing,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { 
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

