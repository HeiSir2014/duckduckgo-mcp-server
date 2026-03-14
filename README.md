# DuckDuckGo Search MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides web search and content fetching via DuckDuckGo. No API key required.

## Features

- **Web Search** — Multi-page results (supports 10 ~ 100+ results via automatic pagination)
- **Content Fetching** — Fetch and parse any webpage to clean text
- **Bot Detection & Retry** — Automatically retries up to 3 times on DDG bot challenges
- **Session Cookie Jar** — Persists DDG session cookies in-memory across requests
- **Advanced Query Syntax** — Full support for DDG/Google-style operators (`site:`, `OR`, `intitle:`, etc.)
- **Zero-Click Results** — Instant answer cards (e.g. search `ip`, `weather`)
- **Zero Dependencies at Runtime** — Only `cheerio` + `@modelcontextprotocol/sdk`
- **Node.js & Bun** — Works with both runtimes (Node ≥ 18)

---

## Installation

### As MCP Server (global CLI)

```bash
npm install -g duckduckgo-websearch
# or
npx duckduckgo-websearch
```

### As npm Library

```bash
npm install duckduckgo-websearch
```

---

## MCP Server Usage

### Claude Desktop

Edit your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ddg-search": {
      "command": "npx",
      "args": ["duckduckgo-websearch"]
    }
  }
}
```

Or with a local build:

```json
{
  "mcpServers": {
    "ddg-search": {
      "command": "node",
      "args": ["/path/to/duckduckgo-mcp-server/build/index.js"]
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client (Cursor, Cline, Continue, etc.) can connect via stdio transport using the same command above.

---

## MCP Tools

### `search`

Search DuckDuckGo and return paginated results.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | `string` | required | Search query. Supports advanced syntax (see below) |
| `max_results` | `integer` | `25` | Number of results to return. Triggers automatic pagination when > 10 |

**Advanced Query Syntax** (DDG supports Google-style operators):

| Syntax | Example | Effect |
|--------|---------|--------|
| `site:domain` | `site:github.com python` | Restrict to a domain |
| `site:a.com OR site:b.com` | `site:docs.python.org OR site:stackoverflow.com` | Multiple domains |
| `"exact phrase"` | `"model context protocol"` | Exact match |
| `-word` | `python -snake` | Exclude keyword |
| `intitle:word` | `intitle:tutorial python` | Match in page title |
| `filetype:ext` | `filetype:pdf machine learning` | Filter by file type |
| `OR` / `AND` | `python OR javascript async` | Boolean operators |

**Response format:**

```
Found 25 search results:

1. Page Title
   URL: https://example.com/page
   Summary: Brief description of the page content...

2. ...
```

---

### `fetch_content`

Fetch and parse a webpage to clean, LLM-readable text.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | required | Webpage URL to fetch |
| `max_content_length` | `integer` | `8000` | Maximum characters to return |

---

## Library Usage (Node.js / Bun)

```typescript
import { WebSearch, WebFetcher } from 'duckduckgo-websearch';

// Search
const searcher = new WebSearch();

// Basic search — returns up to 10 results (1 page)
const results = await searcher.search('claude anthropic');

// Request more results — auto-paginates across multiple DDG pages
const results = await searcher.search('python tutorial', { maxResults: 50 });

// Advanced query syntax works natively in the query string
const results = await searcher.search('site:github.com mcp server typescript');
const results = await searcher.search('site:docs.python.org OR site:realpython.com async await');

// Format for LLM consumption
console.log(searcher.formatResultsForLLM(results));

// Fetch webpage content
const fetcher = new WebFetcher();
const content = await fetcher.fetchAndParse('https://example.com', 8000);
```

### SearchResult type

```typescript
interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}
```

### Error handling

```typescript
import { WebSearch, SearchError } from 'duckduckgo-websearch';

try {
  const results = await searcher.search('query');
} catch (err) {
  if (err instanceof SearchError) {
    console.error(err.code); // 'BOT_DETECTED' | 'HTTP_ERROR' | 'TIMEOUT' | 'UNKNOWN'
    console.error(err.message);
  }
}
```

`SearchError` codes:

| Code | Meaning |
|------|---------|
| `BOT_DETECTED` | DDG bot challenge triggered after 3 retry attempts |
| `HTTP_ERROR` | Non-2xx HTTP response |
| `TIMEOUT` | Request timed out (30s limit) |
| `UNKNOWN` | Unexpected failure |

---

## Development

```bash
git clone https://github.com/HeiSir2014/duckduckgo-mcp-server
cd duckduckgo-mcp-server

npm install
npm run build          # compile TypeScript → build/

# Run example test (Bun)
bun example/test.ts

# Run with Node
node -e "require('./build/index.js')"
```

---

## Architecture

```
src/
├── index.ts              # MCP server entry, tool definitions
├── duckduckgoSearcher.ts # Search logic: fetch, bot detection, retry, pagination
├── cookieJar.ts          # In-memory cookie jar for DDG session persistence
├── webContentFetcher.ts  # Webpage fetch + text extraction
├── rateLimiter.ts        # Token-bucket rate limiter
└── types.ts              # Shared types (SearchResult, SearchOptions, SearchError)
```

**Pagination mechanism** — DDG HTML endpoint returns 10 results per page with a `vqd` session token embedded in the "Next" form. When `maxResults > 10`, the searcher chains page requests using `vqd` and the form parameters (`s`, `dc`) extracted from each page's nav-link.

**Bot detection** — On each page fetch the searcher checks for missing result containers (`.serp__results`) and known challenge keywords. On detection it awaits the report ping (`/t/sl_h`) which warms the session, then retries. After 3 failures it throws `SearchError('BOT_DETECTED')`.

---

## Rate Limits

| Operation | Limit |
|-----------|-------|
| Search | 30 requests / minute |
| Content Fetch | 20 requests / minute |

---

## License

MIT
