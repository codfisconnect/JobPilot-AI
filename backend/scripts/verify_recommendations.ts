import { prisma } from '../src/database/prisma.js';
import { JobRecommendationService } from '../src/services/jobRecommendation.service.js';

async function runRecommendationDiagnostics() {
  console.log('=== PART 8: Real Recommendation Engine Verification ===');

  const user = await prisma.user.findFirst({
    where: { email: 'testuser@pilotmama.local' },
    include: {
      candidateProfile: {
        include: {
          resumes: true,
          skills: { include: { skill: true } },
          experiences: true
        }
      }
    }
  });

  if (!user || !user.candidateProfile) {
    console.error('Candidate not found');
    process.exit(1);
  }

  const profile = user.candidateProfile;
  const preferredResume = profile.resumes.find(r => r.isMaster) || profile.resumes[0];

  console.log('Candidate Information:');
  console.log(`- User ID: ${user.id}`);
  console.log(`- Name: ${profile.fullName}`);
  console.log(`- Headline: ${profile.headline}`);
  console.log(`- Preferred Resume: ${preferredResume ? `${preferredResume.title} (${preferredResume.storageKey})` : 'NONE'}`);
  console.log(`- Verified Skills Count: ${profile.skills.length}`);

  const recResult = await JobRecommendationService.getRecommendations(user.id, {
    page: 1,
    pageSize: 10
  });

  console.log('\nRecommendation Engine Result:');
  console.log(`- Status: ${recResult.status}`);
  console.log(`- Total Eligible Recommendations: ${recResult.pagination.total}`);
  console.log(`- Returned Items (Page 1): ${recResult.items.length}`);

  console.log('\nTop 10 Recommended Jobs:');
  recResult.items.slice(0, 10).forEach((job, idx) => {
    console.log(`[${idx + 1}] Title: ${job.title}`);
    console.log(`    Company: ${job.company?.name || 'Unknown'}`);
    console.log(`    Score: ${job.recommendation?.score ?? job.recommendationScore}%`);
    console.log(`    Headline: ${job.recommendation?.headline}`);
    console.log(`    Evidence: ${job.recommendation?.reasons?.join(' | ')}`);
    console.log(`    Description Excerpt: ${job.description.slice(0, 100)}...`);
    console.log('');
  });

  await prisma.$disconnect();
}

runRecommendationDiagnostics().catch(err => {
  console.error('Recommendation diagnostic error:', err);
  process.exit(1);
});
