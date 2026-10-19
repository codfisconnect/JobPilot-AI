export interface DiscoveredFieldMapping {
  externalJobIdField?: string;
  titleField?: string;
  departmentField?: string;
  locationField?: string;
  countryField?: string;
  cityField?: string;
  workModeField?: string;
  employmentTypeField?: string;
  experienceField?: string;
  salaryField?: string;
  qualificationField?: string;
  summaryField?: string;
  descriptionField?: string;
  responsibilitiesField?: string;
  requirementsField?: string;
  preferredSkillsField?: string;
  skillsField?: string;
  applicationUrlField?: string;
  postedAtField?: string;
  deadlineField?: string;
  activeField?: string;
  rootJobsPath?: string; // e.g. "data" or "jobs" or "results" or "" (array root)
}

export interface InferredSchema {
  strategy: 'DETERMINISTIC' | 'AI_ASSISTED' | 'HYBRID';
  mapping: DiscoveredFieldMapping;
  rootPath: string;
  confidence: number;
}

export class FieldMapperService {
  /**
   * Deterministically finds the candidate key in an object matching standard patterns.
   */
  private static findMatchingKey(keys: string[], patterns: string[]): string | undefined {
    const lowerKeys = keys.map(k => ({ original: k, lower: k.toLowerCase().replace(/[-_]/g, '') }));

    for (const pat of patterns) {
      const cleanPat = pat.toLowerCase().replace(/[-_]/g, '');
      const match = lowerKeys.find(k => k.lower === cleanPat);
      if (match) return match.original;
    }

    for (const pat of patterns) {
      const cleanPat = pat.toLowerCase().replace(/[-_]/g, '');
      const match = lowerKeys.find(k => k.lower.includes(cleanPat));
      if (match) return match.original;
    }

    return undefined;
  }

  /**
   * Identifies where the list of jobs is located in a JSON response payload.
   */
  public static extractJobsArray(jsonPayload: any): { jobs: any[]; rootPath: string } {
    if (Array.isArray(jsonPayload)) {
      return { jobs: jsonPayload, rootPath: '' };
    }

    if (!jsonPayload || typeof jsonPayload !== 'object') {
      return { jobs: [], rootPath: '' };
    }

    const priorityWrapperKeys = ['data', 'jobs', 'results', 'jobList', 'openings', 'items', 'postings', 'vacancies', 'docs', 'content', 'records', 'opportunities', 'jobPostings'];

    for (const key of priorityWrapperKeys) {
      if (Array.isArray(jsonPayload[key]) && jsonPayload[key].length > 0) {
        return { jobs: jsonPayload[key], rootPath: key };
      }
    }

    // Check payload.response.docs (Solr / Lucene / Search API format)
    if (jsonPayload.response && typeof jsonPayload.response === 'object' && Array.isArray(jsonPayload.response.docs) && jsonPayload.response.docs.length > 0) {
      return { jobs: jsonPayload.response.docs, rootPath: 'response.docs' };
    }

    // Inspect any key whose value is an array
    for (const key of Object.keys(jsonPayload)) {
      if (Array.isArray(jsonPayload[key]) && jsonPayload[key].length > 0 && typeof jsonPayload[key][0] === 'object') {
        return { jobs: jsonPayload[key], rootPath: key };
      }
    }

    // Secondary check for nested wrappers e.g. payload.data.jobs
    for (const key of Object.keys(jsonPayload)) {
      if (jsonPayload[key] && typeof jsonPayload[key] === 'object' && !Array.isArray(jsonPayload[key])) {
        for (const subKey of priorityWrapperKeys) {
          if (Array.isArray(jsonPayload[key][subKey]) && jsonPayload[key][subKey].length > 0) {
            return { jobs: jsonPayload[key][subKey], rootPath: `${key}.${subKey}` };
          }
        }
      }
    }

    return { jobs: [], rootPath: '' };
  }

  /**
   * Deterministic schema inference from sample job records.
   */
  public static inferDeterministicMapping(sampleJobs: any[]): DiscoveredFieldMapping {
    if (!sampleJobs || sampleJobs.length === 0) {
      return {};
    }

    const sample = sampleJobs[0];
    const keys = Object.keys(sample);

    const mapping: DiscoveredFieldMapping = {};

    // 1. External Job ID / Code priority:
    mapping.externalJobIdField = this.findMatchingKey(keys, [
      'jobRequisitionId', 'job_requisition_id', 'requisitionId', 'requisition_id', 'job_code', 'jobCode',
      'externalId', 'external_id', 'documentId', 'document_id', 'code', 'slug', 'req_id', 'id'
    ]);

    // 2. Title
    mapping.titleField = this.findMatchingKey(keys, [
      'title', 'jobTitle', 'position', 'role', 'name', 'job_title', 'Job_Requisition', 'jobRequisition', 'job_requisition'
    ]);

    // 3. Department
    mapping.departmentField = this.findMatchingKey(keys, [
      'department', 'dept', 'team', 'category', 'function', 'business_unit', 'jobFamily', 'job_family', 'BU'
    ]);

    // 4. Location
    mapping.locationField = this.findMatchingKey(keys, [
      'displayLocation', 'display_location', 'Job_Posting_Location', 'jobPostingLocation', 'job_posting_location', 'locations', 'location', 'city', 'office', 'workplace', 'region', 'State', 'state', 'Country', 'country'
    ]);

    mapping.countryField = this.findMatchingKey(keys, [
      'countryName', 'country_name', 'country', 'countryCode', 'country_code'
    ]);

    mapping.cityField = this.findMatchingKey(keys, [
      'city', 'cityName', 'city_name', 'town'
    ]);

    // 5. Work Mode / Remote
    mapping.workModeField = this.findMatchingKey(keys, [
      'workMode', 'work_mode', 'remoteType', 'remote_type', 'workplaceType', 'isRemote', 'remote'
    ]);

    // 6. Employment Type
    mapping.employmentTypeField = this.findMatchingKey(keys, [
      'employmentType', 'employment_type', 'type', 'jobType', 'job_type', 'time'
    ]);

    // 7. Experience
    mapping.experienceField = this.findMatchingKey(keys, [
      'experience', 'experienceLevel', 'yearsOfExperience', 'exp', 'yoe'
    ]);

    // 8. Salary
    mapping.salaryField = this.findMatchingKey(keys, [
      'salary', 'compensation', 'pay', 'remuneration', 'ctc', 'package'
    ]);

    // 9. Qualification / Education
    mapping.qualificationField = this.findMatchingKey(keys, [
      'qualification', 'education', 'degree', 'qualificationRequirements'
    ]);

    // 10. Summary
    mapping.summaryField = this.findMatchingKey(keys, [
      'summary', 'shortDescription', 'overview', 'teaser', 'descriptionTeaser', 'snippet', 'intro'
    ]);

    // 11. Description
    mapping.descriptionField = this.findMatchingKey(keys, [
      'description', 'jobDescription', 'descriptionTeaser', 'details', 'body', 'content', 'text'
    ]);

    // 12. Responsibilities
    mapping.responsibilitiesField = this.findMatchingKey(keys, [
      'responsibilities', 'duties', 'roleResponsibilities', 'whatYouWillDo', 'tasks'
    ]);

    // 13. Requirements
    mapping.requirementsField = this.findMatchingKey(keys, [
      'requirements', 'qualifications', 'whoYouAre', 'whatYouNeed', 'eligibility', 'prerequisites'
    ]);

    // 14. Skills & Preferred Skills
    mapping.skillsField = this.findMatchingKey(keys, [
      'skills', 'required_skills', 'requiredSkills', 'coreSkills', 'techStack', 'technologies', 'ml_skills', 'mlSkills'
    ]);

    mapping.preferredSkillsField = this.findMatchingKey(keys, [
      'preferred_skills', 'preferredSkills', 'goodToHave', 'niceToHave', 'plus'
    ]);

    // 15. Application URL
    mapping.applicationUrlField = this.findMatchingKey(keys, [
      'applicationUrl', 'applyUrl', 'apply_url', 'application_url', 'url', 'link'
    ]);

    // 16. Posted Date & Deadline
    mapping.postedAtField = this.findMatchingKey(keys, [
      'posted_at', 'postedAt', 'postedDate', 'createdAt', 'created_at', 'publishDate', 'published_at', 'date'
    ]);

    mapping.deadlineField = this.findMatchingKey(keys, [
      'application_deadline', 'applicationDeadline', 'deadline', 'closing_date', 'expiresAt'
    ]);

    mapping.activeField = this.findMatchingKey(keys, [
      'active', 'isActive', 'status', 'isOpen', 'open'
    ]);

    return mapping;
  }

  /**
   * Applies mapping config to a raw record to construct normalized job raw item.
   * NEVER fabricates missing values.
   */
  public static mapRecord(
    rawRecord: any,
    mapping: DiscoveredFieldMapping,
    defaults: { companyName: string; companyDomain?: string; careersUrl: string; sourceType: string; sourceName: string }
  ): any {
    if (!rawRecord || typeof rawRecord !== 'object') return null;

    // Filter out inactive jobs if an active flag exists
    if (mapping.activeField !== undefined && rawRecord[mapping.activeField] !== undefined) {
      const activeVal = rawRecord[mapping.activeField];
      if (activeVal === false || activeVal === 0 || activeVal === 'false' || activeVal === 'inactive' || activeVal === 'closed') {
        return null;
      }
    }

    const getVal = (field?: string) => (field && rawRecord[field] !== undefined ? rawRecord[field] : undefined);

    const rawTitle = String(getVal(mapping.titleField) || '').trim();
    if (!rawTitle) {
      return null; // A job without a title is invalid
    }

    // Stable External ID priority: externalJobIdField -> stable URL -> null (JobNormalization will contentHash)
    let externalJobId = getVal(mapping.externalJobIdField);
    if (externalJobId !== undefined && externalJobId !== null) {
      externalJobId = String(externalJobId).trim();
    } else {
      externalJobId = undefined;
    }

    // Intelligently derive clean title (e.g. "JR1041997 Database Engineer (Open)" -> "Database Engineer")
    const title = this.cleanTitle(rawTitle, externalJobId);

    // Description text
    const description = getVal(mapping.descriptionField) || getVal(mapping.summaryField) || title;
    const descriptionText = typeof description === 'string' ? description : JSON.stringify(description);

    // Parse array or comma-separated string for list fields
    const toArray = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(x => String(x).trim()).filter(Boolean);
      if (typeof val === 'string') {
        if (val.includes('\n')) {
          return val.split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
        }
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [];
    };

    const responsibilities = toArray(getVal(mapping.responsibilitiesField));
    const requirements = toArray(getVal(mapping.requirementsField));
    const skills = toArray(getVal(mapping.skillsField));
    const preferredQualifications = toArray(getVal(mapping.preferredSkillsField));

    // Application URL: source-provided URL -> careersUrl
    let applicationUrl = getVal(mapping.applicationUrlField);
    if (typeof applicationUrl === 'string' && (applicationUrl.startsWith('http://') || applicationUrl.startsWith('https://'))) {
      // Use clean source application URL
    } else {
      applicationUrl = defaults.careersUrl;
    }

    // Salary string/range
    const salaryVal = getVal(mapping.salaryField);
    let salaryCurrency: string | undefined = undefined;
    let salaryMin: number | undefined = undefined;
    let salaryMax: number | undefined = undefined;

    if (typeof salaryVal === 'string') {
      if (salaryVal.includes('₹') || salaryVal.toLowerCase().includes('inr')) salaryCurrency = 'INR';
      else if (salaryVal.includes('$') || salaryVal.toLowerCase().includes('usd')) salaryCurrency = 'USD';
      else if (salaryVal.includes('€') || salaryVal.toLowerCase().includes('eur')) salaryCurrency = 'EUR';
      else if (salaryVal.includes('£') || salaryVal.toLowerCase().includes('gbp')) salaryCurrency = 'GBP';

      const nums = salaryVal.replace(/,/g, '').match(/\d[\d\.]*/g);
      if (nums && nums.length >= 2) {
        salaryMin = parseFloat(nums[0]);
        salaryMax = parseFloat(nums[1]);
      } else if (nums && nums.length === 1) {
        salaryMin = parseFloat(nums[0]);
      }
    } else if (typeof salaryVal === 'number') {
      salaryMin = salaryVal;
    }

    // Experience parsing
    const expVal = getVal(mapping.experienceField);
    let experienceMin: number | undefined = undefined;
    let experienceMax: number | undefined = undefined;
    if (typeof expVal === 'string') {
      const nums = expVal.match(/\d+/g);
      if (nums && nums.length >= 2) {
        experienceMin = parseInt(nums[0], 10);
        experienceMax = parseInt(nums[1], 10);
      } else if (nums && nums.length === 1) {
        experienceMin = parseInt(nums[0], 10);
      }
    } else if (typeof expVal === 'number') {
      experienceMin = expVal;
    }

    // Posted date
    const postedVal = getVal(mapping.postedAtField);
    let postedAt: Date | undefined = undefined;
    if (postedVal) {
      const d = new Date(postedVal);
      if (!isNaN(d.getTime())) postedAt = d;
    }

    return {
      externalJobId,
      sourceType: defaults.sourceType,
      sourceName: defaults.sourceName,
      sourceUrl: defaults.careersUrl,
      applicationUrl,
      title,
      companyName: defaults.companyName,
      companyDomain: defaults.companyDomain,
      careersUrl: defaults.careersUrl,
      location: (() => {
        const locVal = getVal(mapping.locationField);
        if (!locVal) {
          if (Array.isArray(rawRecord.multi_location) && rawRecord.multi_location.length > 0) {
            return String(rawRecord.multi_location[0]);
          }
          return undefined;
        }
        if (Array.isArray(locVal)) return locVal.map(String).join(', ');
        if (typeof locVal === 'object' && locVal !== null) {
          return locVal.name || locVal.location || locVal.city || JSON.stringify(locVal);
        }
        return String(locVal);
      })(),
      country: getVal(mapping.countryField) ? String(getVal(mapping.countryField)) : undefined,
      city: getVal(mapping.cityField) ? String(getVal(mapping.cityField)) : undefined,
      remoteType: getVal(mapping.workModeField) ? String(getVal(mapping.workModeField)) : undefined,
      employmentType: getVal(mapping.employmentTypeField) ? String(getVal(mapping.employmentTypeField)) : undefined,
      salaryMin,
      salaryMax,
      salaryCurrency,
      experienceMin,
      experienceMax,
      education: getVal(mapping.qualificationField) ? String(getVal(mapping.qualificationField)) : undefined,
      postedAt,
      descriptionHtml: typeof description === 'string' && description.includes('<') ? description : undefined,
      descriptionText,
      responsibilities,
      requirements,
      preferredQualifications,
      skills,
      rawPayload: rawRecord
    };
  }

  /**
   * Cleans title string intelligently when it includes requisition IDs or status flags.
   * e.g. "JR1041997 Database Engineer (Open)" -> "Database Engineer"
   */
  public static cleanTitle(rawTitle: string, reqId?: string): string {
    let title = rawTitle.trim();
    if (!title) return '';

    // Strip explicit requisition ID prefix if provided
    if (reqId) {
      const escapedReqId = reqId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reqRegex = new RegExp(`^${escapedReqId}\\s*[-:–]?\\s*`, 'i');
      title = title.replace(reqRegex, '');
    }

    // Strip generic requisition ID prefixes e.g. "JR1041997 ", "REQ-12345: ", "#1234 "
    title = title.replace(/^(?:JR|REQ|JOB|POS)?\d{4,}\s*[-:–]?\s*/i, '');

    // Strip trailing status/lifecycle tags e.g. "(Open)", "(Closed)", "(Active)", "(Evergreen)"
    title = title.replace(/\s*\((?:Open|Closed|Active|Evergreen|Full[- ]Time|Part[- ]Time|Contract)\)/gi, '');

    return title.trim() || rawTitle.trim();
  }
}

