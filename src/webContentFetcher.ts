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

      const url_ = new URL(url);
      const url_host = url_.host;

      const response = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Ch-Ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'Referer': `https://www.google.com?q=${url_host}`,
          'Origin': 'https://www.google.com',
          'Priority': 'u=0, i',
        },
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Fetch API automatically handles decompression for standard encodings
      // (gzip, deflate, br, zstd) so response.text() returns decompressed content
      let html: string;

      try {
        html = await response.text();
      } catch (decodeError) {
        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-8', { fatal: false });
        html = decoder.decode(buffer);
      }

      // Verify we got valid content
      if (!html || html.length === 0) {
        throw new Error('Received empty response from server');
      }

      const $ = cheerio.load(html);

      // Remove script and style elements
      $('script, style, nav, header, footer, meta').remove();

      // Get the text content
      let text = $.text();
      const $2 = cheerio.load(text);
      $2('script, style, nav, header, footer, meta').remove();
      if ($2.text()) {
        text = $2.text();
      }

      // Clean up the text
      const lines = text.split('\n').map((line: string) => line.trim());
      const chunks = lines.flatMap((line: string) =>
        line.split(/\s{2,}/).map((phrase: string) => phrase.trim())
      );
      let cleanText = chunks.filter((chunk: string) => chunk).join(' ');

      // Remove extra whitespace
      cleanText = cleanText.replace(/\s+/g, ' ').trim();

      // Extract and append links with their text content
      const a_tags = $('a');
      const links: string[] = [];
      
      a_tags.each((_, element) => {
        const href = $(element).attr('href');
        if (!href) return;
        
        // Convert relative URLs to absolute URLs
        let absoluteUrl: string;
        try {
          // Use URL constructor to handle all types of relative URLs
          const resolvedUrl = new URL(href, url);
          absoluteUrl = resolvedUrl.href;
        } catch (error) {
          return;
        }
        
        // Get the link text content
        const linkText = $(element).text().trim();
        
        // Skip if no meaningful text or if it's just the original href
        if (!linkText || linkText === href) return;
        
        // Format the link with absolute URL
        const formattedLink = `[${linkText}](${absoluteUrl})`;
        links.push(formattedLink);
      });
      
      // Append unique links to the content
      if (links.length > 0) {
        const uniqueLinks = [...new Set(links)];
        cleanText += '\n\n**Links:**\n' + uniqueLinks.join('\n');
      }

      // Truncate if too long
      if (max_content_length && cleanText.length > max_content_length) {
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