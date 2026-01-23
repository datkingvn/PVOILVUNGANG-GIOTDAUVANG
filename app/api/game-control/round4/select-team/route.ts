import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import { getRound4TeamOrder } from "@/lib/utils/round4-engine";
import type { GameState as GameStateType } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId } = body as { teamId?: string };

    if (!teamId) {
      return NextResponse.json({ error: "Thiếu teamId" }, { status: 400 });
    }

    const gameState = await GameState.findOne();
    if (!gameState) {
      console.log("[Round4 Team] Error: Không tìm thấy trạng thái game");
      return NextResponse.json(
        { error: "Không tìm thấy trạng thái game" },
        { status: 400 }
      );
    }

    if (gameState.round !== "ROUND4" || !gameState.round4State) {
      console.log("[Round4 Team] Error: Round 4 chưa được khởi tạo");
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;

    // Không cho phép đổi đội nếu:
    // 1. Đã chọn gói (đã có selectedPackage)
    // 2. Đã bắt đầu câu hỏi (đã có currentQuestionId)
    // 3. Phase không phải là R4_IDLE hoặc R4_TURN_SELECT_PACKAGE
    if (r4.selectedPackage) {
      console.log("[Round4 Team] Error: Đã chọn gói, không thể đổi đội", {
        selectedPackage: r4.selectedPackage,
      });
      return NextResponse.json(
        { error: "Không thể đổi đội khi đã chọn gói. Vui lòng hoàn thành lượt chơi của đội hiện tại hoặc bắt đầu gói trước." },
        { status: 400 }
      );
    }

    if (gameState.currentQuestionId) {
      console.log("[Round4 Team] Error: Đã bắt đầu câu hỏi, không thể đổi đội", {
        currentQuestionId: gameState.currentQuestionId,
      });
      return NextResponse.json(
        { error: "Không thể đổi đội khi đã bắt đầu câu hỏi. Vui lòng hoàn thành câu hỏi hiện tại." },
        { status: 400 }
      );
    }

    if (
      gameState.phase !== "R4_IDLE" &&
      gameState.phase !== "R4_TURN_SELECT_PACKAGE"
    ) {
      console.log("[Round4 Team] Error: Phase không hợp lệ để chọn đội", {
        phase: gameState.phase,
      });
      return NextResponse.json(
        { error: "Chỉ chọn đội ở bước chuẩn bị gói (chưa chọn gói)" },
        { status: 400 }
      );
    }

    const teamExists = gameState.teams.some(
      (t: any) => t.teamId.toString() === teamId
    );
    if (!teamExists) {
      console.log("[Round4 Team] Error: Không tìm thấy đội trong teams", {
        requestedTeamId: teamId,
        availableTeamIds: gameState.teams.map((t: any) => t.teamId.toString()),
      });
      return NextResponse.json(
        { error: "Không tìm thấy đội trong trạng thái game" },
        { status: 400 }
      );
    }

    const { orderedTeamIds } = getRound4TeamOrder(
      gameState.toObject() as unknown as GameStateType
    );

    const teamIndexInOrder = orderedTeamIds.findIndex((id) => id === teamId);
    if (teamIndexInOrder === -1) {
      console.log("[Round4 Team] Error: Không tìm thấy team trong orderedTeamIds", {
        requestedTeamId: teamId,
        orderedTeamIds,
      });
      return NextResponse.json(
        { error: "Không tìm thấy đội trong danh sách" },
        { status: 400 }
      );
    }

    // Kiểm tra xem team này có thể được chọn không
    // Team có thể được chọn nếu chưa hoàn thành lượt chơi
    const completedTeamIds = r4.completedTeamIds || [];
    const teamIdStr = teamId.toString();

    if (completedTeamIds.includes(teamIdStr)) {
      console.log("[Round4 Team] Error: Team đã hoàn thành lượt chơi", {
        requestedTeamId: teamId,
        completedTeamIds,
      });
      return NextResponse.json(
        { error: "Đội này đã hoàn thành lượt chơi, không thể chọn lại" },
        { status: 400 }
      );
    }

    // Chỉ set currentTeamId, KHÔNG thay đổi turnIndex
    // turnIndex chỉ tăng lên khi team hoàn thành 3 câu hỏi (trong advanceRound4QuestionOrTeam)
    r4.currentTeamId = teamId;
    // KHÔNG set r4.turnIndex = teamIndexInOrder (đây là bug!)
    r4.selectedPackage = undefined;
    r4.questionPattern = undefined;
    r4.currentQuestionIndex = undefined;
    r4.questions = undefined;
    r4.stealWindow = undefined;
    r4.stealAnswer = undefined;
    gameState.activePackageId = undefined;
    gameState.activeTeamId = teamId;
    gameState.currentQuestionId = undefined;
    gameState.questionTimer = undefined;
    gameState.phase = "R4_TURN_SELECT_PACKAGE";

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Round4 Team] Error in select-team:", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || "Lỗi chọn đội Round 4" },
      { status: 500 }
    );
  }
}


