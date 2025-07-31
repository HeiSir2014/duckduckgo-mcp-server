# DuckDuckGo Search MCP Server (Node.js/TypeScript)

A Model Context Protocol (MCP) server that provides web search capabilities through DuckDuckGo, with additional features for content fetching and parsing. This is the Node.js/TypeScript version of the original Python implementation.

## Features

- **Web Search**: Search DuckDuckGo with advanced rate limiting and result formatting
- **Content Fetching**: Retrieve and parse webpage content with intelligent text extraction
- **Rate Limiting**: Built-in protection against rate limits for both search and content fetching
- **Error Handling**: Comprehensive error handling and logging
- **LLM-Friendly Output**: Results formatted specifically for large language model consumption
- **TypeScript**: Full TypeScript support with type definitions
- **Global CLI**: Available as a global npm package
- **Custom Headers**: Referer、Origin...etc
- **Zero Click Results**: eg: search `ip`

## Installation

### Global Installation (Recommended)

```bash
# Install globally via npm
npm install -g duckduckgo-websearch

# Or using pnpm
pnpm add -g duckduckgo-websearch

# Or using yarn
yarn global add duckduckgo-websearch
```

After global installation, you can use the following commands:
- `npx duckduckgo-websearch`
- `npx ddg-websearch`
- `duckduckgo-websearch`
- `ddg-websearch` (short alias)

### Local Installation

```bash
# Clone and install locally
git clone https://github.com/HeiSir2014/duckduckgo-mcp-server
cd duckduckgo-mcp-server
npm install
npm run build
```

## Usage

### Global Usage

After global installation, you can run the server directly:

```bash
# Start the server
npx duckduckgo-websearch

# Or using the short alias
npx ddg-websearch

# or 
duckduckgo-websearch

# Or using the short alias
ddg-websearch
```

### Running with Claude Desktop

1. Download [Claude Desktop](https://claude.ai/download)
2. Create or edit your Claude Desktop configuration:
   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - On Windows: `%APPDATA%\Claude\claude_desktop_config.json`

#### For Global Installation:
```json
{
  "mcpServers": {
    "ddg-search": {
      "command": "npx duckduckgo-websearch"
    }
  }
}
```

#### For Local Installation:
```json
{
  "mcpServers": {
    "ddg-search": {
      "command": "node",
      "args": ["path/to/duckduckgo-mcp-server/build/index.js"]
    }
  }
}
```

3. Restart Claude Desktop

### Development

For local development:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Start the built server
npm start

# Run tests
npm test
```

## Available Tools

### 1. Search Tool

```typescript
async function search(query: string, max_results?: number): Promise<string>
```

Performs a web search on DuckDuckGo and returns formatted results.

**Parameters:**
- `query`: Search query string
- `max_results`: Maximum number of results to return (default: 10)

**Returns:**
Formatted string containing search results with titles, URLs, and snippets.

### 2. Content Fetching Tool

```typescript
async function fetch_content(url: string, max_length?: number): Promise<string>
```

Fetches and parses content from a webpage.

**Parameters:**
- `url`: The webpage URL to fetch content from
- `max_length`: Maximum content length to return (default: 8000)

**Returns:**
Cleaned and formatted text content from the webpage.

## Features in Detail

### Rate Limiting

- Search: Limited to 30 requests per minute
- Content Fetching: Limited to 20 requests per minute
- Automatic queue management and wait times

### Result Processing

- Removes ads and irrelevant content
- Cleans up DuckDuckGo redirect URLs
- Formats results for optimal LLM consumption
- Truncates long content appropriately

### Error Handling

- Comprehensive error catching and reporting
- Graceful degradation on rate limits or timeouts

## Technical Details

### Dependencies

- `@modelcontextprotocol/sdk`: MCP SDK for Node.js
- `cheerio`: Server-side jQuery implementation for HTML parsing
- Node.js 内置 `fetch` API：用于 HTTP 请求（无需额外依赖）

### Architecture

The server is built using the MCP SDK and consists of several key components:

- **DuckDuckGoSearcher**: Handles search requests with rate limiting
- **WebContentFetcher**: Fetches and parses webpage content
- **RateLimiter**: Manages request rate limiting
- **Main Server**: Integrates everything and handles MCP protocol

## Publishing (For Maintainers)

### Version Management

```bash
# Update version
npm run version:patch  # 0.1.1 -> 0.1.2
npm run version:minor  # 0.1.1 -> 0.2.0  
npm run version:major  # 0.1.1 -> 1.0.0
```

### Publishing to npm

```bash
# Check publish readiness
npm run publish:check

# Publish (after version update)
npm publish
```

### Pre-publish Checklist

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Version updated (`npm version [patch|minor|major]`)
- [ ] README updated
- [ ] CHANGELOG updated

## Contributing

Issues and pull requests are welcome! Some areas for potential improvement:

- Additional search parameters (region, language, etc.)
- Enhanced content parsing options
- Caching layer for frequently accessed content
- Additional rate limiting strategies
- Better error recovery mechanisms

## License

This project is licensed under the MIT License.

## Comparison with Python Version

This Node.js/TypeScript version provides the same functionality as the original Python version with the following benefits:

- **Type Safety**: Full TypeScript support with compile-time type checking
- **Performance**: Generally faster startup and execution times
- **Ecosystem**: Access to the extensive npm ecosystem
- **Compatibility**: Better integration with Node.js-based toolchains
- **Global CLI**: Easy global installation and usage

The API and behavior are designed to be identical to the Python version, making it a drop-in replacement.