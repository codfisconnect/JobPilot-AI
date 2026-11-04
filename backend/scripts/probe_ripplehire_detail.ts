import { safeFetchUrl } from '../src/utils/safeFetch.js';

async function main() {
  const jobSeq = '856016'; // From Bahwan
  const token = 'ncskoGgjoqYnuqre7tUl';
  const source = 'CAREERSITE';

  const endpoints = [
    `https://bahwancybertek.ripplehire.com/candidate/candidatejobsearch/getJobDetail?jobSeq=${jobSeq}&token=${token}&source=${source}`,
    `https://bahwancybertek.ripplehire.com/candidate/getJobDetail?jobSeq=${jobSeq}&token=${token}`,
    `https://bahwancybertek.ripplehire.com/ripplehire/candidate/careerSite/getJobDetail?jobSeq=${jobSeq}&token=${token}`
  ];

  for (const ep of endpoints) {
    try {
      const res = await safeFetchUrl(ep, { timeoutMs: 5000 });
      console.log(`${ep} -> Status: ${res.status}, Length: ${res.text.length}`);
      if (res.status === 200 && res.text.includes('{')) {
        console.log('Sample:', res.text.slice(0, 300));
      }
    } catch (e: any) {
      console.log(`${ep} -> Error: ${e.message}`);
    }
  }

  // Also test POST with candidatejobsearch
  const formBody = new URLSearchParams();
  formBody.append('jobSeq', jobSeq);
  formBody.append('token', token);
  formBody.append('source', source);
  const postEp = 'https://bahwancybertek.ripplehire.com/candidate/candidatejobsearch/getJobDetail';
  const resPost = await safeFetchUrl(postEp, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: formBody.toString(),
    timeoutMs: 5000
  });
  console.log(`POST ${postEp} -> Status: ${resPost.status}, Length: ${resPost.text.length}`);
  if (resPost.status === 200) {
    console.log('POST Response:', resPost.text.slice(0, 400));
  }
}

main().catch(console.error);
