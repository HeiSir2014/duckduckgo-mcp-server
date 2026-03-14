import { DuckDuckGoSearcher } from './duckduckgoSearcher';
import { WebContentFetcher } from './webContentFetcher';
import { SearchError } from './types';

const PORT = 18800;

const searcher = new DuckDuckGoSearcher();
const fetcher = new WebContentFetcher();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

const server = Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // POST /search
    // Body: { query: string, max_results?: number }
    if (req.method === 'POST' && url.pathname === '/search') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return err('Invalid JSON body');
      }

      const { query, max_results = 25 } = body ?? {};
      if (!query || typeof query !== 'string') {
        return err('Missing required field: query');
      }

      try {
        const results = await searcher.search(query, { maxResults: max_results });
        return json({ results });
      } catch (e) {
        if (e instanceof SearchError) {
          return json({ error: e.message, code: e.code }, 502);
        }
        return json({ error: String(e) }, 500);
      }
    }

    // POST /fetch
    // Body: { url: string, max_content_length?: number }
    if (req.method === 'POST' && url.pathname === '/fetch') {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return err('Invalid JSON body');
      }

      const { url: targetUrl, max_content_length = 8000 } = body ?? {};
      if (!targetUrl || typeof targetUrl !== 'string') {
        return err('Missing required field: url');
      }

      try {
        const content = await fetcher.fetchAndParse(targetUrl, max_content_length);
        return json({ content });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ status: 'ok' });
    }

    return err('Not found', 404);
  },
});

console.log(`DuckDuckGo HTTP server listening on http://localhost:${server.port}`);
console.log('  POST /search  { query, max_results? }');
console.log('  POST /fetch   { url, max_content_length? }');
console.log('  GET  /health');
