import React, { useState, useEffect, useCallback } from 'react';
import { TrashIcon } from './EntryEditSheet';
import { ModalPortal } from './ModalPortal';
import {
  getPeopleStats,
  renamePerson,
  deletePerson,
  PersonStat,
} from '../lib/settings';
import { formatDurationMs } from '../lib/time';
import './PeopleSheet.css';

export interface PeopleSheetProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const PeopleSheet: React.FC<PeopleSheetProps> = ({
  isOpen,
  userId,
  onClose,
  onToast,
}) => {
  const [people, setPeople] = useState<PersonStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [personToDelete, setPersonToDelete] = useState<PersonStat | null>(null);
  const [busy, setBusy] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const loadPeople = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const stats = await getPeopleStats(userId);
      setPeople(stats);
    } catch (err: unknown) {
      console.warn('Failed to load people stats:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      loadPeople();
      setEditingPerson(null);
      setPersonToDelete(null);
      setAlertMessage(null);
    }
  }, [isOpen, loadPeople]);

  if (!isOpen) return null;

  // Start inline rename
  const handleStartRename = (person: PersonStat) => {
    setEditingPerson(person.name);
    setRenameInput(person.name);
    setPersonToDelete(null);
    setAlertMessage(null);
  };

  // Save rename (merges automatically if new name exists)
  const handleSaveRename = async (oldName: string) => {
    const cleanNew = renameInput.trim();
    if (!cleanNew) {
      setAlertMessage('Name cannot be empty.');
      return;
    }

    if (cleanNew === oldName) {
      setEditingPerson(null);
      return;
    }

    setBusy(true);
    setAlertMessage(null);
    try {
      const { updatedCount } = await renamePerson(userId, oldName, cleanNew);
      await loadPeople();
      setEditingPerson(null);
      onToast(`Renamed "${oldName}" to "${cleanNew}" (${updatedCount} segment(s) updated)`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to rename person');
    } finally {
      setBusy(false);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!personToDelete) return;
    setBusy(true);
    setAlertMessage(null);
    try {
      const targetName = personToDelete.name;
      const { updatedCount } = await deletePerson(userId, targetName);
      await loadPeople();
      setPersonToDelete(null);
      onToast(`Removed "${targetName}" from ${updatedCount} segment(s)`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to delete person');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="people-sheet-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Manage People"
      >
      <div className="people-sheet-surface" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="people-sheet-header">
          <div className="people-sheet-handle" />
          <button
            type="button"
            className="people-sheet-close"
            onClick={onClose}
            aria-label="Close people sheet"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <h2 className="people-sheet-title">People</h2>
          <p className="people-sheet-subtitle">
            People you log time with. Renaming merges duplicate spellings.
          </p>
        </div>

        {/* Body */}
        <div className="people-sheet-body">
          {alertMessage && (
            <div className="people-sheet-alert" role="alert">
              <span>{alertMessage}</span>
              <button
                type="button"
                className="people-sheet-alert-close"
                onClick={() => setAlertMessage(null)}
                aria-label="Dismiss alert"
              >
                ×
              </button>
            </div>
          )}

          {/* Delete confirmation banner */}
          {personToDelete && (
            <div className="people-delete-confirm-box" role="alertdialog">
              <p className="people-delete-confirm-text">
                Remove <strong>{personToDelete.name}</strong> from all {personToDelete.count} segment(s)?
              </p>
              <div className="people-delete-confirm-actions">
                <button
                  type="button"
                  className="people-delete-confirm-btn"
                  onClick={handleConfirmDelete}
                  disabled={busy}
                >
                  {busy ? 'Removing...' : 'Yes, remove'}
                </button>
                <button
                  type="button"
                  className="people-delete-cancel-btn"
                  onClick={() => setPersonToDelete(null)}
                  disabled={busy}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="people-empty-state">Loading people...</div>
          ) : people.length === 0 ? (
            <div className="people-empty-state">
              <p style={{ margin: '0 0 4px', fontStyle: 'italic' }}>No people logged yet.</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--mauve)' }}>
                When you log entries like &ldquo;lunch with mom&rdquo;, people will appear here.
              </p>
            </div>
          ) : (
            <div className="people-list" role="list">
              {people.map((person) => {
                const isEditing = editingPerson === person.name;
                const durationText = formatDurationMs(person.totalMinutes * 60000);

                return (
                  <div key={person.name} className="person-row-card" role="listitem">
                    {isEditing ? (
                      <div className="person-inline-rename-form">
                        <label htmlFor={`rename-person-${person.name}`} className="visually-hidden">
                          Rename {person.name}
                        </label>
                        <input
                          id={`rename-person-${person.name}`}
                          type="text"
                          className="person-inline-rename-input"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          autoFocus
                          disabled={busy}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveRename(person.name);
                            } else if (e.key === 'Escape') {
                              setEditingPerson(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="person-inline-save-btn"
                          onClick={() => handleSaveRename(person.name)}
                          disabled={busy}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="person-inline-cancel-btn"
                          onClick={() => setEditingPerson(null)}
                          disabled={busy}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="person-info-left">
                          <span className="person-name">{person.name}</span>
                          <span className="person-meta">
                            {person.count} segment{person.count === 1 ? '' : 's'} • {durationText}
                          </span>
                        </div>

                        <div className="person-actions-right">
                          <button
                            type="button"
                            className="person-rename-btn"
                            onClick={() => handleStartRename(person)}
                            disabled={busy}
                            aria-label={`Rename ${person.name}`}
                            title="Rename person"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="person-delete-btn"
                            onClick={() => setPersonToDelete(person)}
                            disabled={busy}
                            aria-label={`Remove ${person.name}`}
                            title="Remove person tag"
                          >
                            <TrashIcon size={14} color="var(--danger)" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
