import { RateLimiterOptions } from './types';

export class RateLimiter {
  private requestsPerMinute: number;
  private requests: Date[] = [];

  constructor(options: RateLimiterOptions = {}) {
    this.requestsPerMinute = options.requestsPerMinute || 30;
  }

  async acquire(): Promise<void> {
    const now = new Date();
    
    // Remove requests older than 1 minute
    this.requests = this.requests.filter(
      req => now.getTime() - req.getTime() < 60000
    );

    if (this.requests.length >= this.requestsPerMinute) {
      // Wait until we can make another request
      const waitTime = 60000 - (now.getTime() - this.requests[0].getTime());
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(now);
  }
}