import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import { advanceRound4QuestionOrTeam } from "@/lib/utils/round4-engine";
import type { TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { isCorrect } = body as { isCorrect?: boolean };

    if (typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "Thiếu isCorrect (true/false)" },
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

    if (gameState.phase !== "R4_STEAL_LOCKED") {
      return NextResponse.json(
        { error: "Không ở trạng thái giành quyền trả lời" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;
    if (!r4.stealWindow || !r4.stealWindow.buzzLockedTeamId) {
      return NextResponse.json(
        { error: "Chưa có đội nào giành quyền để chấm" },
        { status: 400 }
      );
    }

    if (
      r4.currentQuestionIndex === undefined ||
      !r4.questions ||
      !r4.questions[r4.currentQuestionIndex]
    ) {
      return NextResponse.json(
        { error: "Không xác định được câu hỏi hiện tại" },
        { status: 400 }
      );
    }

    const mainTeamId = r4.currentTeamId;
    const stealTeamId = r4.stealWindow.buzzLockedTeamId;

    if (!mainTeamId || !stealTeamId) {
      return NextResponse.json(
        { error: "Không xác định được đội chính hoặc đội giành quyền" },
        { status: 400 }
      );
    }

    const points = r4.questions[r4.currentQuestionIndex].points;

    const mainIdx = gameState.teams.findIndex(
      (t: TeamScore) => t.teamId === mainTeamId
    );
    const stealIdx = gameState.teams.findIndex(
      (t: TeamScore) => t.teamId === stealTeamId
    );

    if (mainIdx === -1 || stealIdx === -1) {
      return NextResponse.json(
        { error: "Không tìm thấy đội trong bảng điểm" },
        { status: 404 }
      );
    }

    if (isCorrect) {
      // Đội giành quyền đúng: +points, main -points (chuyển điểm)
      gameState.teams[stealIdx].score += points;
      gameState.teams[mainIdx].score -= points;
    } else {
      // Đội giành quyền sai: trừ 1/2 points, main giữ nguyên (ngoài penalty Star nếu có, đã trừ trước)
      const penalty = points / 2;
      gameState.teams[stealIdx].score -= penalty;
    }

    // Kết thúc câu, chuyển tiếp
    advanceRound4QuestionOrTeam(gameState as any);

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi chấm đáp án giành quyền Round 4" },
      { status: 500 }
    );
  }
}


