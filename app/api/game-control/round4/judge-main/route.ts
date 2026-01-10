import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import { advanceRound4QuestionOrTeam, getRound4QuestionDuration } from "@/lib/utils/round4-engine";
import type { TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { isCorrect } = body as { isCorrect?: boolean };

    console.log("[Round4 Star] Judge main request received:", {
      isCorrect,
      timestamp: new Date().toISOString(),
    });

    if (typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "Thiếu isCorrect (true/false)" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState || gameState.round !== "ROUND4" || !gameState.round4State) {
      console.log("[Round4 Star] Error: Round 4 chưa được khởi tạo");
      return NextResponse.json(
        { error: "Round 4 chưa được khởi tạo" },
        { status: 400 }
      );
    }

    const r4 = gameState.round4State;
    
    // Cho phép MC chấm trong các trường hợp:
    // 1. R4_STAR_CONFIRMATION: đang chờ đội xác nhận ngôi sao - MC có thể skip và chấm luôn
    // 2. R4_QUESTION_SHOW: đang hiển thị câu hỏi (có thể timer đang chạy hoặc đã hết)
    // 3. R4_QUESTION_LOCK_MAIN: đã khóa đáp án đội đang thi
    // 4. R4_JUDGE_MAIN: đang trong quá trình chấm
    // => auto khóa đồng hồ và chuyển sang phase chấm nếu cần
    const initialPhase = gameState.phase;
    if (gameState.phase === "R4_STAR_CONFIRMATION") {
      // MC có thể skip bước xác nhận ngôi sao và chấm luôn
      // Khởi động timer nếu chưa có (coi như đội đã xác nhận không dùng ngôi sao)
      if (!gameState.questionTimer && r4 && r4.currentQuestionIndex !== undefined && r4.questions) {
        const qRef = r4.questions[r4.currentQuestionIndex];
        if (!qRef) {
          console.error("[Round4 Star] Error: Question not found at index:", r4.currentQuestionIndex);
          return NextResponse.json(
            { error: `Không tìm thấy câu hỏi tại vị trí ${r4.currentQuestionIndex}` },
            { status: 400 }
          );
        }
        const duration = getRound4QuestionDuration(qRef.points);
        const now = Date.now();
        gameState.questionTimer = {
          endsAt: now + duration,
          running: true,
        };
      } else if (!r4 || r4.currentQuestionIndex === undefined || !r4.questions) {
        console.error("[Round4 Star] Error: Missing required data for judgment:", {
          hasR4: !!r4,
          currentQuestionIndex: r4?.currentQuestionIndex,
          hasQuestions: !!r4?.questions,
          questionsLength: r4?.questions?.length,
        });
        return NextResponse.json(
          { error: "Không thể chấm: thiếu thông tin câu hỏi hiện tại" },
          { status: 400 }
        );
      }
      // Khóa timer và chuyển sang phase chấm
      if (gameState.questionTimer) {
        gameState.questionTimer.running = false;
      }
      gameState.phase = "R4_JUDGE_MAIN";
    } else if (gameState.phase === "R4_QUESTION_SHOW") {
      // Cho phép chấm khi đang hiển thị câu hỏi (timer có thể đã hết hoặc đang chạy)
      if (gameState.questionTimer) {
        gameState.questionTimer.running = false;
      }
      gameState.phase = "R4_JUDGE_MAIN";
    } else if (gameState.phase === "R4_QUESTION_LOCK_MAIN") {
      // Đã khóa đáp án, chuyển sang phase chấm
      gameState.phase = "R4_JUDGE_MAIN";
    } else if (gameState.phase === "R4_JUDGE_MAIN") {
      // Đang trong quá trình chấm, cho phép chấm lại (có thể MC muốn sửa)
      // Không cần thay đổi phase
    } else {
      // Các phase khác không cho phép chấm
      console.log("[Round4 Star] Error: Invalid phase for judgment:", {
        phase: gameState.phase,
      });
      return NextResponse.json(
        { 
          error: `Không thể chấm đáp án đội đang thi ở phase hiện tại: ${gameState.phase}. Chỉ cho phép chấm khi phase là R4_STAR_CONFIRMATION, R4_QUESTION_SHOW, R4_QUESTION_LOCK_MAIN, hoặc R4_JUDGE_MAIN.` 
        },
        { status: 400 }
      );
    }

    if (!r4) {
      console.log("[Round4 Star] Error: round4State is null");
      return NextResponse.json(
        { error: "Round 4 state không hợp lệ" },
        { status: 400 }
      );
    }

    if (
      r4.currentQuestionIndex === undefined ||
      !r4.questions ||
      !r4.questions[r4.currentQuestionIndex]
    ) {
      console.log("[Round4 Star] Error: Không xác định được câu hỏi hiện tại", {
        currentQuestionIndex: r4.currentQuestionIndex,
        questionsLength: r4.questions?.length,
      });
      return NextResponse.json(
        { error: "Không xác định được câu hỏi hiện tại" },
        { status: 400 }
      );
    }

    const mainTeamId = r4.currentTeamId;
    if (!mainTeamId) {
      console.log("[Round4 Star] Error: Không xác định được đội đang thi");
      return NextResponse.json(
        { error: "Không xác định được đội đang thi" },
        { status: 400 }
      );
    }

    const teamIndex = gameState.teams.findIndex(
      (t: TeamScore) => t.teamId === mainTeamId
    );
    if (teamIndex === -1) {
      console.log("[Round4 Star] Error: Không tìm thấy đội đang thi", {
        mainTeamId: mainTeamId?.toString(),
        teamIds: gameState.teams.map((t: TeamScore) => t.teamId.toString()),
      });
      return NextResponse.json(
        { error: "Không tìm thấy đội đang thi" },
        { status: 404 }
      );
    }

    const qRef = r4.questions[r4.currentQuestionIndex];
    const points = qRef.points;

    // Đảm bảo key matching đúng với format trong confirm-star API (teamId.toString())
    const teamKey = mainTeamId?.toString() as string;
    
    // Mongoose Map: sử dụng .get() để đọc giá trị
    let starUsage = null;
    if (r4.starUsages && typeof (r4.starUsages as any).get === 'function') {
      starUsage = (r4.starUsages as any).get(teamKey);
    } else {
      // Fallback cho trường hợp không phải Map
      starUsage = (r4.starUsages as any)?.[teamKey];
    }
    
    const hasStarOnThisQuestion =
      starUsage && starUsage.used && starUsage.questionIndex === r4.currentQuestionIndex;

    // Helper để log starUsages
    const getStarUsagesForLog = () => {
      if (!r4.starUsages) return [];
      if (typeof (r4.starUsages as any).toObject === 'function') {
        const obj = (r4.starUsages as any).toObject();
        return Object.keys(obj).map(key => ({ key, value: obj[key] }));
      }
      if (typeof (r4.starUsages as any).get === 'function') {
        const map = r4.starUsages as any;
        const result: any[] = [];
        for (const key of map.keys()) {
          result.push({ key, value: map.get(key) });
        }
        return result;
      }
      return Object.keys(r4.starUsages || {}).map(key => ({
        key,
        value: (r4.starUsages as any)[key],
      }));
    };

    console.log("[Round4 Star] Star usage check in judge-main:", {
      teamKey,
      mainTeamId: mainTeamId?.toString(),
      currentQuestionIndex: r4.currentQuestionIndex,
      starUsage: starUsage
        ? {
            used: starUsage.used,
            questionIndex: starUsage.questionIndex,
          }
        : null,
      hasStarOnThisQuestion,
      allStarUsages: getStarUsagesForLog(),
    });

    const teamBeforeScore = gameState.teams[teamIndex].score;

    if (isCorrect) {
      // Main đội ĐÚNG
      const base = points;
      const gain = hasStarOnThisQuestion ? base * 2 : base;
      gameState.teams[teamIndex].score += gain;

      // Kết thúc câu, chuyển tiếp
      advanceRound4QuestionOrTeam(gameState as any);
    } else {
      // Main đội SAI
      if (hasStarOnThisQuestion) {
        // Trừ full điểm vì Star, bất kể có steal hay không
        gameState.teams[teamIndex].score -= points;
      }

      // Mở cửa sổ giành quyền 5s
      const now = Date.now();
      r4.stealWindow = {
        active: true,
        endsAt: now + 5000,
        buzzLockedTeamId: undefined,
        buzzedTeams: [],
      };
      gameState.phase = "R4_STEAL_WINDOW";
    }

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Round4 Star] Error in judge-main:", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || "Lỗi chấm đáp án đội đang thi Round 4" },
      { status: 500 }
    );
  }
}


