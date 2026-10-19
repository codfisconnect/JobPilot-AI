import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CareerOverview } from '../components/career/CareerOverview';
import { SkillReadiness } from '../components/career/SkillReadiness';
import { LearningPlanItemCard } from '../components/career/LearningPlanItemCard';
import {
  Compass,
  BookOpen,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Lock,
  UserCheck
} from 'lucide-react';
import './LearningPage.css';

interface CareerPageProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export const CareerPage: React.FC<CareerPageProps> = ({ onNavigate }) => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [profileData, setProfileData] = useState<any | null>(null);
  const [skillsData, setSkillsData] = useState<any | null>(null);
  const [learningPlans, setLearningPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isProfileMissing, setIsProfileMissing] = useState<boolean>(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);

  const loadCareerData = useCallback(async () => {
    // If auth state is still bootstrapping, wait
    if (isAuthLoading) {
      return;
    }

    // If user is definitely not authenticated, do not fire 401 calls
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setIsProfileMissing(false);
      const [profile, skills, plans] = await Promise.all([
        apiClient.getCareerProfile(),
        apiClient.getCareerSkills(),
        apiClient.getCareerLearningPlan()
      ]);

      setProfileData(profile);
      setSkillsData(skills);
      setLearningPlans(Array.isArray(plans) ? plans : (plans ? [plans] : []));
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('profile not found') || msg.includes('Candidate profile not found') || err?.status === 404) {
        setIsProfileMissing(true);
      } else if (msg.includes('Authorization') || msg.includes('token') || msg.includes('401')) {
        setError('Your session has expired or requires authentication. Please sign in to access Career Intelligence.');
      } else {
        setError(msg || 'Failed to load career readiness data');
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    loadCareerData();
  }, [loadCareerData]);

  const handleUpdateItemStatus = async (itemId: string, newStatus: string) => {
    try {
      await apiClient.updateLearningPlanItem(itemId, { status: newStatus });
      // Reload plans
      const plans = await apiClient.getCareerLearningPlan();
      setLearningPlans(Array.isArray(plans) ? plans : (plans ? [plans] : []));
    } catch (err: any) {
      console.error('Failed to update learning plan item status:', err);
    }
  };

  const handleCreateDefaultPlan = async () => {
    try {
      setIsCreatingPlan(true);
      await apiClient.createCareerLearningPlan({
        title: 'Career Advancement & Skill Gap Readiness Plan'
      });
      const plans = await apiClient.getCareerLearningPlan();
      setLearningPlans(Array.isArray(plans) ? plans : (plans ? [plans] : []));
    } catch (err: any) {
      setError(err.message || 'Failed to create learning plan');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const activePlan = learningPlans.length > 0 ? learningPlans[0] : null;

  return (
    <div className="career-page-container">
      {/* Page Header */}
      <div className="career-page-header">
        <div>
          <h1 className="career-page-title">
            <Compass style={{ color: '#818cf8' }} size={24} />
            <span>Career Intelligence</span>
          </h1>
          <p className="career-page-subtitle">
            <span className="desktop-only-text">Evidence-based track transition assessments, verified skill classifications, and curated official learning pathways.</span>
            <span className="mobile-only-text">Track transition assessments & skill readiness.</span>
          </p>
        </div>

        <div className="career-header-actions">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={loadCareerData}
            loading={loading}
          >
            Refresh
          </Button>
          {onNavigate && (
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => onNavigate('interview')}
            >
              Interview Prep
            </Button>
          )}
        </div>
      </div>

      {/* Unauthenticated View */}
      {!isAuthenticated && !isAuthLoading && (
        <Card style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          maxWidth: '540px',
          margin: '32px auto'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.12)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <Lock size={26} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Candidate Sign In Required
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
            Career Intelligence evaluates your personalized experience records and computes live market gap alignment. Please sign in to access your analysis.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {onNavigate && (
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate('auth')}
              >
                Sign In to Pilot Mama
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Profile Missing View */}
      {isAuthenticated && isProfileMissing && (
        <Card style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          maxWidth: '560px',
          margin: '32px auto'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <UserCheck size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Complete Your Candidate Profile
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '24px' }}>
            We need at least one verified role headline and skill set in your profile to accurately compute your Career Track alignment and actionable learning gaps.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {onNavigate && (
              <Button
                variant="primary"
                size="md"
                onClick={() => onNavigate('profile')}
              >
                Set Up Profile Now
              </Button>
            )}
          </div>
        </Card>
      )}

      {error && !isProfileMissing && (
        <div style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', borderRadius: '8px', padding: '14px 18px', color: 'var(--color-danger)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: '0.9rem' }}>{error}</span>
        </div>
      )}

      {isAuthenticated && !isProfileMissing && (loading || isAuthLoading) ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin" size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', fontSize: '0.95rem' }}>Evaluating career track and verified skills...</p>
        </div>
      ) : isAuthenticated && !isProfileMissing && (
        <>
          {/* Career Track Overview */}
          {profileData && <CareerOverview profileData={profileData} />}

          {/* Skill Readiness Matrix */}
          {skillsData && <SkillReadiness skillsData={skillsData} />}

          {/* Structured Learning Plan */}
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GraduationCap size={22} style={{ color: 'var(--accent-primary)' }} />
                  Actionable Learning Roadmap
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Milestones prioritize identified skill gaps using only verified official documentation and reputable tutorials.
                </p>
              </div>

              {!activePlan && (
                <Button
                  variant="primary"
                  icon={<PlusCircle size={14} />}
                  onClick={handleCreateDefaultPlan}
                  loading={isCreatingPlan}
                >
                  Generate Plan
                </Button>
              )}
            </div>

            {activePlan ? (
              <div>
                <Card style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px 24px',
                  marginBottom: '16px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {activePlan.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Target Role: {activePlan.targetRole || 'Software Engineering Advancement'} • {activePlan.items?.length || 0} Milestones
                      </p>
                    </div>

                    <Badge variant="blue" size="sm">Active Plan</Badge>
                  </div>
                </Card>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activePlan.items?.map((item: any) => (
                    <LearningPlanItemCard
                      key={item.id}
                      item={item}
                      onUpdateStatus={handleUpdateItemStatus}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <Card style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)' }}>
                <BookOpen size={38} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  No Learning Plan Created
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                  Generate an actionable roadmap prioritized by your verified skill gaps with verified official documentation resources.
                </p>
                <Button
                  variant="primary"
                  onClick={handleCreateDefaultPlan}
                  loading={isCreatingPlan}
                >
                  Create Learning Plan
                </Button>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
};
