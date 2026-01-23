import sharp from "sharp";
import { uploadToLocal, generateImageKey } from "@/lib/storage/local";

export interface ImagePiece {
  index: 1 | 2 | 3 | 4;
  buffer: Buffer;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SplitResult {
  originalUrl: string;
  pieces: Array<{
    index: 1 | 2 | 3 | 4;
    url: string;
  }>;
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Split an image into 4 pieces in a 2x2 grid
 * Piece 1: top-left
 * Piece 2: top-right
 * Piece 3: bottom-right
 * Piece 4: bottom-left
 */
export async function splitImageInto4Pieces(
  imageBuffer: Buffer,
  packageId: string
): Promise<SplitResult> {
  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Invalid image: missing width or height");
  }

  const width = metadata.width;
  const height = metadata.height;

  // Calculate piece dimensions (handle odd dimensions: remainder goes to right/bottom)
  const pieceWidth1 = Math.floor(width / 2);
  const pieceWidth2 = width - pieceWidth1;
  const pieceHeight1 = Math.floor(height / 2);
  const pieceHeight2 = height - pieceHeight1;

  // Extract 4 pieces
  const pieces: ImagePiece[] = [];

  // Piece 1: top-left
  const piece1 = await sharp(imageBuffer)
    .extract({
      left: 0,
      top: 0,
      width: pieceWidth1,
      height: pieceHeight1,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  pieces.push({
    index: 1,
    buffer: piece1,
    x: 0,
    y: 0,
    width: pieceWidth1,
    height: pieceHeight1,
  });

  // Piece 2: top-right
  const piece2 = await sharp(imageBuffer)
    .extract({
      left: pieceWidth1,
      top: 0,
      width: pieceWidth2,
      height: pieceHeight1,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  pieces.push({
    index: 2,
    buffer: piece2,
    x: pieceWidth1,
    y: 0,
    width: pieceWidth2,
    height: pieceHeight1,
  });

  // Piece 3: bottom-right
  const piece3 = await sharp(imageBuffer)
    .extract({
      left: pieceWidth1,
      top: pieceHeight1,
      width: pieceWidth2,
      height: pieceHeight2,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  pieces.push({
    index: 3,
    buffer: piece3,
    x: pieceWidth1,
    y: pieceHeight1,
    width: pieceWidth2,
    height: pieceHeight2,
  });

  // Piece 4: bottom-left
  const piece4 = await sharp(imageBuffer)
    .extract({
      left: 0,
      top: pieceHeight1,
      width: pieceWidth1,
      height: pieceHeight2,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  pieces.push({
    index: 4,
    buffer: piece4,
    x: 0,
    y: pieceHeight1,
    width: pieceWidth1,
    height: pieceHeight2,
  });

  // Upload original image
  const originalKey = generateImageKey(packageId, "original.jpg");
  const originalResult = await uploadToLocal(imageBuffer, originalKey, "image/jpeg");

  // Upload all pieces
  const pieceUploads = await Promise.all(
    pieces.map(async (piece) => {
      const key = generateImageKey(packageId, `piece-${piece.index}.jpg`);
      const result = await uploadToLocal(piece.buffer, key, "image/jpeg");
      return {
        index: piece.index,
        url: result.url,
      };
    })
  );

  // Sort pieces by index (1, 2, 3, 4)
  pieceUploads.sort((a, b) => a.index - b.index);

  return {
    originalUrl: originalResult.url,
    pieces: pieceUploads,
    dimensions: {
      width,
      height,
    },
  };
}

