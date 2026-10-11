import assert from 'node:assert';



interface RecordedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: any;
  credentials?: string;
}

function createMockFetch(config: {
  uploadResponses?: Array<{ status: number; body?: any }>;
  refreshResponses?: Array<{ status: number; body?: any }>;
  onFetch?: (req: RecordedRequest) => void;
}) {
  const uploadQueue = [...(config.uploadResponses || [])];
  const refreshQueue = [...(config.refreshResponses || [])];
  const history: RecordedRequest[] = [];

  const originalFetch = globalThis.fetch;

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    const headers = new Headers(init?.headers);
    const body = init?.body;
    const credentials = init?.credentials;

    const recorded: RecordedRequest = { url, method, headers, body, credentials };
    history.push(recorded);
    if (config.onFetch) config.onFetch(recorded);

    if (url.endsWith('/resumes')) {
      const next = uploadQueue.shift() || {
        status: 200,
        body: { success: true, data: { id: 'resume_123', fileName: 'sample.pdf' } }
      };
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.endsWith('/auth/refresh')) {
      const next = refreshQueue.shift() || {
        status: 200,
        body: {
          success: true,
          data: {
            accessToken: 'refreshed_access_token',
            user: { id: 'u1', email: 'test@example.com', role: 'CANDIDATE' }
          }
        }
      };
      return new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  return {
    mockFetch,
    history,
    restore: () => {
      globalThis.fetch = originalFetch;
    }
  };
}

async function runTests() {
  console.log('--- Testing ApiClient.uploadResume() Against Real Network Boundary ---\n');

  // Dynamically load the real ApiClient from frontend/src/api/client.ts
  // A variable path is used to prevent tsc from traversing outside backend's rootDir
  const frontendClientModulePath = '../../../frontend/src/api/client.js';
  const { ApiClient } = await import(frontendClientModulePath);

  // Requirement 3A: Valid access token
  // - upload succeeds
  // - exactly 1 upload request
  // - refresh not called
  {
    console.log('Testing Scenario A: Valid access token');
    const mock = createMockFetch({
      uploadResponses: [
        { status: 200, body: { success: true, data: { id: 'res_valid_1', fileName: 'resume_a.pdf' } } }
      ]
    });
    globalThis.fetch = mock.mockFetch as any;

    try {
      const client = new ApiClient();
      client.setToken('valid_access_token_123');

      const testFile = new File(['dummy resume content'], 'resume_a.pdf', { type: 'application/pdf' });
      const res = await client.uploadResume(testFile, 'My Valid Resume');

      assert.strictEqual(res.id, 'res_valid_1');

      const uploadRequests = mock.history.filter(r => r.url.endsWith('/resumes'));
      const refreshRequests = mock.history.filter(r => r.url.endsWith('/auth/refresh'));

      assert.strictEqual(uploadRequests.length, 1, 'Exactly 1 upload request must be sent');
      assert.strictEqual(refreshRequests.length, 0, 'Refresh must not be called when token is valid');
      console.log('✔ Scenario A passed: exactly 1 upload, 0 refresh calls, upload succeeded\n');
    } finally {
      mock.restore();
    }
  }

  // Requirement 3B: Expired access token
  // - first upload returns 401
  // - refresh endpoint is called
  // - refresh returns a new access token
  // - exact same resume file is retried
  // - second upload succeeds
  // - exactly 2 upload attempts total
  // - exactly 1 refresh
  {
    console.log('Testing Scenario B: Expired access token recovery');
    const mock = createMockFetch({
      uploadResponses: [
        { status: 401, body: { success: false, error: { code: 'HTTP_401', message: 'Token expired' } } },
        { status: 200, body: { success: true, data: { id: 'res_retry_2', fileName: 'resume_b.pdf' } } }
      ],
      refreshResponses: [
        {
          status: 200,
          body: {
            success: true,
            data: {
              accessToken: 'new_rotated_token_456',
              user: { id: 'u1', email: 'test@example.com', role: 'CANDIDATE' }
            }
          }
        }
      ]
    });
    globalThis.fetch = mock.mockFetch as any;

    try {
      const client = new ApiClient();
      client.setToken('expired_old_token');

      const testFile = new File(['test resume bytes'], 'resume_b.pdf', { type: 'application/pdf' });
      const res = await client.uploadResume(testFile, 'Targeted Resume B');

      assert.strictEqual(res.id, 'res_retry_2');
      assert.strictEqual(client.getToken(), 'new_rotated_token_456', 'Client updated to new token');

      const uploadRequests = mock.history.filter(r => r.url.endsWith('/resumes'));
      const refreshRequests = mock.history.filter(r => r.url.endsWith('/auth/refresh'));

      assert.strictEqual(uploadRequests.length, 2, 'Exactly 2 upload attempts total (initial + retry)');
      assert.strictEqual(refreshRequests.length, 1, 'Exactly 1 refresh request sent');

      // Verify initial attempt carried old token
      assert.strictEqual(uploadRequests[0].headers.get('Authorization'), 'Bearer expired_old_token');
      // Verify retry carried new rotated token
      assert.strictEqual(uploadRequests[1].headers.get('Authorization'), 'Bearer new_rotated_token_456');

      // Verify exact same file was transmitted in retry
      const firstFormData = uploadRequests[0].body as FormData;
      const secondFormData = uploadRequests[1].body as FormData;
      const file1 = firstFormData.get('resume') as File;
      const file2 = secondFormData.get('resume') as File;
      assert.strictEqual(file1.name, 'resume_b.pdf');
      assert.strictEqual(file2.name, 'resume_b.pdf');
      assert.strictEqual(firstFormData.get('title'), 'Targeted Resume B');
      assert.strictEqual(secondFormData.get('title'), 'Targeted Resume B');

      console.log('✔ Scenario B passed: 401 refreshed token, exact file retried with new token, 2 uploads & 1 refresh\n');
    } finally {
      mock.restore();
    }
  }

  // Requirement 3C: Refresh failure
  // - initial upload returns 401
  // - refresh fails
  // - no upload retry
  // - final error is 401
  // - no infinite loop
  {
    console.log('Testing Scenario C: Refresh failure handling');
    const mock = createMockFetch({
      uploadResponses: [
        { status: 401, body: { success: false, error: { code: 'HTTP_401', message: 'Token expired' } } }
      ],
      refreshResponses: [
        { status: 401, body: { success: false, error: { code: 'HTTP_401', message: 'Invalid refresh session' } } }
      ]
    });
    globalThis.fetch = mock.mockFetch as any;

    try {
      const client = new ApiClient();
      client.setToken('expired_token_xyz');

      const testFile = new File(['content'], 'resume_c.pdf', { type: 'application/pdf' });
      let caughtError: any = null;

      try {
        await client.uploadResume(testFile);
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Must throw error when refresh fails');
      assert.strictEqual(caughtError.code, 'HTTP_401');

      const uploadRequests = mock.history.filter(r => r.url.endsWith('/resumes'));
      const refreshRequests = mock.history.filter(r => r.url.endsWith('/auth/refresh'));

      assert.strictEqual(uploadRequests.length, 1, 'No upload retry when refresh fails');
      assert.strictEqual(refreshRequests.length, 1, 'Only 1 refresh attempt before error termination');

      console.log('✔ Scenario C passed: refresh failure aborts retry, returns 401 without infinite loop\n');
    } finally {
      mock.restore();
    }
  }

  // Requirement 3D: Second 401
  // - first upload returns 401
  // - refresh succeeds
  // - second upload also returns 401
  // - exactly one retry
  // - no second refresh cycle
  {
    console.log('Testing Scenario D: Second 401 prevents infinite refresh cycle');
    const mock = createMockFetch({
      uploadResponses: [
        { status: 401, body: { success: false, error: { code: 'HTTP_401', message: 'Initial token invalid' } } },
        { status: 401, body: { success: false, error: { code: 'HTTP_401', message: 'Second token also invalid' } } }
      ],
      refreshResponses: [
        {
          status: 200,
          body: {
            success: true,
            data: { accessToken: 'token_from_first_refresh', user: { id: 'u1' } }
          }
        },
        {
          status: 200,
          body: {
            success: true,
            data: { accessToken: 'should_not_be_called', user: { id: 'u1' } }
          }
        }
      ]
    });
    globalThis.fetch = mock.mockFetch as any;

    try {
      const client = new ApiClient();
      client.setToken('initially_invalid_token');

      const testFile = new File(['bytes'], 'resume_d.pdf', { type: 'application/pdf' });
      let caughtError: any = null;

      try {
        await client.uploadResume(testFile);
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, 'Must throw error on second 401');
      assert.strictEqual(caughtError.code, 'HTTP_401');

      const uploadRequests = mock.history.filter(r => r.url.endsWith('/resumes'));
      const refreshRequests = mock.history.filter(r => r.url.endsWith('/auth/refresh'));

      assert.strictEqual(uploadRequests.length, 2, 'Exactly 2 upload attempts total (initial + single retry)');
      assert.strictEqual(refreshRequests.length, 1, 'Exactly 1 refresh request, no second refresh cycle');

      console.log('✔ Scenario D passed: exactly 1 retry and 1 refresh cycle, stops on second 401\n');
    } finally {
      mock.restore();
    }
  }

  // Requirement 3E: Concurrent 401s
  // - start two ApiClient requests concurrently
  // - both initially receive 401
  // - only one refresh request is sent
  // - both reuse the shared refresh promise
  // - both retry appropriately
  {
    console.log('Testing Scenario E: Concurrent 401 deduplication and shared refresh promise');

    let refreshCallCount = 0;
    const originalFetch = globalThis.fetch;

    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = new Headers(init?.headers);

      if (url.endsWith('/auth/refresh')) {
        refreshCallCount++;
        // Small artificial delay to verify shared concurrent promise locking
        await new Promise(resolve => setTimeout(resolve, 50));
        return new Response(JSON.stringify({
          success: true,
          data: { accessToken: 'shared_concurrent_token_789', user: { id: 'u1' } }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.endsWith('/resumes')) {
        const auth = headers.get('Authorization');
        if (auth === 'Bearer shared_concurrent_token_789') {
          return new Response(JSON.stringify({
            success: true,
            data: { id: 'res_success', status: 'UPLOADED' }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // First attempt with stale token returns 401
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'HTTP_401', message: 'Expired token' }
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: false }), { status: 404 });
    };

    globalThis.fetch = mockFetch as any;

    try {
      const client = new ApiClient();
      client.setToken('stale_shared_token');

      const file1 = new File(['content 1'], 'file1.pdf', { type: 'application/pdf' });
      const file2 = new File(['content 2'], 'file2.pdf', { type: 'application/pdf' });

      const [res1, res2] = await Promise.all([
        client.uploadResume(file1, 'Title 1'),
        client.uploadResume(file2, 'Title 2')
      ]);

      assert.strictEqual(res1.id, 'res_success');
      assert.strictEqual(res2.id, 'res_success');
      assert.strictEqual(refreshCallCount, 1, 'Only one refresh request must be sent for concurrent 401s');
      assert.strictEqual(client.getToken(), 'shared_concurrent_token_789');

      console.log('✔ Scenario E passed: 2 concurrent uploads shared exactly 1 refresh request and succeeded\n');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // Requirement 3F: Multipart correctness
  // - actual upload request receives FormData
  // - Authorization header is present when access token exists
  // - Content-Type is NOT manually set to multipart/form-data
  // - browser/fetch is allowed to generate the multipart boundary
  {
    console.log('Testing Scenario F: Multipart correctness and boundary generation');
    let capturedHeaders: Headers | null = null;
    let capturedBody: any = null;

    const mock = createMockFetch({
      uploadResponses: [
        { status: 200, body: { success: true, data: { id: 'multipart_ok' } } }
      ],
      onFetch: (req) => {
        if (req.url.endsWith('/resumes')) {
          capturedHeaders = req.headers;
          capturedBody = req.body;
        }
      }
    });
    globalThis.fetch = mock.mockFetch as any;

    try {
      const client = new ApiClient();
      client.setToken('multipart_test_bearer_token');

      const file = new File(['binary content'], 'my_resume.pdf', { type: 'application/pdf' });
      const res = await client.uploadResume(file, 'My Multipart Resume');

      assert.strictEqual(res.id, 'multipart_ok');
      assert.ok(capturedBody instanceof FormData, 'Upload body must be an instance of FormData');
      assert.strictEqual((capturedBody as FormData).get('title'), 'My Multipart Resume');

      assert.ok(capturedHeaders !== null, 'Headers must be captured');
      assert.strictEqual(
        (capturedHeaders as Headers).get('Authorization'),
        'Bearer multipart_test_bearer_token',
        'Authorization header must be present'
      );

      // CRITICAL CHECK: Content-Type must NOT be manually set to multipart/form-data
      // When omitted, the browser/fetch runtime automatically injects:
      // Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
      const explicitContentType = (capturedHeaders as Headers).get('Content-Type');
      assert.strictEqual(
        explicitContentType,
        null,
        `Content-Type header must NOT be manually set! (Found: ${explicitContentType}). Browser/fetch must generate the boundary.`
      );

      console.log('✔ Scenario F passed: FormData used, Authorization present, Content-Type NOT hardcoded (boundary preserved)\n');
    } finally {
      mock.restore();
    }
  }

  console.log('======================================================');
  console.log('ALL REAL APICLIENT RESUME AUTHENTICATION TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
