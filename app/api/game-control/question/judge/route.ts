import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import { requireMC } from "@/lib/auth/middleware";
import { finalizeQuestion } from "@/lib/utils/game-engine";
import { broadcastGameState } from "@/lib/pusher/server";
import { getAuthCookie } from "@/lib/auth/cookie";

export async function POST(request: NextRequest) {
  try {
    const user = await requireMC();
    await connectDB();

    const body = await request.json();
    const { questionId, result } = body;

    if (!questionId || !result) {
      return NextResponse.json(
        { error: "Thiếu thông tin câu hỏi hoặc kết quả" },
        { status: 400 }
      );
    }

    if (!["CORRECT", "WRONG"].includes(result)) {
      return NextResponse.json(
        { error: "Kết quả không hợp lệ" },
        { status: 400 }
      );
    }

    const authUser = await getAuthCookie();
    const judgedBy = authUser?.userId || "unknown";

    await finalizeQuestion(questionId, result, judgedBy);
    await broadcastGameState();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

