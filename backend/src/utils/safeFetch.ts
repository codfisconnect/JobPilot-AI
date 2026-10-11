import dns from 'dns';
import { URL } from 'url';

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseSizeBytes?: number;
}

export interface SafeFetchResponse {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  text: string;
  contentType: string;
  redirectsFollowed: number;
}

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or restricted range.
 */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP treated as unsafe
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks if an IPv6 address is loopback, unique local, link-local, or IPv4-mapped private.
 */
export function isPrivateIpv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === '::1' || norm === '::' || norm === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (norm.startsWith('::ffff:')) {
    const v4 = norm.replace('::ffff:', '');
    return isPrivateIpv4(v4);
  }

  // fc00::/7 (Unique local)
  if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
  // fe80::/10 (Link-local)
  if (norm.startsWith('fe80') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true;

  return false;
}

/**
 * Validates a target URL against SSRF attacks.
 * Blocks non-http/https schemes, loopback/private hostnames, and private IPs after DNS resolution.
 */
export async function validateSafeUrl(rawUrl: string): Promise<{ safe: boolean; error?: string; parsedUrl?: URL }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err: any) {
    return { safe: false, error: 'Invalid URL format' };
  }

  // 1. Protocol check: only http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Disallowed protocol: ${parsed.protocol}. Only http: and https: are permitted.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Block direct localhost / local / internal hostnames
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data'
  ) {
    return { safe: false, error: `Access to local/private hostname '${hostname}' is blocked (SSRF Protection).` };
  }

  // 3. If hostname is already an IP address, check directly
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) {
      return { safe: false, error: `Access to private IP address '${hostname}' is blocked (SSRF Protection).` };
    }
  }

  // 4. DNS resolution check: resolve hostname and ensure none of the IP addresses point to private/loopback
  try {
    let dnsTimer: NodeJS.Timeout | undefined;
    const dnsPromise = dns.promises.lookup(hostname, { all: true });
    const timeoutPromise = new Promise<never>((_, reject) => {
      dnsTimer = setTimeout(() => reject(new Error(`DNS resolution timed out for ${hostname}`)), 4000);
    });

    const addresses = await Promise.race([dnsPromise, timeoutPromise]).finally(() => {
      if (dnsTimer) clearTimeout(dnsTimer);
    });

    if (!addresses || addresses.length === 0) {
      return { safe: false, error: `Hostname '${hostname}' could not be resolved via DNS.` };
    }

    for (const addr of addresses) {
      if (addr.family === 4 && isPrivateIpv4(addr.address)) {
        return { safe: false, error: `Resolved IP '${addr.address}' for '${hostname}' is in a private network range (SSRF Protection).` };
      }
      if (addr.family === 6 && isPrivateIpv6(addr.address)) {
        return { safe: false, error: `Resolved IPv6 '${addr.address}' for '${hostname}' is in a private network range (SSRF Protection).` };
      }
    }
  } catch (dnsErr: any) {
    return { safe: false, error: `DNS lookup failed for hostname '${hostname}': ${dnsErr.message}` };
  }

  return { safe: true, parsedUrl: parsed };
}

/**
 * Safely fetches a URL with SSRF protection, strict timeouts, max size limit, and safe redirect validation.
 */
export async function safeFetchUrl(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResponse> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxRedirects = options.maxRedirects ?? 5;
  const maxBytes = options.maxResponseSizeBytes ?? 10 * 1024 * 1024; // 10MB default
  const method = options.method ?? 'GET';

  let currentUrl = rawUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    // SSRF validation on every hop
    const check = await validateSafeUrl(currentUrl);
    if (!check.safe) {
      throw new Error(`SSRF validation failed: ${check.error}`);
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PilotMama-Discovery/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8',
          ...(options.headers || {})
        },
        body: options.body,
        redirect: 'manual', // Manually handle redirects so we can validate each destination against SSRF!
        signal: controller.signal
      });

      // Handle redirect status codes (301, 302, 303, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        clearTimeout(timer);
        const locationHeader = response.headers.get('location');
        if (!locationHeader) {
          throw new Error(`Redirect response (${response.status}) missing Location header.`);
        }

        const nextUrl = new URL(locationHeader, currentUrl).toString();
        redirects++;
        if (redirects > maxRedirects) {
          throw new Error(`Exceeded maximum redirect limit (${maxRedirects}).`);
        }

        currentUrl = nextUrl;
        continue; // Follow redirect safely
      }

      const contentType = response.headers.get('content-type') || '';

      // Stream / buffer response with strict size limit
      // Note: timer remains ACTIVE during body read phase, ensuring a hard upper bound on total fetch duration!
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > maxBytes) {
                await reader.cancel();
                throw new Error(`Response size exceeded maximum allowed limit of ${maxBytes} bytes.`);
              }
              chunks.push(value);
            }
          }
        } catch (streamErr: any) {
          try { await reader.cancel(); } catch {}
          throw streamErr;
        }
      }

      clearTimeout(timer);

      const text = Buffer.concat(chunks).toString('utf-8');

      const headersMap: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        headersMap[k.toLowerCase()] = v;
      });

      return {
        url: rawUrl,
        finalUrl: currentUrl,
        status: response.status,
        headers: headersMap,
        text,
        contentType,
        redirectsFollowed: redirects
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (timedOut || err.name === 'AbortError') {
        throw new Error(`Fetch timed out after ${timeoutMs}ms for ${currentUrl}`);
      }
      throw err;
    }
  }

  throw new Error(`Too many redirects (limit: ${maxRedirects})`);
}
