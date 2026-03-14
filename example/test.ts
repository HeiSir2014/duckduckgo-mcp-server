import { WebSearch } from "../src/index.js";

const webSearch = new WebSearch();

const now = new Date();
const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
const query = `上海 ${dateStr}天气`;

console.log(`[${new Date().toISOString()}] Searching: ${query}\n`);

webSearch.search(query).then((results) => {
  if (results.length === 0) {
    console.log("No results returned (possible bot detection or rate limit)");
    return;
  }
  console.log(`Found ${results.length} results:\n`);
  for (const r of results) {
    console.log(`[${r.position}] ${r.title}`);
    console.log(`    ${r.link}`);
    console.log(`    ${r.snippet?.slice(0, 100)}...`);
    console.log();
  }
}).catch((err) => {
  console.error("Search failed:", err.message);
});