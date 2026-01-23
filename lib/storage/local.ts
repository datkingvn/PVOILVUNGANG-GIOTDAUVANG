import fs from "fs";
import path from "path";

const uploadsDir = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a file buffer to local storage
 */
export async function uploadToLocal(
  buffer: Buffer,
  key: string,
  contentType: string = "image/jpeg"
): Promise<UploadResult> {
  ensureUploadsDir();

  const filePath = path.join(uploadsDir, key);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, buffer);

  // Return local URL (relative path, served by Express static middleware)
  const url = `/uploads/${key}`;

  return { url, key };
}

/**
 * Generate a unique key for an image file
 */
export function generateImageKey(packageId: string, suffix: string): string {
  const timestamp = Date.now();
  return `round2/${packageId}/${timestamp}-${suffix}`;
}

/**
 * Generate a unique key for a video file
 */
export function generateVideoKey(
  questionId: string,
  extension: string,
  round: "ROUND3" | "ROUND4" = "ROUND3"
): string {
  const timestamp = Date.now();
  const roundFolder = round === "ROUND4" ? "round4" : "round3";
  return `${roundFolder}/questions/${questionId}/${timestamp}-video.${extension}`;
}
