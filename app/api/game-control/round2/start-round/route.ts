import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Team from "@/lib/db/models/Team";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { TeamScore } from "@/types/game";

export async function POST() {
  try {
    await requireMC();
    await connectDB();

    let gameState = await GameState.findOne();
    if (!gameState) {
      gameState = await GameState.create({
        round: "ROUND2",
        phase: "IDLE",
        teams: [],
      });
    } else {
      gameState.round = "ROUND2";
      gameState.phase = "IDLE";
      // Clear active game state when switching to Round 2 selection
      gameState.activePackageId = undefined;
      gameState.activeTeamId = undefined;
      gameState.currentQuestionId = undefined;
      gameState.questionTimer = undefined;
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
          status: "active",
        });
      } else {
        // Update nameSnapshot for existing teams
        const existingTeam = gameState.teams.find(
          (t: TeamScore) => t.teamId.toString() === teamIdStr
        );
        if (existingTeam) {
          existingTeam.nameSnapshot = dbTeam.name;
          existingTeam.status = "active";
        }
      }
    }

    // Remove teams that no longer exist in DB
    gameState.teams = gameState.teams.filter((t: TeamScore) =>
      allTeams.some((dbTeam) => dbTeam._id.toString() === t.teamId.toString())
    );

    await gameState.save();

    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

