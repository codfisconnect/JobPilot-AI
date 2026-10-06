import React, { useState } from 'react';
import { ApplicationNoteItem } from '../../types/applications';
import { Plus, Trash2, MessageSquare, Send } from 'lucide-react';
import './ApplicationNotes.css';

interface ApplicationNotesProps {
  notes: ApplicationNoteItem[];
  onAddNote: (content: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const ApplicationNotes: React.FC<ApplicationNotesProps> = ({
  notes,
  onAddNote,
  onDeleteNote
}) => {
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      await onAddNote(newContent.trim());
      setNewContent('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await onDeleteNote(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="app-notes-widget">
      <form className="note-input-form" onSubmit={handleSubmit}>
        <textarea
          className="note-textarea"
          placeholder="Add interview notes, recruiter feedback, salary ranges discussed..."
          value={newContent}
          onChange={e => setNewContent(e.target.value)}
          rows={3}
        />
        <div className="note-form-footer">
          <button
            type="submit"
            className="add-note-btn"
            disabled={!newContent.trim() || submitting}
          >
            <Send size={14} />
            <span>{submitting ? 'Saving...' : 'Add Note'}</span>
          </button>
        </div>
      </form>

      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="notes-empty">
            <MessageSquare size={20} />
            <p>No notes added for this application yet.</p>
          </div>
        ) : (
          notes.map(note => {
            const formattedDate = new Date(note.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short'
            });

            return (
              <div key={note.id} className="note-item">
                <div className="note-item-header">
                  <span className="note-date">{formattedDate}</span>
                  <button
                    className="delete-note-btn"
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                    title="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="note-content">{note.content}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
