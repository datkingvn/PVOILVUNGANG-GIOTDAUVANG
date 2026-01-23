import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/socket/server";
import {
  calculateRound3Score,
} from "@/lib/utils/round3-engine";
import type { PendingAnswer, Round3AnswerResult, TeamScore } from "@/types/game";

function toPlainObject<T>(value: any): T {
  if (value && typeof value.toObject === "function") {
    // Mongoose subdocuments often store fields as getters/non-enumerables;
    // toObject() ensures we keep teamId/isCorrect/submittedAt/etc.
    return value.toObject({
      depopulate: true,
      getters: false,
      virtuals: false,
    }) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function isValidRound3AnswerResult(value: any): value is Round3AnswerResult {
  return (
    value &&
    typeof value.teamId === "string" &&
    value.teamId.length > 0 &&
    typeof value.isCorrect === "boolean" &&
    typeof value.score === "number" &&
    typeof value.submissionOrder === "number" &&
    typeof value.submittedAt === "number" &&
    typeof value.judgedAt === "number"
  );
}

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
    const teamIndex = gameState.teams.findIndex((t: TeamScore) => t.teamId === teamId);
    if (teamIndex === -1) {
      return NextResponse.json(
        { error: "Không tìm thấy đội" },
        { status: 404 }
      );
    }

    // Reload latest state to avoid stale writes during concurrent judging
    // Retry a few times to handle race conditions where previous judge request hasn't saved yet
    let freshGameState = await GameState.findById(gameState._id);
    if (!freshGameState) {
      return NextResponse.json(
        { error: "Không tìm thấy game state" },
        { status: 404 }
      );
    }
    
    // If we're judging a correct answer, retry loading to ensure we have the latest data
    // This handles race conditions where previous judge requests haven't saved yet
    if (isCorrect) {
      const maxRetries = 5;
      const baseDelay = 100; // Start with 100ms delay
      
      for (let retry = 0; retry < maxRetries; retry++) {
        const currentQuestionIndex = freshGameState.round3State?.currentQuestionIndex ?? 0;
        const questionIndexKey = String(currentQuestionIndex);
        
        // Get questionResults using the same logic as below
        let questionResults: Round3AnswerResult[] = [];
        if (freshGameState.round3State?.questionResults instanceof Map) {
          questionResults = freshGameState.round3State.questionResults.get(questionIndexKey) || [];
        } else {
          const resultsObj = freshGameState.round3State?.questionResults as unknown as Record<
            string,
            Round3AnswerResult[]
          >;
          questionResults =
            resultsObj?.[questionIndexKey] ||
            resultsObj?.[String(currentQuestionIndex)] ||
            [];
        }
        
        // Check if we have results for other teams (potential race condition)
        const hasOtherResults = questionResults.some((r: any) => r.teamId !== teamId && r.isCorrect);
        
        if (retry < maxRetries - 1) {
          // If we don't have other results yet, wait and retry
          // Use exponential backoff: 100ms, 200ms, 400ms, 800ms
          const delay = baseDelay * Math.pow(2, retry);
          console.log(`[Round3 Judge] Retry ${retry + 1}/${maxRetries}: Waiting ${delay}ms for other results...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          freshGameState = await GameState.findById(gameState._id);
          if (!freshGameState) {
            console.log(`[Round3 Judge] Failed to reload gameState on retry ${retry + 1}`);
            break;
          }
        } else {
          // Last retry, log what we found
          console.log(`[Round3 Judge] Final retry: Found ${questionResults.length} results, hasOtherResults: ${hasOtherResults}`);
          break;
        }
      }
    }

    // TypeScript safety: the retry loop may break with null
    if (!freshGameState) {
      return NextResponse.json(
        { error: "Không tìm thấy game state" },
        { status: 404 }
      );
    }

    // Get pending answers from the latest state
    const pendingAnswers = freshGameState.round3State?.pendingAnswers || [];
    const teamAnswer = pendingAnswers.find(
      (pa: PendingAnswer) => pa.teamId === teamId
    );

    if (!teamAnswer) {
      return NextResponse.json(
        { error: "Không tìm thấy đáp án của đội này" },
        { status: 404 }
      );
    }

    // Ensure answer exists and is not empty
    if (!teamAnswer.answer || teamAnswer.answer.trim() === "") {
      return NextResponse.json(
        { error: "Đáp án của đội này không hợp lệ" },
        { status: 400 }
      );
    }

    const currentQuestionIndex = freshGameState.round3State?.currentQuestionIndex ?? 0;

    // Initialize questionResults if not exists
    if (!freshGameState.round3State) {
      freshGameState.round3State = {
        currentQuestionIndex,
        pendingAnswers: [],
        questionResults: {},
      };
    }
    if (!freshGameState.round3State.questionResults) {
      freshGameState.round3State.questionResults = {};
    }

    // Handle both Map and object, and convert key to string for Map access
    // MongoDB stores Map keys as strings, so we need to use string keys
    const questionIndexKey = String(currentQuestionIndex);
    let questionResults: Round3AnswerResult[] = [];
    
    if (freshGameState.round3State.questionResults instanceof Map) {
      // Handle Map (MongoDB stores Map keys as strings)
      questionResults = freshGameState.round3State.questionResults.get(questionIndexKey) || [];
      console.log(`[Round3 Judge] questionResults is Map, key: ${questionIndexKey}, found: ${questionResults.length} results`);
    } else {
      // Handle object with both string and number keys (for backward compatibility)
      const resultsObj = freshGameState.round3State
        .questionResults as unknown as Record<string, Round3AnswerResult[]>;
      questionResults =
        resultsObj?.[questionIndexKey] ||
        resultsObj?.[String(currentQuestionIndex)] ||
        [];
      console.log(`[Round3 Judge] questionResults is object, key: ${questionIndexKey}, found: ${questionResults.length} results`);
    }

    // Initialize results array for this question if not exists
    if (questionResults.length === 0) {
      questionResults = [];
    }

    // Debug: Log current questionResults to see what's in the database
    console.log(`[Round3 Judge] Current questionResults for question ${currentQuestionIndex} (key: ${questionIndexKey}):`, 
      JSON.stringify(questionResults, null, 2));

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

    // Create result (do not push to questionResults until after recalculation)
    const result: Round3AnswerResult = {
      teamId,
      isCorrect,
      score: 0, // Will be calculated based on current correct answers
      submissionOrder: 0, // Will be calculated based on current correct answers
      submittedAt: teamAnswer.submittedAt, // Store original submission time
      judgedAt: Date.now(),
      answer: teamAnswer.answer.trim(), // Store answer text for display (trim to ensure clean data)
    };

    // Compute next results and deterministically recalculate all correct scores for this question
    // Create a deep copy to avoid mutating the original array
    // questionResults is already an array from the access logic above
    const previousQuestionResultsRaw = questionResults.map((r: any) =>
      toPlainObject<Round3AnswerResult>(r)
    );
    const previousQuestionResults = previousQuestionResultsRaw.filter(
      isValidRound3AnswerResult
    );
    const droppedPrev = previousQuestionResultsRaw.length - previousQuestionResults.length;
    if (droppedPrev > 0) {
      console.warn(
        `[Round3 Judge] Dropped ${droppedPrev} invalid previous result(s) before scoring`
      );
    }
    const nextQuestionResults: Round3AnswerResult[] = [...previousQuestionResults, result];

    // Old (previously saved) per-team score for this question
    // Only include teams with correct answers (isCorrect = true)
    const oldScoresByTeam = new Map<string, number>();
    previousQuestionResults.forEach((r) => {
      if (r.isCorrect) {
        // Get the score that was actually saved in the database
        const savedScore = r.score || 0;
        oldScoresByTeam.set(r.teamId, savedScore);
        console.log(`[Round3 Judge] Found previous correct answer for team ${r.teamId} with score ${savedScore}`);
      }
    });
    
    console.log(`[Round3 Judge] Previous questionResults count: ${previousQuestionResults.length}`);
    console.log(`[Round3 Judge] Previous correct answers:`, previousQuestionResults.filter(r => r.isCorrect).map(r => ({ teamId: r.teamId, score: r.score })));

    // Recalculate per-team score/order among correct answers
    // Only process teams with correct answers (isCorrect = true)
    const correctResults = nextQuestionResults.filter((r) => r.isCorrect);
    const sortedCorrectResults = [...correctResults].sort((a, b) => {
      // Primary sort: by submission time (earliest first)
      if (a.submittedAt !== b.submittedAt) return a.submittedAt - b.submittedAt;
      // Secondary sort: by judgedAt (earliest judged first) if submittedAt is the same
      return a.judgedAt - b.judgedAt;
    });

    const newScoresByTeam = new Map<string, { score: number; order: number }>();
    sortedCorrectResults.forEach((r, index) => {
      const order = index + 1;
      const score = calculateRound3Score(order);
      newScoresByTeam.set(r.teamId, { score, order });
      console.log(`[Round3 Judge] Team ${r.teamId} - Order: ${order}, Score: ${score}, SubmittedAt: ${r.submittedAt}, JudgedAt: ${r.judgedAt}`);
    });

    // Apply recalculated values back onto all results for saving
    nextQuestionResults.forEach((r) => {
      if (!r.isCorrect) {
        r.score = 0;
        r.submissionOrder = 0;
        return;
      }
      const next = newScoresByTeam.get(r.teamId);
      r.score = next?.score ?? 0;
      r.submissionOrder = next?.order ?? 0;
    });

    // Validate results before saving (avoid persisting corrupted objects like {score:0})
    const nextQuestionResultsValidated = nextQuestionResults.filter(isValidRound3AnswerResult);
    const droppedNext = nextQuestionResults.length - nextQuestionResultsValidated.length;
    if (droppedNext > 0) {
      console.warn(
        `[Round3 Judge] Dropped ${droppedNext} invalid next result(s) before saving`
      );
    }

    // Update team total scores by removing old per-question score and applying new per-question score
    // Only update scores for teams with correct answers (isCorrect = true)
    const affectedTeamIds = new Set<string>([
      ...oldScoresByTeam.keys(), // Teams that previously had correct answers
      ...newScoresByTeam.keys(), // Teams that currently have correct answers
    ]);
    
    // Debug logging
    console.log(`[Round3 Judge] Judging team ${teamId}, isCorrect: ${isCorrect}`);
    console.log(`[Round3 Judge] Old scores:`, Object.fromEntries(oldScoresByTeam));
    console.log(`[Round3 Judge] New scores:`, Object.fromEntries(
      Array.from(newScoresByTeam.entries()).map(([tid, data]) => [tid, data.score])
    ));
    
    affectedTeamIds.forEach((tid) => {
      // Only update scores for teams with correct answers
      // oldScoresByTeam only contains teams with isCorrect=true from previous results
      // newScoresByTeam only contains teams with isCorrect=true from current results
      const oldScore = oldScoresByTeam.get(tid) ?? 0;
      const nextScore = newScoresByTeam.get(tid)?.score ?? 0;
      
      // Only update if this team has a correct answer (either old or new)
      if (oldScore > 0 || nextScore > 0) {
        const idx = freshGameState.teams.findIndex((t: TeamScore) => t.teamId === tid);
        if (idx !== -1) {
          const previousScore = freshGameState.teams[idx].score;
          freshGameState.teams[idx].score = previousScore - oldScore + nextScore;
          console.log(`[Round3 Judge] Team ${tid}: ${previousScore} - ${oldScore} + ${nextScore} = ${freshGameState.teams[idx].score}`);
        }
      }
    });

    // Persist nextQuestionResults for this question
    // Ensure questionResults is properly initialized
    if (!freshGameState.round3State.questionResults) {
      // Initialize as Map to match schema definition
      freshGameState.round3State.questionResults = new Map();
    }

    if (freshGameState.round3State.questionResults instanceof Map) {
      // Handle Map (preferred format matching schema)
      freshGameState.round3State.questionResults.set(
        questionIndexKey,
        nextQuestionResultsValidated
      );
      console.log(`[Round3 Judge] Saving questionResults as Map, key: ${questionIndexKey}`);
    } else {
      // Handle object (for backward compatibility)
      if (!freshGameState.round3State.questionResults) {
        freshGameState.round3State.questionResults = {};
      }
      freshGameState.round3State.questionResults[questionIndexKey] = nextQuestionResultsValidated;
      // Also set with number key for compatibility
      freshGameState.round3State.questionResults[currentQuestionIndex] = nextQuestionResultsValidated;
      console.log(`[Round3 Judge] Saving questionResults as object, key: ${questionIndexKey}`);
    }
    
    console.log(`[Round3 Judge] Saving questionResults for question ${currentQuestionIndex} (key: ${questionIndexKey}):`, 
      JSON.stringify(nextQuestionResultsValidated.map(r => ({ teamId: r.teamId, isCorrect: r.isCorrect, score: r.score })), null, 2));

    // Update pending answers
    freshGameState.round3State.pendingAnswers = remainingAnswers;

    // Check if all answers have been judged
    if (remainingAnswers.length === 0) {
      // All answers judged - move to results phase (ready for next question)
      freshGameState.phase = "ROUND3_RESULTS";
    } else {
      // Still have answers to judge - stay in judging phase
      freshGameState.phase = "ROUND3_JUDGING";
    }

    // Mark modified for nested objects
    freshGameState.markModified("round3State");
    freshGameState.markModified("round3State.questionResults");
    freshGameState.markModified("teams");

    await freshGameState.save();

    await broadcastGameState();

    return NextResponse.json({
      success: true,
      remainingAnswersCount: remainingAnswers.length,
    });
  } catch (error: any) {
    console.error("Error judging answer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi chấm đáp án" },
      { status: 500 }
    );
  }
}

