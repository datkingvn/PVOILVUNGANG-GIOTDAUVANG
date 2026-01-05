import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Package from "@/lib/db/models/Package";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    await connectDB();

    const { packageId } = await params;

    const pkg = await Package.findById(packageId).lean();
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    // Convert _id to string if needed and ensure proper serialization
    const pkgObj = JSON.parse(JSON.stringify(pkg));
    
    // Ensure buzzState exists (for packages created before buzzState was added)
    if (pkgObj.round2Meta && !pkgObj.round2Meta.buzzState) {
      pkgObj.round2Meta.buzzState = {
        keywordBuzzQueue: [],
      };
    }
    
    return NextResponse.json(pkgObj);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Lỗi server" },
      { status: 500 }
    );
  }
}

