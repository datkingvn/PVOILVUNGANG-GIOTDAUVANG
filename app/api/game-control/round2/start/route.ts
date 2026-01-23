import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Team from "@/lib/db/models/Team";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import { getNextTeam } from "@/lib/utils/round2-engine";
import type { TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json(
        { error: "Vui lòng chọn gói câu hỏi" },
        { status: 400 }
      );
    }

    // Verify package exists and is Round2
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    if (pkg.round !== "ROUND2") {
      return NextResponse.json(
        { error: "Chỉ có thể start Round 2" },
        { status: 400 }
      );
    }

    if (!pkg.round2Meta) {
      return NextResponse.json(
        { error: "Gói câu hỏi chưa được setup" },
        { status: 400 }
      );
    }

    // Update package status
    pkg.status = "in_progress";
    await pkg.save();

    // Get or create game state
    let gameState = await GameState.findOne();
    if (!gameState) {
      gameState = await GameState.create({
        round: "ROUND2",
        phase: "TURN_SELECT",
        teams: [],
      });
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

    // Initialize Round2 state
    gameState.round = "ROUND2";
    gameState.phase = "TURN_SELECT";
    gameState.activePackageId = packageId.toString();
    gameState.currentQuestionId = undefined;
    gameState.questionTimer = undefined;

    // Initialize round2Meta turnState (but don't set currentTeamId - let MC choose)
    if (!pkg.round2Meta.turnState) {
      pkg.round2Meta.turnState = {
        teamsUsedHorizontalAttempt: {},
      };
    }

    // Don't set active team - MC will choose manually
    gameState.activeTeamId = undefined;

    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error starting Round 2:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi start Round 2" },
      { status: 500 }
    );
  }
}

