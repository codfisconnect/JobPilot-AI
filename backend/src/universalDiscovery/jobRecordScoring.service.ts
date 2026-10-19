export class JobRecordScoringService {
  private static readonly TITLE_KEYWORDS = [
    'engineer', 'developer', 'architect', 'manager', 'lead', 'specialist',
    'analyst', 'designer', 'consultant', 'administrator', 'director',
    'officer', 'executive', 'technician', 'intern', 'associate', 'tester',
    'sdet', 'qa', 'frontend', 'backend', 'full stack', 'fullstack', 'devops',
    'cloud', 'mobile', 'android', 'ios', 'data', 'product', 'scrum', 'scientist'
  ];

  private static readonly TITLE_KEYS = [
    'title', 'jobtitle', 'position', 'role', 'name', 'job_title', 'designation', 'jobname'
  ];

  private static readonly ID_KEYS = [
    'id', 'jobid', 'job_id', 'jobseq', 'requisitionid', 'requisition_id', 'reqid', 'req_id',
    'jobcode', 'job_code', 'code', 'referencenumber', 'externalid'
  ];

  private static readonly LOCATION_KEYS = [
    'location', 'locations', 'joblocation', 'city', 'state', 'country', 'office', 'region', 'workplace'
  ];

  private static readonly URL_KEYS = [
    'url', 'link', 'applyurl', 'apply_url', 'applicationurl', 'application_url', 'href', 'externalpath'
  ];

  private static readonly DESC_KEYS = [
    'description', 'jobdesc', 'jobdescription', 'summary', 'responsibilities', 'requirements', 'details'
  ];

  /**
   * Scores a single object on how well it represents a real job record (0 to 100).
   */
  public static scoreCandidateObject(obj: any): number {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return 0;
    }

    const keys = Object.keys(obj).map(k => k.toLowerCase().replace(/[-_]/g, ''));
    let score = 0;

    // 1. Identity field
    if (keys.some(k => this.ID_KEYS.some(idk => k === idk || k.includes(idk)))) {
      score += 25;
    }

    // 2. Title-like field
    let hasTitleKey = false;
    for (const [k, v] of Object.entries(obj)) {
      const cleanKey = k.toLowerCase().replace(/[-_]/g, '');
      if (this.TITLE_KEYS.some(tk => cleanKey === tk || cleanKey.includes(tk))) {
        hasTitleKey = true;
        if (typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= 120) {
          score += 30;
          const lowerVal = v.toLowerCase();
          if (this.TITLE_KEYWORDS.some(kw => lowerVal.includes(kw))) {
            score += 15;
          }
        }
        break;
      }
    }

    if (!hasTitleKey) {
      // If there is no title-like key, this is rarely a job record
      return Math.min(score, 30);
    }

    // 3. Location field
    if (keys.some(k => this.LOCATION_KEYS.some(lk => k === lk || k.includes(lk)))) {
      score += 15;
    }

    // 4. URL / Apply link
    if (keys.some(k => this.URL_KEYS.some(uk => k === uk || k.includes(uk)))) {
      score += 10;
    }

    // 5. Description / Summary
    if (keys.some(k => this.DESC_KEYS.some(dk => k === dk || k.includes(dk)))) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Evaluates an array of items and scores their coherence as a job listing collection.
   */
  public static scoreCandidateArray(arr: any[]): { isJobCollection: boolean; averageScore: number } {
    if (!Array.isArray(arr) || arr.length === 0) {
      return { isJobCollection: false, averageScore: 0 };
    }

    const sample = arr.slice(0, 10);
    const validObjects = sample.filter(item => item && typeof item === 'object' && !Array.isArray(item));
    if (validObjects.length === 0) {
      return { isJobCollection: false, averageScore: 0 };
    }

    const totalScore = validObjects.reduce((sum, item) => sum + this.scoreCandidateObject(item), 0);
    const avg = totalScore / validObjects.length;

    return {
      isJobCollection: avg >= 55,
      averageScore: avg
    };
  }
}
