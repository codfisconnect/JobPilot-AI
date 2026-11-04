const fs = require('fs');

async function inspectVercel() {
  const html = await (await fetch('https://job-pilot-ai-pearl.vercel.app/')).text();
  console.log('--- Vercel Production HTML Inspection ---');
  const matches = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
  console.log('Script bundles in HTML:', matches);
  for (const src of matches) {
    const jsUrl = 'https://job-pilot-ai-pearl.vercel.app' + src;
    const js = await (await fetch(jsUrl)).text();
    console.log('\nBundle:', jsUrl, 'size:', js.length);
    console.log('  Contains "jobpilot-ai-backend":', js.includes('jobpilot-ai-backend'));
    console.log('  Contains "JobSearchMultiSelect" or "Search by role":', js.includes('JobSearchMultiSelect') || js.includes('Search by role'));
    console.log('  Contains "Resend in":', js.includes('Resend in'));
    console.log('  Contains "before requesting a new code":', js.includes('before requesting a new code'));
    console.log('  Contains "An account already exists with this email. Please sign in.":', js.includes('An account already exists with this email. Please sign in.'));
  }

  // Also check if there's any vite asset manifest or commit header
  const res = await fetch('https://job-pilot-ai-pearl.vercel.app/');
  console.log('\n--- Vercel Response Headers ---');
  for (const [k, v] of res.headers.entries()) {
    console.log(`  ${k}: ${v}`);
  }
}

inspectVercel().catch(console.error);
