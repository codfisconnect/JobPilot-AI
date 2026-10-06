import React from 'react';
import { ApplicationStatusHistoryItem } from '../../types/applications';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { Clock, CheckCircle2 } from 'lucide-react';
import './ApplicationTimeline.css';

interface ApplicationTimelineProps {
  history: ApplicationStatusHistoryItem[];
}

export const ApplicationTimeline: React.FC<ApplicationTimelineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="timeline-empty">
        <Clock size={20} />
        <p>No status history recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="app-timeline">
      {history.map((item, index) => {
        const isLatest = index === 0;
        const formattedDate = new Date(item.changedAt).toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        return (
          <div key={item.id} className={`timeline-entry ${isLatest ? 'is-latest' : ''}`}>
            <div className="timeline-marker">
              <div className="timeline-dot">
                {isLatest && <CheckCircle2 size={12} />}
              </div>
              {index < history.length - 1 && <div className="timeline-line" />}
            </div>

            <div className="timeline-content">
              <div className="timeline-header">
                <ApplicationStatusBadge status={item.newStatus} size="sm" />
                <span className="timeline-time">{formattedDate}</span>
              </div>

              {item.previousStatus && (
                <p className="timeline-transition">
                  Changed from <span className="status-prev">{item.previousStatus}</span>
                </p>
              )}

              {item.reason && (
                <p className="timeline-reason">{item.reason}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
