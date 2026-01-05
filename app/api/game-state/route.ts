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

    const stateObj = gameState.toObject({ flattenMaps: true });
    
    // Ensure pendingAnswers is a plain array
    if (stateObj.round2State?.pendingAnswers) {
      stateObj.round2State.pendingAnswers = JSON.parse(JSON.stringify(stateObj.round2State.pendingAnswers));
    }

    return NextResponse.json({ state: stateObj });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

