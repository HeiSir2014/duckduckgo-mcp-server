#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { DuckDuckGoSearcher } from './duckduckgoSearcher';
import { WebContentFetcher } from './webContentFetcher';
import { appendFileSync } from 'fs';


function log(message: string) {
  // appendFileSync('search.log', `${new Date().toISOString()} ${message}\n`);
}


class DuckDuckGoMCPServer {
  private server: Server;
  private searcher: DuckDuckGoSearcher;
  private fetcher: WebContentFetcher;

  constructor() {
    this.server = new Server(
      {
        name: 'duckduckgo-websearch',
        version: '0.1.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.searcher = new DuckDuckGoSearcher();
    this.fetcher = new WebContentFetcher();

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search',
            description: 'Search DuckDuckGo and return formatted results',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query string',
                },
                max_results: {
                  type: 'integer',
                  description: 'Maximum number of results to return (default: 25)',
                  default: 25,
                },
              },
              required: ['query'],
            },
          } as Tool,
          {
            name: 'fetch_content',
            description: 'Fetch and parse content from a webpage URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The webpage URL to fetch content from',
                },
                max_content_length: {
                  type: 'integer',
                  description: 'Maximum number of characters to return (default: 8000)',
                  default: 8000,
                },
              },
              required: ['url'],
            },
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'search') {
          const { query, max_results = 25 } = args as {
            query: string;
            max_results?: number;
          };
          log(`query: ${query}, max_results: ${max_results}`);
          const results = await this.searcher.search(query, {
            maxResults: max_results,
          });
          const formattedResults = this.searcher.formatResultsForLLM(results);
          log(`formattedResults: ${formattedResults}`);
          return {
            content: [
              {
                type: 'text',
                text: formattedResults,
              },
            ],
          };
        }
        else if (name === 'fetch_content') {
          const { url, max_content_length = 8000 } = args as {
            url: string;
            max_content_length?: number;
          };
          log(`url: ${url}, max_content_length: ${max_content_length}`);
          const content = await this.fetcher.fetchAndParse(url, max_content_length);
          log(`content: ${content}`);
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };
        }

        throw new Error(`Unknown tool: ${name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`error: ${message}`);
        return {
          content: [
            {
              type: 'text',
              text: `An error occurred while executing ${name}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

async function main(): Promise<void> {
  const server = new DuckDuckGoMCPServer();
  await server.run();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}