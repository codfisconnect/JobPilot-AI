import React, { useState } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { api } from "../api/index";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Award,
  Save,
  CheckCircle,
  Plus,
  Trash2,
  Globe,
  Github,
  Linkedin,
  Layers,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import './ProfilePage.css';

import { ResumeUploadManager } from '../components/profile/ResumeUploadManager';

export const ProfilePage: React.FC = () => {
  const { activeCandidate, setActiveCandidate, refreshCandidates, showToast } = useApp();
  const [profile, setProfile] = useState(activeCandidate);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'skills' | 'experience' | 'education' | 'projects'>('info');

  // Sync if active candidate switched
  React.useEffect(() => {
    setProfile(activeCandidate);
  }, [activeCandidate]);

  if (!profile) {
    return <div className="loading-state">No profile loaded.</div>;
  }

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated = await api.updateCandidate(profile.id, profile);
      setActiveCandidate(updated);
      await refreshCandidates();
      showToast('Master candidate profile updated successfully!');
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = (type: 'primary' | 'secondary') => {
    const val = prompt('Enter skill name:');
    if (!val?.trim()) return;
    if (type === 'primary') {
      setProfile({ ...profile, primarySkills: [...profile.primarySkills, val.trim()] });
    } else {
      setProfile({ ...profile, secondarySkills: [...profile.secondarySkills, val.trim()] });
    }
  };

  const removeSkill = (type: 'primary' | 'secondary', index: number) => {
    if (type === 'primary') {
      const copy = [...profile.primarySkills];
      copy.splice(index, 1);
      setProfile({ ...profile, primarySkills: copy });
    } else {
      const copy = [...profile.secondarySkills];
      copy.splice(index, 1);
      setProfile({ ...profile, secondarySkills: copy });
    }
  };

  const addCertification = () => {
    const name = prompt('Enter Certification Name (e.g. PMP, AWS Solutions Architect):');
    if (!name?.trim()) return;
    const issuer = prompt('Enter Issuing Organization (optional, e.g. PMI, Amazon):');
    const year = prompt('Enter Year/Date (optional, e.g. 2023):');
    
    let certEntry = name.trim();
    const details = [issuer?.trim(), year?.trim()].filter(Boolean).join(' • ');
    if (details) {
      certEntry += ` (${details})`;
    }

    setProfile({
      ...profile,
      certifications: [...(profile.certifications || []), certEntry]
    });
  };

  const editCertification = (index: number) => {
    const current = profile.certifications?.[index] || '';
    const updated = prompt('Edit Certification details:', current);
    if (updated === null) return;
    const trimmed = updated.trim();
    const copy = [...(profile.certifications || [])];
    if (trimmed) {
      copy[index] = trimmed;
    } else {
      copy.splice(index, 1);
    }
    setProfile({ ...profile, certifications: copy });
  };

  const removeCertification = (index: number) => {
    const copy = [...(profile.certifications || [])];
    copy.splice(index, 1);
    setProfile({ ...profile, certifications: copy });
  };

  const addExperience = () => {
    const title = prompt('Enter Job Title:');
    if (!title?.trim()) return;
    const company = prompt('Enter Company Name:');
    if (!company?.trim()) return;
    const startYear = prompt('Enter Start Date (e.g. 2021-03):') || '2021';
    const endYear = prompt('Enter End Date (or "Present"):') || 'Present';

    const newExp = {
      id: `exp-${Date.now()}`,
      title: title.trim(),
      company: company.trim(),
      startDate: startYear.trim(),
      endDate: endYear.trim(),
      duration: 'Relevant Experience',
      responsibilities: ['Spearheaded engineering delivery and cross-functional deliverables.'],
      highlights: ['Spearheaded engineering delivery and cross-functional deliverables.'],
      technologies: [],
      skillsUsed: []
    };

    setProfile({
      ...profile,
      experiences: [newExp, ...profile.experiences]
    });
  };

  const addProject = () => {
    const name = prompt('Enter Project Name:');
    if (!name?.trim()) return;
    const desc = prompt('Enter Project Summary / Deliverables:');
    const tech = prompt('Enter Technologies (comma-separated):');

    const newProj = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      description: desc?.trim() || 'Technical project implementation.',
      technologies: tech ? tech.split(',').map(t => t.trim()) : []
    };

    setProfile({
      ...profile,
      projects: [...(profile.projects || []), newProj]
    });
  };

  return (
    <div className="profile-page">
      {/* Header Banner */}
      <div className="profile-header-banner">
        <div>
          <div className="banner-tag-row">
            <span className="profile-tag">Canonical Master Profile</span>
            <Badge variant="emerald" size="sm">Verified Source of Truth</Badge>
            {profile.isDemo && <Badge variant="indigo" size="sm">Fictional Demo Candidate</Badge>}
          </div>
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-headline" style={{ color: '#818cf8', fontSize: '0.95rem', fontWeight: 600, margin: '4px 0' }}>
            {profile.headline || `${profile.targetRoles.join(' • ')}`}
          </p>
          <div className="profile-quick-contacts" style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span><Mail size={13} style={{ display: 'inline', marginRight: '4px' }} />{profile.email}</span>
            <span><Phone size={13} style={{ display: 'inline', marginRight: '4px' }} />{profile.phone}</span>
            <span><MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />{profile.location}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Button
            variant="primary"
            icon={<Save size={16} />}
            loading={isSaving}
            onClick={handleSave}
          >
            Save Master Profile
          </Button>
        </div>
      </div>

      {/* Production Resume Vault & Parser Area */}
      <ResumeUploadManager onProfileUpdated={refreshCandidates} />

      {/* Profile Sections Grid */}
      <div className="profile-grid">
        {/* Left Column: Personal Identity & Contact Links */}
        <div className="profile-col">
          <Card className="profile-section-card">
            <h3 className="section-title">
              <User size={18} /> Candidate Identity & Contacts
            </h3>

            <div className="form-group">
              <label>Full Legal / Professional Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Professional Headline</label>
              <input
                type="text"
                placeholder="e.g. Senior QA Automation Engineer | SDET | Java & Playwright"
                value={profile.headline || ''}
                onChange={e => setProfile({ ...profile, headline: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={e => setProfile({ ...profile, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Current Location (City, Country)</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={e => setProfile({ ...profile, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Total Experience (Years)</label>
                <input
                  type="number"
                  step="0.5"
                  value={profile.yearsOfExperience}
                  onChange={e => setProfile({ ...profile, yearsOfExperience: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="form-group">
              <label><Linkedin size={14} style={{ display: 'inline', marginRight: '6px' }} /> LinkedIn Profile URL</label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={profile.linkedInUrl || ''}
                onChange={e => setProfile({ ...profile, linkedInUrl: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label><Github size={14} style={{ display: 'inline', marginRight: '6px' }} /> GitHub / Repository URL</label>
              <input
                type="url"
                placeholder="https://github.com/username"
                value={profile.gitHubUrl || ''}
                onChange={e => setProfile({ ...profile, gitHubUrl: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Expected Salary</label>
                <input
                  type="text"
                  value={profile.expectedSalary}
                  onChange={e => setProfile({ ...profile, expectedSalary: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Notice Period</label>
                <input
                  type="text"
                  value={profile.noticePeriod}
                  onChange={e => setProfile({ ...profile, noticePeriod: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Work Preference</label>
              <select
                value={profile.workPreference}
                onChange={e => setProfile({ ...profile, workPreference: e.target.value as any })}
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Onsite">Onsite</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>
          </Card>

          {/* Categorized & Primary Skills */}
          <Card className="profile-section-card">
            <div className="section-head-row">
              <h3 className="section-title">
                <Layers size={18} /> Verified Primary Skills
              </h3>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => addSkill('primary')}>
                Add Skill
              </Button>
            </div>
            <p className="section-note">
              Strict Truth Guarantee: Pilot Mama only uses verified skills present here when optimizing your resumes.
            </p>
            <div className="skill-tags-cloud">
              {profile.primarySkills.map((skill, idx) => (
                <div key={idx} className="interactive-skill-tag">
                  <span>{skill}</span>
                  <button onClick={() => removeSkill('primary', idx)}>×</button>
                </div>
              ))}
            </div>

            <div className="section-head-row" style={{ marginTop: '20px' }}>
              <h3 className="section-title">Secondary & Adjacent Tools</h3>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => addSkill('secondary')}>
                Add Tool
              </Button>
            </div>
            <div className="skill-tags-cloud">
              {profile.secondarySkills.map((skill, idx) => (
                <div key={idx} className="interactive-skill-tag secondary-tag">
                  <span>{skill}</span>
                  <button onClick={() => removeSkill('secondary', idx)}>×</button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Summary, Work History, Education, Projects & Certifications */}
        <div className="profile-col">
          <Card className="profile-section-card">
            <h3 className="section-title">Professional Summary</h3>
            <p className="section-note">
              High-level candidate career narrative. Generic to candidate credentials; prospective company names are never injected here.
            </p>
            <div className="form-group">
              <textarea
                rows={5}
                value={profile.summary}
                onChange={e => setProfile({ ...profile, summary: e.target.value })}
              />
            </div>
          </Card>

          {/* Work History */}
          <Card className="profile-section-card">
            <div className="section-head-row">
              <h3 className="section-title">
                <Briefcase size={18} /> Verified Professional Experience ({profile.experiences.length})
              </h3>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addExperience}>
                Add Position
              </Button>
            </div>
            <div className="experiences-editor-list">
              {profile.experiences.map((exp, expIdx) => (
                <div key={exp.id} className="exp-card-block">
                  <div className="exp-card-header">
                    <div>
                      <h4 className="exp-role-title">{exp.title}</h4>
                      <span className="exp-company-sub">{exp.company} • {exp.startDate} to {exp.endDate} {exp.duration ? `(${exp.duration})` : ''}</span>
                    </div>
                  </div>

                  <div className="highlights-list">
                    {(exp.responsibilities || exp.highlights || []).map((hl, hlIdx) => (
                      <div key={hlIdx} className="highlight-bullet">
                        <span className="bullet-dot">•</span>
                        <input
                          type="text"
                          value={hl}
                          onChange={e => {
                            const newExp = [...profile.experiences];
                            const currentList = [...(newExp[expIdx].responsibilities || newExp[expIdx].highlights || [])];
                            currentList[hlIdx] = e.target.value;
                            newExp[expIdx].responsibilities = currentList;
                            newExp[expIdx].highlights = currentList;
                            setProfile({ ...profile, experiences: newExp });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Projects */}
          <Card className="profile-section-card">
            <div className="section-head-row">
              <h3 className="section-title">
                <FileCheck size={18} /> Technical Projects ({profile.projects?.length || 0})
              </h3>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addProject}>
                Add Project
              </Button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
              {(profile.projects || []).map((proj, pIdx) => (
                <div key={proj.id} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main, #f1f5f9)' }}>{proj.name}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)', margin: '4px 0 8px' }}>{proj.description}</p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(proj.technologies || []).map((t, tIdx) => (
                      <Badge key={tIdx} variant="indigo" size="sm">{t}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Education */}
          <Card className="profile-section-card">
            <h3 className="section-title">
              <GraduationCap size={18} /> Education & Academics
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {(profile.education || []).map((edu, eIdx) => (
                <div key={edu.id} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 600 }}>{edu.degree}</h4>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{edu.institution} {edu.year ? `• ${edu.year}` : ''}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Certifications Section */}
          <Card className="profile-section-card">
            <div className="section-head-row">
              <h3 className="section-title">
                <Award size={18} /> Certifications & Credentials
              </h3>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={addCertification}>
                Add Certification
              </Button>
            </div>
            <p className="section-note">
              Verified certifications & licenses. Only explicitly listed credentials appear here.
            </p>

            {(!profile.certifications || profile.certifications.length === 0) ? (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontStyle: 'italic', padding: '12px 0' }}>
                No certifications added
              </div>
            ) : (
              <div className="certifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {profile.certifications.map((cert, cIdx) => (
                  <div
                    key={cIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Award size={16} style={{ color: 'var(--primary, #6366f1)' }} />
                      <span style={{ fontWeight: 500, fontSize: '0.92rem' }}>{cert}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button size="sm" variant="ghost" onClick={() => editCertification(cIdx)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} style={{ color: '#ef4444' }} />} onClick={() => removeCertification(cIdx)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
