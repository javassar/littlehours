import React, { useState, useEffect } from 'react';
import { ModalPortal } from './ModalPortal';
import { Chip } from './Chip';
import { Button } from './Button';
import { CategoryItem, normalizeCategories, updateWorkReportCategories } from '../lib/settings';
import './WorkCategoriesSheet.css';

export interface WorkCategoriesSheetProps {
  isOpen: boolean;
  userId: string;
  categories: CategoryItem[] | string[];
  workCategories: string[];
  onClose: () => void;
  onWorkCategoriesUpdated: (newWorkCategories: string[]) => void;
  onToast?: (msg: string) => void;
}

export const WorkCategoriesSheet: React.FC<WorkCategoriesSheetProps> = ({
  isOpen,
  userId,
  categories: rawCategories,
  workCategories: initialWorkCategories,
  onClose,
  onWorkCategoriesUpdated,
  onToast,
}) => {
  const categories = normalizeCategories(rawCategories);
  const [selected, setSelected] = useState<string[]>(
    initialWorkCategories && initialWorkCategories.length > 0 ? initialWorkCategories : ['work']
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialWorkCategories && initialWorkCategories.length > 0) {
      setSelected(initialWorkCategories);
    }
  }, [initialWorkCategories]);

  if (!isOpen) return null;

  const handleToggle = (catName: string) => {
    const clean = catName.trim().toLowerCase();
    setErrorMsg(null);
    if (selected.includes(clean)) {
      if (selected.length === 1) {
        setErrorMsg('At least one work category must be selected.');
        return;
      }
      setSelected(selected.filter((c) => c !== clean));
    } else {
      setSelected([...selected, clean]);
    }
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      setErrorMsg('At least one work category must be selected.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await updateWorkReportCategories(userId, selected);
      onWorkCategoriesUpdated(selected);
      onToast?.('Work categories updated');
      onClose();
    } catch (err: any) {
      console.error('Failed to update work categories:', err);
      setErrorMsg(err.message || 'Failed to update work categories');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="work-cat-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Hours I report to my workplace"
      >
        <div className="work-cat-surface" onClick={(e) => e.stopPropagation()}>
          <div className="work-cat-header">
            <div className="work-cat-handle" aria-hidden="true" />
            <button
              type="button"
              className="work-cat-close"
              onClick={onClose}
              aria-label="Close sheet"
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
            <h3 className="work-cat-title">Hours I report to my workplace</h3>
            <p className="work-cat-subtitle">
              Select which categories count toward your reported work hours on the Week in Review screen.
            </p>
          </div>

          <div className="work-cat-body">
            {errorMsg && (
              <div className="work-cat-error" role="alert">
                {errorMsg}
              </div>
            )}

            <div className="work-cat-list" role="group" aria-label="Work categories multi-select">
              {categories.map((cat) => {
                const isChecked = selected.includes(cat.name.toLowerCase());
                return (
                  <label
                    key={cat.name}
                    className={`work-cat-item ${isChecked ? 'work-cat-item-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="work-cat-checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(cat.name)}
                    />
                    <div className="work-cat-item-content">
                      <Chip label={cat.name} size="sm" />
                      {cat.description && (
                        <span className="work-cat-item-desc">{cat.description}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="work-cat-actions">
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={busy}
                className="w-full"
              >
                {busy ? 'Saving...' : 'Done'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
