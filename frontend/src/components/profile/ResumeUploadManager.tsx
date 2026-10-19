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
  Eye,
  Plus,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Sparkles,
  Edit2,
  ChevronDown,
  ChevronUp,
  X
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
  const [editingExpIndex, setEditingExpIndex] = useState<number | null>(null);
  const [editingProjectIndex, setEditingProjectIndex] = useState<number | null>(null);
  const [editingEducationIndex, setEditingEducationIndex] = useState<number | null>(null);
  const [expandedExpIndex, setExpandedExpIndex] = useState<number | null>(0);
  const [newSkillInput, setNewSkillInput] = useState('');
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

  // Experience manipulation helpers
  const handleAddExperience = () => {
    if (!reviewModalData) return;
    const newExp = {
      jobTitle: '',
      company: '',
      duration: '',
      startDate: '',
      endDate: '',
      isCurrent: false,
      location: '',
      responsibilities: []
    };
    const updated = [...(reviewModalData.parsed.experience || []), newExp];
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, experience: updated }
    });
    setEditingExpIndex(updated.length - 1);
  };

  const handleRemoveExperience = (index: number) => {
    if (!reviewModalData) return;
    const updated = (reviewModalData.parsed.experience || []).filter((_: any, i: number) => i !== index);
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, experience: updated }
    });
    if (editingExpIndex === index) setEditingExpIndex(null);
  };

  const handleAddProject = () => {
    if (!reviewModalData) return;
    const newProj = {
      name: '',
      description: '',
      role: 'Contributor',
      technologies: []
    };
    const updated = [...(reviewModalData.parsed.projects || []), newProj];
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, projects: updated }
    });
    setEditingProjectIndex(updated.length - 1);
  };

  const handleRemoveProject = (index: number) => {
    if (!reviewModalData) return;
    const updated = (reviewModalData.parsed.projects || []).filter((_: any, i: number) => i !== index);
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, projects: updated }
    });
    if (editingProjectIndex === index) setEditingProjectIndex(null);
  };

  const handleAddEducation = () => {
    if (!reviewModalData) return;
    const newEdu = {
      degree: '',
      institution: '',
      fieldOfStudy: '',
      location: '',
      endDate: ''
    };
    const updated = [...(reviewModalData.parsed.education || []), newEdu];
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, education: updated }
    });
    setEditingEducationIndex(updated.length - 1);
  };

  const handleRemoveEducation = (index: number) => {
    if (!reviewModalData) return;
    const updated = (reviewModalData.parsed.education || []).filter((_: any, i: number) => i !== index);
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, education: updated }
    });
    if (editingEducationIndex === index) setEditingEducationIndex(null);
  };

  const handleAddSkill = () => {
    if (!newSkillInput.trim() || !reviewModalData) return;
    const skillName = newSkillInput.trim();
    const existing = reviewModalData.parsed.skills || [];
    if (!existing.some((s: any) => s.name.toLowerCase() === skillName.toLowerCase())) {
      const updated = [...existing, { name: skillName, category: 'TECHNICAL', source: 'RESUME' }];
      setReviewModalData({
        ...reviewModalData,
        parsed: { ...reviewModalData.parsed, skills: updated }
      });
    }
    setNewSkillInput('');
  };

  const handleRemoveSkill = (skillName: string) => {
    if (!reviewModalData) return;
    const updated = (reviewModalData.parsed.skills || []).filter((s: any) => s.name !== skillName);
    setReviewModalData({
      ...reviewModalData,
      parsed: { ...reviewModalData.parsed, skills: updated }
    });
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

      {/* Candidate Verification & Review Modal */}
      {reviewModalData && (
        <div className="review-modal-backdrop">
          <div className="review-modal-card">
            {/* Sticky Header */}
            <div className="review-modal-header">
              <div className="review-header-title-wrap">
                <div className="review-header-badge-row">
                  <span className="review-tag">Candidate Verification Workspace</span>
                  <Badge variant={reviewModalData.parsed.needsReview ? 'amber' : 'emerald'} size="sm">
                    {reviewModalData.parsed.needsReview ? 'Review Required' : 'Verified'}
                  </Badge>
                </div>
                <h3 className="review-modal-title">Review Extracted Information</h3>
                <p className="review-modal-subtitle">
                  Review and confirm the information Pilot Mama found in your resume before saving it to your Master Profile.
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setReviewModalData(null)}>✕</Button>
            </div>

            {/* Quick Extraction Metric Chips */}
            <div className="review-metrics-summary">
              <div className="metric-chip">
                <span className="metric-chip-label">Experience:</span>
                <span className="metric-chip-value font-bold">{reviewModalData.parsed.experience?.length || 0}</span>
              </div>
              <div className="metric-chip">
                <span className="metric-chip-label">Projects:</span>
                <span className="metric-chip-value font-bold">{reviewModalData.parsed.projects?.length || 0}</span>
              </div>
              <div className="metric-chip">
                <span className="metric-chip-label">Education:</span>
                <span className="metric-chip-value font-bold">{reviewModalData.parsed.education?.length || 0}</span>
              </div>
              <div className="metric-chip">
                <span className="metric-chip-label">Skills:</span>
                <span className="metric-chip-value font-bold">{reviewModalData.parsed.skills?.length || 0}</span>
              </div>
              <div className="metric-chip">
                <span className="metric-chip-label">Confidence:</span>
                <span className="metric-chip-value font-bold">{reviewModalData.parsed.parseConfidence || 90}%</span>
              </div>
            </div>

            <div className="review-modal-body">
              {reviewModalData.parsed.needsReview && (
                <div className="review-warning-banner">
                  <AlertCircle size={16} />
                  <span>{reviewModalData.parsed.reviewReasons?.join(', ') || 'Please verify detected entries'}</span>
                </div>
              )}

              {/* 1. Detected Personal Identity */}
              <div className="review-section">
                <div className="review-section-header-row">
                  <h4 className="review-section-title">Personal Information</h4>
                  <Badge variant="emerald" size="sm">✓ Verified</Badge>
                </div>
                <div className="form-grid-two">
                  <div className="form-group">
                    <label className="field-label">Candidate Full Name</label>
                    <input
                      type="text"
                      className="text-input"
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
                    <label className="field-label">Email Address</label>
                    <input
                      type="email"
                      className="text-input"
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
                  <div className="form-group">
                    <label className="field-label">Phone Number</label>
                    <input
                      type="tel"
                      className="text-input"
                      value={reviewModalData.parsed.personalInfo.phone || ''}
                      placeholder="+91 98765 43210"
                      onChange={e => setReviewModalData({
                        ...reviewModalData,
                        parsed: {
                          ...reviewModalData.parsed,
                          personalInfo: { ...reviewModalData.parsed.personalInfo, phone: e.target.value }
                        }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="field-label">Location / City</label>
                    <input
                      type="text"
                      className="text-input"
                      value={reviewModalData.parsed.personalInfo.location || ''}
                      placeholder="e.g. Chennai, India"
                      onChange={e => setReviewModalData({
                        ...reviewModalData,
                        parsed: {
                          ...reviewModalData.parsed,
                          personalInfo: { ...reviewModalData.parsed.personalInfo, location: e.target.value }
                        }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Professional Summary */}
              <div className="review-section">
                <div className="review-section-header-row">
                  <h4 className="review-section-title">Professional Summary</h4>
                  <Badge variant="emerald" size="sm">✓ Verified</Badge>
                </div>
                <textarea
                  rows={3}
                  className="textarea-input"
                  value={reviewModalData.parsed.summary || ''}
                  onChange={e => setReviewModalData({
                    ...reviewModalData,
                    parsed: { ...reviewModalData.parsed, summary: e.target.value }
                  })}
                />
              </div>

              {/* 3. Detected Experience Entries (HIGHEST PRIORITY) */}
              <div className="review-section">
                <div className="review-section-header-row">
                  <div className="flex-row items-center gap-2">
                    <Briefcase size={16} className="text-primary" />
                    <h4 className="review-section-title">
                      Experience ({reviewModalData.parsed.experience?.length || 0})
                    </h4>
                  </div>
                  <div className="flex-row items-center gap-2">
                    {(!reviewModalData.parsed.experience || reviewModalData.parsed.experience.length === 0) ? (
                      <Badge variant="amber" size="sm">⚠ Review Required</Badge>
                    ) : (
                      <Badge variant="emerald" size="sm">✓ Detected</Badge>
                    )}
                    <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={handleAddExperience}>
                      Add Experience
                    </Button>
                  </div>
                </div>

                {(!reviewModalData.parsed.experience || reviewModalData.parsed.experience.length === 0) ? (
                  <div className="review-empty-state">
                    <AlertCircle size={20} className="text-amber" />
                    <div>
                      <p className="font-semibold text-sm">Experience detected — review required</p>
                      <p className="text-xs text-muted">Click "+ Add Experience" to insert your professional role.</p>
                    </div>
                  </div>
                ) : (
                  <div className="review-items-list">
                    {reviewModalData.parsed.experience.map((exp: any, idx: number) => {
                      const isEditing = editingExpIndex === idx;
                      const isExpanded = expandedExpIndex === idx;

                      if (isEditing) {
                        return (
                          <div key={idx} className="review-card-edit-box">
                            <div className="form-grid-two">
                              <div className="form-group">
                                <label className="field-label">Job Title *</label>
                                <input
                                  type="text"
                                  className="text-input"
                                  value={exp.jobTitle || ''}
                                  onChange={e => {
                                    const updated = [...reviewModalData.parsed.experience];
                                    updated[idx] = { ...updated[idx], jobTitle: e.target.value };
                                    setReviewModalData({
                                      ...reviewModalData,
                                      parsed: { ...reviewModalData.parsed, experience: updated }
                                    });
                                  }}
                                />
                              </div>
                              <div className="form-group">
                                <label className="field-label">Company Name *</label>
                                <input
                                  type="text"
                                  className="text-input"
                                  value={exp.company || ''}
                                  onChange={e => {
                                    const updated = [...reviewModalData.parsed.experience];
                                    updated[idx] = { ...updated[idx], company: e.target.value };
                                    setReviewModalData({
                                      ...reviewModalData,
                                      parsed: { ...reviewModalData.parsed, experience: updated }
                                    });
                                  }}
                                />
                              </div>
                              <div className="form-group">
                                <label className="field-label">Duration</label>
                                <input
                                  type="text"
                                  className="text-input"
                                  placeholder="e.g. 6 years"
                                  value={exp.duration || ''}
                                  onChange={e => {
                                    const updated = [...reviewModalData.parsed.experience];
                                    updated[idx] = { ...updated[idx], duration: e.target.value };
                                    setReviewModalData({
                                      ...reviewModalData,
                                      parsed: { ...reviewModalData.parsed, experience: updated }
                                    });
                                  }}
                                />
                              </div>
                              <div className="form-group">
                                <label className="field-label">Location</label>
                                <input
                                  type="text"
                                  className="text-input"
                                  placeholder="e.g. Chennai, India"
                                  value={exp.location || ''}
                                  onChange={e => {
                                    const updated = [...reviewModalData.parsed.experience];
                                    updated[idx] = { ...updated[idx], location: e.target.value };
                                    setReviewModalData({
                                      ...reviewModalData,
                                      parsed: { ...reviewModalData.parsed, experience: updated }
                                    });
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex-row justify-end gap-2 mt-3">
                              <Button size="sm" variant="ghost" onClick={() => handleRemoveExperience(idx)}>
                                Remove
                              </Button>
                              <Button size="sm" variant="primary" onClick={() => setEditingExpIndex(null)}>
                                Done
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="review-entity-card">
                          <div className="review-card-top-row">
                            <div>
                              <div className="font-bold text-sm text-primary">{exp.jobTitle}</div>
                              <div className="text-xs font-semibold">{exp.company}</div>
                              <div className="text-xs text-muted">
                                {exp.duration ? exp.duration : `${exp.startDate || ''} - ${exp.isCurrent ? 'Present' : (exp.endDate || '')}`}
                                {exp.location ? ` • ${exp.location}` : ''}
                              </div>
                            </div>
                            <div className="review-card-controls">
                              <button
                                className="icon-btn"
                                title="Expand Responsibilities"
                                onClick={() => setExpandedExpIndex(isExpanded ? null : idx)}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <button
                                className="icon-btn"
                                title="Edit Experience"
                                onClick={() => setEditingExpIndex(idx)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="icon-btn text-red"
                                title="Remove Experience"
                                onClick={() => handleRemoveExperience(idx)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Expandable Key Responsibilities */}
                          {isExpanded && exp.responsibilities && exp.responsibilities.length > 0 && (
                            <div className="review-card-details">
                              <div className="text-xs font-bold uppercase tracking-wider mb-1 text-muted">Key Responsibilities</div>
                              <ul className="review-bullets-list">
                                {exp.responsibilities.map((bullet: string, bIdx: number) => (
                                  <li key={bIdx} className="text-xs">{bullet}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Projects Section */}
              <div className="review-section">
                <div className="review-section-header-row">
                  <div className="flex-row items-center gap-2">
                    <FolderGit2 size={16} className="text-primary" />
                    <h4 className="review-section-title">
                      Projects ({reviewModalData.parsed.projects?.length || 0})
                    </h4>
                  </div>
                  <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={handleAddProject}>
                    Add Project
                  </Button>
                </div>

                <div className="review-items-list">
                  {reviewModalData.parsed.projects?.map((proj: any, idx: number) => {
                    const isEditing = editingProjectIndex === idx;

                    if (isEditing) {
                      return (
                        <div key={idx} className="review-card-edit-box">
                          <div className="form-group mb-2">
                            <label className="field-label">Project Name *</label>
                            <input
                              type="text"
                              className="text-input"
                              value={proj.name || ''}
                              onChange={e => {
                                const updated = [...reviewModalData.parsed.projects];
                                updated[idx] = { ...updated[idx], name: e.target.value };
                                setReviewModalData({
                                  ...reviewModalData,
                                  parsed: { ...reviewModalData.parsed, projects: updated }
                                });
                              }}
                            />
                          </div>
                          <div className="form-group mb-2">
                            <label className="field-label">Description / Achievements</label>
                            <textarea
                              rows={2}
                              className="textarea-input"
                              value={proj.description || ''}
                              onChange={e => {
                                const updated = [...reviewModalData.parsed.projects];
                                updated[idx] = { ...updated[idx], description: e.target.value };
                                setReviewModalData({
                                  ...reviewModalData,
                                  parsed: { ...reviewModalData.parsed, projects: updated }
                                });
                              }}
                            />
                          </div>
                          <div className="flex-row justify-end gap-2 mt-2">
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveProject(idx)}>
                              Remove
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => setEditingProjectIndex(null)}>
                              Done
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="review-entity-card">
                        <div className="review-card-top-row">
                          <div>
                            <div className="font-bold text-sm">{proj.name}</div>
                            <div className="text-xs text-muted">{proj.description}</div>
                          </div>
                          <div className="review-card-controls">
                            <button
                              className="icon-btn"
                              title="Edit Project"
                              onClick={() => setEditingProjectIndex(idx)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="icon-btn text-red"
                              title="Remove Project"
                              onClick={() => handleRemoveProject(idx)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Education Section */}
              <div className="review-section">
                <div className="review-section-header-row">
                  <div className="flex-row items-center gap-2">
                    <GraduationCap size={16} className="text-primary" />
                    <h4 className="review-section-title">
                      Education ({reviewModalData.parsed.education?.length || 0})
                    </h4>
                  </div>
                  <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={handleAddEducation}>
                    Add Education
                  </Button>
                </div>

                <div className="review-items-list">
                  {reviewModalData.parsed.education?.map((edu: any, idx: number) => {
                    const isEditing = editingEducationIndex === idx;

                    if (isEditing) {
                      return (
                        <div key={idx} className="review-card-edit-box">
                          <div className="form-grid-two">
                            <div className="form-group">
                              <label className="field-label">Degree *</label>
                              <input
                                type="text"
                                className="text-input"
                                value={edu.degree || ''}
                                onChange={e => {
                                  const updated = [...reviewModalData.parsed.education];
                                  updated[idx] = { ...updated[idx], degree: e.target.value };
                                  setReviewModalData({
                                    ...reviewModalData,
                                    parsed: { ...reviewModalData.parsed, education: updated }
                                  });
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label className="field-label">Institution *</label>
                              <input
                                type="text"
                                className="text-input"
                                value={edu.institution || ''}
                                onChange={e => {
                                  const updated = [...reviewModalData.parsed.education];
                                  updated[idx] = { ...updated[idx], institution: e.target.value };
                                  setReviewModalData({
                                    ...reviewModalData,
                                    parsed: { ...reviewModalData.parsed, education: updated }
                                  });
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex-row justify-end gap-2 mt-2">
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveEducation(idx)}>
                              Remove
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => setEditingEducationIndex(null)}>
                              Done
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="review-entity-card">
                        <div className="review-card-top-row">
                          <div>
                            <div className="font-bold text-sm">{edu.degree}</div>
                            <div className="text-xs text-muted">{edu.institution} {edu.endDate ? `• ${edu.endDate}` : ''}</div>
                          </div>
                          <div className="review-card-controls">
                            <button
                              className="icon-btn"
                              title="Edit Education"
                              onClick={() => setEditingEducationIndex(idx)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="icon-btn text-red"
                              title="Remove Education"
                              onClick={() => handleRemoveEducation(idx)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 6. Skills Section with Interactive Chips */}
              <div className="review-section">
                <div className="review-section-header-row">
                  <div className="flex-row items-center gap-2">
                    <Sparkles size={16} className="text-primary" />
                    <h4 className="review-section-title">
                      Skills ({reviewModalData.parsed.skills?.length || 0})
                    </h4>
                  </div>
                  <Badge variant="emerald" size="sm">✓ Detected</Badge>
                </div>

                <div className="skills-inline-add">
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Add skill (e.g. Docker, TypeScript)"
                    value={newSkillInput}
                    onChange={e => setNewSkillInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={handleAddSkill}>
                    Add
                  </Button>
                </div>

                <div className="review-skills-chips">
                  {reviewModalData.parsed.skills?.map((s: any, idx: number) => (
                    <div key={idx} className="review-skill-chip-wrap">
                      <span className="skill-name">{s.name}</span>
                      {s.yearsOfExperience ? <span className="skill-years">{s.yearsOfExperience}y</span> : null}
                      <button
                        className="skill-remove-btn"
                        onClick={() => handleRemoveSkill(s.name)}
                        title={`Remove ${s.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="review-modal-footer">
              <div className="review-footer-status">
                <span className="text-xs text-muted">
                  Ready to save: {reviewModalData.parsed.experience?.length || 0} exp, {reviewModalData.parsed.projects?.length || 0} proj, {reviewModalData.parsed.education?.length || 0} edu
                </span>
              </div>
              <div className="review-footer-buttons">
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
        </div>
      )}
    </Card>
  );
};
