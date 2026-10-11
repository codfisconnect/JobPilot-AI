const https = require('https');

const check = (url) => new Promise((resolve) => {
  https.get(url, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      resolve({
        url,
        statusCode: res.statusCode,
        hasRootDiv: body.indexOf('id="root"') !== -1
      });
    });
  }).on('error', e => resolve({ url, error: e.message }));
});

async function main() {
  const urls = [
    'https://job-pilot-ai-pearl.vercel.app/',
    'https://job-pilot-ai-pearl.vercel.app/admin',
    'https://job-pilot-ai-pearl.vercel.app/admin/login',
    'https://job-pilot-ai-pearl.vercel.app/admin/job-sources',
    'https://job-pilot-ai-pearl.vercel.app/admin/jobs',
    'https://job-pilot-ai-pearl.vercel.app/login',
    'https://job-pilot-ai-pearl.vercel.app/jobs',
    'https://job-pilot-ai-pearl.vercel.app/profile',
    'https://job-pilot-ai-pearl.vercel.app/settings'
  ];

  for (const u of urls) {
    const res = await check(u);
    console.log(u.padEnd(58) + 'Status: ' + res.statusCode + ' | SPA index.html: ' + (res.hasRootDiv ? 'YES' : 'NO'));
  }
}

main();
