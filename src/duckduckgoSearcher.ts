import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { SearchResult, SearchOptions, SearchError } from './types';
import { RateLimiter } from './rateLimiter';
import { cookieJar } from './cookieJar';

export class DuckDuckGoSearcher {
  private static readonly BASE_URL = 'https://html.duckduckgo.com/html';
  private static readonly BASE_URL_REPORT = 'https://duckduckgo.com/t/sl_h';
  private static readonly HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Referer': 'https://html.duckduckgo.com/',
    'Origin': 'https://html.duckduckgo.com',
    'Sec-Ch-Ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Priority': 'u=0, i',
  };

  private static readonly HEADERS_REPORT: Record<string, string> = (() => {
    const { Origin: _removed, ...rest } = DuckDuckGoSearcher.HEADERS;
    return {
      ...rest,
      'Sec-Fetch-Site': 'same-site',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Dest': 'image',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };
  })();

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

  private extractNextPageParams($: CheerioAPI): Record<string, string> | null {
    let nextForm: ReturnType<typeof $> | null = null;

    $('.nav-link').each((_: number, el: any) => {
      const form = $(el).find('form');
      if (form.find('input[type="submit"][value="Next"]').length) {
        nextForm = form;
        return false; // break
      }
    });

    if (!nextForm) return null;

    const get = (name: string): string =>
      (nextForm as ReturnType<typeof $>).find(`input[name="${name}"]`).val() as string ?? '';

    const vqd = get('vqd');
    if (!vqd) return null;

    const params: Record<string, string> = {
      s: get('s'),
      nextParams: get('nextParams'),
      v: get('v'),
      o: get('o'),
      dc: get('dc'),
      api: get('api'),
      vqd,
    };
    const kl = get('kl');
    if (kl) params['kl'] = kl;
    return params;
  }

  private isBotDetected(html: string, $: CheerioAPI): boolean {
    // 1. HTML too short — redirect or minimal block page
    if (html.length < 1500) return true;
    // 2. Main results container missing
    if ($('.serp__results').length === 0) return true;
    // 3. Page title doesn't match valid DDG pattern
    const title = $('title').text();
    if (title && !/at DuckDuckGo$/i.test(title)) return true;
    // 4. Challenge/CAPTCHA keywords in body text
    if (/(captcha|robot check|verify you are human|unusual traffic|access denied)/i.test(html)) return true;
    return false;
  }

  private parseResults($: CheerioAPI, maxResults: number): SearchResult[] {
    const results: SearchResult[] = [];

    $('.zci-wrapper').each((_index: number, element: any) => {
      const $element = $(element);
      const titleElement = $element.find('.zci__heading');
      if (!titleElement.length) return;
      const title = titleElement.text().trim();
      const snippetElement = $element.find('.zci__result');
      if (!snippetElement.length) return;
      const snippet = snippetElement.text().trim();
      results.push({
        title,
        link: '',
        snippet: `[可信度: 最高，zero click results are present] ${snippet}`,
        position: results.length + 1
      });
    });

    $('.result').each((_index: number, element: any) => {
      if (results.length >= maxResults) return false;

      const $element = $(element);
      const titleElement = $element.find('.result__title');
      if (!titleElement.length) return;

      const linkElement = titleElement.find('a');
      if (!linkElement.length) return;

      const title = linkElement.text().trim();
      let link = linkElement.attr('href') || '';

      // Skip ad results
      if (link.includes('y.js')) return;

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
  }

  private async fetchPage(body: URLSearchParams, signal: AbortSignal): Promise<Response> {
    const cookieHeader = cookieJar.getCookieHeader(DuckDuckGoSearcher.BASE_URL);
    const response = await fetch(DuckDuckGoSearcher.BASE_URL, {
      method: 'POST',
      headers: {
        ...DuckDuckGoSearcher.HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body,
      signal,
    });
    cookieJar.setCookies(response.headers, DuckDuckGoSearcher.BASE_URL);
    return response;
  }

  private async fireReportPing(): Promise<void> {
    try {
      const r = await fetch(DuckDuckGoSearcher.BASE_URL_REPORT, {
        method: 'GET',
        headers: { ...DuckDuckGoSearcher.HEADERS_REPORT },
      });
      await r.blob();
    } catch { /* ignore */ }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { maxResults = 10 } = options;
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS = [1000, 2000]; // ms between attempts

    await this.rateLimiter.acquire();

    // --- Page 1 with bot-detection retry ---
    let page1$!: CheerioAPI;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await this.fetchPage(new URLSearchParams({ q: query, b: '' }), controller.signal);
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new SearchError(`HTTP ${response.status}: ${response.statusText}`, 'HTTP_ERROR');
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const botDetected = this.isBotDetected(html, $);

      // Always complete report ping before retrying or throwing
      await this.fireReportPing();

      if (botDetected) {
        if (attempt < MAX_ATTEMPTS - 1) continue;
        throw new SearchError('DuckDuckGo bot detection triggered after 3 attempts', 'BOT_DETECTED');
      }

      page1$ = $;
      break;
    }

    // --- Paginate until maxResults satisfied ---
    const allResults: SearchResult[] = [];
    let $ = page1$;

    // vqd is embedded in page 1's "Next" nav-link form — extract it directly.
    // No extra HTTP request needed.
    let nextParams: Record<string, string> | null = this.extractNextPageParams($);

    const page1Results = this.parseResults($, maxResults);
    for (const r of page1Results) {
      r.position = allResults.length + 1;
      allResults.push(r);
    }

    while (allResults.length < maxResults && nextParams) {
      try {
        const body = new URLSearchParams({ q: query, ...nextParams });
        const response = await this.fetchPage(body, new AbortController().signal);
        if (!response.ok) break;

        const html = await response.text();
        $ = cheerio.load(html);

        if (this.isBotDetected(html, $)) break;

        const pageResults = this.parseResults($, maxResults - allResults.length);
        for (const r of pageResults) {
          r.position = allResults.length + 1;
          allResults.push(r);
        }

        nextParams = allResults.length < maxResults
          ? this.extractNextPageParams($)
          : null;
      } catch {
        break;
      }
    }

    return allResults;
  }
}