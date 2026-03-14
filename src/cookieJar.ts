interface CookieEntry {
  value: string;
  expires?: Date;   // undefined = session cookie
  path: string;
  domain: string;   // normalized, no leading dot
  hostOnly: boolean; // true = exact domain match only
}

class CookieJar {
  private store = new Map<string, Map<string, CookieEntry>>();
  // store key = normalized domain (no leading dot)
  // inner key = cookie name

  constructor(seeds: Record<string, string[]> = {}) {
    for (const [domain, cookies] of Object.entries(seeds)) {
      const normalizedDomain = domain.replace(/^\./, '');
      for (const cookie of cookies) {
        const [name, ...rest] = cookie.split('=');
        const value = rest.join('=');
        if (!this.store.has(normalizedDomain)) {
          this.store.set(normalizedDomain, new Map());
        }
        this.store.get(normalizedDomain)!.set(name.trim(), {
          value: value.trim(),
          path: '/',
          domain: normalizedDomain,
          hostOnly: false,
        });
      }
    }
  }

  /** Parse Set-Cookie headers from a response and store them */
  setCookies(headers: Headers, requestUrl: string): void {
    const requestHost = new URL(requestUrl).hostname;

    // Headers.getSetCookie() is available in modern environments; fall back to get()
    let setCookieLines: string[] = [];
    if (typeof (headers as any).getSetCookie === 'function') {
      setCookieLines = (headers as any).getSetCookie();
    } else {
      const raw = headers.get('set-cookie');
      if (raw) setCookieLines = [raw];
    }

    for (const line of setCookieLines) {
      const parts = line.split(';').map((p: string) => p.trim());
      const [nameValue, ...attrs] = parts;
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();

      let expires: Date | undefined;
      let path = '/';
      let domain = '';
      let hostOnly = true;

      for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower.startsWith('expires=')) {
          const d = new Date(attr.slice('expires='.length));
          if (!isNaN(d.getTime())) expires = d;
        } else if (lower.startsWith('max-age=')) {
          const secs = parseInt(attr.slice('max-age='.length), 10);
          if (!isNaN(secs)) {
            expires = new Date(Date.now() + secs * 1000);
          }
        } else if (lower.startsWith('path=')) {
          path = attr.slice('path='.length) || '/';
        } else if (lower.startsWith('domain=')) {
          const raw = attr.slice('domain='.length).replace(/^\./, '');
          if (raw) {
            domain = raw;
            hostOnly = false;
          }
        }
      }

      const normalizedDomain = domain || requestHost;
      if (!this.store.has(normalizedDomain)) {
        this.store.set(normalizedDomain, new Map());
      }
      this.store.get(normalizedDomain)!.set(name, {
        value,
        expires,
        path,
        domain: normalizedDomain,
        hostOnly,
      });
    }
  }

  /** Build the Cookie header string for a given URL */
  getCookieHeader(url: string): string {
    const { hostname, pathname } = new URL(url);
    const matches: string[] = [];

    for (const [, cookieMap] of this.store) {
      for (const [name, entry] of cookieMap) {
        if (this.isExpired(entry)) continue;
        if (!this.hostMatches(entry.domain, entry.hostOnly, hostname)) continue;
        if (!pathname.startsWith(entry.path)) continue;
        matches.push(`${name}=${entry.value}`);
      }
    }

    return matches.join('; ');
  }

  private isExpired(entry: CookieEntry): boolean {
    if (!entry.expires) return false;
    return entry.expires.getTime() < Date.now();
  }

  private hostMatches(cookieDomain: string, hostOnly: boolean, requestHost: string): boolean {
    if (hostOnly) {
      return cookieDomain === requestHost;
    }
    // domain cookie: match exact or any subdomain
    return requestHost === cookieDomain || requestHost.endsWith(`.${cookieDomain}`);
  }
}

// Empty singleton — kl locale cookie must NOT be pre-seeded.
// Sending kl=cn-zh suppresses the nav-link/vqd that DDG embeds in the first page,
// breaking pagination. Locale is controlled via Accept-Language header instead.
export const cookieJar = new CookieJar();
