import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Team from "@/lib/db/models/Team";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: "Vui lòng chọn đội" },
        { status: 400 }
      );
    }

    // Verify team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Không tìm thấy đội" }, { status: 404 });
    }

    let gameState = await GameState.findOne();
    if (!gameState) {
      gameState = await GameState.create({
        round: "ROUND1",
        phase: "IDLE",
        teams: [],
      });
    }

    // Check if team has already finished
    const teamInState = gameState.teams.find(
      (t: any) => t.teamId === teamId.toString()
    );
    if (teamInState && teamInState.status === "finished") {
      return NextResponse.json(
        { error: "Đội này đã thi xong" },
        { status: 400 }
      );
    }

    // Add team to teams array if not present
    if (!teamInState) {
      gameState.teams.push({
        teamId: teamId.toString(),
        nameSnapshot: team.name,
        score: 0,
        status: "waiting",
      });
    }

    gameState.activeTeamId = teamId.toString();
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

