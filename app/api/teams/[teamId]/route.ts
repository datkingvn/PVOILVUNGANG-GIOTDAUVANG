import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Team from "@/lib/db/models/Team";
import bcrypt from "bcryptjs";
import { requireMC } from "@/lib/auth/middleware";
import { updateTeamSchema } from "@/lib/utils/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    await requireMC();
    await connectDB();

    const { teamId } = await params;
    const body = await request.json();
    const data = updateTeamSchema.parse(body);

    const team = await Team.findById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Không tìm thấy đội" }, { status: 404 });
    }

    if (data.name) {
      const existingTeam = await Team.findOne({ name: data.name });
      if (existingTeam && existingTeam._id.toString() !== teamId) {
        return NextResponse.json(
          { error: "Tên đội đã tồn tại" },
          { status: 400 }
        );
      }
      team.name = data.name;
    }

    if (data.password) {
      team.passwordHash = await bcrypt.hash(data.password, 10);
    }

    await team.save();

    return NextResponse.json(team);
  } catch (error: any) {
    if (error.name === "ZodError" && error.errors && error.errors.length > 0) {
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    await requireMC();
    await connectDB();

    const { teamId } = await params;

    const team = await Team.findByIdAndDelete(teamId);
    if (!team) {
      return NextResponse.json({ error: "Không tìm thấy đội" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

