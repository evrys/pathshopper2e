// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MultiSelect } from "./MultiSelect";

afterEach(cleanup);

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("MultiSelect", () => {
  it("renders the placeholder when nothing is selected", () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set()}
        onChange={() => {}}
        placeholder="Pick one"
      />,
    );
    expect(screen.getByText("Pick one")).toBeDefined();
  });

  it("shows selected labels as the trigger text", () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set(["a", "c"])}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Alpha, Gamma")).toBeDefined();
  });

  it("opens the dropdown on click", () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set()}
        onChange={() => {}}
      />,
    );
    // dropdown should not be visible initially
    expect(screen.queryByText("Alpha")).toBeNull();

    fireEvent.click(screen.getByRole("button"));

    // all options visible
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("Beta")).toBeDefined();
    expect(screen.getByText("Gamma")).toBeDefined();
  });

  it("calls onChange when an option is toggled", () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set(["a"])}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    // Click "Beta" checkbox
    fireEvent.click(screen.getByText("Beta"));

    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0] as Set<string>;
    expect(arg.has("a")).toBe(true);
    expect(arg.has("b")).toBe(true);
  });

  it("removes an item from selection when toggled off", () => {
    const onChange = vi.fn();
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set(["a", "b"])}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    // Click "Alpha" to deselect
    fireEvent.click(screen.getByText("Alpha"));

    expect(onChange).toHaveBeenCalledOnce();
    const arg = onChange.mock.calls[0][0] as Set<string>;
    expect(arg.has("a")).toBe(false);
    expect(arg.has("b")).toBe(true);
  });

  it("shows ▲ when open and ▼ when closed", () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set()}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("▼")).toBeDefined();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("▲")).toBeDefined();
  });

  it("closes when clicking the trigger again", () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set()}
        onChange={() => {}}
      />,
    );
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);
    expect(screen.getByText("Alpha")).toBeDefined();

    // Clicking the trigger again closes the popover
    fireEvent.click(trigger);

    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("truncates the label when many items are selected", () => {
    render(
      <MultiSelect
        options={OPTIONS}
        selected={new Set(["a", "b", "c"])}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Alpha, Beta (+1 more)")).toBeDefined();
  });
});
