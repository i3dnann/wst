import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./StatusState";

describe("EmptyState", () => {
  it("announces an honest empty result", () => {
    render(<EmptyState title="No gangs found" message="Adjust the filters." />);
    expect(screen.getByRole("status")).toHaveTextContent("No gangs found");
    expect(screen.getByRole("status")).toHaveTextContent("Adjust the filters.");
  });
});
