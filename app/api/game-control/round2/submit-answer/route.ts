import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import GameState from "@/lib/db/models/GameState";
import Package from "@/lib/db/models/Package";
import Team from "@/lib/db/models/Team";
import { requireTeam } from "@/lib/auth/middleware";
import { broadcastGameState } from "@/lib/pusher/server";
import type { PendingAnswer } from "@/types/game";

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

    if (gameState.round !== "ROUND2") {
      return NextResponse.json(
        { error: "Không phải Round 2" },
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

    const teamId = team.teamId?.toString();
    if (!teamId) {
      return NextResponse.json(
        { error: "Không xác định được đội" },
        { status: 400 }
      );
    }

    // Check if team is eliminated
    if (pkg.round2Meta.eliminatedTeamIds?.includes(teamId)) {
      return NextResponse.json(
        { error: "Đội đã bị loại" },
        { status: 400 }
      );
    }

    // Determine if this is a horizontal or CNV answer
    const isHorizontal = gameState.phase === "HORIZONTAL_ACTIVE";
    const isCNV = gameState.phase === "CNV_ACTIVE";

    if (!isCNV && !isHorizontal) {
      return NextResponse.json(
        { error: "Không thể submit đáp án ở phase này" },
        { status: 400 }
      );
    }

    // Get existing pending answers
    const currentPendingAnswers = gameState.round2State?.pendingAnswers || [];
    
    // Check if team already submitted an answer
    const alreadySubmitted = currentPendingAnswers.some((pa: PendingAnswer) => pa.teamId === teamId);
    if (alreadySubmitted) {
      return NextResponse.json(
        { error: "Đội đã submit đáp án rồi" },
        { status: 400 }
      );
    }

    // Add answer to pending answers array
    const newAnswer = {
      teamId,
      answer: answer.trim(),
      submittedAt: Date.now(),
    };
    
    // Create new array with the new answer
    const updatedAnswers = [...currentPendingAnswers, newAnswer];
    
    // Preserve existing round2State fields - convert to plain object
    const existingRound2State = gameState.round2State 
      ? (gameState.round2State.toObject ? gameState.round2State.toObject() : { ...gameState.round2State })
      : {};
    
    // Use findOneAndUpdate with $set to ensure the update is applied
    // Only update pendingAnswers, preserve other fields
    const updatedState = await GameState.findOneAndUpdate(
      { _id: gameState._id },
      {
        $set: {
          'round2State': {
            ...existingRound2State,
            pendingAnswers: updatedAnswers,
          }
        }
      },
      { new: true }
    );
    
    if (!updatedState) {
      return NextResponse.json(
        { error: "Không thể cập nhật game state" },
        { status: 500 }
      );
    }

    console.log("After update - round2State:", JSON.stringify(updatedState.round2State, null, 2));
    console.log("Pending answers count:", updatedState.round2State?.pendingAnswers?.length || 0);
    console.log("Pending answers data:", JSON.stringify(updatedState.round2State?.pendingAnswers, null, 2));
    
    await broadcastGameState();

    return NextResponse.json({ 
      success: true,
      pendingAnswersCount: updatedState?.round2State?.pendingAnswers?.length || 0
    });
  } catch (error: any) {
    console.error("Error submitting answer:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi submit đáp án" },
      { status: 500 }
    );
  }
}

