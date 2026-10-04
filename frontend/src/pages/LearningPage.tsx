import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { api } from "../api/index";
import { SkillGapItem, OnlineLearningResource, LocalTrainingInstitute } from "../types/index";
import {
  BookOpen,
  MapPin,
  Globe,
  ExternalLink,
  Sparkles,
  Phone,
  Star,
  CheckCircle,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import './LearningPage.css';

export const LearningPage: React.FC = () => {
  const { activeCandidate } = useApp();
  const [skillGaps, setSkillGaps] = useState<SkillGapItem[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string>('Playwright');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('English');
  const [selectedCity, setSelectedCity] = useState<string>('Chennai');
  const [resources, setResources] = useState<OnlineLearningResource[]>([]);
  const [institutes, setInstitutes] = useState<LocalTrainingInstitute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCandidate) return;
    async function loadGaps() {
      try {
        setLoading(true);
        const gaps = await api.getSkillGaps(activeCandidate!.id);
        setSkillGaps(gaps);
        if (gaps.length > 0) {
          const firstMissing = gaps.find(g => g.status === 'MISSING') || gaps[0];
          setSelectedSkill(firstMissing.skill);
        }
      } catch (err) {
        console.error('Failed to load skill gaps:', err);
      } finally {
        setLoading(false);
      }
    }
    loadGaps();
  }, [activeCandidate]);

  useEffect(() => {
    async function loadLearningData() {
      if (!selectedSkill) return;
      try {
        const [resList, instList] = await Promise.all([
          api.getLearningResources(selectedSkill, selectedLanguage),
          api.getLocalInstitutes(selectedCity, selectedSkill)
        ]);
        setResources(resList);
        setInstitutes(instList);
      } catch (err) {
        console.error('Failed to load learning data:', err);
      }
    }
    loadLearningData();
  }, [selectedSkill, selectedLanguage, selectedCity]);

  const languages = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada'];
  const cities = ['Chennai', 'Bangalore', 'Pune', 'Hyderabad', 'Mumbai'];

  return (
    <div className="learning-page">
      <div className="learning-header">
        <div>
          <h2 className="learning-title">Skill Gap Intelligence & Learning Academy</h2>
          <p className="learning-sub">
            Prioritized skill gap analysis across all analyzed target jobs. Discover verified online documentation, video tutorials, and legitimate nearby training institutes without false claims.
          </p>
        </div>
      </div>

      {/* Location & Language Customization Toolbar */}
      <div className="learning-controls-row">
        <div className="control-item">
          <Globe size={16} />
          <span>Preferred Learning Language:</span>
          <select
            className="control-select"
            value={selectedLanguage}
            onChange={e => setSelectedLanguage(e.target.value)}
          >
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="control-item">
          <MapPin size={16} />
          <span>Local Institute Location:</span>
          <select
            className="control-select"
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
          >
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="learning-layout">
        {/* Left Column: Aggregated Skill Gaps */}
        <div className="learning-left-col">
          <Card>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} /> Priority Skill Gaps in Target Market
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Aggregated across active job catalog. Select any skill to view customized learning pathways.
            </p>

            <div className="gaps-list">
              {skillGaps.map(item => (
                <div
                  key={item.skill}
                  className={`gap-card ${selectedSkill === item.skill ? 'gap-card-active' : ''}`}
                  onClick={() => setSelectedSkill(item.skill)}
                >
                  <div className="gap-top-row">
                    <span className="gap-skill-name">{item.skill}</span>
                    <Badge
                      variant={
                        item.priority === 'HIGH' ? 'rose' : item.priority === 'MEDIUM' ? 'amber' : 'emerald'
                      }
                      size="sm"
                    >
                      {item.priority} Priority
                    </Badge>
                  </div>

                  <div className="gap-meta-row">
                    <span>Demand: {item.frequencyInTargetJobs} Target Roles</span>
                    <span>Status: {item.status}</span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                    {item.reason}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Online Tutorials + Local Training Institutes */}
        <div className="learning-right-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Online Learning Resources */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} /> Verified Online Learning: {selectedSkill}
              </h3>
              <Badge variant="blue" size="sm">Language: {selectedLanguage}</Badge>
            </div>

            <div className="resources-list">
              {resources.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No verified learning resources found for {selectedSkill} in {selectedLanguage}. Showing English documentation instead.
                </p>
              ) : (
                resources.map(res => (
                  <div key={res.id} className="res-item-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 className="res-item-title">{res.title}</h4>
                      <Badge variant="indigo" size="sm">{res.platform}</Badge>
                    </div>
                    <p className="res-desc">{res.description}</p>
                    <div className="res-footer">
                      <span>Level: {res.level} • {res.approximateDuration}</span>
                      <a href={res.url} target="_blank" rel="noreferrer" style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
                        Open Tutorial <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Local Training Institutes */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={18} /> Legitimate Training Institutes near {selectedCity}
              </h3>
              <Badge variant="emerald" size="sm">Verified Presence</Badge>
            </div>

            <div className="institutes-list">
              {institutes.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No specific training institutes found in {selectedCity} for {selectedSkill}.
                </p>
              ) : (
                institutes.map(inst => (
                  <div key={inst.id} className="inst-item-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 className="inst-item-title">{inst.name}</h4>
                      <span style={{ fontSize: '0.82rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                        <Star size={12} fill="#fbbf24" /> {inst.rating} / 5.0
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {inst.area}, {inst.city} • Approx {inst.distanceEstimate}
                    </div>

                    <p className="inst-desc">{inst.courseRelevance}</p>

                    <div className="inst-footer">
                      <span>
                        <Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />
                        {inst.contactPhone || 'Available on site'}
                      </span>
                      {inst.website && (
                        <a href={inst.website} target="_blank" rel="noreferrer" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
                          Visit Official Website <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
