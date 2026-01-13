import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { reconcileGameState } from "@/lib/utils/game-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function GET() {
  try {
    await connectDB();

    // Reconcile state first to ensure it's up-to-date
    await reconcileGameState();

    const gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { state: null },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const stateObj = gameState.toObject({ flattenMaps: true });
    
    // Ensure pendingAnswers is a plain array
    if (stateObj.round2State?.pendingAnswers) {
      stateObj.round2State.pendingAnswers = JSON.parse(JSON.stringify(stateObj.round2State.pendingAnswers));
    }

    return NextResponse.json(
      { 
        state: stateObj,
        serverTime: Date.now(), // Include server time for client sync
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

