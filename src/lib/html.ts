/**
 * Strip HTML tags, Foundry VTT enriched text references, and decode common
 * HTML entities into readable plain text.
 *
 * Foundry patterns handled:
 * - `@UUID[...Item.Name]{Display}` → "Display" (custom display name override)
 * - `@UUID[...Item.Name]` → "Name" (human-readable display name)
 * - `@UUID[...Item.Effect: ...]` → removed (internal effect references)
 * - `@UUID[...]` (no Item segment) → removed
 * - `@Check[type|dc:N|...]` → "DC N type check" (mirrors Foundry's #createSingleCheck)
 * - `@Damage[formula[type]]` → "formula type" (e.g. "1d6 fire")
 * - `@Template[type:shape|distance:N]` → "N-foot shape" (e.g. "10-foot emanation")
 * - `@Embed[...]` → removed (embedded content)
 * - `[[/r formula]]` → "formula" (Foundry inline rolls)
 * - `<span class="action-glyph">X</span>` → action icon (◆, ◆◆, ◆◆◆, ◇, ↺)
 */
export function stripHtml(html: string): string {
  return replaceFoundryRefs(html)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const ALLOWED_TAGS = new Set([
  "p",
  "strong",
  "em",
  "hr",
  "br",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "h2",
  "h3",
]);

/**
 * Sanitize HTML for safe rendering via `dangerouslySetInnerHTML`.
 *
 * Resolves Foundry VTT enriched text patterns to plain text, keeps a
 * curated set of safe structural/formatting tags, and strips everything
 * else (scripts, spans, divs, unknown attributes, etc.).
 */
export function sanitizeHtml(html: string): string {
  return replaceFoundryRefs(html)
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tag: string) => {
      const lower = tag.toLowerCase();
      if (ALLOWED_TAGS.has(lower)) {
        // Self-closing tags
        if (lower === "hr" || lower === "br") return `<${lower} />`;
        // Keep the tag but strip attributes
        const isClosing = match.startsWith("</");
        return isClosing ? `</${lower}>` : `<${lower}>`;
      }
      return "";
    })
    .trim();
}

/** Map Foundry action-glyph codes to Unicode symbols. */
const ACTION_GLYPHS: Record<string, string> = {
  "1": "◆",
  "2": "◆◆",
  "3": "◆◆◆",
  A: "◆",
  a: "◆",
  D: "◆◆◆",
  f: "◇",
  F: "◇",
  r: "↺",
  R: "↺",
};

/** Replace Foundry VTT enriched text patterns (@UUID, @Check, etc.) with plain text. */
function replaceFoundryRefs(html: string): string {
  return html
    .replace(
      /<span class="action-glyph">([^<]*)<\/span>/g,
      (_match, code: string) => ACTION_GLYPHS[code.trim()] ?? code,
    )
    .replace(
      /@UUID\[[^\]]*\.Item\.([^\]]+)\](?:\{([^}]*)\})?/g,
      (_match, name: string, display: string | undefined) => {
        const label = display ?? name;
        return label.startsWith("Effect: ") ? "" : label;
      },
    )
    .replace(/@UUID\[[^\]]*\](?:\{[^}]*\})?/g, "")
    .replace(/@Check\[([^\]]*)\]/g, (_match, inner: string) => {
      const parts = inner.split("|");
      const type = parts[0] ?? "";
      const dcPart = parts.find((p) => p.startsWith("dc:"));
      const dc = dcPart?.slice(3);
      const basic = parts.includes("basic") ? "basic " : "";
      if (dc) {
        return `DC ${dc} ${basic}${type} check`;
      }
      return `${type} check`;
    })
    .replace(
      /@Damage\[([^[]*)\[([^\]]*)\]\]?/g,
      (_match, formula: string, type: string) =>
        `${formula} ${type.replace(/,/g, " ")}`.trim(),
    )
    .replace(/@Damage\[.*?\]\]?/g, "")
    .replace(/@Template\[([^\]]*)\]/g, (_match, inner: string) => {
      const params = Object.fromEntries(
        inner.split("|").map((p) => {
          const i = p.indexOf(":");
          return i >= 0 ? [p.slice(0, i), p.slice(i + 1)] : ["type", p];
        }),
      );
      const shape = params.type ?? "";
      const distance = params.distance ?? "";
      if (distance && shape) {
        return `${distance}-foot ${shape}`;
      }
      return "";
    })
    .replace(/@Embed\[[^\]]*\]/g, "")
    .replace(/\[\[\/r\s+(.*)\]\]/g, (_match, inner: string) => {
      // Strip braces: {1d20+31} → 1d20+31
      let formula = inner.replace(/^\{([^}]*)\}/, "$1").trim();
      // Strip # comments: 1d20+31 #Label → 1d20+31
      formula = formula.replace(/\s*#.*$/, "").trim();
      // Extract damage-type brackets: (2d10+5)[healing] → 2d10+5 healing
      formula = formula.replace(/\(([^)]*)\)\[([^\]]*)\]/, "$1 $2");
      return formula;
    });
}
