import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Team from "@/lib/db/models/Team";
import bcrypt from "bcryptjs";
import { requireMC } from "@/lib/auth/middleware";
import { createTeamSchema, updateTeamSchema } from "@/lib/utils/validation";

export async function GET() {
  try {
    await requireMC();
    await connectDB();

    const teams = await Team.find().sort({ orderIndex: 1, createdAt: 1 });
    return NextResponse.json(teams);
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
    const { name, password } = createTeamSchema.parse(body);

    const existingTeam = await Team.findOne({ name });
    if (existingTeam) {
      return NextResponse.json(
        { error: "Tên đội đã tồn tại" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const team = await Team.create({
      name,
      passwordHash,
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    if (error.code === 11000) {
      return NextResponse.json(
        { error: "Tên đội đã tồn tại" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

