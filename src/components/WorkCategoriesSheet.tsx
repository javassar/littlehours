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
  workCategories?: string[]; // Backwards-compatible alias for selectedCategories
  selectedCategories?: string[];
  onClose: () => void;
  onWorkCategoriesUpdated?: (newWorkCategories: string[]) => void;
  onSelectionChanged?: (newCategories: string[]) => void;
  onToast?: (msg: string) => void;
  mode?: 'view' | 'settings';
}

export const WorkCategoriesSheet: React.FC<WorkCategoriesSheetProps> = ({
  isOpen,
  userId,
  categories: rawCategories,
  workCategories: initialWorkCategories,
  selectedCategories: initialSelectedCategories,
  onClose,
  onWorkCategoriesUpdated,
  onSelectionChanged,
  onToast,
  mode = 'view',
}) => {
  const categories = normalizeCategories(rawCategories);
  const initialList = initialSelectedCategories || initialWorkCategories;
  const [selected, setSelected] = useState<string[]>(
    initialList && initialList.length > 0 ? initialList : ['work']
  );
  const [busy, setBusy] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const nextList = initialSelectedCategories || initialWorkCategories;
    if (nextList && nextList.length > 0) {
      setSelected(nextList);
    }
  }, [initialSelectedCategories, initialWorkCategories]);

  if (!isOpen) return null;

  const handleToggle = (catName: string) => {
    const clean = catName.trim().toLowerCase();
    setErrorMsg(null);
    setDefaultSaved(false);

    let next: string[];
    if (selected.includes(clean)) {
      if (selected.length === 1) {
        // At least one category must stay selected; disabled checkbox prevents this
        return;
      }
      next = selected.filter((c) => c !== clean);
    } else {
      next = [...selected, clean];
    }
    setSelected(next);
    if (mode === 'view') {
      onSelectionChanged?.(next);
    }
  };

  const handleMakeDefault = async () => {
    if (selected.length === 0) return;
    setSavingDefault(true);
    setErrorMsg(null);
    try {
      await updateWorkReportCategories(userId, selected);
      onWorkCategoriesUpdated?.(selected);
      setDefaultSaved(true);
      onToast?.('Saved as default');
      setTimeout(() => setDefaultSaved(false), 3000);
    } catch (err: any) {
      console.error('Failed to update default featured categories:', err);
      onToast?.(err.message || 'Failed to save default');
    } finally {
      setSavingDefault(false);
    }
  };

  const handleSaveSettings = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await updateWorkReportCategories(userId, selected);
      onWorkCategoriesUpdated?.(selected);
      onToast?.('Saved as default');
      onClose();
    } catch (err: any) {
      console.error('Failed to update work report categories:', err);
      setErrorMsg(err.message || 'Failed to update work categories');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'settings' ? 'Default featured categories' : 'Featured categories';
  const subtitle =
    mode === 'settings'
      ? 'The categories shown at the top of Week in Review. Choose work if you report your hours to a workplace.'
      : 'Select which categories to feature at the top of Week in Review.';

  return (
    <ModalPortal>
      <div
        className="work-cat-backdrop"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
            <h3 className="work-cat-title">{title}</h3>
            <p className="work-cat-subtitle">{subtitle}</p>
          </div>

          <div className="work-cat-body">
            {errorMsg && (
              <div className="work-cat-error" role="alert">
                {errorMsg}
              </div>
            )}

            <div className="work-cat-list" role="group" aria-label="Featured categories multi-select">
              {categories.map((cat) => {
                const isChecked = selected.includes(cat.name.toLowerCase());
                const isOnlySelected = isChecked && selected.length === 1;

                return (
                  <label
                    key={cat.name}
                    className={`work-cat-item ${isChecked ? 'work-cat-item-selected' : ''} ${
                      isOnlySelected ? 'work-cat-item-locked' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="work-cat-checkbox"
                      checked={isChecked}
                      disabled={isOnlySelected}
                      onChange={() => handleToggle(cat.name)}
                      aria-label={`Select ${cat.name}`}
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
              {mode === 'settings' ? (
                <Button
                  variant="primary"
                  onClick={handleSaveSettings}
                  disabled={busy || selected.length === 0}
                  className="w-full"
                >
                  {busy ? 'Saving...' : 'Save default'}
                </Button>
              ) : (
                <div className="work-cat-view-actions">
                  <div className="work-cat-default-wrap">
                    <button
                      type="button"
                      className="work-cat-make-default-btn"
                      onClick={handleMakeDefault}
                      disabled={savingDefault || selected.length === 0}
                    >
                      {savingDefault ? 'Saving...' : 'Make this my default'}
                    </button>
                    {defaultSaved && (
                      <span className="work-cat-saved-badge" role="status">
                        Saved as default
                      </span>
                    )}
                  </div>
                  <Button
                    variant="primary"
                    onClick={onClose}
                    className="work-cat-done-btn"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
