export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface RateLimiterOptions {
  requestsPerMinute?: number;
}

export interface SearchOptions {
  maxResults?: number;
}

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly code: 'BOT_DETECTED' | 'HTTP_ERROR' | 'TIMEOUT' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'SearchError';
  }
}