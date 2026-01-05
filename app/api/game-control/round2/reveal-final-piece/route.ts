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

    // Reveal final piece
    if (!pkg.round2Meta.revealedPieces) {
      pkg.round2Meta.revealedPieces = {};
    }
    pkg.round2Meta.revealedPieces[pkg.round2Meta.finalPieceIndex] = true;
    pkg.round2Meta.openedClueCount = 4;

    // Move to center hint phase
    gameState.phase = "CENTER_HINT_ACTIVE";

    await pkg.save();
    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error revealing final piece:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi mở mảnh cuối" },
      { status: 500 }
    );
  }
}

