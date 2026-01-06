import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import { calculateRound3Score } from "@/lib/utils/round3-engine";
import type { Round3AnswerResult, TeamScore } from "@/types/game";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const gameState = await GameState.findOne();
    if (!gameState) {
      return NextResponse.json(
        { error: "Không tìm thấy game state" },
        { status: 404 }
      );
    }

    if (gameState.round !== "ROUND3") {
      return NextResponse.json(
        { error: "Không phải Round 3" },
        { status: 400 }
      );
    }

    // Ensure all scores are calculated correctly before ending
    // Recalculate Round 3 scores for all questions to ensure accuracy
    if (gameState.round3State?.questionResults) {
      // Store old Round 3 scores to subtract before recalculating
      const oldRound3Scores = new Map<string, number>();
      gameState.teams.forEach((team: TeamScore) => {
        // We need to track Round 3 scores separately
        // For now, we'll recalculate all Round 3 scores and update team scores
        // by subtracting old Round 3 scores and adding new ones
        oldRound3Scores.set(team.teamId, 0); // Initialize to 0, will sum up Round 3 scores
      });

      // First, calculate old Round 3 scores
      const questionResultsMap = gameState.round3State.questionResults;
      const questionIndices = questionResultsMap instanceof Map 
        ? Array.from(questionResultsMap.keys())
        : Object.keys(questionResultsMap);

      for (const questionIndexKey of questionIndices) {
        const questionResults = questionResultsMap instanceof Map
          ? questionResultsMap.get(String(questionIndexKey)) || []
          : questionResultsMap[String(questionIndexKey)] || [];

        questionResults.forEach((result: Round3AnswerResult) => {
          if (result.isCorrect && result.score) {
            const current = oldRound3Scores.get(result.teamId) || 0;
            oldRound3Scores.set(result.teamId, current + result.score);
          }
        });
      }

      // Now recalculate all Round 3 scores
      for (const questionIndexKey of questionIndices) {
        const questionResults = questionResultsMap instanceof Map
          ? questionResultsMap.get(String(questionIndexKey)) || []
          : questionResultsMap[String(questionIndexKey)] || [];

        // Get all correct answers for this question
        const correctResults = questionResults.filter(
          (r: Round3AnswerResult) => r.isCorrect
        );

        if (correctResults.length > 0) {
          // Sort by submission time
          const sortedCorrectResults = [...correctResults].sort(
            (a, b) => a.submittedAt - b.submittedAt
          );

          // Calculate and assign scores
          sortedCorrectResults.forEach((result, index) => {
            const order = index + 1;
            const score = calculateRound3Score(order);
            result.submissionOrder = order;
            result.score = score;
          });

          // Update questionResults with new scores
          if (questionResultsMap instanceof Map) {
            questionResultsMap.set(String(questionIndexKey), questionResults);
          } else {
            questionResultsMap[String(questionIndexKey)] = questionResults;
          }
        }
      }

      // Update team scores: subtract old Round 3 scores, add new Round 3 scores
      const newRound3Scores = new Map<string, number>();
      for (const questionIndexKey of questionIndices) {
        const questionResults = questionResultsMap instanceof Map
          ? questionResultsMap.get(String(questionIndexKey)) || []
          : questionResultsMap[String(questionIndexKey)] || [];

        questionResults.forEach((result: Round3AnswerResult) => {
          if (result.isCorrect && result.score) {
            const current = newRound3Scores.get(result.teamId) || 0;
            newRound3Scores.set(result.teamId, current + result.score);
          }
        });
      }

      // Update team scores
      gameState.teams.forEach((team: TeamScore) => {
        const oldScore = oldRound3Scores.get(team.teamId) || 0;
        const newScore = newRound3Scores.get(team.teamId) || 0;
        team.score = team.score - oldScore + newScore;
      });

      // Mark modified
      gameState.markModified("round3State.questionResults");
      gameState.markModified("teams");
    }

    // Update phase to ROUND3_END
    gameState.phase = "ROUND3_END";
    
    // Stop timer if running
    if (gameState.questionTimer) {
      gameState.questionTimer.running = false;
    }

    // Update package status to completed
    if (gameState.activePackageId) {
      const pkg = await Package.findById(gameState.activePackageId);
      if (pkg) {
        pkg.status = "completed";
        await pkg.save();
      }
    }

    await gameState.save();
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error ending Round 3:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

