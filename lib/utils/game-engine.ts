import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import type { QuestionResult, PackageHistory, TeamScore } from "@/types/game";
import { advanceRound4QuestionOrTeam } from "@/lib/utils/round4-engine";

/**
 * Reconcile game state: auto-finalize timeout questions
 * Called on every game action/client fetch to ensure state is up-to-date
 */
export async function reconcileGameState() {
  const gameState = await GameState.findOne();
  if (!gameState) return null;

  const now = Date.now();
  let hasChanges = false;

  // Round 4: auto chuyển phase khi hết giờ câu hỏi hoặc hết cửa sổ steal
  if (gameState.round === "ROUND4" && gameState.round4State) {
    // Hết giờ suy nghĩ của đội đang thi -> khóa đáp án
    if (
      gameState.phase === "R4_QUESTION_SHOW" &&
      gameState.questionTimer &&
      gameState.questionTimer.running &&
      now > gameState.questionTimer.endsAt
    ) {
      gameState.questionTimer.running = false;
      gameState.phase = "R4_QUESTION_LOCK_MAIN";
      hasChanges = true;
    }

    // Hết 5s giành quyền mà không ai lock -> chỉ đóng cửa sổ, KHÔNG tự sang câu
    const r4 = gameState.round4State;
    if (
      gameState.phase === "R4_STEAL_WINDOW" &&
      r4.stealWindow &&
      r4.stealWindow.active &&
      now > r4.stealWindow.endsAt
    ) {
      // Đóng cửa sổ steal, chờ MC quyết định sang câu tiếp theo
      r4.stealWindow.active = false;
      hasChanges = true;
    }
  } else {
    // Round 1-3: logic cũ cho package timer
    if (
      gameState.questionTimer &&
      gameState.questionTimer.running &&
      now > gameState.questionTimer.endsAt
    ) {
      // Package timer expired - finalize all remaining questions as TIMEOUT
      if (gameState.activePackageId) {
        const pkg = await Package.findById(gameState.activePackageId);
        if (pkg && pkg.status === "in_progress") {
          // Get all questions for this package
          const allQuestions = await Question.find({
            packageId: gameState.activePackageId,
          }).sort({ index: 1 });

          // Find questions that haven't been answered yet
          const answeredIndices = new Set(
            pkg.history.map((h: PackageHistory) => h.index)
          );
          const unansweredQuestions = allQuestions.filter(
            (q) => !answeredIndices.has(q.index)
          );

          // Mark all unanswered questions as TIMEOUT
          for (const question of unansweredQuestions) {
            pkg.history.push({
              index: question.index,
              questionId: question._id.toString(),
              result: "TIMEOUT",
              judgedAt: new Date(),
            });
          }

          // Mark package as completed
          pkg.status = "completed";
          pkg.currentQuestionIndex = allQuestions.length;
          await pkg.save();

          // Mark active team as finished
          if (gameState.activeTeamId) {
            const teamIndex = gameState.teams.findIndex(
              (t: TeamScore) => t.teamId === gameState.activeTeamId
            );
            if (teamIndex !== -1) {
              gameState.teams[teamIndex].status = "finished";
            }
          }

          // Clear active question and timer
          gameState.currentQuestionId = undefined;
          gameState.questionTimer = undefined;
          gameState.phase = "IDLE";
          hasChanges = true;
        }
      }
    }
  }

  if (hasChanges) {
    await gameState.save();
  }

  return gameState;
}

/**
 * Finalize a question with a result
 */
export async function finalizeQuestion(
  questionId: string,
  result: QuestionResult,
  judgedBy: string
) {
  const gameState = await GameState.findOne();
  if (!gameState) {
    throw new Error("Không tìm thấy trạng thái game");
  }

  if (!gameState.activePackageId) {
    throw new Error("Không có gói câu hỏi đang active");
  }

  const pkg = await Package.findById(gameState.activePackageId);
  if (!pkg) {
    throw new Error("Không tìm thấy gói câu hỏi");
  }

  const question = await Question.findById(questionId);
  if (!question) {
    throw new Error("Không tìm thấy câu hỏi");
  }

  // Check if question is already answered
  const existingHistory = pkg.history.find(
    (h: PackageHistory) => h.questionId === questionId
  );

  // If already answered as CORRECT or WRONG, prevent re-judging
  if (existingHistory && (existingHistory.result === "CORRECT" || existingHistory.result === "WRONG")) {
    throw new Error("Câu hỏi này đã được chấm rồi, không thể chấm lại");
  }

  // If already answered as TIMEOUT, allow overriding
  const isOverridingTimeout =
    existingHistory?.result === "TIMEOUT" && result !== "TIMEOUT";

  // Add or update history
  if (existingHistory && isOverridingTimeout) {
    existingHistory.result = result;
    existingHistory.judgedBy = judgedBy;
    existingHistory.judgedAt = new Date();
  } else if (!existingHistory) {
    pkg.history.push({
      index: question.index,
      questionId: questionId,
      result,
      judgedBy,
      judgedAt: new Date(),
    });
  }

  // Update score
  if (result === "CORRECT") {
    const teamIndex = gameState.teams.findIndex(
      (t: TeamScore) => t.teamId === gameState.activeTeamId
    );
    if (teamIndex !== -1) {
      gameState.teams[teamIndex].score += 10;
    }
  }

  // Check if package timer has expired
  const now = Date.now();
  const timerExpired =
    gameState.questionTimer &&
    gameState.questionTimer.running &&
    now > gameState.questionTimer.endsAt;

  // If timer expired, finalize all remaining questions
  if (timerExpired) {
    const allQuestions = await Question.find({
      packageId: gameState.activePackageId,
    }).sort({ index: 1 });

    const answeredIndices = new Set(pkg.history.map((h: PackageHistory) => h.index));
    const unansweredQuestions = allQuestions.filter(
      (q) => !answeredIndices.has(q.index)
    );

    for (const q of unansweredQuestions) {
      pkg.history.push({
        index: q.index,
        questionId: q._id.toString(),
        result: "TIMEOUT",
        judgedAt: new Date(),
      });
    }

    pkg.status = "completed";
    pkg.currentQuestionIndex = allQuestions.length;

    // Mark team as finished
    if (gameState.activeTeamId) {
      const teamIndex = gameState.teams.findIndex(
        (t: TeamScore) => t.teamId === gameState.activeTeamId
      );
      if (teamIndex !== -1) {
        gameState.teams[teamIndex].status = "finished";
      }
    }

    // Clear active team and package to require selecting new team for next package
    gameState.currentQuestionId = undefined;
    gameState.questionTimer = undefined;
    gameState.activeTeamId = undefined;
    gameState.activePackageId = undefined;
    gameState.phase = "IDLE";
  } else {
    // Move to next question
    const allQuestions = await Question.find({
      packageId: gameState.activePackageId,
    }).sort({ index: 1 });

    const currentIndex = allQuestions.findIndex(
      (q) => q._id.toString() === questionId
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex < allQuestions.length) {
      const nextQuestion = allQuestions[nextIndex];
      gameState.currentQuestionId = nextQuestion._id.toString();
      pkg.currentQuestionIndex = nextIndex;
    } else {
      // All questions answered
      pkg.status = "completed";
      pkg.currentQuestionIndex = allQuestions.length;
      gameState.currentQuestionId = undefined;
      gameState.questionTimer = undefined;
      gameState.phase = "IDLE";

      // Mark team as finished
      if (gameState.activeTeamId) {
        const teamIndex = gameState.teams.findIndex(
          (t: TeamScore) => t.teamId === gameState.activeTeamId
        );
        if (teamIndex !== -1) {
          gameState.teams[teamIndex].status = "finished";
        }
      }

      // Clear active team and package to require selecting new team for next package
      gameState.activeTeamId = undefined;
      gameState.activePackageId = undefined;
    }
  }

  await pkg.save();
  await gameState.save();

  return gameState;
}

