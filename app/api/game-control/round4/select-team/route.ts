import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import { getRound4TeamOrder } from "@/lib/utils/round4-engine";
import type { GameState as GameStateType } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { teamId } = body as { teamId?: string };

    console.log("[Round4 Team] Select team request received:", {
      teamId,
      timestamp: new Date().toISOString(),
    });

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

    console.log("[Round4 Team] Current state before selection:", {
      currentTeamId: r4.currentTeamId?.toString(),
      currentTurnIndex: r4.turnIndex,
      selectedPackage: r4.selectedPackage,
      currentQuestionId: gameState.currentQuestionId,
      phase: gameState.phase,
    });

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
    
    console.log("[Round4 Team] Team order calculation:", {
      orderedTeamIds,
      totalTeams: orderedTeamIds.length,
      requestedTeamId: teamId,
    });

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

    // turnIndex đại diện cho số team đã HOÀN THÀNH lượt chơi
    // Chỉ các team ở vị trí < turnIndex mới đã hoàn thành
    const currentTurnIndex = r4.turnIndex ?? 0;
    
    // Kiểm tra xem team này có thể được chọn không
    // Team có thể được chọn nếu:
    // - teamIndexInOrder >= currentTurnIndex (chưa thi hoặc đang thi)
    if (teamIndexInOrder < currentTurnIndex) {
      console.log("[Round4 Team] Error: Team đã hoàn thành lượt chơi", {
        requestedTeamId: teamId,
        teamIndexInOrder,
        currentTurnIndex,
        teamsThatHaveCompleted: orderedTeamIds.slice(0, currentTurnIndex),
      });
      return NextResponse.json(
        { error: "Đội này đã hoàn thành lượt chơi, không thể chọn lại" },
        { status: 400 }
      );
    }

    console.log("[Round4 Team] Team selection details:", {
      selectedTeamId: teamId,
      teamIndexInOrder,
      currentTurnIndex,
      previousTeamId: r4.currentTeamId?.toString(),
      note: "turnIndex không thay đổi khi chọn team, chỉ thay đổi khi team hoàn thành 3 câu",
    });

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
    console.log("[Round4 Team] GameState saved after team selection");

    await broadcastGameState();
    console.log("[Round4 Team] GameState broadcasted");

    console.log("[Round4 Team] Team selection completed:", {
      newTeamId: r4.currentTeamId?.toString(),
      turnIndex: r4.turnIndex,
      phase: gameState.phase,
      teamsThatHaveCompleted: (r4.turnIndex ?? 0) > 0 ? orderedTeamIds.slice(0, r4.turnIndex ?? 0) : [],
      note: "turnIndex = số team đã hoàn thành lượt chơi, không thay đổi khi chọn team",
    });

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


