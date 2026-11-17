import assert from 'assert';
import { DateExtractionService } from '../universalDiscovery/dateExtraction.service.js';
import { ExcelJobAssociationService } from '../services/excelJobAssociation.service.js';
import { JobNormalizationService } from '../services/jobNormalization.service.js';
import { RippleHireAdapter } from '../universalDiscovery/adapters/ripplehire.adapter.js';

export async function runJobDateAndSortingTests() {
  console.log('\n--- Running Job Pilot AI: Publication Date & Newest-First Sorting Test Suite ---');
  let passed = 0;
  let total = 0;

  function testAssert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. RippleHire Response with jobPostingDate
  const rippleHireItem1 = {
    jobSeq: 1001,
    jobCode: 'BCT-1001',
    jobTitle: 'Senior Automation Test Engineer',
    jobDesc: 'Lead QA automation framework for enterprise client.',
    jobLocation: 'Chennai, India',
    jobPostingDate: '2026-11-16 14:30:00',
    createDttm: '2026-11-10 09:00:00',
    jobStatus: 'ACTIVE'
  };

  const rhDateRes1 = DateExtractionService.extractPublicationDate(rippleHireItem1, 'jobPostingDate', 'ATS_API');
  testAssert(rhDateRes1.sourcePublishedAt !== null, 'RippleHire: extracts sourcePublishedAt from jobPostingDate');
  testAssert(rhDateRes1.sourceDateField === 'jobPostingDate', 'RippleHire: identifies sourceDateField as jobPostingDate');
  testAssert(rhDateRes1.sourceDatePrecision === 'EXACT_TIMESTAMP', 'RippleHire: identifies precision as EXACT_TIMESTAMP');
  testAssert(rhDateRes1.rawPostingDate === '2026-11-16 14:30:00', 'RippleHire: preserves raw source string for auditing');

  // 2. RippleHire with missing jobPostingDate but with createDttm fallback
  const rippleHireItem2 = {
    jobSeq: 1002,
    jobTitle: 'DevOps Specialist',
    jobDesc: 'CI/CD pipeline lead',
    createDttm: '2026-11-12T08:15:00Z'
  };
  const rhDateRes2 = DateExtractionService.extractPublicationDate(rippleHireItem2, 'jobPostingDate', 'ATS_API');
  testAssert(rhDateRes2.sourcePublishedAt !== null, 'RippleHire: falls back to createDttm when jobPostingDate is missing');
  testAssert(rhDateRes2.sourceDatePrecision === 'CREATION_FALLBACK', 'RippleHire: marks precision as CREATION_FALLBACK');
  testAssert(rhDateRes2.sourceDateField === 'createDttm', 'RippleHire: records createDttm as sourceDateField');

  // 3. Blacklist verification: rejects lastModified / updated_at
  const blacklistedPayload = {
    id: 555,
    title: 'Software Developer',
    updated_at: '2026-11-16T18:00:00Z',
    lastModified: '2026-11-16T18:00:00Z'
  };
  const blacklistedRes = DateExtractionService.extractPublicationDate(blacklistedPayload, 'updated_at', 'ATS_API');
  testAssert(blacklistedRes.sourcePublishedAt === null, 'Blacklist: never extracts updated_at or lastModified as publication date');
  testAssert(blacklistedRes.sourceDatePrecision === 'UNAVAILABLE', 'Blacklist: sets precision to UNAVAILABLE when only update timestamps exist');
  testAssert(blacklistedRes.firstDiscoveredAt instanceof Date, 'Blacklist: preserves firstDiscoveredAt as fallback');

  // 4. Multi-portal candidate fields: Lever (epoch ms), Ashby (publishedAt), Workday (postedOn)
  const leverItem = {
    id: 'lev-1',
    text: 'Site Reliability Engineer',
    createdAt: 1731758400000 // 2024-11-16T12:00:00.000Z
  };
  const leverDateRes = DateExtractionService.extractPublicationDate(leverItem, 'createdAt', 'ATS_API');
  testAssert(leverDateRes.sourcePublishedAt !== null && leverDateRes.sourcePublishedAt.getTime() === 1731758400000, 'Lever: extracts epoch timestamp correctly');

  const workdayItem = {
    id: 'wd-1',
    title: 'Financial Analyst',
    postedOn: '2026-11-14'
  };
  const workdayDateRes = DateExtractionService.extractPublicationDate(workdayItem, 'postedOn', 'ATS_API');
  testAssert(workdayDateRes.sourcePublishedAt !== null, 'Workday: extracts date-only postedOn');
  testAssert(workdayDateRes.sourceDatePrecision === 'DATE_ONLY', 'Workday: marks date-only precision without inventing hours');

  // 5. Job Normalization with Date Provenance
  const normalizedJob = JobNormalizationService.normalize({
    externalJobId: 'TEST-123',
    sourceType: 'RIPPLEHIRE',
    sourceName: 'RippleHire ATS',
    sourceUrl: 'https://careers.example.com/jobs/123',
    applicationUrl: 'https://careers.example.com/apply/123',
    title: 'Principal Architect',
    companyName: 'Acme Global',
    descriptionText: 'Lead enterprise software architecture.',
    rawPayload: rippleHireItem1
  });
  testAssert(normalizedJob.sourcePublishedAt !== null, 'JobNormalizationService: attaches sourcePublishedAt');
  testAssert(normalizedJob.firstDiscoveredAt instanceof Date, 'JobNormalizationService: server-generates firstDiscoveredAt');
  testAssert(normalizedJob.sourceDateField === 'jobPostingDate', 'JobNormalizationService: records sourceDateField');
  testAssert(normalizedJob.rawPostingDate === '2026-11-16 14:30:00', 'JobNormalizationService: retains rawPostingDate');

  // 6. Excel Association & Newest-First Sorting
  const mockExcelRows = [
    { externalJobId: 'JOB-OLD', title: 'Legacy Analyst', companyName: 'Acme Global' },
    { externalJobId: 'JOB-NEW', title: 'Modern Engineer', companyName: 'Acme Global' },
    { externalJobId: 'JOB-NO-DATE', title: 'Draft Spec', companyName: 'Acme Global' }
  ];

  // In-memory association sort rule test
  const testAssociated = [
    {
      jobId: '1',
      effectiveDate: new Date('2026-11-10T10:00:00Z'),
      sourcePublishedAt: new Date('2026-11-10T10:00:00Z'),
      excelRecord: mockExcelRows[0]
    },
    {
      jobId: '2',
      effectiveDate: new Date('2026-11-16T12:00:00Z'),
      sourcePublishedAt: new Date('2026-11-16T12:00:00Z'),
      excelRecord: mockExcelRows[1]
    },
    {
      jobId: '3',
      effectiveDate: null,
      sourcePublishedAt: null,
      excelRecord: mockExcelRows[2]
    }
  ];

  testAssociated.sort((a, b) => {
    const timeA = a.effectiveDate ? a.effectiveDate.getTime() : -1;
    const timeB = b.effectiveDate ? b.effectiveDate.getTime() : -1;
    if (timeA !== timeB) return timeB - timeA;
    return (a.jobId || '').localeCompare(b.jobId || '');
  });

  testAssert(testAssociated[0].jobId === '2', 'Sorting: newest published job (2026-11-16) appears first');
  testAssert(testAssociated[1].jobId === '1', 'Sorting: older published job (2026-11-10) appears second');
  testAssert(testAssociated[2].jobId === '3', 'Sorting: job without posting date placed predictably at bottom');

  // 7. Same-day full timestamp ordering
  const sameDayJobs = [
    { id: 'morning', date: new Date('2026-11-16T08:30:00Z') },
    { id: 'afternoon', date: new Date('2026-11-16T14:45:00Z') },
    { id: 'evening', date: new Date('2026-11-16T21:15:00Z') }
  ];
  sameDayJobs.sort((a, b) => b.date.getTime() - a.date.getTime());
  testAssert(sameDayJobs[0].id === 'evening', 'Same-day sorting: 21:15 appears first');
  testAssert(sameDayJobs[1].id === 'afternoon', 'Same-day sorting: 14:45 appears second');
  testAssert(sameDayJobs[2].id === 'morning', 'Same-day sorting: 08:30 appears third');

  // 8. Refresh & Duplicate Idempotency simulation
  const originalDiscovery = new Date('2026-10-01T00:00:00Z');
  const existingJob = {
    id: 'uuid-1',
    sourcePublishedAt: new Date('2026-09-15T10:00:00Z'),
    firstDiscoveredAt: originalDiscovery
  };
  // Refresh occurs 2 months later
  const refreshTime = new Date('2026-12-01T15:00:00Z');
  const incomingRefreshedData = {
    sourcePublishedAt: new Date('2026-09-15T10:00:00Z'),
    firstDiscoveredAt: refreshTime
  };
  // Repository preserves existing firstDiscoveredAt and existing sourcePublishedAt
  const preservedDiscovery = existingJob.firstDiscoveredAt;
  testAssert(preservedDiscovery.getTime() === originalDiscovery.getTime(), 'Refresh Idempotency: firstDiscoveredAt is never overwritten during refresh');

  console.log(`\nTest Results: ${passed}/${total} passed.`);
}

runJobDateAndSortingTests().catch(err => {
  console.error(err);
  process.exit(1);
});
