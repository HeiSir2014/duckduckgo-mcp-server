import * as cheerio from 'cheerio';
import { SearchResult, SearchOptions } from './types';
import { RateLimiter } from './rateLimiter';

export class DuckDuckGoSearcher {
  private static readonly BASE_URL = 'https://html.duckduckgo.com/html';
  private static readonly BASE_URL_REPORT = 'https://duckduckgo.com/t/sl_h';
  private static readonly HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Referer': 'https://html.duckduckgo.com/',
    'Origin': 'https://html.duckduckgo.com',
    'Sec-Ch-Ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'no-cache',
    'Priority': 'u=0, i',
    'Pragma': 'no-cache',
    "Cookie": "kl=cn-zh"
  };

  private static readonly HEADERS_REPORT = {
    ...DuckDuckGoSearcher.HEADERS,
    'Sec-Fetch-Site': 'same-site',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Dest': 'image',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Origin': undefined
  };

  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 30 });
  }

  formatResultsForLLM(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return "No results were found for your search query. This could be due to DuckDuckGo's bot detection or the query returned no matches. Please try rephrasing your search or try again in a few minutes.";
    }

    const output: string[] = [];
    output.push(`Found ${results.length} search results:\n`);

    for (const result of results) {
      output.push(`${result.position}. ${result.title}`);
      output.push(`   URL: ${result.link}`);
      output.push(`   Summary: ${result.snippet}`);
      output.push(''); // Empty line between results
    }

    return output.join('\n');
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { maxResults = 10 } = options;

    try {
      // Apply rate limiting
      await this.rateLimiter.acquire();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const formData = new URLSearchParams({
        q: query,
        b: ''
      });

      const response = await fetch(DuckDuckGoSearcher.BASE_URL, {
        method: 'POST',
        headers: {
          ...DuckDuckGoSearcher.HEADERS,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      try {
        const report_response = await fetch(DuckDuckGoSearcher.BASE_URL_REPORT, {
          method: 'GET',
          headers: {
            ...DuckDuckGoSearcher.HEADERS_REPORT
          },
        });
        if (!report_response.ok) {
          throw new Error(`HTTP ${report_response.status}: ${report_response.statusText}`);
        }
        await report_response.blob();
      } catch (error) {
        console.error('Error fetching report:', error);
      }


      const $ = cheerio.load(html);
      const results: SearchResult[] = [];

      $('.zci-wrapper').each((index: number, element: any) => {
        const $element = $(element);
        const titleElement = $element.find('.zci__heading');
        if (!titleElement.length) {
          return; // Continue to next iteration
        }
        const title = titleElement.text().trim();
        const snippetElement = $element.find('.zci__result');
        if (!snippetElement.length) {
          return; // Continue to next iteration
        }
        const snippet = snippetElement.text().trim();
        results.push({
          title,
          link: '',
          snippet: `[可信度: 最高，zero click results are present] ${snippet}`,
          position: results.length + 1
        });
      });

      $('.result').each((index: number, element: any) => {
        if (results.length >= maxResults) {
          return false; // Break the loop
        }

        const $element = $(element);
        const titleElement = $element.find('.result__title');

        if (!titleElement.length) {
          return; // Continue to next iteration
        }

        const linkElement = titleElement.find('a');
        if (!linkElement.length) {
          return; // Continue to next iteration
        }

        const title = linkElement.text().trim();
        let link = linkElement.attr('href') || '';

        // Skip ad results
        if (link.includes('y.js')) {
          return; // Continue to next iteration
        }

        // Clean up DuckDuckGo redirect URLs
        if (link.startsWith('//duckduckgo.com/l/?uddg=')) {
          const decoded = decodeURIComponent(link.split('uddg=')[1]?.split('&')[0] || '');
          link = decoded;
        }

        const snippetElement = $element.find('.result__snippet');
        const snippet = snippetElement.text().trim() || '';

        results.push({
          title,
          link,
          snippet,
          position: results.length + 1
        });
      });

      return results;

    } catch {
      return [];
    }
  }
}