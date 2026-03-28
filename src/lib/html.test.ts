import { describe, expect, it } from "vitest";
import { stripHtml } from "./html";

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

  it("removes @Damage references", () => {
    expect(stripHtml("takes @Damage[1d6[fire]] damage")).toBe("takes damage");
    expect(stripHtml("deals @Damage[1[bleed]] per round")).toBe(
      "deals per round",
    );
  });

  it("removes @Template references", () => {
    expect(stripHtml("in a @Template[type:emanation|distance:10] area")).toBe(
      "in a area",
    );
  });

  it("removes @Embed references", () => {
    expect(
      stripHtml(
        "see @Embed[Compendium.pf2e.classfeatures.Item.PoclGJ7BCEyIuqJe inline] for details",
      ),
    ).toBe("see for details");
  });
});
