import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WorkdayApplicationStrategy } from '../modules/applications/workdayApplication.strategy.js';

describe('WorkdayApplicationStrategy Unit & Security Tests', () => {
  it('Correctly identifies valid Workday career portal URLs', () => {
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('https://synechron.wd1.myworkdayjobs.com/en-US/Synechron/job/Workday-Admin_JR-102'),
      true
    );
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('https://company.myworkdayjobs.com/careers'),
      true
    );
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('https://workday.com/company/jobs'),
      true
    );
  });

  it('Blocks non-Workday or insecure URLs (SSRF prevention)', () => {
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('http://synechron.wd1.myworkdayjobs.com/job'),
      false // non-HTTPS
    );
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('https://evil-site.com/fake-workday'),
      false
    );
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('https://169.254.169.254/latest/meta-data'),
      false
    );
    assert.strictEqual(
      WorkdayApplicationStrategy.isWorkdayUrl('https://localhost:8080/workday'),
      false
    );
  });

  it('Parses Workday tenant and site information correctly', () => {
    const parsed = WorkdayApplicationStrategy.parseWorkdayUrl(
      'https://synechron.wd1.myworkdayjobs.com/en-US/Synechron/job/Workday-Admin_JR-102'
    );
    assert.strictEqual(parsed.tenant, 'synechron');
    assert.strictEqual(parsed.site, 'en-US');
  });

  it('Simulates Workday application automation and enforces voluntary disclosure gate', async () => {
    const mockTask: any = {
      taskId: 'task_test_wd1',
      applicationUrl: 'https://synechron.wd1.myworkdayjobs.com/en-US/Synechron/job/Workday-Admin_JR-102',
      platform: 'WORKDAY',
      atsCompatibilityScore: 85
    };

    const mockCandidate: any = {
      fullName: 'Syed Salman A',
      email: 'salman@pilotmama.test',
      location: 'Pune, India',
      experiences: [
        {
          company: 'Synechron',
          title: 'Workday Admin',
          startDate: new Date('2021-01-01'),
          isCurrent: true
        }
      ]
    };

    const res = await WorkdayApplicationStrategy.executeFlow({
      task: mockTask,
      candidateProfile: mockCandidate,
      resumeVersion: { id: 'rv-1', versionName: 'Tailored_Workday_v1' },
      autoApplyEnabled: true
    });

    assert.strictEqual(res.success, true);
    // Requires candidate voluntary disclosure confirmation
    assert.strictEqual(res.finalState, 'USER_ACTION_REQUIRED');
    assert.strictEqual(res.userActionType, 'TERMS_CONSENT');
    assert.ok(res.stepsExecuted.some(s => s.step === 'MY_INFORMATION'));
    assert.ok(res.stepsExecuted.some(s => s.step === 'DOCUMENT_UPLOAD'));
  });
});
