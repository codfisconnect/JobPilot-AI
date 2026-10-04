export class GenericJobAdapter {
    constructor() {
        this.name = 'Generic Job Page Adapter';
    }
    canHandle(url) {
        return true; // Fallback for all public web pages
    }
    extract() {
        // 1. Role / Job Title
        const title = document.querySelector('h1')?.innerText?.trim() ||
            document.querySelector('[data-automation="job-title"]')?.textContent?.trim() ||
            document.title.split(/[-–|]/)[0]?.trim() ||
            'Software Opportunity';
        // 2. Company Name
        const company = document.querySelector('[data-automation="company-name"]')?.textContent?.trim() ||
            document.querySelector('.company, .employer, [class*="company"]')?.textContent?.trim() ||
            'Target Company';
        // 3. Location
        const location = document.querySelector('[data-automation="job-location"]')?.textContent?.trim() ||
            document.querySelector('.location, [class*="location"]')?.textContent?.trim() ||
            'Remote / Hybrid';
        // 4. Main Body Content (stripping scripts and navigation)
        const contentClone = document.body.cloneNode(true);
        contentClone.querySelectorAll('script, style, nav, header, footer, noscript').forEach(el => el.remove());
        const description = contentClone.innerText.replace(/\s+/g, ' ').slice(0, 12000).trim();
        return {
            title,
            company,
            location,
            description,
            sourceUrl: window.location.href
        };
    }
}
