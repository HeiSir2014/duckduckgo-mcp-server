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