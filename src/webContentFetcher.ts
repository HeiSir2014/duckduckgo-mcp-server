import * as cheerio from 'cheerio';
import { RateLimiter } from './rateLimiter';

export class WebContentFetcher {
  private rateLimiter: RateLimiter;

  constructor() {
    this.rateLimiter = new RateLimiter({ requestsPerMinute: 20 });
  }

  async fetchAndParse(url: string, max_content_length: number = 8000): Promise<string> {
    try {
      await this.rateLimiter.acquire();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script and style elements
      $('script, style, nav, header, footer').remove();

      // Get the text content
      const text = $.text();

      // Clean up the text
      const lines = text.split('\n').map((line: string) => line.trim());
      const chunks = lines.flatMap((line: string) => 
        line.split(/\s{2,}/).map((phrase: string) => phrase.trim())
      );
      let cleanText = chunks.filter((chunk: string) => chunk).join(' ');

      // Remove extra whitespace
      cleanText = cleanText.replace(/\s+/g, ' ').trim();

      // Truncate if too long
      if (cleanText.length > max_content_length) {
        cleanText = cleanText.substring(0, max_content_length) + '... [content truncated]';
      }

      return cleanText;

    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return 'Error: The request timed out while trying to fetch the webpage.';
        } else if (error.message.includes('HTTP')) {
          return `Error: Could not access the webpage (${error.message})`;
        } else {
          return `Error: An unexpected error occurred while fetching the webpage (${error.message})`;
        }
      } else {
        const errorMessage = String(error);
        return `Error: An unexpected error occurred while fetching the webpage (${errorMessage})`;
      }
    }
  }
}