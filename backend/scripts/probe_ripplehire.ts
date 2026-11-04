import { safeFetchUrl } from '../src/utils/safeFetch.js';

async function main() {
  const endpoint = 'https://bahwancybertek.ripplehire.com/candidate/candidatejobsearch';
  const token = 'ncskoGgjoqYnuqre7tUl';
  const source = 'CAREERSITE';

  const searchParams = {
    page: 0,
    search: '*:*',
    token,
    source,
    pagesize: 2
  };

  const formBody = new URLSearchParams();
  formBody.append('careerSiteUrlParams', JSON.stringify(searchParams));
  formBody.append('lang', 'en');

  const res = await safeFetchUrl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json'
    },
    body: formBody.toString(),
    timeoutMs: 12000
  });

  const json = JSON.parse(res.text);
  console.log('JSON top-level keys:', Object.keys(json));
  if (json.data) {
    console.log('json.data keys:', Object.keys(json.data));
    console.log('totalJobCount:', json.data.totalJobCount);
    console.log('jobVoList length:', json.data.jobVoList?.length);
    if (json.data.jobVoList?.length > 0) {
      console.log('First item:', JSON.stringify(json.data.jobVoList[0], null, 2));
    }
  } else {
    console.log('json output:', JSON.stringify(json).slice(0, 500));
  }
}

main().catch(console.error);
