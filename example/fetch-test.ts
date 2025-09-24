import { WebContentFetcher } from "../src/webContentFetcher.js";

const webContentFetcher = new WebContentFetcher();

// webContentFetcher.fetchAndParse("https://www.baidu.com").then((result) => {
//   console.log(result);
// });

webContentFetcher.fetchAndParse("https://www.baidu.com", 0).then((result) => {
  console.log(result);
});
