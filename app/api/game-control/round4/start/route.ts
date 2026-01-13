import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Team from "@/lib/db/models/Team";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { TeamScore } from "@/types/game";
import { initRound4State } from "@/lib/utils/round4-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function POST() {
  try {
    await requireMC();
    await connectDB();

    // Đồng bộ teams giống Round 2/3
    let gameState = await GameState.findOne();
    if (!gameState) {
      gameState = await GameState.create({
        round: "ROUND4",
        phase: "R4_IDLE",
        teams: [],
      });
    }

    const allTeams = await Team.find();
    const existingTeamIds = new Set(
      gameState.teams.map((t: TeamScore) => t.teamId.toString())
    );

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

    // Remove teams that no longer exist
    gameState.teams = gameState.teams.filter((t: TeamScore) =>
      allTeams.some((dbTeam) => dbTeam._id.toString() === t.teamId.toString())
    );

    await gameState.save();

    // Khởi tạo Round4State với danh sách đội đã sync
    const inited = await initRound4State();
    await GameState.updateOne({ _id: gameState._id }, inited);

    // Reload gameState to get updated round4State
    const updatedGameState = await GameState.findById(gameState._id);
    if (updatedGameState) {
      const stateObj = updatedGameState.toObject({ flattenMaps: true });
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
      { error: error.message || "Lỗi khởi tạo Round 4" },
      { 
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}


