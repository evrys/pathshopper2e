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

  it("replaces @UUID item references with their display name", () => {
    expect(
      stripHtml(
        "turns into a @UUID[Compendium.pf2e.equipment-srd.Item.Aeon Stone (Consumed)].",
      ),
    ).toBe("turns into a Aeon Stone (Consumed).");
  });

  it("replaces @UUID condition references with their display name", () => {
    expect(
      stripHtml(
        "the @UUID[Compendium.pf2e.conditionitems.Item.Dying] condition",
      ),
    ).toBe("the Dying condition");
  });

  it("replaces @UUID action references with their display name", () => {
    expect(
      stripHtml(
        "use @UUID[Compendium.pf2e.actionspf2e.Item.Raise a Shield] action",
      ),
    ).toBe("use Raise a Shield action");
  });

  it("replaces @UUID spell references with their display name", () => {
    expect(
      stripHtml(
        "cast @UUID[Compendium.pf2e.spells-srd.Item.Heal] as a divine spell",
      ),
    ).toBe("cast Heal as a divine spell");
  });

  it("removes @UUID Effect: references entirely", () => {
    expect(
      stripHtml(
        "grants the effect @UUID[Compendium.pf2e.equipment-effects.Item.Effect: Animal Blind]",
      ),
    ).toBe("grants the effect");
  });

  it("removes @UUID references without an Item segment", () => {
    expect(
      stripHtml("see @UUID[Compendium.pf2e.journals.something] for details"),
    ).toBe("see for details");
  });

  it("uses {display} override when present on @UUID", () => {
    expect(
      stripHtml(
        "become @UUID[Compendium.pf2e.conditionitems.Item.Sickened]{Sickened 1}",
      ),
    ).toBe("become Sickened 1");
    expect(
      stripHtml(
        "into a @UUID[Compendium.pf2e.equipment-srd.Item.Aeon Stone (Consumed)]{Aeon Stone (Dull Grey)}.",
      ),
    ).toBe("into a Aeon Stone (Dull Grey).");
  });

  it("removes @UUID without Item segment even with {display}", () => {
    expect(
      stripHtml(
        "see @UUID[Compendium.pf2e.journals.JournalEntry.abc]{Some Page} for details",
      ),
    ).toBe("see for details");
  });

  it("handles multiple @UUID references in one string", () => {
    expect(
      stripHtml(
        "the @UUID[Compendium.pf2e.conditionitems.Item.Dying] and @UUID[Compendium.pf2e.conditionitems.Item.Wounded] conditions",
      ),
    ).toBe("the Dying and Wounded conditions");
  });

  it("handles a realistic full description", () => {
    const input =
      "<p>When you would die from the @UUID[Compendium.pf2e.conditionitems.Item.Dying] condition (typically at dying 4), this smooth pink stone automatically activates. The stone then permanently turns into a @UUID[Compendium.pf2e.equipment-srd.Item.Aeon Stone (Consumed)]. You can cast @UUID[Compendium.pf2e.spells-srd.Item.Heal] once per day.</p>";
    const result = stripHtml(input);
    expect(result).toBe(
      "When you would die from the Dying condition (typically at dying 4), this smooth pink stone automatically activates. The stone then permanently turns into a Aeon Stone (Consumed). You can cast Heal once per day.",
    );
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("Just plain text.")).toBe("Just plain text.");
  });

  it("converts @Check with DC to readable text", () => {
    expect(stripHtml("succeed at the @Check[flat|dc:6] to")).toBe(
      "succeed at the DC 6 flat check to",
    );
    expect(stripHtml("a @Check[fortitude|dc:14] save")).toBe(
      "a DC 14 fortitude check save",
    );
  });

  it("converts @Check with basic save", () => {
    expect(stripHtml("@Check[reflex|dc:15|basic]")).toBe(
      "DC 15 basic reflex check",
    );
    expect(stripHtml("@Check[reflex|dc:15|basic|options:area-effect]")).toBe(
      "DC 15 basic reflex check",
    );
  });

  it("converts @Check without DC", () => {
    expect(stripHtml("a @Check[thievery] to unlock")).toBe(
      "a thievery check to unlock",
    );
  });

  it("converts @Check with extra options", () => {
    expect(stripHtml("@Check[acrobatics|dc:14|name:Avoid Caltrops]")).toBe(
      "DC 14 acrobatics check",
    );
    expect(
      stripHtml(
        "@Check[fortitude|dc:17|name:Lesser Blasting Stone|showDC:all]",
      ),
    ).toBe("DC 17 fortitude check");
  });

  it("renders @Damage with formula and type", () => {
    expect(stripHtml("takes @Damage[1d6[fire]] damage")).toBe(
      "takes 1d6 fire damage",
    );
    expect(stripHtml("deals @Damage[1[bleed]] per round")).toBe(
      "deals 1 bleed per round",
    );
    expect(stripHtml("@Damage[(1d4)[piercing]] damage")).toBe(
      "(1d4) piercing damage",
    );
  });

  it("renders @Damage with comma-separated types as spaces", () => {
    expect(stripHtml("it takes @Damage[3d6[persistent,poison]] damage")).toBe(
      "it takes 3d6 persistent poison damage",
    );
    expect(stripHtml("@Damage[1d4[persistent,fire]]")).toBe(
      "1d4 persistent fire",
    );
  });

  it("removes @Damage without typed bracket syntax", () => {
    expect(stripHtml("takes @Damage[2d6] damage")).toBe("takes damage");
  });

  it("renders @Template as distance-foot shape", () => {
    expect(stripHtml("in a @Template[type:emanation|distance:10] area")).toBe(
      "in a 10-foot emanation area",
    );
    expect(stripHtml("a @Template[cone|distance:15]")).toBe("a 15-foot cone");
    expect(stripHtml("a @Template[type:burst|distance:10]")).toBe(
      "a 10-foot burst",
    );
  });

  it("removes @Embed references", () => {
    expect(
      stripHtml(
        "see @Embed[Compendium.pf2e.classfeatures.Item.PoclGJ7BCEyIuqJe inline] for details",
      ),
    ).toBe("see for details");
  });

  it("converts action glyphs to Unicode symbols", () => {
    expect(stripHtml('<span class="action-glyph">1</span> Interact')).toBe(
      "◆ Interact",
    );
    expect(stripHtml('<span class="action-glyph">2</span> Cast a Spell')).toBe(
      "◆◆ Cast a Spell",
    );
    expect(stripHtml('<span class="action-glyph">3</span>')).toBe("◆◆◆");
    expect(stripHtml('<span class="action-glyph">f</span> envision')).toBe(
      "◇ envision",
    );
    expect(stripHtml('<span class="action-glyph">R</span>')).toBe("↺");
    expect(stripHtml('<span class="action-glyph">A</span>')).toBe("◆");
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

  it("converts action glyph spans to Unicode symbols", () => {
    expect(sanitizeHtml('<span class="action-glyph">A</span> Interact')).toBe(
      "◆ Interact",
    );
    expect(
      sanitizeHtml(
        '<p><strong>Activate</strong> <span class="action-glyph">f</span> envision</p>',
      ),
    ).toBe("<p><strong>Activate</strong> ◇ envision</p>");
  });

  it("strips attributes from allowed tags", () => {
    expect(sanitizeHtml('<p class="foo">text</p>')).toBe("<p>text</p>");
  });

  it("resolves Foundry @UUID references", () => {
    expect(
      sanitizeHtml(
        "<p>the @UUID[Compendium.pf2e.conditionitems.Item.Sickened]{Sickened 1} condition</p>",
      ),
    ).toBe("<p>the Sickened 1 condition</p>");
  });

  it("resolves Foundry @Check references", () => {
    expect(sanitizeHtml("<p>a @Check[reflex|dc:15|basic] save</p>")).toBe(
      "<p>a DC 15 basic reflex check save</p>",
    );
  });

  it("resolves Foundry @Damage references", () => {
    expect(sanitizeHtml("<p>takes @Damage[1d6[fire]] damage</p>")).toBe(
      "<p>takes 1d6 fire damage</p>",
    );
  });

  it("resolves Foundry @Template references", () => {
    expect(sanitizeHtml("<p>a @Template[cone|distance:30] of energy</p>")).toBe(
      "<p>a 30-foot cone of energy</p>",
    );
  });

  it("renders [[/r ...]] inline roll expressions as formulas", () => {
    expect(sanitizeHtml("<p>add [[/r 1d4]] damage</p>")).toBe(
      "<p>add 1d4 damage</p>",
    );
    expect(sanitizeHtml("<p>modifier of [[/r 1d20+31]].</p>")).toBe(
      "<p>modifier of 1d20+31.</p>",
    );
  });

  it("preserves Benefit/Drawback structure", () => {
    const input =
      "<p><strong>Benefit</strong> You gain a bonus.</p><p><strong>Drawback</strong> You take a penalty.</p>";
    expect(sanitizeHtml(input)).toBe(
      "<p><strong>Benefit</strong> You gain a bonus.</p><p><strong>Drawback</strong> You take a penalty.</p>",
    );
  });
});

describe("inline rolls", () => {
  it("renders simple inline rolls", () => {
    expect(stripHtml("add [[/r 1d4]] damage")).toBe("add 1d4 damage");
  });

  it("renders inline rolls with braces", () => {
    expect(stripHtml("roll [[/r {1d20+31}]]")).toBe("roll 1d20+31");
  });

  it("renders inline rolls with # comments", () => {
    expect(stripHtml("[[/r 1d4 #rounds]] later")).toBe("1d4 later");
    expect(stripHtml("[[/r {1d20+18} #Counteract Modifier]]")).toBe("1d20+18");
  });

  it("renders inline rolls with damage type brackets", () => {
    expect(stripHtml("[[/r (2d10+5)[healing]]]")).toBe("2d10+5 healing");
  });
});
