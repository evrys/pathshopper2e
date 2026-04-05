// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VersionTag } from "./VersionTag";

vi.stubGlobal("__COMMIT_HASH__", "abc1234");

afterEach(cleanup);

describe("VersionTag", () => {
  it("renders the commit hash", () => {
    render(<VersionTag />);
    expect(screen.getByText("abc1234")).toBeDefined();
  });

  it("shows the commit hash in the title attribute", () => {
    render(<VersionTag />);
    const el = screen.getByText("abc1234");
    expect(el.getAttribute("title")).toBe("Build abc1234");
  });
});
