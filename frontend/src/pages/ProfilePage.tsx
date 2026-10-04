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
  Trash2
} from 'lucide-react';
import './ProfilePage.css';

export const ProfilePage: React.FC = () => {
  const { activeCandidate, setActiveCandidate, refreshCandidates, showToast } = useApp();
  const [profile, setProfile] = useState(activeCandidate);
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <div className="profile-page">
      {/* Header Banner */}
      <div className="profile-header-banner">
        <div>
          <div className="banner-tag-row">
            <span className="profile-tag">Candidate Master Profile</span>
            {profile.isDemo && <Badge variant="indigo" size="sm">Fictional Demo Candidate</Badge>}
          </div>
          <h2 className="profile-name">{profile.name}</h2>
          <p className="profile-roles">{profile.targetRoles.join(' • ')}</p>
        </div>

        <Button
          variant="primary"
          icon={<Save size={16} />}
          loading={isSaving}
          onClick={handleSave}
        >
          Save Profile Changes
        </Button>
      </div>

      <div className="profile-grid">
        {/* Left Column: Personal & Preferences */}
        <div className="profile-col">
          <Card className="profile-section-card">
            <h3 className="section-title">
              <User size={18} /> Contact & Target Details
            </h3>

            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
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
                <label>Current Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={e => setProfile({ ...profile, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="number"
                  step="0.5"
                  value={profile.yearsOfExperience}
                  onChange={e => setProfile({ ...profile, yearsOfExperience: parseFloat(e.target.value) || 0 })}
                />
              </div>
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

          {/* Verified Technical Skills */}
          <Card className="profile-section-card">
            <div className="section-head-row">
              <h3 className="section-title">Verified Primary Skills</h3>
              <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => addSkill('primary')}>
                Add Skill
              </Button>
            </div>
            <p className="section-note">
              Strict Truth Guarantee: JobPilot only uses verified skills present here when optimizing your resumes.
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

        {/* Right Column: Summary & Experiences */}
        <div className="profile-col">
          <Card className="profile-section-card">
            <h3 className="section-title">Professional Summary</h3>
            <div className="form-group">
              <textarea
                rows={5}
                value={profile.summary}
                onChange={e => setProfile({ ...profile, summary: e.target.value })}
              />
            </div>
          </Card>

          <Card className="profile-section-card">
            <h3 className="section-title">
              <Briefcase size={18} /> Verified Work History
            </h3>
            <div className="experiences-editor-list">
              {profile.experiences.map((exp, expIdx) => (
                <div key={exp.id} className="exp-card-block">
                  <div className="exp-card-header">
                    <div>
                      <h4 className="exp-role-title">{exp.title}</h4>
                      <span className="exp-company-sub">{exp.company} • {exp.startDate} to {exp.endDate}</span>
                    </div>
                  </div>

                  <div className="highlights-list">
                    {exp.highlights.map((hl, hlIdx) => (
                      <div key={hlIdx} className="highlight-bullet">
                        <span className="bullet-dot">•</span>
                        <input
                          type="text"
                          value={hl}
                          onChange={e => {
                            const newExp = [...profile.experiences];
                            newExp[expIdx].highlights[hlIdx] = e.target.value;
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
        </div>
      </div>
    </div>
  );
};
