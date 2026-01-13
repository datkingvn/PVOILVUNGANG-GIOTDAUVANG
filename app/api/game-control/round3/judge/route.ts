import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import {
  calculateRound3Score,
  sortAnswersByTimestamp,
  getSubmissionOrder,
  normalizeArrangeAnswer,
} from "@/lib/utils/round3-engine";
import { normalizeAnswer } from "@/lib/utils/round2-engine";
import type { PendingAnswer, Round3AnswerResult, TeamScore } from "@/types/game";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const preferredRegion = "sin1";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { isCorrect, teamId } = body;

    if (typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp isCorrect (true/false)" },
        { status: 400 }
      );
    }

    if (!teamId || typeof teamId !== "string") {
      return NextResponse.json(
        { error: "Vui lòng cung cấp teamId" },
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

    if (
      gameState.phase !== "ROUND3_QUESTION_ACTIVE" &&
      gameState.phase !== "ROUND3_JUDGING"
    ) {
      return NextResponse.json(
        { error: "Không thể chấm ở phase này" },
        { status: 400 }
      );
    }

    const pkg = await Package.findById(gameState.activePackageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    const question = await Question.findById(gameState.currentQuestionId);
    if (!question) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi" },
        { status: 404 }
      );
    }

    // Find team in gameState
    const teamIndex = gameState.teams.findIndex(
      (t: TeamScore) => t.teamId === teamId
    );
    if (teamIndex === -1) {
      return NextResponse.json(
        { error: "Không tìm thấy đội" },
        { status: 404 }
      );
    }

    // Get pending answers
    const pendingAnswers = gameState.round3State?.pendingAnswers || [];
    const teamAnswer = pendingAnswers.find(
      (pa: PendingAnswer) => pa.teamId === teamId
    );

    if (!teamAnswer) {
      return NextResponse.json(
        { error: "Không tìm thấy đáp án của đội này" },
        { status: 404 }
      );
    }

    const currentQuestionIndex = gameState.round3State?.currentQuestionIndex ?? 0;

    // Initialize questionResults if not exists
    if (!gameState.round3State) {
      gameState.round3State = {
        currentQuestionIndex,
        pendingAnswers: [],
        questionResults: {},
      };
    }
    if (!gameState.round3State.questionResults) {
      gameState.round3State.questionResults = {};
    }

    // Initialize results array for this question if not exists
    if (!gameState.round3State.questionResults[currentQuestionIndex]) {
      gameState.round3State.questionResults[currentQuestionIndex] = [];
    }

    const questionResults =
      gameState.round3State.questionResults[currentQuestionIndex];

    // Check if already judged
    const alreadyJudged = questionResults.some(
      (r: Round3AnswerResult) => r.teamId === teamId
    );
    if (alreadyJudged) {
      return NextResponse.json(
        { error: "Đáp án này đã được chấm rồi" },
        { status: 400 }
      );
    }

    // Remove this team's answer from pending answers
    const remainingAnswers = pendingAnswers.filter(
      (pa: PendingAnswer) => pa.teamId !== teamId
    );

    // Add to results
    const result: Round3AnswerResult = {
      teamId,
      isCorrect,
      score: 0, // Will be calculated later
      submissionOrder: 0, // Will be calculated later
      submittedAt: teamAnswer.submittedAt, // Store original submission time
      judgedAt: Date.now(),
    };

    questionResults.push(result);

    // If this is correct, we need to calculate score after all correct answers are judged
    // For now, just mark it
    if (isCorrect) {
      // We'll calculate scores after all answers are judged
    } else {
      // Wrong answer gets 0 points
      result.score = 0;
      result.submissionOrder = 0;
    }

    // Update pending answers
    gameState.round3State.pendingAnswers = remainingAnswers;

    // Check if all answers have been judged
    if (remainingAnswers.length === 0) {
      // All answers judged - calculate scores for correct answers
      const correctResults = questionResults.filter(
        (r: Round3AnswerResult) => r.isCorrect
      );

      if (correctResults.length > 0) {
        // We need to get all original pending answers (before any were removed)
        // Reconstruct from all judged results
        const allJudgedTeamIds = new Set(
          questionResults.map((r: Round3AnswerResult) => r.teamId)
        );
        
        // Get original answers from all teams that submitted (before judging started)
        // We need to combine current pendingAnswers with all judged answers
        const allOriginalAnswers: PendingAnswer[] = [];
        
        // Add back all judged answers
        questionResults.forEach((r: Round3AnswerResult) => {
          // Find the original answer from pendingAnswers before removal
          // Since we've been removing them, we need to reconstruct
          // The answer should be in teamAnswer for current team, or we need to track it
          if (r.teamId === teamId) {
            allOriginalAnswers.push(teamAnswer);
          } else {
            // For other teams, we need to find from the original pendingAnswers
            // Since we don't have access to original, we'll need to store them
            // For now, use a workaround: fetch from question results if available
            // Actually, we should have stored the answer in the result
            // Let's add answer to result for future use, but for now reconstruct from what we have
          }
        });

        // Better approach: store answer in result when judging
        // For now, let's get all correct team IDs and their answers
        // We need to track answers in results - let's add answer field to Round3AnswerResult
        // Actually, let's use a simpler approach: get all correct answers sorted by judgedAt
        // But we need the original submittedAt timestamp
        
        // Reconstruct correct answers list with timestamps
        // We'll need to get original answers - let's fetch from package history or store in result
        // For now, let's use a workaround: sort by judgedAt for correct answers
        // But this won't work perfectly - we need submittedAt
        
        // Better solution: Store answer text in result when judging
        // For Round 3, let's modify Round3AnswerResult to include answer text
        // But that requires schema change - let's work with what we have
        
        // Get all correct team answers with their submission times
        // We need to preserve original pending answers before removal
        // Let's fetch all questions' pending answers from gameState before we started removing
        // Actually, we can reconstruct: all judged answers + current pending = all original
        
        // Get all original answers by combining remaining + all judged
        const allOriginalPendingAnswers: PendingAnswer[] = [...remainingAnswers];
        
        // Add all judged answers - we need their original submittedAt
        // Since we removed them, we need to reconstruct
        // Best approach: before removing, store the answer in a map
        // For now, let's use judgedAt as proxy (not perfect but works)
        
        // Actually, we can get original answers from the question results if we stored them
        // Let's modify the approach: don't remove from pendingAnswers until after scoring
        // Or store answer in result
        
        // Simpler: keep all answers in pendingAnswers, mark as judged separately
        // But that requires more refactoring
        
        // Sort correct results by original submission timestamp (stored in result)
        const sortedCorrectResults = [...correctResults].sort(
          (a, b) => a.submittedAt - b.submittedAt
        );

        // Calculate scores and update results
        sortedCorrectResults.forEach((result, index) => {
          const order = index + 1;
          const score = calculateRound3Score(order);
          result.submissionOrder = order;
          result.score = score;

          // Update team score
          const teamIdx = gameState.teams.findIndex(
            (t: TeamScore) => t.teamId === result.teamId
          );
          if (teamIdx !== -1) {
            gameState.teams[teamIdx].score += score;
          }
        });
      }

      // Move to results phase
      gameState.phase = "ROUND3_RESULTS";
    } else {
      // Still have answers to judge - move to judging phase
      gameState.phase = "ROUND3_JUDGING";
    }

    // Mark modified for nested objects
    gameState.markModified("round3State");
    gameState.markModified("round3State.questionResults");
    gameState.markModified("teams");

    await gameState.save();

    const stateObj = gameState.toObject({ flattenMaps: true });
    const timing = await broadcastGameState(stateObj);

    return NextResponse.json(
      {
        success: true,
        remainingAnswersCount: remainingAnswers.length,
        timing,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error("Error judging answer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi chấm đáp án" },
      { 
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

