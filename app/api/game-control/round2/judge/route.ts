import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import {
  calculateCNVScore,
  suggestAnswerMatch,
  getNextTeam,
  checkRound2Complete,
} from "@/lib/utils/round2-engine";
import type { PendingAnswer, TeamScore, PackageHistory, Round2Mapping } from "@/types/game";

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

    if (gameState.round !== "ROUND2") {
      return NextResponse.json(
        { error: "Không phải Round 2" },
        { status: 400 }
      );
    }

    const isHorizontal = gameState.phase === "HORIZONTAL_ACTIVE" || gameState.phase === "HORIZONTAL_JUDGING";
    const isCNV = gameState.phase === "CNV_ACTIVE" || gameState.phase === "CNV_JUDGING";
    const isKeywordBuzz = gameState.phase === "KEYWORD_BUZZ_JUDGING";

    if (!isHorizontal && !isCNV && !isKeywordBuzz) {
      return NextResponse.json(
        { error: "Không thể chấm ở phase này" },
        { status: 400 }
      );
    }

    const pkg = await Package.findById(gameState.activePackageId);
    if (!pkg || !pkg.round2Meta) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    // For keyword buzz, we don't need pendingAnswers - MC will enter the answer
    // For horizontal/CNV, we need to find the pending answer
    const pendingAnswers = gameState.round2State?.pendingAnswers || [];
    let pendingAnswer: { teamId: string; answer: string; submittedAt: number } | null = null;
    
    if (!isKeywordBuzz) {
      const teamAnswerIndex = pendingAnswers.findIndex((pa: PendingAnswer) => pa.teamId === teamId);
      
      if (teamAnswerIndex === -1) {
        return NextResponse.json(
          { error: "Không tìm thấy đáp án của đội này" },
          { status: 404 }
        );
      }

      pendingAnswer = pendingAnswers[teamAnswerIndex];
    }

    // Find team in gameState
    const teamIndex = gameState.teams.findIndex((t: TeamScore) => t.teamId === teamId);
    if (teamIndex === -1) {
      return NextResponse.json(
        { error: "Không tìm thấy đội" },
        { status: 404 }
      );
    }

    if (isHorizontal) {
      // Judge horizontal question
      const currentHorizontalOrder = gameState.round2State?.currentHorizontalOrder;
      if (!currentHorizontalOrder || !gameState.currentQuestionId) {
        return NextResponse.json(
          { error: "Thiếu thông tin câu hỏi hàng ngang" },
          { status: 400 }
        );
      }

      const question = await Question.findById(gameState.currentQuestionId);
      if (!question) {
        return NextResponse.json(
          { error: "Không tìm thấy câu hỏi" },
          { status: 404 }
        );
      }

      if (!pendingAnswer) {
        return NextResponse.json(
          { error: "Không tìm thấy đáp án của đội" },
          { status: 404 }
        );
      }

      // Get suggestion (for reference, MC already decided)
      const suggestion = suggestAnswerMatch(
        pendingAnswer.answer,
        question.answerText || "",
        question.acceptedAnswers
      );

      if (isCorrect) {
        // Correct: +10 points
        gameState.teams[teamIndex].score += 10;

        // Mark team used horizontal attempt
        if (!pkg.round2Meta.turnState) {
          pkg.round2Meta.turnState = {
            teamsUsedHorizontalAttempt: {},
          };
        }
        if (!pkg.round2Meta.turnState.teamsUsedHorizontalAttempt) {
          pkg.round2Meta.turnState.teamsUsedHorizontalAttempt = {};
        }
        pkg.round2Meta.turnState.teamsUsedHorizontalAttempt[teamId] = true;

        // Add to history
        pkg.history.push({
          index: question.index,
          questionId: question._id.toString(),
          result: "CORRECT",
          judgedAt: new Date(),
        });

        // Don't reveal piece yet - wait until all answers are judged
      } else {
        // Wrong: 0 points, no piece reveal
        pkg.history.push({
          index: question.index,
          questionId: question._id.toString(),
          result: "WRONG",
          judgedAt: new Date(),
        });

        // Mark team used horizontal attempt anyway
        if (!pkg.round2Meta.turnState) {
          pkg.round2Meta.turnState = {
            teamsUsedHorizontalAttempt: {},
          };
        }
        if (!pkg.round2Meta.turnState.teamsUsedHorizontalAttempt) {
          pkg.round2Meta.turnState.teamsUsedHorizontalAttempt = {};
        }
        pkg.round2Meta.turnState.teamsUsedHorizontalAttempt[teamId] = true;
      }

      // Remove this team's answer from pending answers
      const remainingAnswers = pendingAnswers.filter((pa: PendingAnswer) => pa.teamId !== teamId);
      
      // Always keep other teams' answers for MC to judge
      // Only remove the current team's answer
      if (!gameState.round2State) {
        gameState.round2State = {};
      }
      gameState.round2State.pendingAnswers = remainingAnswers;
      gameState.markModified('round2State');
      gameState.markModified('round2State.pendingAnswers');
      
      // Only change phase when ALL answers are judged
      if (remainingAnswers.length === 0) {
        // All answers have been judged - check history to see if any team answered correctly
        const questionHistoryEntries = pkg.history.filter(
          (h: PackageHistory) => h.questionId === question._id.toString()
        );
        const hasCorrectAnswer = questionHistoryEntries.some((h: PackageHistory) => h.result === "CORRECT");
        
        if (hasCorrectAnswer) {
          // If at least one answer was correct, reveal piece and move to REVEAL_PIECE phase
          const mapping = pkg.round2Meta.mapping.find(
            (m: Round2Mapping) => m.horizontalOrder === currentHorizontalOrder
          );
          
          if (mapping) {
            // Reveal piece
            if (!pkg.round2Meta.revealedPieces) {
              pkg.round2Meta.revealedPieces = new Map();
            }
            // Handle both Map and object types
            if (pkg.round2Meta.revealedPieces instanceof Map) {
              pkg.round2Meta.revealedPieces.set(mapping.pieceIndex.toString(), true);
            } else {
              // If it's an object, convert to Map first
              const existingMap = new Map();
              Object.keys(pkg.round2Meta.revealedPieces || {}).forEach(key => {
                existingMap.set(key, pkg.round2Meta.revealedPieces[key]);
              });
              existingMap.set(mapping.pieceIndex.toString(), true);
              pkg.round2Meta.revealedPieces = existingMap;
            }
            pkg.round2Meta.openedClueCount = (pkg.round2Meta.openedClueCount || 0) + 1;
            pkg.markModified('round2Meta.revealedPieces');
          }
          
          gameState.phase = "REVEAL_PIECE";
          gameState.currentQuestionId = undefined;
          gameState.round2State.currentHorizontalOrder = undefined;
        } else {
          // If no correct answers, go back to turn select (no piece revealed)
          gameState.phase = "TURN_SELECT";
          gameState.currentQuestionId = undefined;
          gameState.round2State.currentHorizontalOrder = undefined;
        }
      } else {
        // If there are still answers to judge, stay in current phase (HORIZONTAL_ACTIVE or HORIZONTAL_JUDGING)
        // MC can continue judging other teams
        // Piece will only be revealed after all answers are judged
      }

      // No need to check for final piece reveal - all 4 pieces are mapped to 4 questions
    } else if (isCNV) {
      // Judge CNV answer
      if (isCorrect) {
        // Correct: award points based on openedClueCount, end round
        const score = calculateCNVScore(pkg.round2Meta.openedClueCount || 0);
        gameState.teams[teamIndex].score += score;

        // Round 2 ends - remove all pending answers
        if (!gameState.round2State) {
          gameState.round2State = {};
        }
        gameState.round2State.pendingAnswers = [];
        gameState.markModified('round2State');
        gameState.phase = "ROUND_END";
        pkg.status = "completed";
        pkg.round2Meta.buzzState = {};
      } else {
        // Wrong: eliminate team
        if (!pkg.round2Meta.eliminatedTeamIds) {
          pkg.round2Meta.eliminatedTeamIds = [];
        }
        pkg.round2Meta.eliminatedTeamIds.push(teamId);
        gameState.teams[teamIndex].status = "finished";

        // Remove this team's answer from pending answers
        const remainingAnswers = pendingAnswers.filter((pa: PendingAnswer) => pa.teamId !== teamId);
        if (!gameState.round2State) {
          gameState.round2State = {};
        }
        gameState.round2State.pendingAnswers = remainingAnswers;
        gameState.markModified('round2State');
        gameState.markModified('round2State.pendingAnswers');

        // Check if all teams eliminated
        if (checkRound2Complete(gameState.teams, pkg.round2Meta.eliminatedTeamIds)) {
          gameState.phase = "ROUND_END";
          pkg.status = "completed";
          gameState.round2State.pendingAnswers = [];
          pkg.round2Meta.buzzState = {};
        } else if (remainingAnswers.length === 0) {
          // No more answers, go back to turn select
          gameState.phase = "TURN_SELECT";
          pkg.round2Meta.buzzState = {};
        }
        // If there are still answers, stay in CNV_ACTIVE for MC to judge others
      }
    } else if (isKeywordBuzz) {
      // Judge keyword buzz answer (dự đoán từ khóa)
      const keywordBuzzQueue = pkg.round2Meta.buzzState?.keywordBuzzQueue || [];
      const currentIndex = pkg.round2Meta.buzzState?.currentKeywordBuzzIndex ?? 0;

      // Verify this is the correct team being judged
      if (currentIndex >= keywordBuzzQueue.length || keywordBuzzQueue[currentIndex].teamId !== teamId) {
        return NextResponse.json(
          { error: "Không phải lượt chấm của đội này" },
          { status: 400 }
        );
      }

      if (isCorrect) {
        // Correct: award points based on openedClueCount, end round
        const score = calculateCNVScore(pkg.round2Meta.openedClueCount || 0);
        gameState.teams[teamIndex].score += score;

        // Set winner team ID for completion message
        if (!pkg.round2Meta.buzzState) {
          pkg.round2Meta.buzzState = {};
        }
        pkg.round2Meta.buzzState.keywordWinnerTeamId = teamId;

        // Round 2 ends - remove all pending answers
        if (!gameState.round2State) {
          gameState.round2State = {};
        }
        gameState.round2State.pendingAnswers = [];
        gameState.markModified('round2State');
        gameState.phase = "ROUND_END";
        pkg.status = "completed";
        
        // Clear buzz state but keep winner info for message
        pkg.round2Meta.buzzState = {
          keywordWinnerTeamId: teamId,
        };
        
        // Mark modified to ensure Mongoose saves nested object changes
        pkg.markModified('round2Meta.buzzState');
        pkg.markModified('round2Meta');
      } else {
        // Wrong: eliminate team
        if (!pkg.round2Meta.eliminatedTeamIds) {
          pkg.round2Meta.eliminatedTeamIds = [];
        }
        if (!pkg.round2Meta.eliminatedTeamIds.includes(teamId)) {
          pkg.round2Meta.eliminatedTeamIds.push(teamId);
        }
        gameState.teams[teamIndex].status = "finished";

        // Move to next team in queue
        const nextIndex = currentIndex + 1;
        
        if (nextIndex < keywordBuzzQueue.length) {
          // There are more teams to judge
          pkg.round2Meta.buzzState = pkg.round2Meta.buzzState || {};
          pkg.round2Meta.buzzState.currentKeywordBuzzIndex = nextIndex;
          gameState.activeTeamId = keywordBuzzQueue[nextIndex].teamId;
        } else {
          // No more teams in queue, go back to turn select
          gameState.phase = "TURN_SELECT";
          pkg.round2Meta.buzzState = {
            ...pkg.round2Meta.buzzState,
            currentKeywordBuzzIndex: undefined,
          };
          
          // Check if all teams eliminated
          if (checkRound2Complete(gameState.teams, pkg.round2Meta.eliminatedTeamIds)) {
            gameState.phase = "ROUND_END";
            pkg.status = "completed";
          }
        }
        
        // Mark modified to ensure Mongoose saves nested object changes
        pkg.markModified('round2Meta.buzzState');
        pkg.markModified('round2Meta');
      }
    }

    await pkg.save();
    await gameState.save();
    
    await broadcastGameState();

    return NextResponse.json({
      success: true,
      suggestion: isHorizontal && gameState.currentQuestionId && pendingAnswer
        ? suggestAnswerMatch(
            pendingAnswer.answer,
            (await Question.findById(gameState.currentQuestionId))?.answerText || "",
            (await Question.findById(gameState.currentQuestionId))?.acceptedAnswers
          )
        : undefined,
    });
  } catch (error: any) {
    console.error("Error judging answer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi chấm đáp án" },
      { status: 500 }
    );
  }
}

