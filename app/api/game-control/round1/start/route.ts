import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Team from "@/lib/db/models/Team";
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

    let gameState = await GameState.findOne();
    if (!gameState) {
      gameState = await GameState.create({
        round: "ROUND1",
        phase: "ROUND_READY",
        teams: [],
      });
    } else {
      gameState.round = "ROUND1";
      gameState.phase = "ROUND_READY";
    }

    // Synchronize teams with Team model
    const allTeams = await Team.find();
    const existingTeamIds = new Set(
      gameState.teams.map((t: TeamScore) => t.teamId.toString())
    );

    // Add new teams
    for (const dbTeam of allTeams) {
      const teamIdStr = dbTeam._id.toString();
      if (!existingTeamIds.has(teamIdStr)) {
        gameState.teams.push({
          teamId: teamIdStr,
          nameSnapshot: dbTeam.name,
          score: 0,
          status: "waiting",
        });
      } else {
        // Update nameSnapshot for existing teams
        const existingTeam = gameState.teams.find(
          (t: TeamScore) => t.teamId.toString() === teamIdStr
        );
        if (existingTeam) {
          existingTeam.nameSnapshot = dbTeam.name;
        }
      }
    }

    // Remove teams that no longer exist in DB
    gameState.teams = gameState.teams.filter((t: TeamScore) =>
      allTeams.some((dbTeam) => dbTeam._id.toString() === t.teamId.toString())
    );

    await gameState.save();

    const stateObj = gameState.toObject({ flattenMaps: true });
    const timing = await broadcastGameState(stateObj);

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

