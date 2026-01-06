import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import {
  calculateRound3Score,
  sortAnswersByTimestamp,
  normalizeArrangeAnswer,
} from "@/lib/utils/round3-engine";
import { normalizeAnswer } from "@/lib/utils/round2-engine";
import type { PendingAnswer, Round3AnswerResult, TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    const team = await requireTeam();
    await connectDB();

    const body = await request.json();
    const { answer } = body;

    if (!answer || typeof answer !== "string") {
      return NextResponse.json(
        { error: "Vui lòng nhập đáp án" },
        { status: 400 }
      );
    }

    const gameState = await GameState.findOne();
    if (!gameState || !gameState.activePackageId) {
      return NextResponse.json(
        { error: "Không có game đang active" },
        { status: 400 }
      );
    }

    if (gameState.round !== "ROUND3") {
      return NextResponse.json(
        { error: "Không phải Round 3" },
        { status: 400 }
      );
    }

    if (gameState.phase !== "ROUND3_QUESTION_ACTIVE") {
      return NextResponse.json(
        { error: "Không thể submit đáp án ở phase này" },
        { status: 400 }
      );
    }

    // Check if timer has expired
    const now = Date.now();
    if (
      !gameState.questionTimer ||
      !gameState.questionTimer.running ||
      now > gameState.questionTimer.endsAt
    ) {
      return NextResponse.json(
        { error: "Đã hết thời gian" },
        { status: 400 }
      );
    }

    const teamId = team.teamId?.toString();
    if (!teamId) {
      return NextResponse.json(
        { error: "Không xác định được đội" },
        { status: 400 }
      );
    }

    // Get existing pending answers
    const currentPendingAnswers = gameState.round3State?.pendingAnswers || [];

    // Check if team already submitted an answer
    const alreadySubmitted = currentPendingAnswers.some(
      (pa: PendingAnswer) => pa.teamId === teamId
    );
    if (alreadySubmitted) {
      return NextResponse.json(
        { error: "Đội đã submit đáp án rồi" },
        { status: 400 }
      );
    }

    // Get current question for auto-judging
    const question = await Question.findById(gameState.currentQuestionId);
    if (!question) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi" },
        { status: 404 }
      );
    }

    // Add answer to pending answers array
    const newAnswer: PendingAnswer = {
      teamId,
      answer: answer.trim(),
      submittedAt: now,
    };

    const updatedAnswers = [...currentPendingAnswers, newAnswer];

    // Initialize round3State if not exists
    if (!gameState.round3State) {
      gameState.round3State = {
        currentQuestionIndex: 0,
        pendingAnswers: [],
        questionResults: new Map(),
      };
    }
    // Ensure questionResults is a Map (Mongoose Map)
    if (!gameState.round3State.questionResults) {
      gameState.round3State.questionResults = new Map();
    }
    // Convert to Map if it's an object
    if (!(gameState.round3State.questionResults instanceof Map)) {
      const map = new Map();
      Object.keys(gameState.round3State.questionResults).forEach(key => {
        map.set(key, gameState.round3State.questionResults[key]);
      });
      gameState.round3State.questionResults = map;
    }

    const currentQuestionIndex = gameState.round3State.currentQuestionIndex ?? 0;
    const questionIndexKey = String(currentQuestionIndex); // Mongoose Map only supports string keys
    
    if (!gameState.round3State.questionResults.has(questionIndexKey)) {
      gameState.round3State.questionResults.set(questionIndexKey, []);
    }

    // Auto-judge: Check if answer is correct
    let isCorrect = false;
    const normalizedUserAnswer = normalizeAnswer(answer.trim());

    if (question.type === "arrange") {
      // For arrange questions, compare the order of steps
      // User answer should be in format like "ABCD" or "A B C D"
      const normalizedUser = normalizeArrangeAnswer(answer.trim());
      if (question.answerText) {
        const normalizedCorrect = normalizeArrangeAnswer(question.answerText);
        isCorrect = normalizedUser === normalizedCorrect;
      }
      // Also check acceptedAnswers for arrange
      if (!isCorrect && question.acceptedAnswers && question.acceptedAnswers.length > 0) {
        for (const accepted of question.acceptedAnswers) {
          if (normalizeArrangeAnswer(accepted) === normalizedUser) {
            isCorrect = true;
            break;
          }
        }
      }
    } else {
      // For reasoning and video questions, compare text
      if (question.answerText) {
        const normalizedCorrect = normalizeAnswer(question.answerText);
        isCorrect = normalizedUserAnswer === normalizedCorrect;
      }
      // Check acceptedAnswers
      if (!isCorrect && question.acceptedAnswers && question.acceptedAnswers.length > 0) {
        for (const accepted of question.acceptedAnswers) {
          if (normalizeAnswer(accepted) === normalizedUserAnswer) {
            isCorrect = true;
            break;
          }
        }
      }
    }

    // Add to questionResults immediately (auto-judged)
    let questionResults = gameState.round3State.questionResults.get(questionIndexKey) || [];
    const result: Round3AnswerResult = {
      teamId,
      isCorrect,
      score: 0, // Will be calculated based on submission order
      submissionOrder: 0, // Will be calculated based on submission order
      submittedAt: now,
      judgedAt: now,
      answer: answer.trim(), // Store answer text for display
    };
    questionResults.push(result);
    // Update Map with modified array
    gameState.round3State.questionResults.set(questionIndexKey, questionResults);

    // Calculate scores for all correct answers based on submission order
    const correctResults = questionResults.filter((r: Round3AnswerResult) => r.isCorrect);
    if (correctResults.length > 0) {
      // Sort correct answers by submission time
      const sortedCorrectResults = [...correctResults].sort(
        (a, b) => a.submittedAt - b.submittedAt
      );

      // Store old scores before recalculating
      const oldScores = new Map<string, number>();
      questionResults.forEach((r: Round3AnswerResult) => {
        if (r.isCorrect) {
          oldScores.set(r.teamId, r.score || 0);
        }
      });

      // Update scores and submission order for all correct answers
      sortedCorrectResults.forEach((correctResult, index) => {
        const order = index + 1;
        const score = calculateRound3Score(order);
        const oldScore = oldScores.get(correctResult.teamId) || 0;
        correctResult.submissionOrder = order;
        correctResult.score = score;

        // Update team score: subtract old score, add new score
        const teamIdx = gameState.teams.findIndex(
          (t: TeamScore) => t.teamId === correctResult.teamId
        );
        if (teamIdx !== -1) {
          gameState.teams[teamIdx].score = gameState.teams[teamIdx].score - oldScore + score;
        }
      });
    }
    
    // Update Map with modified questionResults array after score calculation
    gameState.round3State.questionResults.set(questionIndexKey, questionResults);

    // Update pending answers (remove this team's answer since it's already judged)
    gameState.round3State.pendingAnswers = updatedAnswers.filter(
      (pa: PendingAnswer) => pa.teamId !== teamId
    );

    // Check if all teams have submitted
    // Get total number of teams
    const totalTeams = gameState.teams.length;
    const submittedCount = questionResults.length;
    
    // If all teams have submitted, automatically move to results phase
    if (submittedCount >= totalTeams) {
      gameState.phase = "ROUND3_RESULTS";
    }

    // Mark modified for nested objects
    gameState.markModified("round3State");
    gameState.markModified("round3State.questionResults");
    gameState.markModified("teams");

    // Save using Mongoose save() - handles Map correctly
    await gameState.save();

    // Fetch updated state for response and broadcast
    const updatedState = await GameState.findById(gameState._id);

    if (!updatedState) {
      return NextResponse.json(
        { error: "Không thể cập nhật game state" },
        { status: 500 }
      );
    }

    await broadcastGameState();

    // Get the final result for this team (after score calculation)
    const finalResult = questionResults.find((r: Round3AnswerResult) => r.teamId === teamId);

    return NextResponse.json({
      success: true,
      isCorrect,
      score: finalResult?.score || 0,
      submissionOrder: finalResult?.submissionOrder || 0,
      pendingAnswersCount: updatedState?.round3State?.pendingAnswers?.length || 0,
      judgedAnswersCount: questionResults.length,
    });
  } catch (error: any) {
    console.error("Error submitting answer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi submit đáp án" },
      { status: 500 }
    );
  }
}

