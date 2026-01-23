import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Question from "@/lib/db/models/Question";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import { getRound4QuestionDuration } from "@/lib/utils/round4-engine";

export async function POST(request: NextRequest) {
  try {
    const { teamId } = await requireTeam();
    await connectDB();

    const body = await request.json();
    const { useStar } = body as {
      useStar?: boolean;
    };

    console.log("[Round4 Star] Confirm star request received:", {
      teamId: teamId?.toString(),
      useStar,
      timestamp: new Date().toISOString(),
    });

    if (typeof useStar !== "boolean") {
      return NextResponse.json(
        { error: "Thiếu useStar (true/false)" },
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

    // Chỉ đội đang thi mới được xác nhận ngôi sao
    if (r4.currentTeamId !== teamId) {
      console.log("[Round4 Star] Error: Chỉ đội đang thi mới được xác nhận", {
        currentTeamId: r4.currentTeamId?.toString(),
        requestingTeamId: teamId?.toString(),
      });
      return NextResponse.json(
        { error: "Chỉ đội đang thi mới được xác nhận Ngôi sao hy vọng" },
        { status: 403 }
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

    console.log("[Round4 Star] Starting confirmation process:", {
      phase: gameState.phase,
      teamId: teamId?.toString(),
      useStar,
      currentQuestionIndex: r4.currentQuestionIndex,
      questionPoints: r4.questions[r4.currentQuestionIndex]?.points,
    });

    // Cho phép gọi idempotent:
    // - Nếu đang ở phase chờ xác nhận: xử lý bình thường (Có/Không)
    // - Nếu đã chuyển sang R4_QUESTION_SHOW: coi như đã xác nhận, trả về success
    if (gameState.phase === "R4_STAR_CONFIRMATION") {
      const teamKey = teamId?.toString() as string;
      
      // Mongoose Map: sử dụng .get() để đọc giá trị
      let existing = null;
      if (r4.starUsages && typeof (r4.starUsages as any).get === 'function') {
        existing = (r4.starUsages as any).get(teamKey);
      } else {
        // Fallback cho trường hợp không phải Map
        existing = (r4.starUsages as any)?.[teamKey];
      }

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

      console.log("[Round4 Star] Checking existing star usage:", {
        teamKey,
        existing: existing ? { used: existing.used, questionIndex: existing.questionIndex } : null,
        allStarUsages: getStarUsagesForLog(),
      });

      if (useStar) {
        // Đội chọn sử dụng Ngôi sao hy vọng cho câu hỏi hiện tại
        // Kiểm tra xem đội đã dùng ngôi sao ở câu nào chưa (chỉ được dùng 1 lần trong vòng 4)
        if (existing?.used) {
          console.log("[Round4 Star] Error: Đội đã sử dụng Ngôi sao hy vọng", {
            teamKey,
            existingQuestionIndex: existing.questionIndex,
            currentQuestionIndex: r4.currentQuestionIndex,
          });
          return NextResponse.json(
            { error: "Đội đã sử dụng Ngôi sao hy vọng trong Round 4, không thể sử dụng lại" },
            { status: 400 }
          );
        }

        const newStarUsage = {
          used: true,
          questionIndex: r4.currentQuestionIndex,
        };
        
        // Mongoose Map: sử dụng .set() để ghi giá trị
        if (r4.starUsages && typeof (r4.starUsages as any).set === 'function') {
          (r4.starUsages as any).set(teamKey, newStarUsage);
        } else {
          // Fallback cho trường hợp không phải Map
          (r4.starUsages as any)[teamKey] = newStarUsage;
        }

        // Mark modified để đảm bảo Mongoose lưu thay đổi
        gameState.markModified('round4State.starUsages');

        console.log("[Round4 Star] Star usage saved:", {
          teamKey,
          starUsage: newStarUsage,
          starUsagesAfterSave: getStarUsagesForLog(),
        });
      } else {
        // Đội chọn KHÔNG sử dụng Ngôi sao hy vọng cho câu hỏi này
        // Không cần lưu gì cả, chỉ cần chuyển sang phase hiển thị câu hỏi
        // (Mỗi câu sẽ hỏi lại, nên không cần lưu quyết định "không dùng")
        console.log("[Round4 Star] Team chose NOT to use star:", {
          teamKey,
          currentQuestionIndex: r4.currentQuestionIndex,
        });
      }

      // Sau khi xác nhận, chuyển sang phase hiển thị câu hỏi
      // Timer sẽ được start sau khi video kết thúc (nếu có video)
      const qRef = r4.questions[r4.currentQuestionIndex];
      
      // Fetch question data để check xem có video không
      const question = await Question.findById(qRef.questionId);
      const hasVideo = question && question.videoUrl;
      
      // Set server timestamp for video sync when entering R4_QUESTION_SHOW
      if (hasVideo) {
        r4.videoStartedAt = Date.now();
      } else {
        r4.videoStartedAt = undefined;
      }
      gameState.markModified("round4State.videoStartedAt");

      if (!hasVideo) {
        // Nếu không có video, start timer ngay
        const duration = getRound4QuestionDuration(qRef.points);
        const now = Date.now();
        gameState.questionTimer = {
          endsAt: now + duration,
          running: true,
        };
        console.log("[Round4 Star] No video, timer started immediately:", {
          questionPoints: qRef.points,
          duration,
          timerEndsAt: gameState.questionTimer.endsAt,
        });
      } else {
        // Có video, timer sẽ start sau khi video kết thúc
        gameState.questionTimer = undefined;
        console.log("[Round4 Star] Has video, timer will start after video ends");
      }
      
      gameState.phase = "R4_QUESTION_SHOW";

      console.log("[Round4 Star] Phase changed to R4_QUESTION_SHOW:", {
        questionPoints: qRef.points,
        useStar,
        hasVideo,
      });
    } else if (gameState.phase === "R4_QUESTION_SHOW") {
      // Đã xác nhận và câu hỏi đang hiển thị -> coi như thành công, không báo lỗi
      console.log("[Round4 Star] Already confirmed, returning success:", {
        teamId: teamId?.toString(),
        phase: gameState.phase,
      });
      return NextResponse.json({ success: true, alreadyConfirmed: true });
    } else {
      // Các phase khác là không hợp lệ
      console.log("[Round4 Star] Error: Invalid phase for confirmation:", {
        phase: gameState.phase,
        teamId: teamId?.toString(),
      });
      return NextResponse.json(
        {
          error:
            "Không thể xác nhận Ngôi sao hy vọng ở phase hiện tại. Vui lòng báo MC kiểm tra trạng thái vòng chơi.",
        },
        { status: 400 }
      );
    }

    await gameState.save();
    console.log("[Round4 Star] GameState saved successfully");
    
    await broadcastGameState();
    console.log("[Round4 Star] GameState broadcasted");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Round4 Star] Error in confirm-star:", {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || "Lỗi xác nhận Ngôi sao hy vọng" },
      { status: 500 }
    );
  }
}

