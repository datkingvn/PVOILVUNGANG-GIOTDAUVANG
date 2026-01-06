import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import {
  getRound4PackagePattern,
  drawQuestionsForRound4Package,
} from "@/lib/utils/round4-engine";
import type { Round4PackagePoints } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId, packagePoints } = body as {
      teamId?: string;
      packagePoints?: Round4PackagePoints;
    };

    if (!teamId || !packagePoints) {
      return NextResponse.json(
        { error: "Thiếu teamId hoặc packagePoints" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { error: "Không tìm thấy trạng thái game" },
        { status: 400 }
      );
    }

    if (gameState.round !== "ROUND4") {
      return NextResponse.json(
        { error: "Không phải Round 4" },
        { status: 400 }
      );
    }

    if (!gameState.round4State) {
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    if (gameState.phase !== "R4_TURN_SELECT_PACKAGE" && gameState.phase !== "R4_IDLE") {
      return NextResponse.json(
        { error: "Không thể chọn gói ở phase hiện tại" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;

    // Đảm bảo đúng lượt
    if (r4.currentTeamId && r4.currentTeamId !== teamId) {
      return NextResponse.json(
        { error: "Không phải lượt của đội này" },
        { status: 400 }
      );
    }

    const pattern = getRound4PackagePattern(packagePoints);

    // Rút câu hỏi theo pattern, không trùng usedQuestionIdsByPoints
    const { questions, updatedUsed } = await drawQuestionsForRound4Package(
      pattern as any,
      r4.usedQuestionIdsByPoints
    );

    r4.selectedPackage = packagePoints;
    r4.questionPattern = pattern;
    r4.questions = questions;
    r4.currentQuestionIndex = undefined;
    r4.usedQuestionIdsByPoints = updatedUsed;

    // Chỉ chuẩn bị gói và danh sách câu hỏi, chưa bắt đầu câu nào.
    // MC sẽ bấm nút \"Bắt đầu\" để gọi /round4/start-question với questionIndex=0.
    gameState.activeTeamId = teamId;
    gameState.currentQuestionId = undefined;
    gameState.questionTimer = undefined;
    r4.lastMainAnswer = undefined;
    r4.stealWindow = undefined;
    r4.stealAnswer = undefined;
    gameState.phase = "R4_TURN_PICK_QUESTIONS";

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi chọn gói Round 4" },
      { status: 500 }
    );
  }
}


