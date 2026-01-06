import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import { getRound4QuestionDuration } from "@/lib/utils/round4-engine";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { questionIndex } = body as { questionIndex?: number };

    if (typeof questionIndex !== "number") {
      return NextResponse.json(
        { error: "Thiếu questionIndex" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState || gameState.round !== "ROUND4" || !gameState.round4State) {
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;

    // Chỉ cho phép bắt đầu câu khi:
    // - Đang ở bước chọn câu trong gói (sau khi chọn gói) HOẶC
    // - Đang ở phase chờ xác nhận ngôi sao (có thể MC muốn restart) HOẶC
    // - Đã chuyển sang câu tiếp theo và đang ở trạng thái hiển thị (QUESTION_SHOW) nhưng CHƯA có timer chạy
    const canStartNow =
      gameState.phase === "R4_TURN_PICK_QUESTIONS" ||
      gameState.phase === "R4_STAR_CONFIRMATION" ||
      (gameState.phase === "R4_QUESTION_SHOW" &&
        (!gameState.questionTimer || !gameState.questionTimer.running));

    if (!canStartNow) {
      return NextResponse.json(
        {
          error:
            "Không thể bắt đầu câu hỏi mới khi câu hiện tại chưa kết thúc. Vui lòng chấm xong trước.",
        },
        { status: 400 }
      );
    }
    if (!r4.questions || questionIndex < 0 || questionIndex >= r4.questions.length) {
      return NextResponse.json(
        { error: "questionIndex không hợp lệ" },
        { status: 400 }
      );
    }

    const qRef = r4.questions[questionIndex];
    const duration = getRound4QuestionDuration(qRef.points);
    const now = Date.now();

    r4.currentQuestionIndex = questionIndex;
    gameState.currentQuestionId = qRef.questionId;
    // Không bắt đầu timer ngay, chờ đội xác nhận ngôi sao
    gameState.questionTimer = undefined;
    r4.lastMainAnswer = undefined;
    r4.stealWindow = undefined;
    r4.stealAnswer = undefined;
    // Chuyển sang phase chờ xác nhận ngôi sao
    gameState.phase = "R4_STAR_CONFIRMATION";

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi bắt đầu câu Round 4" },
      { status: 500 }
    );
  }
}


