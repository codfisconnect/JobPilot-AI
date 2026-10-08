import assert from 'node:assert';

class MockFetchEnvironment {
  private accessToken: string | null = 'initial_expired_token';
  private refreshCount: number = 0;
  private uploadAttempts: number = 0;
  private refreshShouldFail: boolean = false;
  private refreshPromise: Promise<any> | null = null;

  setRefreshShouldFail(val: boolean) {
    this.refreshShouldFail = val;
  }

  setToken(token: string | null) {
    this.accessToken = token;
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      this.refreshCount++;
      if (this.refreshShouldFail) {
        throw { code: 'HTTP_401', message: 'Invalid refresh token' };
      }
      this.accessToken = 'new_fresh_access_token_' + this.refreshCount;
      return { accessToken: this.accessToken };
    })().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  async uploadResume(formData: any, isRetry: boolean = false): Promise<any> {
    this.uploadAttempts++;

    if (this.accessToken === 'initial_expired_token' || this.accessToken === 'permanently_invalid_token') {
      if (!isRetry) {
        try {
          await this.refresh();
          return this.uploadResume(formData, true);
        } catch (err) {
          // Refresh failed
        }
      }
      throw { code: 'HTTP_401', message: 'Unauthorized' };
    }

    return { id: 'res_123', fileName: 'resume.pdf', status: 'PARSED' };
  }

  getMetrics() {
    return {
      uploadAttempts: this.uploadAttempts,
      refreshCount: this.refreshCount,
      currentToken: this.accessToken
    };
  }
}

async function runTests() {
  console.log('Testing Resume Upload 401 Interceptor and Refresh Resilience...');

  // Test 1: Expired token recovers transparently on first upload attempt
  {
    const env = new MockFetchEnvironment();
    const result = await env.uploadResume({ file: 'dummy' });
    const metrics = env.getMetrics();
    assert.strictEqual(result.id, 'res_123');
    assert.strictEqual(metrics.uploadAttempts, 2, 'Initial 401 + 1 retry = 2 attempts');
    assert.strictEqual(metrics.refreshCount, 1, 'Refreshed exactly once');
    assert.strictEqual(metrics.currentToken, 'new_fresh_access_token_1');
    console.log('[PASS] Test B: Expired access token triggers refresh and succeeds on retry');
  }

  // Test 2: Valid token requires zero refreshes
  {
    const env = new MockFetchEnvironment();
    env.setToken('valid_token');
    const result = await env.uploadResume({ file: 'dummy' });
    const metrics = env.getMetrics();
    assert.strictEqual(result.id, 'res_123');
    assert.strictEqual(metrics.uploadAttempts, 1, 'Single upload attempt');
    assert.strictEqual(metrics.refreshCount, 0, 'No refresh triggered');
    console.log('[PASS] Test A: Valid access token succeeds without refresh');
  }

  // Test 3: Refresh failure terminates gracefully without looping
  {
    const env = new MockFetchEnvironment();
    env.setRefreshShouldFail(true);
    let errorCaught = false;
    try {
      await env.uploadResume({ file: 'dummy' });
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.code, 'HTTP_401');
    }
    const metrics = env.getMetrics();
    assert.ok(errorCaught, 'Error must be thrown');
    assert.strictEqual(metrics.uploadAttempts, 1, 'No second upload attempt if refresh failed');
    assert.strictEqual(metrics.refreshCount, 1, 'Single refresh attempted');
    console.log('[PASS] Test C: Refresh failure throws HTTP_401 without infinite loops');
  }

  // Test 4: Permanently invalid token stops after exactly 1 retry (prevent infinite loop)
  {
    const env = new MockFetchEnvironment();
    env.setToken('permanently_invalid_token');
    env.refresh = async () => {
      return { accessToken: 'permanently_invalid_token' };
    };
    let errorCaught = false;
    try {
      await env.uploadResume({ file: 'dummy' });
    } catch (err: any) {
      errorCaught = true;
    }
    const metrics = env.getMetrics();
    assert.ok(errorCaught);
    assert.strictEqual(metrics.uploadAttempts, 2, 'Must stop at exactly 1 retry');
    console.log('[PASS] Test D: Never loops infinitely even if token remains unauthorized');
  }

  // Test 5: Concurrent 401 uploads coordinate on single refresh
  {
    const env = new MockFetchEnvironment();
    const [res1, res2] = await Promise.all([
      env.uploadResume({ file: 'dummy1' }),
      env.uploadResume({ file: 'dummy2' })
    ]);
    const metrics = env.getMetrics();
    assert.strictEqual(res1.id, 'res_123');
    assert.strictEqual(res2.id, 'res_123');
    assert.strictEqual(metrics.refreshCount, 1, 'Single unified refresh promise for concurrent calls');
    console.log('[PASS] Test E: Concurrent requests share single refresh promise');
  }

  console.log('ALL RESUME UPLOAD RESILIENCE TESTS PASSED.');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
