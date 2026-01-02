import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Team from "@/lib/db/models/Team";
import bcrypt from "bcryptjs";
import { setAuthCookie, getAuthCookie } from "@/lib/auth/cookie";
import { teamLoginSchema } from "@/lib/utils/validation";

export async function GET() {
  try {
    const user = await getAuthCookie();
    if (!user || user.role !== "TEAM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { teamId, password } = teamLoginSchema.parse(body);

    const team = await Team.findById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Đội không tồn tại" }, { status: 404 });
    }

    const isValid = await bcrypt.compare(password, team.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Mật khẩu không đúng" },
        { status: 401 }
      );
    }

    await setAuthCookie({ role: "TEAM", teamId: team._id.toString() });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}
