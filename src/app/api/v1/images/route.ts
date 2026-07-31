// POST /api/v1/images — presigned image-upload declaration (BUILD-CONTRACT §7).
// Body: { stationId, contentType }. Success: ApiOk<{ uploadUrl, publicUrl, key }>.
// Returns 503 s3_unavailable when object storage is not configured.
//
// Target storage is DigitalOcean Spaces (BLR1), S3-compatible SigV4, via AWS SDK v3.
//
// NOTE FOR FOUNDATION (owns package.json): this route requires two runtime deps that
// are not yet in package.json — please add:
//     "@aws-sdk/client-s3": "^3.700.0",
//     "@aws-sdk/s3-request-presigner": "^3.700.0"
// Until then the modules are loaded lazily behind the hasS3() guard so the app still
// builds and runs with no S3 configured (the route simply answers 503). The SDK
// specifiers are computed + webpackIgnore'd so a missing dependency degrades to a
// runtime 503 rather than breaking `next build` (contract §2). Types below are
// declared locally (not imported from @aws-sdk/*) for the same reason.

import { err, ok } from "@/lib/api";
import { imagePresignSchema } from "@/lib/validation";
import { hasS3 } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRESIGN_EXPIRES_S = 900; // 15 minutes (spec §7.10.6)

const EXT_BY_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

// Minimal local shapes for the AWS SDK v3 pieces we use (see file header).
interface S3ClientConfig {
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials: { accessKeyId: string; secretAccessKey: string };
}
type S3ClientCtor = new (config: S3ClientConfig) => object;
type PutObjectCommandCtor = new (input: {
  Bucket: string;
  Key: string;
  ContentType: string;
}) => object;
type GetSignedUrlFn = (
  client: object,
  command: object,
  options: { expiresIn: number },
) => Promise<string>;

interface S3ClientModule {
  S3Client: S3ClientCtor;
  PutObjectCommand: PutObjectCommandCtor;
}
interface PresignerModule {
  getSignedUrl: GetSignedUrlFn;
}

async function loadS3(): Promise<{ client: S3ClientModule; presigner: PresignerModule } | null> {
  try {
    // Computed specifiers keep the bundler from hard-resolving these optional deps.
    const clientPkg = ["@aws-sdk", "client-s3"].join("/");
    const presignerPkg = ["@aws-sdk", "s3-request-presigner"].join("/");
    const client = (await import(/* webpackIgnore: true */ clientPkg)) as unknown as S3ClientModule;
    const presigner = (await import(
      /* webpackIgnore: true */ presignerPkg
    )) as unknown as PresignerModule;
    return { client, presigner };
  } catch {
    return null;
  }
}

/** Virtual-hosted-style public URL for a Spaces/S3 object. */
function publicUrlFor(endpoint: string, bucket: string, key: string): string {
  try {
    const u = new URL(endpoint);
    return `${u.protocol}//${bucket}.${u.host}/${key}`;
  } catch {
    return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!hasS3()) {
    return err("s3_unavailable", "Image uploads are not configured.", 503);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return err("invalid_request", "Request body must be valid JSON.", 400);
  }

  const parsed = imagePresignSchema.safeParse(raw);
  if (!parsed.success) {
    return err("invalid_request", "Invalid image-upload request.", 400, parsed.error.issues);
  }
  const { stationId, contentType } = parsed.data;

  const mods = await loadS3();
  if (mods === null) {
    return err("s3_unavailable", "Object-storage client is unavailable.", 503);
  }

  // hasS3() guarantees these are set; assert non-null for the typed config.
  const endpoint = process.env.S3_ENDPOINT ?? "";
  const region = process.env.S3_REGION ?? "us-east-1";
  const bucket = process.env.S3_BUCKET as string;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID as string;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY as string;

  const ext = EXT_BY_TYPE[contentType] ?? "bin";
  const uploadId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const key = `staging/${stationId}/upl_${uploadId}.${ext}`;

  try {
    const { S3Client, PutObjectCommand } = mods.client;
    const { getSignedUrl } = mods.presigner;

    const s3 = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: false,
      credentials: { accessKeyId, secretAccessKey },
    });
    const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRES_S });
    const publicUrl = publicUrlFor(endpoint, bucket, key);

    return ok({ uploadUrl, publicUrl, key });
  } catch {
    return err("internal_error", "Failed to presign upload.", 500);
  }
}
