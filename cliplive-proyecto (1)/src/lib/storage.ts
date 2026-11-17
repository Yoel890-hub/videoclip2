import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto", endpoint: process.env.S3_ENDPOINT,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
});
export const signedDownload = (key: string, filename: string) =>
  getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"` }), { expiresIn: 600 });
