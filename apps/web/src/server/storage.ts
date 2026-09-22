import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ObjectStorageProvider } from "@aperture/types";

function client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
      secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
    },
  });
}

const bucket = () => process.env.S3_BUCKET ?? "aperture-recordings";

async function ensureBucket(): Promise<void> {
  const s3 = client();
  const name = bucket();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: name }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: name }));
  }
}

export const s3Storage: ObjectStorageProvider = {
  async putObject({ key, body, contentType }) {
    await ensureBucket();
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key };
  },
  async getSignedUrl(key, expiresInSeconds) {
    return getSignedUrl(
      client(),
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: expiresInSeconds },
    );
  },
  async deleteObject(key) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
};
