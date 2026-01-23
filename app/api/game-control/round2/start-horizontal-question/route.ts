import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";

export async function POST() {
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

    if (gameState.phase !== "HORIZONTAL_SELECTED") {
      return NextResponse.json(
        { error: "Chưa chọn hàng ngang hoặc đã bắt đầu câu hỏi" },
        { status: 400 }
      );
    }

    const currentHorizontalOrder = gameState.round2State?.currentHorizontalOrder;
    if (!currentHorizontalOrder) {
      return NextResponse.json(
        { error: "Không có hàng ngang được chọn" },
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

    // Find the question for this horizontal order
    const questions = await Question.find({ packageId: pkg._id, type: "horizontal" }).sort({ index: 1 });
    const targetQuestion = questions.find((q: any) => q.index === currentHorizontalOrder);

    if (!targetQuestion) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi hàng ngang" },
        { status: 404 }
      );
    }

    // Set phase to HORIZONTAL_ACTIVE and start question
    gameState.phase = "HORIZONTAL_ACTIVE";
    gameState.currentQuestionId = targetQuestion._id.toString();

    // Ensure round2State exists
    if (!gameState.round2State) {
      gameState.round2State = {};
    }
    // Keep currentHorizontalOrder, mark as modified
    gameState.markModified('round2State');

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
    console.error("Error starting horizontal question:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi bắt đầu câu hỏi" },
      { status: 500 }
    );
  }
}
