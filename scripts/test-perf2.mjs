import uFuzzy from "@leeoniya/ufuzzy";
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

const uf = new uFuzzy({ intraMode: 1, intraIns: 1 });
const items = JSON.parse(readFileSync("public/data/items.json", "utf8"));
const secondaries = items.map((i) => {
  const desc = stripHtml(i.description);
  return i.traits.length > 0 ? `${desc} ${i.traits.join(" ")}` : desc;
});

const needle = "bonus to saving throws against magical effects";
const terms = needle.toLowerCase().split(/\s+/);

// Pre-filter
const candidateTexts = [];
for (let i = 0; i < secondaries.length; i++) {
  const lower = secondaries[i].toLowerCase();
  if (terms.every((t) => lower.includes(t))) {
    candidateTexts.push(secondaries[i]);
  }
}
console.log("Candidates:", candidateTexts.length);

// Try uf.search on just the candidates
console.time("uf.search candidates");
const [idxs, info, order] = uf.search(candidateTexts, needle);
console.timeEnd("uf.search candidates");
console.log("Hits:", idxs?.length, "info:", !!info);

// Try uf.filter only
console.time("uf.filter candidates");
const filtered = uf.filter(candidateTexts, needle);
console.timeEnd("uf.filter candidates");
console.log("Filtered:", filtered?.length);

// Try the 3 steps manually
if (filtered && filtered.length > 0) {
  console.time("uf.info");
  const info2 = uf.info(filtered, candidateTexts, needle);
  console.timeEnd("uf.info");

  if (info2) {
    console.time("uf.sort");
    const order2 = uf.sort(info2, candidateTexts, needle);
    console.timeEnd("uf.sort");
  }
}
