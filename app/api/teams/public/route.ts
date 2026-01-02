import { NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Team from "@/lib/db/models/Team";

export async function GET() {
  try {
    await connectDB();

    const teams = await Team.find().sort({ orderIndex: 1, createdAt: 1 });
    return NextResponse.json(teams);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

