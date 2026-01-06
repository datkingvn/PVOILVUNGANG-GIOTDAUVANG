import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { packageId, questionIndex } = body;

    if (!packageId || typeof questionIndex !== "number") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp packageId và questionIndex" },
        { status: 400 }
      );
    }

    if (questionIndex < 0 || questionIndex > 3) {
      return NextResponse.json(
        { error: "questionIndex phải từ 0 đến 3" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { error: "Không tìm thấy game state" },
        { status: 404 }
      );
    }

    if (gameState.round !== "ROUND3") {
      return NextResponse.json(
        { error: "Không phải Round 3" },
        { status: 400 }
      );
    }

    // Verify package exists and is Round3
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    if (pkg.round !== "ROUND3") {
      return NextResponse.json(
        { error: "Gói câu hỏi không phải Round 3" },
        { status: 400 }
      );
    }

    // Get question by index
    const questions = await Question.find({ packageId }).sort({ index: 1 });
    if (questionIndex >= questions.length) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi tại index này" },
        { status: 404 }
      );
    }

    const question = questions[questionIndex];

    // Update package status
    if (pkg.status === "unassigned") {
      pkg.status = "in_progress";
      await pkg.save();
    }

    // Update game state
    gameState.activePackageId = packageId.toString();
    gameState.currentQuestionId = question._id.toString();
    gameState.phase = "ROUND3_QUESTION_ACTIVE";

    // Initialize round3State if not exists
    if (!gameState.round3State) {
      gameState.round3State = {
        currentQuestionIndex: questionIndex,
        pendingAnswers: [],
        questionResults: {},
      };
    } else {
      gameState.round3State.currentQuestionIndex = questionIndex;
      // Clear pending answers from previous question
      gameState.round3State.pendingAnswers = [];
    }

    // Start 30-second timer
    const now = Date.now();
    gameState.questionTimer = {
      endsAt: now + 30 * 1000, // 30 seconds
      running: true,
    };

    await gameState.save();

    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

