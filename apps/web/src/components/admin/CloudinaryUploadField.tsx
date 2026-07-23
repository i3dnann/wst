import { useId, useRef, useState } from "react";
import { Check, CloudUpload, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cloudinaryMediaKindFromUrl,
  mediaAccept,
  uploadMediaToCloudinary,
  type MediaCategory,
  type MediaKind,
} from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

export function CloudinaryUploadField({
  label,
  value,
  onChange,
  category,
  kind = "image",
  required = false,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  category: MediaCategory;
  kind?: MediaKind;
  required?: boolean;
  full?: boolean;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadedType, setUploadedType] = useState<"image" | "video" | null>(
    null,
  );
  const previewType = uploadedType ?? cloudinaryMediaKindFromUrl(value);

  async function upload(file: File) {
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadMediaToCloudinary(
        file,
        category,
        kind,
        setProgress,
      );
      setUploadedType(result.resourceType);
      onChange(result.secureUrl);
      toast.success(
        `${result.resourceType === "video" ? "Video" : "Image"} uploaded to Cloudinary. The URL was added automatically.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Cloudinary upload failed.",
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className={cn("cloudinary-upload-field", full && "full-width")}>
      <span className="cloudinary-upload-field__label">{label}</span>
      <div className="cloudinary-upload-field__controls">
        <input
          aria-label={`${label} Cloudinary URL`}
          type="url"
          value={value}
          required={required}
          disabled={uploading}
          onChange={(event) => {
            setUploadedType(null);
            onChange(event.target.value);
          }}
          placeholder="Paste a media link or upload a file"
        />
        <input
          id={inputId}
          ref={fileInput}
          className="cloudinary-upload-field__file"
          aria-label={`${label} file`}
          type="file"
          accept={mediaAccept(kind)}
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? (
            <>
              <CloudUpload /> {String(progress)}%
            </>
          ) : (
            <>
              <CloudUpload /> Upload file
            </>
          )}
        </Button>
        {value ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Copy ${label} URL`}
              onClick={() => {
                void navigator.clipboard.writeText(value);
                toast.success("Cloudinary URL copied.");
              }}
            >
              <Copy />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remove ${label}`}
              onClick={() => {
                setUploadedType(null);
                onChange("");
              }}
            >
              <Trash2 />
            </Button>
          </>
        ) : null}
      </div>
      <small className="cloudinary-upload-field__status" aria-live="polite">
        {uploading ? (
          <>Uploading securely to Cloudinary… {String(progress)}%</>
        ) : value ? (
          <>
            <Check /> Media link ready
          </>
        ) : kind === "video" ? (
          "MP4, WebM, or MOV · maximum 100 MB"
        ) : kind === "image-or-video" ? (
          "Image or video · images up to 12 MB, videos up to 100 MB"
        ) : (
          "PNG, JPG, WebP, or GIF · maximum 12 MB"
        )}
      </small>
      {value && previewType === "video" ? (
        <video
          className="cloudinary-upload-field__preview"
          src={value}
          controls
          preload="metadata"
        />
      ) : null}
      {value && previewType !== "video" ? (
        <img
          className="cloudinary-upload-field__preview"
          src={value}
          alt={`${label} preview`}
        />
      ) : null}
    </div>
  );
}
