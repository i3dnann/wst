import { api } from "@/lib/api";

export type MediaCategory =
  | "gang-logo"
  | "gang-banner"
  | "player-avatar"
  | "tournament-banner"
  | "event-image"
  | "event-video"
  | "stream-thumbnail"
  | "website-media"
  | "match-evidence";

export type MediaKind = "image" | "video" | "image-or-video";

const imageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const videoTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  resource_type?: string;
  width?: number;
  height?: number;
  error?: { message?: string };
};

export type CloudinaryMediaResult = {
  secureUrl: string;
  publicId: string;
  resourceType: "image" | "video";
  width?: number;
  height?: number;
};

function recordString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function recordNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function mediaAccept(kind: MediaKind): string {
  if (kind === "image") return "image/png,image/jpeg,image/webp,image/gif";
  if (kind === "video") return "video/mp4,video/webm,video/quicktime";
  return "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
}

export function validateMediaFile(file: File, kind: MediaKind): void {
  const image = imageTypes.has(file.type);
  const video = videoTypes.has(file.type);
  if (!image && !video)
    throw new Error(
      "Choose a PNG, JPG, WebP, GIF, MP4, WebM, or MOV file.",
    );
  if (kind === "image" && !image) throw new Error("Choose an image file.");
  if (kind === "video" && !video) throw new Error("Choose a video file.");
  const maximumBytes = video ? 100 * 1024 * 1024 : 12 * 1024 * 1024;
  if (file.size > maximumBytes)
    throw new Error(
      video
        ? "Videos must be 100 MB or smaller."
        : "Images must be 12 MB or smaller.",
    );
}

export function cloudinaryMediaKindFromUrl(
  url: string,
): "image" | "video" | null {
  if (!url) return null;
  if (url.includes("/video/upload/")) return "video";
  if (url.includes("/image/upload/")) return "image";
  return null;
}

function sendCloudinaryUpload(
  uploadUrl: string,
  form: FormData,
  onProgress: (progress: number) => void,
): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", uploadUrl);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      let result: CloudinaryUploadResponse;
      try {
        result = JSON.parse(request.responseText) as CloudinaryUploadResponse;
      } catch {
        reject(new Error("Cloudinary returned an unreadable response."));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(
          new Error(
            result.error?.message ??
              `Cloudinary upload failed with HTTP ${String(request.status)}.`,
          ),
        );
        return;
      }
      resolve(result);
    });
    request.addEventListener("error", () =>
      reject(new Error("The Cloudinary upload connection failed.")),
    );
    request.send(form);
  });
}

export async function uploadMediaToCloudinary(
  file: File,
  category: MediaCategory,
  kind: MediaKind,
  onProgress: (progress: number) => void = () => undefined,
): Promise<CloudinaryMediaResult> {
  validateMediaFile(file, kind);
  const intent = await api.mediaUploadIntent({
    category,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  });
  const data = intent.data;
  const uploadUrl = recordString(data, "uploadUrl");
  const apiKey = recordString(data, "apiKey");
  const publicId = recordString(data, "publicId");
  const signature = recordString(data, "signature");
  const mediaAssetId = recordString(data, "mediaAssetId");
  const timestamp = recordNumber(data, "timestamp");
  if (
    !uploadUrl ||
    !apiKey ||
    !publicId ||
    !signature ||
    !mediaAssetId ||
    !timestamp
  )
    throw new Error("The API returned an incomplete Cloudinary upload request.");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("public_id", publicId);

  const uploaded = await sendCloudinaryUpload(uploadUrl, form, onProgress);
  const secureUrl = uploaded.secure_url ?? "";
  const uploadedPublicId = uploaded.public_id ?? "";
  const resourceType =
    uploaded.resource_type === "video"
      ? "video"
      : uploaded.resource_type === "image"
        ? "image"
        : null;
  if (!secureUrl || uploadedPublicId !== publicId || !resourceType)
    throw new Error("Cloudinary returned incomplete asset information.");

  await api.completeMediaUpload({
    mediaAssetId,
    publicUrl: secureUrl,
    publicId,
    resourceType,
    width: uploaded.width,
    height: uploaded.height,
  });
  onProgress(100);
  return {
    secureUrl,
    publicId,
    resourceType,
    ...(uploaded.width === undefined ? {} : { width: uploaded.width }),
    ...(uploaded.height === undefined ? {} : { height: uploaded.height }),
  };
}
