import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Question from "@/lib/db/models/Question";
import { requireMC } from "@/lib/auth/middleware";
import { uploadToLocal, generateVideoKey } from "@/lib/storage/local";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  try {
    await requireMC();
    await connectDB();

    const { questionId } = await params;

    // Verify question exists and is Round3
    const question = await Question.findById(questionId);
    if (!question) {
      return NextResponse.json(
        { error: "Không tìm thấy câu hỏi" },
        { status: 404 }
      );
    }

    if (question.round !== "ROUND3" && question.round !== "ROUND4") {
      return NextResponse.json(
        { error: "Chỉ có thể upload video cho câu hỏi Round 3 và Round 4" },
        { status: 400 }
      );
    }

    // Chỉ check type cho Round 3
    if (question.round === "ROUND3" && question.type !== "video") {
      return NextResponse.json(
        { error: "Câu hỏi này không phải loại video" },
        { status: 400 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("video") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file video" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file extension
    const fileName = file.name;
    const extension = fileName.split(".").pop() || "mp4";

    // Generate key and upload to local storage
    const key = generateVideoKey(questionId, extension, question.round as "ROUND3" | "ROUND4");
    
    // Detect content type
    const contentType = file.type || `video/${extension}`;

    const uploadResult = await uploadToLocal(buffer, key, contentType);

    // Update question with video URL
    question.videoUrl = uploadResult.url;
    await question.save();

    return NextResponse.json({
      success: true,
      url: uploadResult.url,
    });
  } catch (error: any) {
    console.error("Error uploading video:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi upload video" },
      { status: 500 }
    );
  }
}

