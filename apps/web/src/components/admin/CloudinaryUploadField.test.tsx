import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudinaryUploadField } from "./CloudinaryUploadField";
import { uploadMediaToCloudinary } from "@/lib/cloudinary";

vi.mock("@/lib/cloudinary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cloudinary")>();
  return {
    ...actual,
    uploadMediaToCloudinary: vi.fn(),
  };
});

function TestField() {
  const [value, setValue] = useState("");
  return (
    <CloudinaryUploadField
      label="Gang logo"
      value={value}
      onChange={setValue}
      category="gang-logo"
    />
  );
}

afterEach(cleanup);

describe("CloudinaryUploadField", () => {
  it("keeps manual media links editable", () => {
    render(<TestField />);

    const input = screen.getByLabelText("Gang logo Cloudinary URL");
    fireEvent.change(input, {
      target: { value: "https://cdn.example.com/gang-logo.png" },
    });

    expect(input).toHaveValue("https://cdn.example.com/gang-logo.png");
    expect(screen.getByText("Media link ready")).toBeInTheDocument();
  });

  it("automatically fills the secure Cloudinary URL after upload", async () => {
    vi.mocked(uploadMediaToCloudinary).mockResolvedValue({
      secureUrl:
        "https://res.cloudinary.com/world-star/image/upload/v1/gang-logo.webp",
      publicId: "world-star/gang-logo",
      resourceType: "image",
      width: 1200,
      height: 1200,
    });
    render(<TestField />);

    fireEvent.change(screen.getByLabelText("Gang logo file"), {
      target: {
        files: [new File(["logo"], "logo.webp", { type: "image/webp" })],
      },
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Gang logo Cloudinary URL")).toHaveValue(
        "https://res.cloudinary.com/world-star/image/upload/v1/gang-logo.webp",
      ),
    );
    expect(screen.getByText("Media link ready")).toBeInTheDocument();
  });
});
