import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Question from "@/lib/db/models/Question";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { createQuestionSchema } from "@/lib/utils/validation";

export async function GET(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const round = searchParams.get("round");
    const packageId = searchParams.get("packageId");

    const query: any = {};
    if (round) query.round = round;
    if (packageId) query.packageId = packageId;

    const questions = await Question.find(query).sort({ index: 1 }).lean();
    // Ensure all fields are properly serialized, including optional ones
    const serializedQuestions = questions.map((q: any) => ({
      ...q,
      _id: q._id.toString(),
      packageId: q.packageId.toString(),
      answerText: q.answerText || null,
      acceptedAnswers: q.acceptedAnswers || [],
      arrangeSteps: q.arrangeSteps || [],
      points: q.points ?? null,
    }));
    return NextResponse.json(serializedQuestions);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: error.message?.includes("Chưa đăng nhập") ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let index: number | undefined;
  
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const parsed = createQuestionSchema.parse(body);
    const { text, packageId, round, points } = parsed;
    index = parsed.index;

    // Determine effective packageId:
    // - ROUND1/2/3: dùng đúng packageId được gửi từ client
    // - ROUND4: tự động dùng (hoặc tạo) một Package ẩn cho ROUND4 để thỏa schema,
    //   MC không cần quản lý gói cho vòng này.
    let effectivePackage = null as any;
    if (round === "ROUND4") {
      effectivePackage =
        (await Package.findOne({ round: "ROUND4", number: 1 })) ||
        (await Package.create({
          number: 1,
          round: "ROUND4",
          status: "unassigned",
          currentQuestionIndex: 0,
          questions: [],
          history: [],
        }));
    } else {
      effectivePackage = await Package.findById(packageId);
    }

    const pkg = effectivePackage;
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    if (pkg.round !== round) {
      return NextResponse.json(
        { error: "Vòng của câu hỏi không khớp với vòng của gói" },
        { status: 400 }
      );
    }

    // Check if index already exists (unique index will catch this, but we can provide better error)
    const existing = await Question.findOne({ packageId: pkg._id, index });
    if (existing) {
      return NextResponse.json(
        { error: `Câu hỏi số ${index} đã tồn tại trong gói này` },
        { status: 400 }
      );
    }

    // Prepare question data with Round 3 specific fields
    const questionData: any = {
      text,
      packageId: pkg._id,
      index,
      round,
    };

    // Add Round 3 specific fields if provided
    if (round === "ROUND3") {
      if (body.type) {
        questionData.type = body.type;
      }
      if (body.answerText) {
        questionData.answerText = body.answerText.trim();
      }
      if (body.acceptedAnswers && Array.isArray(body.acceptedAnswers)) {
        questionData.acceptedAnswers = body.acceptedAnswers.filter((a: string) => a.trim());
      }
      if (body.arrangeSteps && Array.isArray(body.arrangeSteps)) {
        questionData.arrangeSteps = body.arrangeSteps;
      }
    }

    // Round 4 specific fields
    if (round === "ROUND4" && points) {
      questionData.points = points;
    }

    const question = await Question.create(questionData);

    // Add question to package
    pkg.questions.push(question._id);
    await pkg.save();

    return NextResponse.json(question, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    if (error.code === 11000) {
      return NextResponse.json(
        { error: `Câu hỏi số ${index ?? "này"} đã tồn tại trong gói này` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

