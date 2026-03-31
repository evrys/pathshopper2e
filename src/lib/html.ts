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
  let openAnchors = 0;
  return replaceFoundryRefs(html)
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g, (match, tag: string) => {
      const lower = tag.toLowerCase();

      // Anchor tags: preserve href, open in new tab
      if (lower === "a") {
        const isClosing = match.startsWith("</");
        if (isClosing) {
          if (openAnchors > 0) {
            openAnchors--;
            return "</a>";
          }
          return "";
        }
        const hrefMatch = match.match(/href\s*=\s*"([^"]*)"/);
        if (!hrefMatch) return "";
        const href = hrefMatch[1];
        openAnchors++;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      }

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
  return (
    html
      .replace(
        /<span class="action-glyph">([^<]*)<\/span>/g,
        (_match, code: string) => ACTION_GLYPHS[code.trim()] ?? code,
      )
      // @UUID with Item segment: use {display} or item name
      .replace(
        /@UUID\[[^\]]*\.Item\.([^\]]+)\](?:\{([^}]*)\})?/g,
        (_match, name: string, display: string | undefined) => {
          const label = display ?? name;
          return label.startsWith("Effect: ") ? "" : label;
        },
      )
      // @UUID without Item segment: use {display} or remove
      .replace(
        /@UUID\[[^\]]*\](?:\{([^}]*)\})?/g,
        (_match, display: string | undefined) => display ?? "",
      )
      // @Check: use {display} or compute "DC N type check"
      .replace(
        /@Check\[([^\]]*)\](?:\{([^}]*)\})?/g,
        (_match, inner: string, display: string | undefined) => {
          if (display) return display;
          const parts = inner.split("|");
          const type = parts[0] ?? "";
          const dcPart = parts.find((p) => p.startsWith("dc:"));
          const dc = dcPart?.slice(3);
          const basic = parts.includes("basic") ? "basic " : "";
          if (dc) {
            return `DC ${dc} ${basic}${type} check`;
          }
          return `${type} check`;
        },
      )
      // @Damage: match the full pattern including nested brackets, then optional {display}
      // The content can have nested [...] like: @Damage[6d6[acid],1d6[persistent,acid]]
      .replace(
        /@Damage\[([^[\]]*(?:\[[^\]]*\][^[\]]*)*)\](?:\{([^}]*)\})?/g,
        (_match, inner: string, display: string | undefined) => {
          if (display) return display;
          // Parse typed damage: formula[type] → "formula type"
          const typed = inner.match(/^([^[]*)\[([^\]]*)\]$/);
          if (typed) return `${typed[1]} ${typed[2].replace(/,/g, " ")}`.trim();
          return "";
        },
      )
      // @Template: use {display} or compute "N-foot shape"
      .replace(
        /@Template\[([^\]]*)\](?:\{([^}]*)\})?/g,
        (_match, inner: string, display: string | undefined) => {
          if (display) return display;
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
        },
      )
      .replace(/@Embed\[[^\]]*\]/g, "")
      // [[/r ...]], [[/br ...]], [[/gmr ...]], [[/act ...]] inline expressions
      // Use {display} if present, otherwise extract formula
      // Match up to ]] followed by {display}, end of string, or non-] char
      .replace(
        /\[\[\/(?:r|br|gmr|act)\s+(.*?)\]\](?=\{|$|[^\]])(?:\{([^}]*)\})?/g,
        (_match, inner: string, display: string | undefined) => {
          if (display) return display;
          // Strip braces: {1d20+31} → 1d20+31
          let formula = inner.replace(/^\{([^}]*)\}/, "$1").trim();
          // Strip # comments: 1d20+31 #Label → 1d20+31
          formula = formula.replace(/\s*#.*$/, "").trim();
          // Extract damage-type brackets: (2d10+5)[healing] → 2d10+5 healing
          formula = formula.replace(/\(([^)]*)\)\[([^\]]*)\]/, "$1 $2");
          return formula;
        },
      )
      // Malformed [[/... with {display} inside instead of after (e.g. [[/r 1d20+9{+9})
      .replace(
        /\[\[\/(?:r|br|gmr|act)\s+[^[\]]*\{([^}]*)\}/g,
        (_match, display: string) => display,
      )
  );
}
