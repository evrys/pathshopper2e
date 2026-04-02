/**
 * Strip HTML tags and decode common HTML entities into readable plain text.
 * Used to create the `plainDescription` field for search indexing.
 */
export function stripHtml(html: string): string {
  return html
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
  "code",
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
  "h1",
  "h2",
  "h3",
  "h4",
]);

/**
 * Sanitize HTML for safe rendering via `dangerouslySetInnerHTML`.
 *
 * Keeps a curated set of safe structural/formatting tags and anchor links,
 * stripping everything else (scripts, divs, unknown attributes, etc.).
 */
export function sanitizeHtml(html: string): string {
  let openAnchors = 0;
  return html
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
