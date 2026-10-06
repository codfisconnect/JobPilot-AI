import React, { useState } from 'react';
import { ApplicationReminderItem } from '../../types/applications';
import { Bell, Calendar, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import './ApplicationReminder.css';

interface ApplicationReminderProps {
  reminders: ApplicationReminderItem[];
  onAddReminder: (title: string, dueDate: string) => Promise<void>;
  onDeleteReminder: (reminderId: string) => Promise<void>;
}

export const ApplicationReminderWidget: React.FC<ApplicationReminderProps> = ({
  reminders,
  onAddReminder,
  onDeleteReminder
}) => {
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateStr || submitting) return;

    try {
      setSubmitting(true);
      const isoDate = new Date(dateStr).toISOString();
      await onAddReminder(title.trim(), isoDate);
      setTitle('');
      setDateStr('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await onDeleteReminder(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="app-reminders-widget">
      <form className="reminder-input-form" onSubmit={handleSubmit}>
        <div className="reminder-inputs-row">
          <input
            type="text"
            className="reminder-title-input"
            placeholder="e.g. Follow up on status, Prepare interview presentation..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <input
            type="datetime-local"
            className="reminder-date-input"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
          />
          <button
            type="submit"
            className="add-reminder-btn"
            disabled={!title.trim() || !dateStr || submitting}
          >
            <Plus size={16} />
            <span>{submitting ? 'Adding...' : 'Add'}</span>
          </button>
        </div>
      </form>

      <div className="reminders-list">
        {reminders.length === 0 ? (
          <div className="reminders-empty">
            <Bell size={20} />
            <p>No reminders scheduled for this application.</p>
          </div>
        ) : (
          reminders.map(rem => {
            const dueDate = new Date(rem.dueDate);
            const isOverdue = !rem.isCompleted && dueDate.getTime() < Date.now();
            const formattedDate = dueDate.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            });

            return (
              <div
                key={rem.id}
                className={`reminder-item ${isOverdue ? 'is-overdue' : ''} ${rem.isCompleted ? 'is-completed' : ''}`}
              >
                <div className="reminder-item-left">
                  <div className="reminder-icon">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h5 className="reminder-title">{rem.title}</h5>
                    <span className="reminder-due-date">
                      {isOverdue ? '⚠️ Overdue: ' : 'Due: '} {formattedDate}
                    </span>
                  </div>
                </div>

                <button
                  className="delete-reminder-btn"
                  onClick={() => handleDelete(rem.id)}
                  disabled={deletingId === rem.id}
                  title="Delete reminder"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
