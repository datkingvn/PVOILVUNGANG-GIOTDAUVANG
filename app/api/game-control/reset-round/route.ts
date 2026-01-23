import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import type { Round } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const searchParams = request.nextUrl.searchParams;
    const round = searchParams.get("round") as Round;

    if (!round || !["ROUND1", "ROUND2", "ROUND3", "ROUND4"].includes(round)) {
      return NextResponse.json(
        { error: "Vòng không hợp lệ. Phải là ROUND1, ROUND2, ROUND3 hoặc ROUND4" },
        { status: 400 }
      );
    }

    let gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { error: "Không tìm thấy game state" },
        { status: 404 }
      );
    }

    // Reset packages của vòng đó
    if (round === "ROUND1") {
      await Package.updateMany(
        { round: "ROUND1" },
        {
          $set: {
            status: "unassigned",
            assignedTeamId: null,
            currentQuestionIndex: 0,
            history: [],
          },
        }
      );

      // Clear active state nếu đang ở ROUND1
      if (gameState.round === "ROUND1") {
        gameState.activeTeamId = undefined;
        gameState.activePackageId = undefined;
        gameState.currentQuestionId = undefined;
        gameState.questionTimer = undefined;
        gameState.phase = "IDLE";
      }
    } else if (round === "ROUND2") {
      // Reset Round 2 packages
      const round2Packages = await Package.find({ round: "ROUND2" });
      for (const pkg of round2Packages) {
        if (pkg.round2Meta) {
          pkg.status = "unassigned";
          pkg.assignedTeamId = undefined;
          pkg.currentQuestionIndex = 0;
          pkg.history = [];
          
          // Reset round2Meta game state (keep setup data like image, cnvAnswer, questions, etc.)
          pkg.round2Meta.revealedPieces = new Map();
          pkg.round2Meta.openedClueCount = 0;
          pkg.round2Meta.eliminatedTeamIds = [];
          pkg.round2Meta.turnState = {
            currentTeamId: undefined,
            teamsUsedHorizontalAttempt: {},
          };
          pkg.round2Meta.buzzState = {};
          
          await pkg.save();
        }
      }

      // Reset round2State
      if (gameState.round2State) {
        gameState.round2State = undefined;
      }

      // Clear active state nếu đang ở ROUND2
      if (gameState.round === "ROUND2") {
        gameState.activeTeamId = undefined;
        gameState.activePackageId = undefined;
        gameState.currentQuestionId = undefined;
        gameState.questionTimer = undefined;
        gameState.phase = "IDLE";
      }
    } else if (round === "ROUND3") {
      await Package.updateMany(
        { round: "ROUND3" },
        {
          $set: {
            status: "unassigned",
            assignedTeamId: null,
            currentQuestionIndex: 0,
            history: [],
          },
        }
      );

      // Reset round3State
      if (gameState.round3State) {
        gameState.round3State = {
          currentQuestionIndex: undefined,
          pendingAnswers: [],
          questionResults: {},
        };
      }

      // Clear active state nếu đang ở ROUND3
      if (gameState.round === "ROUND3") {
        gameState.activeTeamId = undefined;
        gameState.activePackageId = undefined;
        gameState.currentQuestionId = undefined;
        gameState.questionTimer = undefined;
        gameState.phase = "IDLE";
      }
    } else if (round === "ROUND4") {
      // Reset round4State
      if (gameState.round4State) {
        gameState.round4State = {
          turnIndex: 0,
          currentTeamId: undefined,
          completedTeamIds: [],
          selectedPackage: undefined,
          questionPattern: undefined,
          currentQuestionIndex: undefined,
          questions: undefined,
          starUsages: {},
          usedQuestionIdsByPoints: {
            10: [],
            20: [],
            30: [],
          },
          lastMainAnswer: undefined,
          stealWindow: undefined,
          stealAnswer: undefined,
        };
        gameState.markModified('round4State');
      }

      // Clear active state nếu đang ở ROUND4
      if (gameState.round === "ROUND4") {
        gameState.activeTeamId = undefined;
        gameState.activePackageId = undefined;
        gameState.currentQuestionId = undefined;
        gameState.questionTimer = undefined;
        gameState.phase = "IDLE";
      }
    }

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true, message: `Đã reset ${round} thành công` });
  } catch (error: any) {
    console.error("Error resetting round:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}
