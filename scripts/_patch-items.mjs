import { readFileSync, writeFileSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";

const items = JSON.parse(readFileSync("data/items.json", "utf-8"));
const items = JSON.parse(readFileSync("data/items.json", "utf-8"));

const urlUpdates = {const urlUpdates = {

  'Enhanced Hearing Aids': '/Equipment.aspx?ID=1349',  'Enhanced Hearing Aids': '/Equipment.aspx?ID=1349',

  'Eye of the Moonwarden': '/Equipment.aspx?ID=3673',  'Eye of the Moonwarden': '/Equipment.aspx?ID=3673',

  'Remorhaz Armor': '/Equipment.aspx?ID=1852',  'Remorhaz Armor': '/Equipment.aspx?ID=1852',

  'Windlass Bola': '/Equipment.aspx?ID=1873',  'Windlass Bola': '/Equipment.aspx?ID=1873',

  'Zetogeki Hide Armor': '/Equipment.aspx?ID=3667',  'Zetogeki Hide Armor': '/Equipment.aspx?ID=3667',

};
}

const count = 0;
let count = 0;

for (const item of items) {
  // Rename Extendable Pincer → Extendible Pincer

  if (item.name === "Extendable Pincer") {
    for (const item of items) {
      item.name = "Extendible Pincer";
      if (item.name === "Extendable Pincer") {
        item.aonUrl = "/Equipment.aspx?ID=4252";
        item.name = "Extendible Pincer";

        console.log("Renamed + URL: Extendable Pincer -> Extendible Pincer");
        item.aonUrl = "/Equipment.aspx?ID=4252";

        count++;
        console.log("Renamed + URL: Extendable Pincer → Extendible Pincer");
      }
      count++;

      if (urlUpdates[item.name] && !item.aonUrl) {
      }

      item.aonUrl = urlUpdates[item.name];
      if (urlUpdates[item.name] && !item.aonUrl) {
        console.log("URL set: " + item.name + " -> " + item.aonUrl);
        item.aonUrl = urlUpdates[item.name];

        count++;
        console.log("URL set: " + item.name + " → " + item.aonUrl);
      }
      count++;
    }
  }
}

writeFileSync("data/items.json", JSON.stringify(items));

console.log("Done. " + count + " items updated.");
writeFileSync("data/items.json", JSON.stringify(items));

console.log("Done. " + count + " items updated.");
