import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { apiClient } from '../api/client';
import { InterviewSessionCard } from '../components/interviews/InterviewSessionCard';
import { InterviewQuestionCard } from '../components/interviews/InterviewQuestionCard';
import { AnswerEditor } from '../components/interviews/AnswerEditor';
import { AnswerEvaluation } from '../components/interviews/AnswerEvaluation';
import {
  Sparkles,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  Briefcase,
  ChevronRight,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import './InterviewPage.css';

interface InterviewPrepPageProps {
  preselectedJobId?: string;
  onNavigate: (tab: string, id?: string) => void;
}

export const InterviewPrepPage: React.FC<InterviewPrepPageProps> = ({
  preselectedJobId,
  onNavigate
}) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing sessions
  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await apiClient.getInterviewSessions();
      setSessions(list || []);

      // If preselectedJobId provided, either open matching session or create one
      if (preselectedJobId) {
        const matching = list.find((s: any) => s.jobId === preselectedJobId);
        if (matching) {
          const detail = await apiClient.getInterviewSessionById(matching.id);
          setActiveSession(detail);
        } else {
          // Auto create session for preselected job
          handleCreateSession(preselectedJobId);
        }
      } else if (list.length > 0 && !activeSession) {
        // Load first session detail
        const detail = await apiClient.getInterviewSessionById(list[0].id);
        setActiveSession(detail);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load interview sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [preselectedJobId]);

  const handleSelectSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const detail = await apiClient.getInterviewSessionById(sessionId);
      setActiveSession(detail);
      setSelectedQuestionIndex(0);
    } catch (err: any) {
      setError(err.message || 'Failed to load interview session details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (jobId: string) => {
    try {
      setIsGenerating(true);
      setError(null);
      const newSession = await apiClient.createInterviewSession(jobId);
      const detail = await apiClient.getInterviewSessionById(newSession.id);
      setActiveSession(detail);
      setSelectedQuestionIndex(0);
      setSessions(prev => [detail, ...prev.filter(s => s.id !== detail.id)]);
    } catch (err: any) {
      setError(err.message || 'Failed to create interview preparation session');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMoreQuestions = async () => {
    if (!activeSession) return;
    try {
      setIsGenerating(true);
      await apiClient.generateInterviewQuestions(activeSession.id, 3);
      const refreshed = await apiClient.getInterviewSessionById(activeSession.id);
      setActiveSession(refreshed);
    } catch (err: any) {
      setError(err.message || 'Failed to generate additional questions');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAnswer = async (answerText: string) => {
    if (!activeSession || !currentQuestion) return;
    try {
      setIsSubmitting(true);
      // 1. Submit answer
      await apiClient.submitInterviewAnswer(currentQuestion.id, answerText);
      // 2. Trigger truthful evaluation
      await apiClient.evaluateInterviewAnswer(currentQuestion.id);
      // 3. Refresh session
      const refreshed = await apiClient.getInterviewSessionById(activeSession.id);
      setActiveSession(refreshed);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentQuestion = activeSession?.questions?.[selectedQuestionIndex];
  const latestAnswer = currentQuestion?.answers?.[0];
  const evaluation = latestAnswer?.evaluation;

  return (
    <div className="interview-page-container" style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles style={{ color: '#818cf8' }} size={24} />
            Interview Preparation Intelligence
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
            Practice questions strictly grounded in your verified experience, target job requirements, and skill gaps.
          </p>
        </div>

        {activeSession && (
          <Button
            variant="outline"
            icon={<ArrowLeft size={16} />}
            onClick={() => setActiveSession(null)}
          >
            All Sessions ({sessions.length})
          </Button>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', padding: '12px 16px', color: '#fb7185', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main View: Active Session Practice or Session List */}
      {activeSession ? (
        <div className="active-session-grid" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
          {/* Left Column: Questions List & Session Summary */}
          <div>
            <Card style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase' }}>
                  Target Opening
                </span>
                <Badge variant="blue" size="sm">
                  {activeSession.questions?.length || 0} Questions
                </Badge>
              </div>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                {activeSession.job?.title || 'Job Opening'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                {activeSession.job?.company?.name || 'Company'}
              </p>

              <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<RefreshCw size={14} />}
                  loading={isGenerating}
                  onClick={handleGenerateMoreQuestions}
                  style={{ width: '100%' }}
                >
                  Generate More Questions
                </Button>
              </div>
            </Card>

            {/* Questions List */}
            <div className="questions-scroll" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {activeSession.questions?.map((q: any, idx: number) => (
                <InterviewQuestionCard
                  key={q.id}
                  question={q}
                  isActive={idx === selectedQuestionIndex}
                  onSelect={() => setSelectedQuestionIndex(idx)}
                />
              ))}
            </div>
          </div>

          {/* Right Column: Question Detail, Answer Editor & AI Evaluation */}
          <div>
            {currentQuestion ? (
              <div>
                <Card style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Badge variant="indigo" size="sm">
                        Question {currentQuestion.displayOrder} of {activeSession.questions.length}
                      </Badge>
                      <Badge variant={currentQuestion.difficulty === 'HARD' ? 'rose' : 'amber'} size="sm">
                        {currentQuestion.difficulty}
                      </Badge>
                      <Badge variant="blue" size="sm">
                        {currentQuestion.type.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedQuestionIndex === 0}
                        onClick={() => setSelectedQuestionIndex(prev => prev - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selectedQuestionIndex === activeSession.questions.length - 1}
                        onClick={() => setSelectedQuestionIndex(prev => prev + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                    {currentQuestion.question}
                  </h2>

                  {currentQuestion.context && (
                    <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HelpCircle size={16} style={{ color: '#818cf8', flexShrink: 0 }} />
                      <span>{currentQuestion.context}</span>
                    </div>
                  )}
                </Card>

                {/* Answer Editor */}
                <AnswerEditor
                  questionId={currentQuestion.id}
                  questionText={currentQuestion.question}
                  existingAnswer={latestAnswer?.answerText || ''}
                  isSubmitting={isSubmitting}
                  onSubmit={handleSubmitAnswer}
                />

                {/* Answer Evaluation if available */}
                {evaluation && (
                  <AnswerEvaluation
                    evaluation={evaluation}
                    suggestedAnswerGuide={currentQuestion.suggestedAnswerGuide}
                  />
                )}
              </div>
            ) : (
              <Card style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <p>No questions generated yet for this session.</p>
                <Button variant="primary" onClick={handleGenerateMoreQuestions}>
                  Generate Grounded Questions
                </Button>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Session List View */
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Your Practice Sessions ({sessions.length})
            </h3>
            <Button
              variant="outline"
              icon={<Briefcase size={16} />}
              onClick={() => onNavigate('jobs')}
            >
              Prepare for a Job
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <RefreshCw className="spin" size={28} />
              <p style={{ marginTop: '12px' }}>Loading interview prep sessions...</p>
            </div>
          ) : sessions.length === 0 ? (
            <Card style={{ padding: '60px 20px', textAlign: 'center', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <Sparkles size={40} style={{ color: '#818cf8', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                No Interview Sessions Yet
              </h3>
              <p style={{ maxWidth: '480px', margin: '0 auto 20px auto', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5 }}>
                Analyze any target job and click "Prepare for Interview" to generate realistic technical, behavioral, and skill-gap questions grounded in your verified experience.
              </p>
              <Button variant="primary" onClick={() => onNavigate('jobs')}>
                Explore Verified Jobs
              </Button>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {sessions.map(s => (
                <InterviewSessionCard
                  key={s.id}
                  session={s}
                  onSelect={handleSelectSession}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
