import { describe, expect, it } from "vitest";
import {
  cloudinaryMediaKindFromUrl,
  mediaAccept,
  validateMediaFile,
} from "./cloudinary";

describe("Cloudinary media helpers", () => {
  it("accepts the supported image and video formats", () => {
    expect(mediaAccept("image")).toContain("image/webp");
    expect(mediaAccept("video")).toContain("video/mp4");
    expect(mediaAccept("image-or-video")).toContain("video/webm");
  });

  it("rejects a video when the field only accepts images", () => {
    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    expect(() => validateMediaFile(file, "image")).toThrow(
      "Choose an image file.",
    );
  });

  it("recognizes Cloudinary image and video delivery URLs", () => {
    expect(
      cloudinaryMediaKindFromUrl(
        "https://res.cloudinary.com/demo/video/upload/v1/clip.mp4",
      ),
    ).toBe("video");
    expect(
      cloudinaryMediaKindFromUrl(
        "https://res.cloudinary.com/demo/image/upload/v1/logo.webp",
      ),
    ).toBe("image");
  });
});
