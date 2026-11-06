import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Award,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import './JobApplyModals.css';

interface InternalApplyModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (application: any) => void;
}

export const InternalApplyModal: React.FC<InternalApplyModalProps> = ({
  job,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const { activeCandidate, showToast } = useApp();

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [resumes, setResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [screeningAnswers, setScreeningAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<any>(null);

  // Prefilled candidate profile details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [experience, setExperience] = useState('3');
  const [designation, setDesignation] = useState('');

  const candidateId = activeCandidate?.id || user?.id || 'cand-default-aarav';

  // Load candidate resumes and prefill profile info
  useEffect(() => {
    if (isOpen) {
      setStep('form');
      setError(null);

      // Prefill details from activeCandidate or user
      setFullName(activeCandidate?.name || user?.candidateProfile?.fullName || 'Aarav Patel');
      setEmail(activeCandidate?.email || user?.email || 'aarav.patel@example.com');
      setPhone(activeCandidate?.phone || '+91 98765 43210');
      setLocation(activeCandidate?.location || 'Bangalore, India');
      setExperience(String(activeCandidate?.yearsOfExperience || 3));
      setDesignation(activeCandidate?.targetRoles?.[0] || 'QA Automation Engineer');

      // Fetch resume versions
      api.getResumeVersions(candidateId)
        .then(versions => {
          if (Array.isArray(versions) && versions.length > 0) {
            setResumes(versions);
            setSelectedResumeId(versions[0].id);
          } else {
            // Default master profile resume
            setResumes([{ id: 'default-profile-resume', versionName: 'Primary Profile Resume (Auto-generated)' }]);
            setSelectedResumeId('default-profile-resume');
          }
        })
        .catch(() => {
          setResumes([{ id: 'default-profile-resume', versionName: 'Primary Profile Resume' }]);
          setSelectedResumeId('default-profile-resume');
        });
    }
  }, [isOpen, candidateId, activeCandidate, user]);

  if (!isOpen || !job) return null;

  const screeningQuestions: string[] = Array.isArray(job.screeningQuestions) && job.screeningQuestions.length > 0
    ? job.screeningQuestions
    : [
        'How many years of relevant experience do you possess for this role?',
        'What is your notice period with your current organization?'
      ];

  const handleScreeningAnswerChange = (question: string, answer: string) => {
    setScreeningAnswers(prev => ({ ...prev, [question]: answer }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email address are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const app = await api.applyInternal({
        jobId: job.id,
        candidateId,
        resumeId: selectedResumeId,
        screeningAnswers
      });

      setSubmittedRecord(app);
      setStep('success');
      if (showToast) {
        showToast('Application submitted successfully!');
      }
      if (onSuccess) {
        onSuccess(app);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={step === 'form' ? `Apply to ${job.company?.name || job.company}` : 'Application Submitted'} maxWidth="lg">
      <div className="internal-apply-container">
        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="apply-form-body">
            {/* Job Header Strip */}
            <div className="apply-job-header-strip">
              <div className="apply-company-icon">
                <Building size={22} />
              </div>
              <div>
                <h3 className="apply-job-role">{job.title || job.role}</h3>
                <span className="apply-job-company">{job.company?.name || job.company}</span>
                <span className="apply-job-type-badge">Direct JobPilot Application (Internal)</span>
              </div>
            </div>

            {error && (
              <div className="apply-error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Resume Selection */}
            <div className="apply-section">
              <div className="apply-section-header">
                <FileText size={18} className="apply-sec-icon" />
                <h4 className="apply-sec-title">1. Select Resume</h4>
              </div>
              <p className="apply-sec-desc">Choose which resume version to submit to the employer:</p>
              <div className="resume-options-list">
                {resumes.map(r => (
                  <label key={r.id} className={`resume-option-card ${selectedResumeId === r.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="resumeSelection"
                      value={r.id}
                      checked={selectedResumeId === r.id}
                      onChange={() => setSelectedResumeId(r.id)}
                    />
                    <div className="resume-option-info">
                      <span className="resume-option-name">{r.versionName || r.title || 'Resume Version'}</span>
                      <span className="resume-option-meta">
                        {r.mode ? `Mode: ${r.mode} • ` : ''}
                        {r.updatedAt ? `Updated ${new Date(r.updatedAt).toLocaleDateString()}` : 'Ready for submission'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 2: Personal & Contact Information */}
            <div className="apply-section">
              <div className="apply-section-header">
                <User size={18} className="apply-sec-icon" />
                <h4 className="apply-sec-title">2. Review Your Profile Details</h4>
              </div>
              <div className="apply-grid-2">
                <div className="apply-field">
                  <label>Full Name</label>
                  <div className="apply-input-wrap">
                    <User size={16} />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="apply-field">
                  <label>Email Address</label>
                  <div className="apply-input-wrap">
                    <Mail size={16} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="apply-field">
                  <label>Mobile Number</label>
                  <div className="apply-input-wrap">
                    <Phone size={16} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="apply-field">
                  <label>Current Location</label>
                  <div className="apply-input-wrap">
                    <MapPin size={16} />
                    <input
                      type="text"
                      required
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="apply-field">
                  <label>Current Designation</label>
                  <div className="apply-input-wrap">
                    <Briefcase size={16} />
                    <input
                      type="text"
                      required
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="apply-field">
                  <label>Total Experience (Years)</label>
                  <div className="apply-input-wrap">
                    <Award size={16} />
                    <input
                      type="number"
                      min="0"
                      max="40"
                      required
                      value={experience}
                      onChange={e => setExperience(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Screening Questions */}
            <div className="apply-section">
              <div className="apply-section-header">
                <HelpCircle size={18} className="apply-sec-icon" />
                <h4 className="apply-sec-title">3. Employer Screening Questions</h4>
              </div>
              <div className="screening-questions-list">
                {screeningQuestions.map((q, idx) => (
                  <div key={idx} className="screening-q-item">
                    <label className="screening-q-label">
                      <span className="q-num">Q{idx + 1}.</span> {q}
                    </label>
                    <textarea
                      rows={2}
                      className="screening-q-input"
                      placeholder="Type your response..."
                      value={screeningAnswers[q] || ''}
                      onChange={e => handleScreeningAnswerChange(q, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="apply-footer-bar">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="spinning" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Application</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Step 2: Submission Confirmation */
          <div className="apply-success-view">
            <div className="apply-success-badge">
              <CheckCircle2 size={48} className="success-icon" />
            </div>
            <h3 className="success-title">Application Submitted Successfully!</h3>
            <p className="success-subtitle">
              Your application for <strong>{job.title || job.role}</strong> has been directly delivered to{' '}
              <strong>{job.company?.name || job.company}</strong>'s hiring pipeline.
            </p>

            <div className="success-details-card">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="status-badge status-submitted">Submitted</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Application ID</span>
                <span className="detail-val">{submittedRecord?.id || 'app-int-new'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Submitted On</span>
                <span className="detail-val">{new Date().toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Candidate</span>
                <span className="detail-val">{fullName} ({email})</span>
              </div>
            </div>

            <div className="success-actions-row">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
