import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import InformationPage from "./InformationPage";

vi.mock("@/lib/website-settings", () => ({
  usePublicWebsiteSettings: () => ({ data: undefined }),
}));

describe("InformationPage artwork", () => {
  afterEach(cleanup);

  it.each([
    ["rules", "Rules of Engagement", "sealed-dossier-red.jpg"],
    ["about", "Built for the official record", "admin-office-red.jpg"],
  ] as const)(
    "uses blue-themed artwork on the %s page",
    (kind, heading, imageName) => {
      render(
        <MemoryRouter>
          <InformationPage kind={kind} />
        </MemoryRouter>,
      );

      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      const media = document.querySelector<HTMLImageElement>(
        ".information-hero__media",
      );
      expect(media).toHaveClass("themed-blue-media");
      expect(media?.src).toContain(imageName);
    },
  );
});
