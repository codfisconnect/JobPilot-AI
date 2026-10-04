import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { api } from "../api/index";
import { InterviewPreparation, JobDescription } from "../types/index";
import {
  Headphones,
  Sparkles,
  BookOpen,
  Code,
  UserCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Briefcase
} from 'lucide-react';
import './InterviewPage.css';

interface InterviewPageProps {
  preselectedJobId?: string;
  onNavigate: (tab: string) => void;
}

export const InterviewPage: React.FC<InterviewPageProps> = ({
  preselectedJobId,
  onNavigate
}) => {
  const { activeCandidate, showToast } = useApp();
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(preselectedJobId || '');
  const [prep, setPrep] = useState<InterviewPreparation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    tech: true,
    resume: true,
    hr: true,
    scenario: true
  });

  useEffect(() => {
    async function loadJobs() {
      try {
        const list = await api.getJobs();
        setJobs(list);
        if (!selectedJobId && list.length > 0) {
          setSelectedJobId(list[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadJobs();
  }, []);

  useEffect(() => {
    async function loadPrep() {
      if (!activeCandidate || !selectedJobId) return;
      try {
        setIsLoading(true);
        const existing = await api.getInterviewPrep(activeCandidate.id, selectedJobId);
        setPrep(existing);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPrep();
  }, [activeCandidate, selectedJobId]);

  const handleGenerate = async () => {
    if (!activeCandidate || !selectedJobId) return;
    try {
      setIsGenerating(true);
      const res = await api.generateInterviewPrep(activeCandidate.id, selectedJobId);
      setPrep(res);
      showToast('Comprehensive interview preparation guide generated!');
    } catch (err: any) {
      alert(`Failed to generate prep: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const currentJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="interview-page">
      <div className="interview-header-row">
        <div>
          <h2 className="interview-title">Interview Preparation Studio</h2>
          <p className="interview-sub">
            AI generated questions synthesized from the exact Job Description, candidate background, and tailored resume.
          </p>
        </div>

        {/* Job Selector */}
        <div className="job-select-box">
          <label>Target Role for Prep:</label>
          <select
            value={selectedJobId}
            onChange={e => setSelectedJobId(e.target.value)}
          >
            {jobs.map(j => (
              <option key={j.id} value={j.id}>
                {j.company} — {j.role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!prep ? (
        <Card className="prep-empty-card">
          <Headphones size={48} className="prep-icon" />
          <h3>No interview preparation generated yet for this role.</h3>
          <p>
            Generate targeted technical deep-dives, resume defense questions, and company cultural inquiries for{' '}
            <strong>{currentJob ? `${currentJob.role} at ${currentJob.company}` : 'selected job'}</strong>.
          </p>
          <Button
            variant="primary"
            icon={<Sparkles size={16} />}
            loading={isGenerating}
            onClick={handleGenerate}
          >
            Generate Interview Preparation Pack
          </Button>
        </Card>
      ) : (
        <div className="prep-content-flow">
          {/* Summary / Focus Areas Banner */}
          <div className="prep-focus-banner">
            <div className="focus-header">
              <span className="focus-tag">Preparation Roadmap</span>
              <h3 className="focus-title">
                {prep.role} • {prep.company}
              </h3>
            </div>
            <div className="focus-areas-list">
              {prep.preparationAreas.map((area, i) => (
                <div key={i} className="focus-area-chip">
                  <span className="area-num">0{i + 1}</span>
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Topics & Core Questions */}
          <Card className="prep-section-card">
            <div className="section-accordion-head" onClick={() => toggleSection('tech')}>
              <h3 className="section-title">
                <Code size={18} /> High-Yield Technical Interview Questions ({prep.technicalQuestions.length})
              </h3>
              {expandedSections.tech ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {expandedSections.tech && (
              <div className="questions-list">
                {prep.technicalQuestions.map((tq, idx) => (
                  <div key={idx} className="q-card">
                    <div className="q-card-head">
                      <span className="q-badge">Question {idx + 1}</span>
                      <Badge variant={tq.difficulty === 'Hard' ? 'rose' : 'blue'} size="sm">
                        {tq.difficulty}
                      </Badge>
                    </div>
                    <h4 className="q-text">{tq.question}</h4>
                    <div className="q-guidance">
                      <span className="guidance-label">How to answer (STAR Technique):</span>
                      <p>{tq.answerGuidance}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Resume Defense Questions */}
          <Card className="prep-section-card">
            <div className="section-accordion-head" onClick={() => toggleSection('resume')}>
              <h3 className="section-title">
                <BookOpen size={18} /> Resume Defense & Verification Questions ({prep.resumeQuestions.length})
              </h3>
              {expandedSections.resume ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {expandedSections.resume && (
              <div className="questions-list">
                {prep.resumeQuestions.map((rq, idx) => (
                  <div key={idx} className="q-card">
                    <div className="q-card-head">
                      <span className="q-badge">Based on your experience</span>
                      <span className="q-source">{rq.basedOn}</span>
                    </div>
                    <h4 className="q-text">{rq.question}</h4>
                    <div className="q-guidance">
                      <span className="guidance-label">Strategic Guidance:</span>
                      <p>{rq.answerGuidance}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* HR & Behavioral Questions */}
          <Card className="prep-section-card">
            <div className="section-accordion-head" onClick={() => toggleSection('hr')}>
              <h3 className="section-title">
                <UserCheck size={18} /> Behavioral & Culture Alignment Questions ({prep.hrQuestions.length})
              </h3>
              {expandedSections.hr ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {expandedSections.hr && (
              <div className="questions-list">
                {prep.hrQuestions.map((hq, idx) => (
                  <div key={idx} className="q-card">
                    <div className="q-card-head">
                      <span className="q-badge">Interviewer Intent</span>
                      <span className="q-source">{hq.purpose}</span>
                    </div>
                    <h4 className="q-text">{hq.question}</h4>
                    <div className="q-guidance">
                      <span className="guidance-label">Suggested Response Framework:</span>
                      <p style={{ whiteSpace: 'pre-line' }}>{hq.sampleOutline}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Role Scenarios */}
          {prep.roleSpecificQuestions.length > 0 && (
            <Card className="prep-section-card">
              <div className="section-accordion-head" onClick={() => toggleSection('scenario')}>
                <h3 className="section-title">
                  <AlertCircle size={18} /> Role-Specific System & Crisis Scenarios
                </h3>
                {expandedSections.scenario ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>

              {expandedSections.scenario && (
                <div className="questions-list">
                  {prep.roleSpecificQuestions.map((sq, idx) => (
                    <div key={idx} className="q-card">
                      <h4 className="q-text">Scenario: {sq.scenario}</h4>
                      <div className="q-guidance">
                        <span className="guidance-label">Key Checkpoints Evaluated:</span>
                        <ul className="checkpoint-list">
                          {sq.keyCheckpoints.map((cp, cpi) => (
                            <li key={cpi}>{cp}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
