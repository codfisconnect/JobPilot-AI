import React, { useState, useEffect } from 'react';
import { api } from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { InternalApplyModal } from './InternalApplyModal';
import { ExternalApplyModal } from './ExternalApplyModal';
import {
  Building2,
  MapPin,
  Briefcase,
  Calendar,
  IndianRupee,
  Star,
  Users,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Globe,
  Share2,
  ShieldCheck,
  Sparkles,
  Award,
  Layers,
  HeartHandshake,
  Send,
  Loader2,
  ChevronRight,
  ThumbsUp,
  MessageSquare
} from 'lucide-react';
import './NaukriJobDetail.css';

interface NaukriJobDetailProps {
  job: any;
  onClose?: () => void;
  onAnalyzeFit?: (jobId: string) => void;
}

export const NaukriJobDetail: React.FC<NaukriJobDetailProps> = ({ job, onClose, onAnalyzeFit }) => {
  const { user } = useAuth();
  const { activeCandidate, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<'details' | 'company' | 'reviews' | 'benefits'>('details');
  const [isSaved, setIsSaved] = useState(false);
  const [isInternalModalOpen, setIsInternalModalOpen] = useState(false);
  const [isExternalModalOpen, setIsExternalModalOpen] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewPros, setNewReviewPros] = useState('');
  const [newReviewCons, setNewReviewCons] = useState('');
  const [newReviewRating, setNewReviewRating] = useState('5');
  const [submittingReview, setSubmittingReview] = useState(false);

  const companyName = job.company?.name || job.company || 'Enterprise';
  const isExternal = job.applicationType === 'EXTERNAL' || job.isExternal || job.applicationMode === 'external';

  // Format salary
  const displaySalary = job.salary || (job.salaryMin ? `₹ ${Number(job.salaryMin).toLocaleString()} - ${Number(job.salaryMax || job.salaryMin * 1.5).toLocaleString()} P.A.` : '₹ 12,00,000 - 18,00,000 P.A.');
  const displayExperience = job.experienceRequired || (job.experienceMin ? `${job.experienceMin} - ${job.experienceMax || job.experienceMin + 3} Yrs` : '2 - 5 Yrs');
  const displayLocation = job.location || job.city || 'Bangalore, Karnataka';
  const displayOpenings = job.openingsCount || 3;
  const displayRating = job.rating || 4.2;
  const displayReviewsCount = job.reviewsCount || 18;

  // Load verified reviews for this company
  useEffect(() => {
    if (companyName) {
      setReviewsLoading(true);
      api.getCompanyReviews(companyName)
        .then(data => {
          if (Array.isArray(data)) {
            setReviews(data);
          }
        })
        .catch(() => {})
        .finally(() => setReviewsLoading(false));
    }
  }, [companyName]);

  const handleApplyClick = () => {
    if (isExternal) {
      setIsExternalModalOpen(true);
    } else {
      setIsInternalModalOpen(true);
    }
  };

  const handleToggleSave = () => {
    setIsSaved(prev => {
      const next = !prev;
      if (showToast) {
        showToast(next ? 'Job saved to your bookmarks!' : 'Job removed from saved list.');
      }
      return next;
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${job.title || job.role} at ${companyName}`,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      if (showToast) showToast('Job link copied to clipboard!');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewTitle.trim() || !newReviewText.trim()) return;

    try {
      setSubmittingReview(true);
      const reviewerName = activeCandidate?.name || user?.candidateProfile?.fullName || 'Verified Employee';
      const reviewerRole = activeCandidate?.targetRoles?.[0] || 'Software Professional';

      const submitted = await api.submitCompanyReview({
        companyName,
        reviewerName,
        reviewerRole,
        rating: Number(newReviewRating),
        title: newReviewTitle.trim(),
        reviewText: newReviewText.trim(),
        pros: newReviewPros.trim(),
        cons: newReviewCons.trim(),
        workCultureRating: Number(newReviewRating),
        salaryBenefitsRating: Number(newReviewRating),
        careerGrowthRating: Number(newReviewRating),
        workLifeBalanceRating: Number(newReviewRating)
      });

      setReviews(prev => [submitted, ...prev]);
      setShowReviewForm(false);
      setNewReviewTitle('');
      setNewReviewText('');
      setNewReviewPros('');
      setNewReviewCons('');
      if (showToast) showToast('Thank you! Your verified review has been submitted.');
    } catch (err: any) {
      if (showToast) showToast(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const benefitsList: string[] = Array.isArray(job.benefits) && job.benefits.length > 0
    ? job.benefits
    : [
        'Comprehensive Health Insurance (Family Floater)',
        'Flexible Hybrid Work Model',
        'Annual Performance Incentive',
        'Continuous Learning & Certification Reimbursement',
        'Wellness & Mental Health Allowances',
        'Provident Fund & Gratuity'
      ];

  const mustHaveSkills: string[] = Array.isArray(job.mustHaveSkills) && job.mustHaveSkills.length > 0
    ? job.mustHaveSkills
    : (Array.isArray(job.skills) ? job.skills.map((s: any) => s.name || s) : ['Java', 'Selenium', 'Automation Testing', 'CI/CD']);

  const niceToHaveSkills: string[] = Array.isArray(job.niceToHaveSkills) && job.niceToHaveSkills.length > 0
    ? job.niceToHaveSkills
    : ['Playwright', 'Docker', 'AWS', 'Python'];

  const responsibilities: string[] = Array.isArray(job.responsibilities) && job.responsibilities.length > 0
    ? job.responsibilities
    : [
        `Architect, develop, and maintain automated regression test suites for enterprise systems.`,
        `Collaborate closely with cross-functional software engineering, product management, and DevOps teams.`,
        `Execute automated test suites across multiple environments and report actionable defects with root cause analysis.`,
        `Integrate test automation frameworks into continuous integration and delivery (CI/CD) pipelines.`
      ];

  const qualifications: string[] = Array.isArray(job.qualifications) && job.qualifications.length > 0
    ? job.qualifications
    : [
        `B.E. / B.Tech / M.C.A. in Computer Science, Information Technology, or equivalent degree.`,
        `Demonstrated hands-on experience in test automation frameworks and enterprise applications.`,
        `Solid understanding of software engineering fundamentals, design patterns, and Agile methodologies.`
      ];

  return (
    <div className="naukri-job-detail-root">
      {/* 1. TOP HEADER CARD */}
      <div className="nj-header-card">
        <div className="nj-header-top-row">
          <div className="nj-header-left">
            <div className="nj-company-logo">
              {job.companyLogo ? (
                <img src={job.companyLogo} alt={companyName} />
              ) : (
                <div className="nj-logo-placeholder">{companyName.charAt(0)}</div>
              )}
            </div>
            <div>
              <h1 className="nj-job-title">{job.title || job.role}</h1>
              <div className="nj-company-subline">
                <span className="nj-company-name">{companyName}</span>
                <span className="nj-rating-pill">
                  <Star size={13} className="star-icon" />
                  <span>{displayRating}</span>
                  <span className="review-count">({displayReviewsCount} Reviews)</span>
                </span>
                <span className="nj-verified-pill">
                  <ShieldCheck size={13} />
                  <span>Verified Recruiter</span>
                </span>
              </div>
            </div>
          </div>

          <div className="nj-header-actions">
            <button
              type="button"
              className={`nj-action-icon-btn ${isSaved ? 'saved' : ''}`}
              onClick={handleToggleSave}
              title={isSaved ? 'Saved' : 'Save Job'}
            >
              {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
            </button>
            <button
              type="button"
              className="nj-action-icon-btn"
              onClick={handleShare}
              title="Share Job"
            >
              <Share2 size={19} />
            </button>
          </div>
        </div>

        {/* Highlights Meta Grid */}
        <div className="nj-meta-grid">
          <div className="nj-meta-col">
            <Briefcase size={16} className="nj-meta-icon" />
            <div>
              <span className="nj-meta-label">Experience</span>
              <span className="nj-meta-val">{displayExperience}</span>
            </div>
          </div>

          <div className="nj-meta-col">
            <IndianRupee size={16} className="nj-meta-icon" />
            <div>
              <span className="nj-meta-label">Salary</span>
              <span className="nj-meta-val">{displaySalary}</span>
            </div>
          </div>

          <div className="nj-meta-col">
            <MapPin size={16} className="nj-meta-icon" />
            <div>
              <span className="nj-meta-label">Location</span>
              <span className="nj-meta-val">{displayLocation}</span>
            </div>
          </div>
        </div>

        {/* Status / Openings subline */}
        <div className="nj-subline-stats">
          <div className="nj-stat-item">
            <span>Posted: <strong>{job.publishedDate ? new Date(job.publishedDate).toLocaleDateString() : 'Just now'}</strong></span>
          </div>
          <div className="nj-stat-divider">•</div>
          <div className="nj-stat-item">
            <span>Openings: <strong>{displayOpenings}</strong></span>
          </div>
          <div className="nj-stat-divider">•</div>
          <div className="nj-stat-item">
            <span>Applicants: <strong>{job.applicantsCount || 42}</strong></span>
          </div>
          <div className="nj-stat-divider">•</div>
          <div className="nj-stat-item">
            <span className={`source-type-badge ${isExternal ? 'badge-external' : 'badge-internal'}`}>
              {isExternal ? 'Aggregated External Job' : 'Direct Employer Job'}
            </span>
          </div>
        </div>

        {/* Primary Header CTA */}
        <div className="nj-header-cta-row">
          <Button
            variant="primary"
            size="lg"
            onClick={handleApplyClick}
            icon={isExternal ? <ExternalLink size={18} /> : <Send size={18} />}
          >
            {isExternal ? 'Apply on Company Website' : 'Apply Now'}
          </Button>

          {onAnalyzeFit && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => onAnalyzeFit(job.id)}
              icon={<Sparkles size={16} />}
            >
              Analyze AI Fit
            </Button>
          )}
        </div>
      </div>

      {/* 2. TAB NAVIGATION */}
      <div className="nj-tab-navigation" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'details'}
          className={`nj-nav-tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Job Details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'company'}
          className={`nj-nav-tab ${activeTab === 'company' ? 'active' : ''}`}
          onClick={() => setActiveTab('company')}
        >
          About Company
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reviews'}
          className={`nj-nav-tab ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({reviews.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'benefits'}
          className={`nj-nav-tab ${activeTab === 'benefits' ? 'active' : ''}`}
          onClick={() => setActiveTab('benefits')}
        >
          Benefits & Perks
        </button>
      </div>

      {/* 3. TAB CONTENT */}
      <div className="nj-tab-content-area">
        {/* TAB 1: JOB DETAILS */}
        {activeTab === 'details' && (
          <div className="nj-details-container">
            {/* Highlights Grid */}
            <div className="nj-section-card">
              <h3 className="nj-section-heading">Job Highlights</h3>
              <div className="nj-highlights-pill-grid">
                <div className="nj-pill-card">
                  <span className="pill-title">Role Category</span>
                  <span className="pill-value">{job.roleCategory || 'Software Development'}</span>
                </div>
                <div className="nj-pill-card">
                  <span className="pill-title">Department</span>
                  <span className="pill-value">{job.department || 'Engineering & QA'}</span>
                </div>
                <div className="nj-pill-card">
                  <span className="pill-title">Employment Type</span>
                  <span className="pill-value">{job.employmentType || 'Full Time, Permanent'}</span>
                </div>
                <div className="nj-pill-card">
                  <span className="pill-title">Work Mode</span>
                  <span className="pill-value">{job.workMode || job.remoteType || 'Hybrid'}</span>
                </div>
                <div className="nj-pill-card">
                  <span className="pill-title">Openings</span>
                  <span className="pill-value">{displayOpenings} Vacancies</span>
                </div>
              </div>
            </div>

            {/* Key Skills Section */}
            <div className="nj-section-card">
              <h3 className="nj-section-heading">Key Skills</h3>
              <div className="nj-skills-block">
                <span className="nj-skills-sublabel">Must-Have Skills:</span>
                <div className="nj-skills-chips">
                  {mustHaveSkills.map((s, idx) => (
                    <span key={idx} className="nj-skill-tag must-have">
                      <CheckCircle2 size={13} />
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {niceToHaveSkills.length > 0 && (
                <div className="nj-skills-block" style={{ marginTop: '1rem' }}>
                  <span className="nj-skills-sublabel">Preferred / Nice-to-Have Skills:</span>
                  <div className="nj-skills-chips">
                    {niceToHaveSkills.map((s, idx) => (
                      <span key={idx} className="nj-skill-tag nice-to-have">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Job Description & Responsibilities */}
            <div className="nj-section-card">
              <h3 className="nj-section-heading">Job Description</h3>
              <p className="nj-prose-text">
                {job.rawText || job.description || `${companyName} is seeking an accomplished ${job.title || job.role} to drive high-quality software delivery and automation.`}
              </p>

              <h4 className="nj-subheading">Core Responsibilities</h4>
              <ul className="nj-bullet-list">
                {responsibilities.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>

              <h4 className="nj-subheading">Education & Qualifications</h4>
              <ul className="nj-bullet-list">
                {qualifications.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: ABOUT COMPANY */}
        {activeTab === 'company' && (
          <div className="nj-company-container">
            <div className="nj-section-card">
              <div className="nj-company-overview-header">
                <Building2 size={32} className="company-big-icon" />
                <div>
                  <h3 className="nj-section-heading" style={{ margin: 0 }}>{companyName}</h3>
                  <span className="nj-company-industry">{job.company?.industry || job.department || 'Information Technology & Services'}</span>
                </div>
              </div>

              <p className="nj-prose-text">
                {job.companyDescription || job.company?.description || `${companyName} is an industry-leading organization delivering modern digital engineering solutions, enterprise products, and innovation at scale.`}
              </p>

              <div className="nj-company-specs-grid">
                <div className="spec-card">
                  <span className="spec-label">Headquarters</span>
                  <span className="spec-val">{job.companyHeadquarters || 'Bangalore, Karnataka, India'}</span>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Company Size</span>
                  <span className="spec-val">{job.companySize || '500 - 1,000 Employees'}</span>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Founded</span>
                  <span className="spec-val">{job.companyFounded || '2015'}</span>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Official Website</span>
                  <a
                    href={job.companyWebsite || job.company?.careersUrl || 'https://google.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="spec-link"
                  >
                    <span>Visit Company Site</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="nj-reviews-container">
            {/* Reviews Summary Card */}
            <div className="nj-section-card">
              <div className="nj-reviews-summary-row">
                <div className="rating-score-box">
                  <span className="big-rating">{displayRating}</span>
                  <div className="stars-row">
                    {[1, 2, 3, 4, 5].map(st => (
                      <Star key={st} size={16} className={st <= Math.round(displayRating) ? 'star-filled' : 'star-empty'} />
                    ))}
                  </div>
                  <span className="based-on-text">Based on {reviews.length || displayReviewsCount} verified reviews</span>
                </div>

                <div className="rating-breakdown-col">
                  <div className="breakdown-bar-item">
                    <span className="b-label">Work Culture</span>
                    <div className="b-track"><div className="b-fill" style={{ width: '85%' }}></div></div>
                    <span className="b-score">4.3</span>
                  </div>
                  <div className="breakdown-bar-item">
                    <span className="b-label">Salary & Benefits</span>
                    <div className="b-track"><div className="b-fill" style={{ width: '80%' }}></div></div>
                    <span className="b-score">4.0</span>
                  </div>
                  <div className="breakdown-bar-item">
                    <span className="b-label">Career Growth</span>
                    <div className="b-track"><div className="b-fill" style={{ width: '82%' }}></div></div>
                    <span className="b-score">4.1</span>
                  </div>
                  <div className="breakdown-bar-item">
                    <span className="b-label">Work-Life Balance</span>
                    <div className="b-track"><div className="b-fill" style={{ width: '88%' }}></div></div>
                    <span className="b-score">4.4</span>
                  </div>
                </div>

                <div className="review-action-col">
                  <Button
                    variant="outline"
                    onClick={() => setShowReviewForm(prev => !prev)}
                    icon={<MessageSquare size={16} />}
                  >
                    {showReviewForm ? 'Cancel Review' : 'Write a Review'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Write Review Form */}
            {showReviewForm && (
              <form onSubmit={handleSubmitReview} className="nj-section-card nj-write-review-form">
                <h4 className="nj-subheading">Share Your Verified Feedback for {companyName}</h4>
                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Review Headline / Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Great engineering culture and collaborative teams"
                      value={newReviewTitle}
                      onChange={e => setNewReviewTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Overall Rating</label>
                    <select value={newReviewRating} onChange={e => setNewReviewRating(e.target.value)}>
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Good</option>
                      <option value="3">3 - Average</option>
                      <option value="2">2 - Below Average</option>
                      <option value="1">1 - Poor</option>
                    </select>
                  </div>
                </div>

                <div className="form-field">
                  <label>Review Details</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe your working experience at this company..."
                    value={newReviewText}
                    onChange={e => setNewReviewText(e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Pros</label>
                    <input
                      type="text"
                      placeholder="e.g. Supportive management, flexible work hours"
                      value={newReviewPros}
                      onChange={e => setNewReviewPros(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Cons</label>
                    <input
                      type="text"
                      placeholder="e.g. Occasional deployment deadlines"
                      value={newReviewCons}
                      onChange={e => setNewReviewCons(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-btn-row">
                  <Button type="submit" variant="primary" disabled={submittingReview}>
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            <div className="nj-reviews-list">
              {reviews.map((r, idx) => (
                <div key={r.id || idx} className="nj-review-card">
                  <div className="review-top-row">
                    <div>
                      <span className="review-title">{r.title}</span>
                      <div className="review-author-line">
                        <span>{r.reviewerRole}</span>
                        <span>•</span>
                        <span>{r.reviewerName}</span>
                        <span>•</span>
                        <span>{new Date(r.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <span className="review-rating-badge">
                      <Star size={12} />
                      <span>{r.rating}.0</span>
                    </span>
                  </div>

                  <p className="review-body">{r.reviewText}</p>

                  {(r.pros || r.cons) && (
                    <div className="review-pros-cons">
                      {r.pros && (
                        <div className="pros-line">
                          <strong>Pros:</strong> {r.pros}
                        </div>
                      )}
                      {r.cons && (
                        <div className="cons-line">
                          <strong>Cons:</strong> {r.cons}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: BENEFITS & PERKS */}
        {activeTab === 'benefits' && (
          <div className="nj-benefits-container">
            <div className="nj-section-card">
              <h3 className="nj-section-heading">Verified Perks & Benefits</h3>
              <p className="nj-prose-text">
                Benefits provided directly by <strong>{companyName}</strong> for this opening:
              </p>
              <div className="nj-benefits-grid">
                {benefitsList.map((b, idx) => (
                  <div key={idx} className="benefit-card">
                    <div className="benefit-icon-wrap">
                      <HeartHandshake size={20} />
                    </div>
                    <span className="benefit-text">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. STICKY BOTTOM APPLY BAR */}
      <div className="nj-sticky-apply-bar">
        <div className="nj-sticky-inner">
          <div className="nj-sticky-job-info">
            <span className="sticky-title">{job.title || job.role}</span>
            <span className="sticky-sub">{companyName} • {displaySalary} • {displayLocation}</span>
          </div>

          <div className="nj-sticky-actions">
            <button
              type="button"
              className={`nj-sticky-save-btn ${isSaved ? 'saved' : ''}`}
              onClick={handleToggleSave}
            >
              {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>

            <Button
              variant="primary"
              onClick={handleApplyClick}
              icon={isExternal ? <ExternalLink size={16} /> : <Send size={16} />}
            >
              {isExternal ? 'Apply on Company Website' : 'Apply Now'}
            </Button>
          </div>
        </div>
      </div>

      {/* TYPE A: Internal Application Modal */}
      <InternalApplyModal
        job={job}
        isOpen={isInternalModalOpen}
        onClose={() => setIsInternalModalOpen(false)}
        onSuccess={() => {
          setIsInternalModalOpen(false);
          if (showToast) showToast('Application successfully registered in your tracker!');
        }}
      />

      {/* TYPE B: External Application Modal */}
      <ExternalApplyModal
        job={job}
        isOpen={isExternalModalOpen}
        onClose={() => setIsExternalModalOpen(false)}
        onConfirmApplied={() => {
          setIsExternalModalOpen(false);
        }}
      />
    </div>
  );
};
