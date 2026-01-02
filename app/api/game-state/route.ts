import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { reconcileGameState } from "@/lib/utils/game-engine";

export async function GET() {
  try {
    await connectDB();

    // Reconcile state first to ensure it's up-to-date
    await reconcileGameState();

    const gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json({ state: null });
    }

    return NextResponse.json({ state: gameState.toObject() });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

