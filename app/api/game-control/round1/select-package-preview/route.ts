import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const preferredRegion = "sin1";

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

    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    let gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { error: "Game chưa được khởi tạo" },
        { status: 400 }
      );
    }

    gameState.activePackageId = packageId.toString();
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

