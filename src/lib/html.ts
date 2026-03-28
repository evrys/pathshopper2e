/**
 * Strip HTML tags, Foundry VTT enriched text references, and decode common
 * HTML entities into readable plain text.
 *
 * Foundry patterns handled:
 * - `@UUID[...Item.Name]` → "Name" (human-readable display name)
 * - `@UUID[...Item.Effect: ...]` → removed (internal effect references)
 * - `@UUID[...]` (no Item segment) → removed
 * - `@Check[type|dc:N|...]` → "DC N type check" (mirrors Foundry's #createSingleCheck)
 * - `@Damage[formula[type]]` → "formula type" (e.g. "1d6 fire")
 * - `@Template[type:shape|distance:N]` → "N-foot shape" (e.g. "10-foot emanation")
 * - `@Embed[...]` → removed (embedded content)
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/@UUID\[[^\]]*\.Item\.([^\]]+)\]/g, (_match, name: string) =>
      name.startsWith("Effect: ") ? "" : name,
    )
    .replace(/@UUID\[[^\]]*\]/g, "")
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
    .replace(/@Damage\[([^\[]*)\[([^\]]*)\]\]?/g, (_match, formula: string, type: string) =>
      `${formula} ${type}`.trim(),
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
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
