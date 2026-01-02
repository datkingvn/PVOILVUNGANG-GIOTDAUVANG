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

    const questions = await Question.find(query).sort({ index: 1 });
    return NextResponse.json(questions);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: error.message?.includes("Chưa đăng nhập") ? 401 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const body = await request.json();
    const { text, packageId, index, round } = createQuestionSchema.parse(body);

    // Verify package exists and round matches
    const pkg = await Package.findById(packageId);
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
    const existing = await Question.findOne({ packageId, index });
    if (existing) {
      return NextResponse.json(
        { error: `Câu hỏi số ${index} đã tồn tại trong gói này` },
        { status: 400 }
      );
    }

    const question = await Question.create({
      text,
      packageId,
      index,
      round,
    });

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
        { error: `Câu hỏi số ${index} đã tồn tại trong gói này` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

