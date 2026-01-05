import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

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

    const keywordBuzzQueue = pkg.round2Meta.buzzState?.keywordBuzzQueue || [];
    
    if (keywordBuzzQueue.length === 0) {
      return NextResponse.json(
        { error: "Không có đội nào đã rung chuông" },
        { status: 400 }
      );
    }

    // Set phase to KEYWORD_BUZZ_JUDGING and start with first team
    gameState.phase = "KEYWORD_BUZZ_JUDGING";
    
    if (!pkg.round2Meta.buzzState) {
      pkg.round2Meta.buzzState = {};
    }
    pkg.round2Meta.buzzState.currentKeywordBuzzIndex = 0;

    // Set active team to first team in queue
    if (keywordBuzzQueue.length > 0) {
      gameState.activeTeamId = keywordBuzzQueue[0].teamId;
    }

    // Mark modified to ensure Mongoose saves nested object changes
    pkg.markModified('round2Meta.buzzState');
    pkg.markModified('round2Meta');
    
    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error starting keyword judging:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi bắt đầu chấm từ khóa" },
      { status: 500 }
    );
  }
}

