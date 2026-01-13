import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import Team from "@/lib/db/models/Team";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { TeamScore } from "@/types/game";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId, packageId } = body;

    if (!teamId || !packageId) {
      return NextResponse.json(
        { error: "Vui lòng chọn đội và gói câu hỏi" },
        { status: 400 }
      );
    }

    // Verify team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Không tìm thấy đội" }, { status: 404 });
    }

    // Verify package exists
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    if (pkg.status !== "unassigned") {
      return NextResponse.json(
        { error: "Gói câu hỏi này đã được sử dụng" },
        { status: 400 }
      );
    }

    let gameState = await GameState.findOne();
    if (!gameState) {
      gameState = await GameState.create({
        round: "ROUND1",
        phase: "IDLE",
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

    // Add team to teams array if not present
    const teamIdStr = teamId.toString();
    const teamInState = gameState.teams.find(
      (t: TeamScore) => t.teamId.toString() === teamIdStr
    );
    if (!teamInState) {
      gameState.teams.push({
        teamId: teamIdStr,
        nameSnapshot: team.name,
        score: 0,
        status: "active",
      });
    } else {
      teamInState.status = "active";
      teamInState.nameSnapshot = team.name;
    }

    // Get first question
    const questions = await Question.find({ packageId }).sort({ index: 1 });
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "Gói câu hỏi này chưa có câu hỏi nào" },
        { status: 400 }
      );
    }

    const firstQuestion = questions[0];

    // Update package
    pkg.status = "in_progress";
    pkg.assignedTeamId = teamId;
    pkg.currentQuestionIndex = 0;
    await pkg.save();

    // Update game state
    gameState.activeTeamId = teamIdStr;
    gameState.activePackageId = packageId.toString();
    gameState.currentQuestionId = firstQuestion._id.toString();
    gameState.phase = "QUESTION_SHOW";

    // Start 60-second package timer
    const now = Date.now();
    gameState.questionTimer = {
      endsAt: now + 60 * 1000, // 60 seconds
      running: true,
    };

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

