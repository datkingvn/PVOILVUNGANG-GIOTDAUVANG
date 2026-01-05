import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { PackageHistory } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { horizontalOrder } = body;

    if (!horizontalOrder || (horizontalOrder !== 1 && horizontalOrder !== 2 && horizontalOrder !== 3 && horizontalOrder !== 4)) {
      return NextResponse.json(
        { error: "Vui lòng chọn hàng ngang hợp lệ (1, 2, 3, hoặc 4)" },
        { status: 400 }
      );
    }

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

    if (gameState.phase !== "TURN_SELECT") {
      return NextResponse.json(
        { error: "Không thể chọn hàng ngang ở phase này" },
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

    // Check if team has already used horizontal attempt
    const currentTeamId = pkg.round2Meta.turnState?.currentTeamId || gameState.activeTeamId;
    if (!currentTeamId) {
      return NextResponse.json(
        { error: "Không có đội đang lượt" },
        { status: 400 }
      );
    }

    const teamsUsedAttempt = pkg.round2Meta.turnState?.teamsUsedHorizontalAttempt || {};
    if (teamsUsedAttempt[currentTeamId]) {
      return NextResponse.json(
        { error: "Đội này đã sử dụng lượt chọn hàng ngang" },
        { status: 400 }
      );
    }

    // Find the question for this horizontal order
    const questions = await Question.find({ packageId: pkg._id, type: "horizontal" }).sort({ index: 1 });
    const targetQuestion = questions.find((q: any) => q.index === horizontalOrder);

    if (!targetQuestion) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi hàng ngang" },
        { status: 404 }
      );
    }

    // Check if this horizontal has already been answered (check history)
    const answeredHorizontalOrders = new Set(
      pkg.history
        .map((h: PackageHistory) => {
          const q = questions.find((q: any) => q._id.toString() === h.questionId);
          return q?.index;
        })
        .filter((idx: number | undefined): idx is number => idx !== undefined)
    );

    if (answeredHorizontalOrders.has(horizontalOrder)) {
      return NextResponse.json(
        { error: "Hàng ngang này đã được trả lời" },
        { status: 400 }
      );
    }

    // Set phase to HORIZONTAL_ACTIVE
    gameState.phase = "HORIZONTAL_ACTIVE";
    gameState.currentQuestionId = targetQuestion._id.toString();
    gameState.round2State = {
      currentHorizontalOrder: horizontalOrder,
    };

    // Start 15-second timer
    const now = Date.now();
    gameState.questionTimer = {
      endsAt: now + 15 * 1000, // 15 seconds
      running: true,
    };

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error selecting horizontal:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi chọn hàng ngang" },
      { status: 500 }
    );
  }
}

