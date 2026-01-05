import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Package from "@/lib/db/models/Package";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { countLetters } from "@/lib/utils/round2-engine";

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { packageId, cnvAnswer, horizontalQuestions } = body;

    if (!packageId || !cnvAnswer || !horizontalQuestions || horizontalQuestions.length !== 4) {
      return NextResponse.json(
        { error: "Thiếu thông tin cần thiết hoặc không đủ 4 câu hỏi hàng ngang" },
        { status: 400 }
      );
    }

    const pkg = await Package.findById(packageId);
    if (!pkg || !pkg.round2Meta?.image) {
      return NextResponse.json(
        { error: "Không tìm thấy package hoặc chưa upload ảnh" },
        { status: 404 }
      );
    }

    // Fixed mapping: Hàng ngang 1 → Mảnh 1, Hàng ngang 2 → Mảnh 2, Hàng ngang 3 → Mảnh 3, Hàng ngang 4 → Mảnh 4
    const mapping = [
      { horizontalOrder: 1, pieceIndex: 1 },
      { horizontalOrder: 2, pieceIndex: 2 },
      { horizontalOrder: 3, pieceIndex: 3 },
      { horizontalOrder: 4, pieceIndex: 4 },
    ];

    // Calculate CNV letter count
    const cnvLetterCount = countLetters(cnvAnswer);

    // Update package round2Meta
    if (!pkg.round2Meta) {
      pkg.round2Meta = {} as any;
    }

    pkg.round2Meta.cnvAnswer = cnvAnswer;
    pkg.round2Meta.cnvLetterCount = cnvLetterCount;
    pkg.round2Meta.mapping = mapping;
    pkg.round2Meta.revealedPieces = {};
    pkg.round2Meta.openedClueCount = 0;
    pkg.round2Meta.eliminatedTeamIds = [];
    pkg.round2Meta.turnState = {
      teamsUsedHorizontalAttempt: {},
    };
    pkg.round2Meta.buzzState = {
      keywordBuzzQueue: [],
    };

    // Mark modified to ensure Mongoose saves nested object changes
    pkg.markModified('round2Meta.buzzState');
    pkg.markModified('round2Meta');
    
    await pkg.save({ validateBeforeSave: false });

    // Create or update questions
    // Delete existing questions for this package first
    await Question.deleteMany({ packageId, round: "ROUND2" });

    // Create 4 horizontal questions
    for (let i = 0; i < 4; i++) {
      const hq = horizontalQuestions[i];
      await Question.create({
        packageId,
        round: "ROUND2",
        index: i + 1,
        text: hq.questionText,
        answerText: hq.answerText,
        acceptedAnswers: hq.acceptedAnswers || [],
        type: "horizontal",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error setting up Round 2:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}
