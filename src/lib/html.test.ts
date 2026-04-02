import { describe, expect, it } from "vitest";
import { sanitizeHtml, stripHtml } from "./html";

describe("stripHtml", () => {
  it("strips HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("Swords &amp; Shields")).toBe("Swords & Shields");
    expect(stripHtml("&lt;damage&gt;")).toBe("<damage>");
    expect(stripHtml("&quot;quoted&quot;")).toBe('"quoted"');
    expect(stripHtml("it&#39;s")).toBe("it's");
  });

  it("collapses whitespace and trims", () => {
    expect(stripHtml("  too   many    spaces  ")).toBe("too many spaces");
    expect(stripHtml("<p>First</p>\n<p>Second</p>")).toBe("First Second");
  });

  it("strips anchor tags and keeps link text", () => {
    expect(
      stripHtml(
        'See <a href="https://2e.aonprd.com/Skills.aspx?ID=3">Athletics</a> checks.',
      ),
    ).toBe("See Athletics checks.");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("Just plain text.")).toBe("Just plain text.");
  });
});

describe("sanitizeHtml", () => {
  it("keeps allowed structural tags", () => {
    expect(sanitizeHtml("<p>Hello <strong>world</strong></p>")).toBe(
      "<p>Hello <strong>world</strong></p>",
    );
  });

  it("keeps em, hr, br tags", () => {
    expect(sanitizeHtml("<em>italic</em>")).toBe("<em>italic</em>");
    expect(sanitizeHtml("before<hr />after")).toBe("before<hr />after");
    expect(sanitizeHtml("before<br/>after")).toBe("before<br />after");
  });

  it("keeps list tags", () => {
    expect(sanitizeHtml("<ul><li>one</li><li>two</li></ul>")).toBe(
      "<ul><li>one</li><li>two</li></ul>",
    );
  });

  it("keeps table tags", () => {
    expect(
      sanitizeHtml("<table><thead><tr><th>A</th></tr></thead></table>"),
    ).toBe("<table><thead><tr><th>A</th></tr></thead></table>");
  });

  it("strips attributes from allowed tags", () => {
    expect(sanitizeHtml('<p class="foo">text</p>')).toBe("<p>text</p>");
  });

  it("preserves anchor tags with href and adds target/rel", () => {
    expect(
      sanitizeHtml('<p>See <a href="https://example.com">this link</a>.</p>'),
    ).toBe(
      '<p>See <a href="https://example.com" target="_blank" rel="noopener noreferrer">this link</a>.</p>',
    );
  });

  it("strips anchor tags without href", () => {
    expect(sanitizeHtml("<p><a>no link</a></p>")).toBe("<p>no link</p>");
  });

  it("strips non-href attributes from anchor tags", () => {
    expect(
      sanitizeHtml(
        '<p><a href="https://example.com" onclick="alert(1)" class="foo">link</a></p>',
      ),
    ).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">link</a></p>',
    );
  });

  it("strips unknown tags but keeps content", () => {
    expect(sanitizeHtml("<div><p>content</p></div>")).toBe("<p>content</p>");
    expect(sanitizeHtml("<span>text</span>")).toBe("text");
  });

  it("preserves Benefit/Drawback structure", () => {
    const input =
      "<p><strong>Benefit</strong> You gain a bonus.</p><p><strong>Drawback</strong> You take a penalty.</p>";
    expect(sanitizeHtml(input)).toBe(
      "<p><strong>Benefit</strong> You gain a bonus.</p><p><strong>Drawback</strong> You take a penalty.</p>",
    );
  });
});
