import { readFileSync } from "node:fs";

function stripHtml(html) {
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

const items = JSON.parse(readFileSync("public/data/items.json", "utf8"));
const secondaries = items.map((i) => {
  const desc = stripHtml(i.description);
  return i.traits.length > 0 ? `${desc} ${i.traits.join(" ")}` : desc;
});

const needle = "bonus to saving throws against magical effects";
const terms = needle.toLowerCase().split(/\s+/);
const candidates = secondaries.filter((s) => {
  const lower = s.toLowerCase();
  return terms.every((t) => lower.includes(t));
});
console.log("Candidates:", candidates.length);
console.log(
  "Avg length:",
  Math.round(
    candidates.reduce((s, t) => s + t.length, 0) / (candidates.length || 1),
  ),
);
