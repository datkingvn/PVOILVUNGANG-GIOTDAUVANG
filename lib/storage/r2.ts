import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  throw new Error("Missing Cloudflare R2 environment variables");
}

// Create S3 client compatible with R2
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a file buffer to R2
 */
export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string = "image/jpeg"
): Promise<UploadResult> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await r2Client.send(command);

  // Construct public URL
  const url = publicUrl
    ? `${publicUrl}/${key}`
    : `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${key}`;

  return { url, key };
}

/**
 * Generate a unique key for an image file
 */
export function generateImageKey(packageId: string, suffix: string): string {
  const timestamp = Date.now();
  return `round2/${packageId}/${timestamp}-${suffix}`;
}

export default r2Client;

