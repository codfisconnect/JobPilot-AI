import dns from 'dns';
import { safeFetchUrl } from './safeFetch.js';

export interface DiagnosticResult {
  url: string;
  dnsResolution: {
    durationMs: number;
    addresses?: Array<{ address: string; family: number }>;
    error?: string;
  };
  fetch: {
    status?: number;
    finalUrl?: string;
    contentType?: string;
    contentLength?: number;
    responseDurationMs?: number;
    totalDurationMs?: number;
    error?: string;
  };
}

export async function runSafeFetchDiagnostic(targetUrl = 'https://www.synechron.com/careers'): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    url: targetUrl,
    dnsResolution: { durationMs: 0 },
    fetch: {}
  };

  const parsed = new URL(targetUrl);

  // 1. DNS Resolution Probe
  const dnsStart = Date.now();
  try {
    const addresses = await dns.promises.lookup(parsed.hostname, { all: true });
    result.dnsResolution.durationMs = Date.now() - dnsStart;
    result.dnsResolution.addresses = addresses;
  } catch (dnsErr: any) {
    result.dnsResolution.durationMs = Date.now() - dnsStart;
    result.dnsResolution.error = dnsErr.message;
  }

  // 2. Safe Fetch Probe
  const fetchStart = Date.now();
  try {
    const response = await safeFetchUrl(targetUrl, { timeoutMs: 15000 });
    const totalDuration = Date.now() - fetchStart;

    result.fetch.status = response.status;
    result.fetch.finalUrl = response.finalUrl;
    result.fetch.contentType = response.contentType;
    result.fetch.contentLength = response.text.length;
    result.fetch.totalDurationMs = totalDuration;
  } catch (fetchErr: any) {
    result.fetch.totalDurationMs = Date.now() - fetchStart;
    result.fetch.error = fetchErr.message;
  }

  return result;
}

// Standalone execution if invoked directly
if (process.argv[1]?.includes('diagnostic')) {
  console.log('Running SafeFetch Diagnostic on https://www.synechron.com/careers...');
  runSafeFetchDiagnostic('https://www.synechron.com/careers')
    .then(diag => {
      console.log('Diagnostic Results:');
      console.log(JSON.stringify(diag, null, 2));
    })
    .catch(err => {
      console.error('Diagnostic probe failed:', err);
    });
}
