import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

export async function POST(request: NextRequest) {
  try {
    const team = await requireTeam();
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

    // Không cho phép rung chuông keyword trong các phase này
    if (
      gameState.phase === "KEYWORD_BUZZ_JUDGING" ||
      gameState.phase === "ROUND_END"
    ) {
      return NextResponse.json(
        { error: "Không thể rung chuông ở phase này" },
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

    const teamId = team.teamId?.toString();
    if (!teamId) {
      return NextResponse.json(
        { error: "Không xác định được đội" },
        { status: 400 }
      );
    }

    // Check if team is eliminated
    if (pkg.round2Meta.eliminatedTeamIds?.includes(teamId)) {
      return NextResponse.json(
        { error: "Đội đã bị loại" },
        { status: 400 }
      );
    }

    // Check if team already buzzed keyword
    const existingQueue = pkg.round2Meta.buzzState?.keywordBuzzQueue || [];
    const alreadyBuzzed = existingQueue.some((item: { teamId: string; buzzedAt: number }) => item.teamId === teamId);
    
    if (alreadyBuzzed) {
      return NextResponse.json(
        { error: "Đội đã rung chuông dự đoán từ khóa rồi" },
        { status: 400 }
      );
    }

    // Add team to queue with timestamp
    const now = Date.now();
    const newQueueItem = {
      teamId,
      buzzedAt: now,
    };

    if (!pkg.round2Meta.buzzState) {
      pkg.round2Meta.buzzState = {
        keywordBuzzQueue: [],
      };
    }
    
    if (!pkg.round2Meta.buzzState.keywordBuzzQueue) {
      pkg.round2Meta.buzzState.keywordBuzzQueue = [];
    }

    pkg.round2Meta.buzzState.keywordBuzzQueue = [
      ...existingQueue,
      newQueueItem,
    ];

    // Sort queue by buzzedAt (earliest first)
    pkg.round2Meta.buzzState.keywordBuzzQueue.sort(
      (a: { teamId: string; buzzedAt: number }, b: { teamId: string; buzzedAt: number }) => a.buzzedAt - b.buzzedAt
    );

    // Mark modified to ensure Mongoose saves nested object changes
    pkg.markModified('round2Meta.buzzState');
    pkg.markModified('round2Meta');
    
    await pkg.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error buzzing keyword:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi rung chuông dự đoán từ khóa" },
      { status: 500 }
    );
  }
}

