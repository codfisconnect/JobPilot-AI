import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { apiClient } from '../api/client';
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
  ArrowRight
} from 'lucide-react';
import './LearningPage.css';

interface CareerPageProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export const CareerPage: React.FC<CareerPageProps> = ({ onNavigate }) => {
  const [profileData, setProfileData] = useState<any | null>(null);
  const [skillsData, setSkillsData] = useState<any | null>(null);
  const [learningPlans, setLearningPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState<boolean>(false);

  const loadCareerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [profile, skills, plans] = await Promise.all([
        apiClient.getCareerProfile(),
        apiClient.getCareerSkills(),
        apiClient.getCareerLearningPlan()
      ]);

      setProfileData(profile);
      setSkillsData(skills);
      setLearningPlans(Array.isArray(plans) ? plans : (plans ? [plans] : []));
    } catch (err: any) {
      setError(err.message || 'Failed to load career readiness data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCareerData();
  }, []);

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
    <div className="career-page-container" style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass style={{ color: '#818cf8' }} size={24} />
            Career Intelligence & Learning Readiness
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>
            Evidence-based track transition assessments, verified skill classifications, and curated official learning pathways.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            icon={<RefreshCw size={14} />}
            onClick={loadCareerData}
            loading={loading}
          >
            Refresh Data
          </Button>
          {onNavigate && (
            <Button
              variant="primary"
              icon={<ArrowRight size={14} />}
              onClick={() => onNavigate('interview')}
            >
              Interview Prep
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '8px', padding: '12px 16px', color: '#fb7185', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
          <RefreshCw className="spin" size={32} />
          <p style={{ marginTop: '16px' }}>Evaluating career track and verified skills...</p>
        </div>
      ) : (
        <>
          {/* Career Track Overview */}
          {profileData && <CareerOverview profileData={profileData} />}

          {/* Skill Readiness Matrix */}
          {skillsData && <SkillReadiness skillsData={skillsData} />}

          {/* Structured Learning Plan */}
          <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GraduationCap size={20} style={{ color: '#818cf8' }} />
                  Actionable Learning Roadmap
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
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
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '18px 24px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {activePlan.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                        Target Role: {activePlan.targetRole || 'Software Engineering Advancement'} • {activePlan.items?.length || 0} Milestones
                      </p>
                    </div>

                    <Badge variant="blue" size="sm">Active Plan</Badge>
                  </div>
                </Card>

                {/* Items */}
                <div>
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
              <Card style={{ padding: '40px', textAlign: 'center', background: 'rgba(30, 41, 59, 0.5)' }}>
                <BookOpen size={36} style={{ color: '#818cf8', marginBottom: '12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  No Learning Plan Created
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 16px auto' }}>
                  Generate an actionable plan prioritized by your verified skill gaps with verified official documentation resources.
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
