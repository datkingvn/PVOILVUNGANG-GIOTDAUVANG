import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Question from "@/lib/db/models/Question";

export async function GET(request: NextRequest) {
  try {
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
      { status: 500 }
    );
  }
}

