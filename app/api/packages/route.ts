import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { createPackageSchema } from "@/lib/utils/validation";

export async function GET(request: NextRequest) {
  try {
    await requireMC();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const round = searchParams.get("round");

    const query: any = {};
    if (round) query.round = round;

    const packages = await Package.find(query).sort({ number: 1 });
    return NextResponse.json(packages);
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
    const { number, round } = createPackageSchema.parse(body);

    // Check if package already exists
    const existing = await Package.findOne({ round, number });
    if (existing) {
      return NextResponse.json(
        { error: `Gói ${number} đã tồn tại trong vòng ${round}` },
        { status: 400 }
      );
    }

    const pkg = await Package.create({
      number,
      round,
      status: "unassigned",
      currentQuestionIndex: 0,
      questions: [],
      history: [],
    });

    return NextResponse.json(pkg, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    if (error.code === 11000) {
      return NextResponse.json(
        { error: `Gói ${number} đã tồn tại trong vòng ${round}` },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

