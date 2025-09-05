import { WebSearch } from "../src/index.js";


const webSearch = new WebSearch();

webSearch.search("上海 2025年9月5日天气").then((result) => {
  console.log(result);
});