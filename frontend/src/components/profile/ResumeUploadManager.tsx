import React, { useState, useRef } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { apiClient } from '../../api/client';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  ArrowRight,
  Eye,
  Plus
} from 'lucide-react';
import './ResumeUploadManager.css';

interface ResumeUploadManagerProps {
  onProfileUpdated?: () => void;
}

export const ResumeUploadManager: React.FC<ResumeUploadManagerProps> = ({ onProfileUpdated }) => {
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsingId, setParsingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewModalData, setReviewModalData] = useState<{
    resumeId: string;
    parsed: any;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [versionTitle, setVersionTitle] = useState('');
  const [creatingVersionForId, setCreatingVersionForId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing resumes on mount
  React.useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await apiClient.listResumes();
      setResumes(list || []);
    } catch (err: any) {
      // If user has not logged in with V1 yet, gracefully fall back
      console.warn('Could not fetch v1 resumes:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    try {
      setUploading(true);
      setError(null);
      const uploaded = await apiClient.uploadResume(file, file.name);
      await loadResumes();
      // Proactively trigger parse review
      await handleParse(uploaded.id);
    } catch (err: any) {
      setError(err.message || 'Failed to upload resume file');
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async (resumeId: string) => {
    try {
      setParsingId(resumeId);
      setError(null);
      const parsedResult = await apiClient.parseResume(resumeId);
      setReviewModalData({ resumeId, parsed: parsedResult });
      await loadResumes();
    } catch (err: any) {
      setError(err.message || 'Failed to parse resume document');
    } finally {
      setParsingId(null);
    }
  };

  const handleConfirmReview = async () => {
    if (!reviewModalData) return;
    try {
      setLoading(true);
      await apiClient.confirmParsedResume(reviewModalData.resumeId, {
        ...reviewModalData.parsed,
        setAsMaster: true
      });
      setReviewModalData(null);
      await loadResumes();
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm and apply resume data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (resumeId: string) => {
    try {
      setLoading(true);
      await apiClient.createResumeVersion(resumeId, versionTitle || 'Canonical Snapshot');
      setVersionTitle('');
      setCreatingVersionForId(null);
      await loadResumes();
    } catch (err: any) {
      setError(err.message || 'Failed to create resume version snapshot');
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveResume = async (resumeId: string) => {
    if (!confirm('Are you sure you want to archive this resume? Historical versions will remain safe.')) return;
    try {
      setLoading(true);
      await apiClient.deleteResume(resumeId);
      await loadResumes();
    } catch (err: any) {
      setError(err.message || 'Failed to archive resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="resume-manager-card">
      <div className="resume-manager-header">
        <div>
          <h3 className="resume-manager-title">
            <UploadCloud size={20} /> Master Resume & Document Vault
          </h3>
          <p className="resume-manager-subtitle">
            Upload your existing PDF or DOCX resume. All extracted text is reviewed by you before becoming canonical truth.
          </p>
        </div>
      </div>

      {error && (
        <div className="resume-manager-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Drag & Drop Zone */}
      <div
        className={`resume-drop-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          style={{ display: 'none' }}
          onChange={e => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
        {uploading ? (
          <div className="drop-zone-content">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="font-semibold">Securing and uploading resume...</p>
            <span className="text-xs text-muted">Checking file signature & magic numbers</span>
          </div>
        ) : (
          <div className="drop-zone-content">
            <UploadCloud size={36} className="text-primary" />
            <p className="font-semibold">Drag & drop your resume here, or <span className="browse-link">browse</span></p>
            <span className="text-xs text-muted">Supports PDF, DOCX (Max 10MB). Stored privately.</span>
          </div>
        )}
      </div>

      {/* Resumes List */}
      <div className="resumes-list-section">
        <h4 className="resumes-list-heading">Uploaded Documents ({resumes.length})</h4>
        {resumes.length === 0 ? (
          <p className="resumes-empty-note">No documents uploaded yet. Upload your PDF/DOCX resume above to parse your profile automatically.</p>
        ) : (
          <div className="resumes-grid">
            {resumes.map(r => (
              <div key={r.id} className="resume-item-card">
                <div className="resume-item-top">
                  <div className="resume-file-info">
                    <FileText size={20} className="text-primary" />
                    <div>
                      <div className="resume-item-filename">{r.title || r.originalFileName || 'Resume Document'}</div>
                      <div className="resume-item-meta">
                        {r.fileSize ? `${Math.round(r.fileSize / 1024)} KB` : ''} • Uploaded {new Date(r.uploadedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={r.status === 'PARSED' ? 'emerald' : r.status === 'PARSE_REVIEW_REQUIRED' ? 'amber' : 'indigo'}
                    size="sm"
                  >
                    {r.status}
                  </Badge>
                </div>

                {/* Resume Version Badges */}
                {r.versions && r.versions.length > 0 && (
                  <div className="resume-versions-row">
                    <span className="versions-label">Immutable Versions:</span>
                    {r.versions.map((v: any) => (
                      <Badge key={v.id} variant="neutral" size="sm">
                        v{v.versionNumber}: {v.title}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="resume-item-actions">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={parsingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                    disabled={parsingId === r.id}
                    onClick={() => handleParse(r.id)}
                  >
                    {r.status === 'PARSED' ? 'Re-review Parse' : 'Parse & Review'}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus size={14} />}
                    onClick={() => setCreatingVersionForId(r.id)}
                  >
                    Create Snapshot
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={14} className="text-red" />}
                    onClick={() => handleArchiveResume(r.id)}
                  >
                    Archive
                  </Button>
                </div>

                {/* Inline Snapshot Creation Input */}
                {creatingVersionForId === r.id && (
                  <div className="version-creation-box">
                    <input
                      type="text"
                      placeholder="Snapshot Title (e.g. Full Stack v1.0)"
                      value={versionTitle}
                      onChange={e => setVersionTitle(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button size="sm" variant="primary" onClick={() => handleCreateVersion(r.id)}>
                        Save Version
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCreatingVersionForId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Candidate Review Modal */}
      {reviewModalData && (
        <div className="review-modal-backdrop">
          <div className="review-modal-card">
            <div className="review-modal-header">
              <div>
                <h3 className="text-lg font-bold">Review Extracted Candidate Information</h3>
                <p className="text-xs text-muted">
                  Truth Protection Guarantee: Please verify or edit any fields before saving to your Canonical Master Profile.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setReviewModalData(null)}>✕</Button>
            </div>

            <div className="review-modal-body">
              {reviewModalData.parsed.needsReview && (
                <div className="review-warning-banner">
                  <AlertCircle size={16} />
                  <span>Some sections require candidate confirmation: {reviewModalData.parsed.reviewReasons?.join(', ')}</span>
                </div>
              )}

              {/* Detected Identity */}
              <div className="review-section">
                <h4 className="review-section-title">Detected Personal Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Candidate Name</label>
                    <input
                      type="text"
                      value={reviewModalData.parsed.personalInfo.fullName || ''}
                      onChange={e => setReviewModalData({
                        ...reviewModalData,
                        parsed: {
                          ...reviewModalData.parsed,
                          personalInfo: { ...reviewModalData.parsed.personalInfo, fullName: e.target.value }
                        }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={reviewModalData.parsed.personalInfo.email || ''}
                      onChange={e => setReviewModalData({
                        ...reviewModalData,
                        parsed: {
                          ...reviewModalData.parsed,
                          personalInfo: { ...reviewModalData.parsed.personalInfo, email: e.target.value }
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Detected Summary */}
              <div className="review-section">
                <h4 className="review-section-title">Detected Professional Summary</h4>
                <textarea
                  rows={3}
                  value={reviewModalData.parsed.summary || ''}
                  onChange={e => setReviewModalData({
                    ...reviewModalData,
                    parsed: { ...reviewModalData.parsed, summary: e.target.value }
                  })}
                />
              </div>

              {/* Detected Skills */}
              <div className="review-section">
                <h4 className="review-section-title">Detected Skills ({reviewModalData.parsed.skills?.length || 0})</h4>
                <div className="review-skills-chips">
                  {reviewModalData.parsed.skills?.map((s: any, idx: number) => (
                    <Badge key={idx} variant="indigo" size="sm">
                      {s.name} {s.yearsOfExperience ? `(${s.yearsOfExperience} yrs)` : ''}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Detected Work Experiences */}
              <div className="review-section">
                <h4 className="review-section-title">Detected Experience Entries ({reviewModalData.parsed.experience?.length || 0})</h4>
                {reviewModalData.parsed.experience?.map((exp: any, idx: number) => (
                  <div key={idx} className="review-exp-item">
                    <div className="font-semibold text-sm">{exp.jobTitle} at {exp.company}</div>
                    <div className="text-xs text-muted">{exp.startDate} - {exp.isCurrent ? 'Present' : exp.endDate}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="review-modal-footer">
              <Button variant="ghost" onClick={() => setReviewModalData(null)}>
                Discard Changes
              </Button>
              <Button
                variant="primary"
                icon={<CheckCircle size={16} />}
                loading={loading}
                onClick={handleConfirmReview}
              >
                Confirm & Save to Master Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
