import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Question from "@/lib/db/models/Question";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { updateQuestionSchema } from "@/lib/utils/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    await connectDB();

    const { questionId } = await params;
    const question = await Question.findById(questionId);

    if (!question) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi" },
        { status: 404 }
      );
    }

    return NextResponse.json(question);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    await requireMC();
    await connectDB();

    const { questionId } = await params;
    const body = await request.json();
    const data = updateQuestionSchema.parse(body);

    const question = await Question.findById(questionId);
    if (!question) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi" },
        { status: 404 }
      );
    }

    // If index is being updated, check for conflicts
    if (data.index !== undefined && data.index !== question.index) {
      const existing = await Question.findOne({
        packageId: question.packageId,
        index: data.index,
      });
      if (existing && existing._id.toString() !== questionId) {
        return NextResponse.json(
          { error: `Câu hỏi số ${data.index} đã tồn tại trong gói này` },
          { status: 400 }
        );
      }
      question.index = data.index;
    }

    if (data.text !== undefined) {
      question.text = data.text;
    }

    await question.save();

    return NextResponse.json(question);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    if (error.code === 11000) {
      const index = data?.index || "này";
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    await requireMC();
    await connectDB();

    const { questionId } = await params;
    const question = await Question.findById(questionId);
    
    if (!question) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi" },
        { status: 404 }
      );
    }

    const packageId = question.packageId;

    // Delete the question
    await Question.findByIdAndDelete(questionId);

    // Remove question from package
    const pkg = await Package.findById(packageId);
    if (pkg) {
      pkg.questions = pkg.questions.filter(
        (id: any) => id.toString() !== questionId
      );
      await pkg.save();
    }

    // Reindex remaining questions
    const remainingQuestions = await Question.find({ packageId }).sort({ index: 1 });
    for (let i = 0; i < remainingQuestions.length; i++) {
      remainingQuestions[i].index = i + 1;
      await remainingQuestions[i].save();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}
