import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Package from "@/lib/db/models/Package";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const round = searchParams.get("round");

    const query: any = {};
    if (round) query.round = round;

    const packages = await Package.find(query).sort({ number: 1 });
    // Convert to plain objects and ensure revealedPieces Map is properly serialized
    const packagesObj = packages.map(pkg => pkg.toObject({ flattenMaps: true }));
    return NextResponse.json(packagesObj);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

