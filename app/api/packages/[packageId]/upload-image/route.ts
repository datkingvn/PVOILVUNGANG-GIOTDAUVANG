import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db/connection";
import Package from "@/lib/db/models/Package";
import { requireMC } from "@/lib/auth/middleware";
import { splitImageInto4Pieces } from "@/lib/utils/image-split";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packageId: string }> }
) {
  try {
    await requireMC();
    await connectDB();

    const { packageId } = await params;

    // Verify package exists and is Round2
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      return NextResponse.json(
        { error: "Không tìm thấy gói câu hỏi" },
        { status: 404 }
      );
    }

    if (pkg.round !== "ROUND2") {
      return NextResponse.json(
        { error: "Chỉ có thể upload ảnh cho gói Round 2" },
        { status: 400 }
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Vui lòng chọn file ảnh" },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Split image into 4 pieces and upload to local storage
    const splitResult = await splitImageInto4Pieces(buffer, packageId);

    // Update package with image data
    // Only set image, other fields will be set during setup
    // Use markModified to skip validation for partial round2Meta
    if (!pkg.round2Meta) {
      pkg.round2Meta = {
        image: splitResult,
        revealedPieces: {},
        openedClueCount: 0,
        eliminatedTeamIds: [],
        turnState: {
          teamsUsedHorizontalAttempt: {},
        },
        buzzState: {
          keywordBuzzQueue: [],
        },
      } as any;
    } else {
      pkg.round2Meta.image = splitResult;
    }
    
    pkg.markModified("round2Meta");
    await pkg.save({ validateBeforeSave: false });

    return NextResponse.json({
      success: true,
      image: splitResult,
    });
  } catch (error: any) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi upload ảnh" },
      { status: 500 }
    );
  }
}

