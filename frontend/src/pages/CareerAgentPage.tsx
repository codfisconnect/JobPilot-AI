import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type { AgentSession, AgentMessage, AgentAction } from '../types/agent';
import {
  Sparkles,
  Send,
  PlusCircle,
  CheckCircle,
  XCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import './CareerAgentPage.css';

interface CareerAgentPageProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export const CareerAgentPage: React.FC<CareerAgentPageProps> = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<AgentSession | null>(null);
  const [inputMsg, setInputMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAgentSessions();
      if (res.success && res.data) {
        setSessions(res.data);
        if (res.data.length > 0 && !activeSession) {
          const firstSession = await apiClient.getAgentSession(res.data[0].id);
          if (firstSession.success) {
            setActiveSession(firstSession.data);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load agent sessions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleCreateSession = async () => {
    try {
      const res = await apiClient.createAgentSession('Career Strategic Roadmap');
      if (res.success && res.data) {
        setActiveSession(res.data);
        loadSessions();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start session');
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const res = await apiClient.getAgentSession(sessionId);
      if (res.success) {
        setActiveSession(res.data);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeSession || sending) return;

    try {
      setSending(true);
      const text = inputMsg;
      setInputMsg('');
      const res = await apiClient.sendAgentMessage(activeSession.id, text);
      if (res.success) {
        // Refresh session
        const refreshed = await apiClient.getAgentSession(activeSession.id);
        if (refreshed.success) {
          setActiveSession(refreshed.data);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    if (!activeSession) return;
    try {
      await apiClient.approveAgentAction(actionId);
      const refreshed = await apiClient.getAgentSession(activeSession.id);
      if (refreshed.success) {
        setActiveSession(refreshed.data);
      }
    } catch (err: any) {
      alert(err.message || 'Action approval failed');
    }
  };

  const handleRejectAction = async (actionId: string) => {
    if (!activeSession) return;
    try {
      await apiClient.rejectAgentAction(actionId, 'User dismissed suggestion');
      const refreshed = await apiClient.getAgentSession(activeSession.id);
      if (refreshed.success) {
        setActiveSession(refreshed.data);
      }
    } catch (err: any) {
      alert(err.message || 'Action rejection failed');
    }
  };

  return (
    <div className="agent-page">
      <div className="agent-header">
        <div>
          <h1 className="agent-title">
            <Sparkles size={28} color="var(--accent-primary)" />
            AI Career Agent & Copilot
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Truthful, controlled career orchestration with transparent approvals & credit billing.
          </p>
        </div>
        <button
          onClick={handleCreateSession}
          className="action-btn action-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <PlusCircle size={16} />
          New Strategy Session
        </button>
      </div>

      <div className="agent-container">
        {/* Sessions Sidebar */}
        <div className="agent-sidebar">
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            STRATEGY SESSIONS
          </div>
          <div className="agent-sessions-list">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`agent-session-item ${activeSession?.id === s.id ? 'active' : ''}`}
                onClick={() => handleSelectSession(s.id)}
              >
                {s.title}
              </div>
            ))}
          </div>
        </div>

        {/* Chat / Interaction Area */}
        <div className="agent-chat-area">
          {activeSession ? (
            <>
              <div className="agent-messages-box">
                {activeSession.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`message-bubble message-${m.role.toLowerCase()}`}
                  >
                    <div>{m.content}</div>

                    {/* Pending Action Card if Attached */}
                    {activeSession.actions
                      .filter((a) => a.status === 'WAITING_FOR_APPROVAL')
                      .map((action) => (
                        <div key={action.id} className="action-card">
                          <div className="action-card-header">
                            <span style={{ fontWeight: 600 }}>Proposed Action</span>
                            <span className="action-badge">Requires User Approval</span>
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {action.description}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            Credit Cost: <strong>{action.creditCost} credits</strong> (Atomic deduction on approval)
                          </div>
                          <div className="action-card-btns">
                            <button
                              onClick={() => handleApproveAction(action.id)}
                              className="action-btn action-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <CheckCircle size={14} />
                              Approve & Execute
                            </button>
                            <button
                              onClick={() => handleRejectAction(action.id)}
                              className="action-btn action-outline"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <XCircle size={14} />
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>

              {/* Message Input Bar */}
              <form onSubmit={handleSendMessage} className="agent-input-bar">
                <input
                  className="agent-input"
                  type="text"
                  placeholder="Ask for resume tailoring advice, interview prep, or career next steps..."
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="action-btn action-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Send size={16} />
                  {sending ? 'Analyzing...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
              Click "New Strategy Session" above to start interacting with your Career Agent.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
