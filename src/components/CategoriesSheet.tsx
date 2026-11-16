import React, { useState } from 'react';
import { Chip } from './Chip';
import { TrashIcon } from './EntryEditSheet';
import {
  updateUserCategories,
  renameCategory,
  deleteCategory,
} from '../lib/settings';
import './CategoriesSheet.css';

export interface CategoriesSheetProps {
  isOpen: boolean;
  userId: string;
  categories: string[];
  onClose: () => void;
  onCategoriesUpdated: (newCategories: string[]) => void;
  onToast: (msg: string) => void;
}

export const CategoriesSheet: React.FC<CategoriesSheetProps> = ({
  isOpen,
  userId,
  categories,
  onClose,
  onCategoriesUpdated,
  onToast,
}) => {
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  // 1. Add new category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatInput.trim().toLowerCase();
    if (!clean) return;

    if (categories.some((c) => c.toLowerCase() === clean)) {
      setAlertMessage(`Category "${clean}" already exists.`);
      return;
    }

    setBusy(true);
    setAlertMessage(null);
    try {
      const updated = [...categories, clean];
      await updateUserCategories(userId, updated);
      onCategoriesUpdated(updated);
      setNewCatInput('');
      onToast(`Added category "${clean}"`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setBusy(false);
    }
  };

  // 2. Start inline renaming
  const handleStartRename = (cat: string) => {
    setEditingCat(cat);
    setRenameInput(cat);
    setAlertMessage(null);
  };

  // Save inline renaming
  const handleSaveRename = async (oldName: string) => {
    const cleanNew = renameInput.trim().toLowerCase();
    if (!cleanNew) {
      setAlertMessage('Category name cannot be empty.');
      return;
    }

    if (cleanNew === oldName.toLowerCase()) {
      setEditingCat(null);
      return;
    }

    if (categories.some((c) => c.toLowerCase() === cleanNew && c.toLowerCase() !== oldName.toLowerCase())) {
      setAlertMessage(`Category "${cleanNew}" already exists.`);
      return;
    }

    setBusy(true);
    setAlertMessage(null);
    try {
      const { updatedCount, newCategories } = await renameCategory(
        userId,
        oldName,
        cleanNew,
        categories
      );
      onCategoriesUpdated(newCategories);
      setEditingCat(null);
      onToast(`Renamed to "${cleanNew}" (${updatedCount} segment(s) updated)`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to rename category');
    } finally {
      setBusy(false);
    }
  };

  // 3. Remove category (blocked if segments use it)
  const handleRemoveCategory = async (cat: string) => {
    setBusy(true);
    setAlertMessage(null);
    try {
      const res = await deleteCategory(userId, cat, categories);
      if (!res.success) {
        setAlertMessage(
          `Cannot remove "${cat}" because ${res.usageCount} segment(s) are currently using it. Reassign or edit those segments first.`
        );
        return;
      }

      if (res.newCategories) {
        onCategoriesUpdated(res.newCategories);
        onToast(`Removed category "${cat}"`);
      }
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to remove category');
    } finally {
      setBusy(false);
    }
  };

  // 4. Reorder categories (move up / down)
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= categories.length) return;

    const copy = [...categories];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);

    onCategoriesUpdated(copy);
    try {
      await updateUserCategories(userId, copy);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to save order');
    }
  };

  return (
    <div
      className="categories-sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Manage Categories"
    >
      <div className="categories-sheet-surface" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="categories-sheet-header">
          <div className="categories-sheet-handle" />
          <button
            type="button"
            className="categories-sheet-close"
            onClick={onClose}
            aria-label="Close categories sheet"
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
          <h2 className="categories-sheet-title">Categories</h2>
          <p className="categories-sheet-subtitle">Add, rename, reorder, and remove categories</p>
        </div>

        {/* Body */}
        <div className="categories-sheet-body">
          {/* Alert Message */}
          {alertMessage && (
            <div className="categories-sheet-alert" role="alert">
              <span>{alertMessage}</span>
              <button
                type="button"
                className="categories-sheet-alert-close"
                onClick={() => setAlertMessage(null)}
                aria-label="Dismiss alert"
              >
                ×
              </button>
            </div>
          )}

          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="categories-add-form">
            <label htmlFor="new-category-input" className="visually-hidden">
              New category name
            </label>
            <input
              id="new-category-input"
              name="new-category-name"
              type="text"
              className="categories-add-input"
              placeholder="Add a new category..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="categories-add-btn"
              disabled={busy || !newCatInput.trim()}
            >
              + Add
            </button>
          </form>

          {/* Categories List */}
          <div className="categories-list" role="list" aria-label="Categories list">
            {categories.map((cat, idx) => {
              const isEditing = editingCat === cat;

              return (
                <div key={cat} className="category-row" role="listitem">
                  {/* Left: Reorder controls + Chip or Inline Rename Input */}
                  <div className="category-row-left">
                    <div className="category-order-controls">
                      <button
                        type="button"
                        className="category-order-btn"
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0 || busy}
                        aria-label={`Move ${cat} up`}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="category-order-btn"
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === categories.length - 1 || busy}
                        aria-label={`Move ${cat} down`}
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="category-inline-rename-form">
                        <label htmlFor={`rename-input-${idx}`} className="visually-hidden">
                          Rename {cat}
                        </label>
                        <input
                          id={`rename-input-${idx}`}
                          name={`rename-category-${idx}`}
                          type="text"
                          className="category-inline-rename-input"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveRename(cat);
                            } else if (e.key === 'Escape') {
                              setEditingCat(null);
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="category-inline-save-btn"
                          onClick={() => handleSaveRename(cat)}
                          disabled={busy}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="category-inline-cancel-btn"
                          onClick={() => setEditingCat(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <Chip label={cat} size="md" />
                    )}
                  </div>

                  {/* Right Actions: Rename & Remove */}
                  {!isEditing && (
                    <div className="category-row-actions">
                      <button
                        type="button"
                        className="category-rename-btn"
                        onClick={() => handleStartRename(cat)}
                        disabled={busy}
                        aria-label={`Rename category ${cat}`}
                        title="Rename"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="category-remove-btn"
                        onClick={() => handleRemoveCategory(cat)}
                        disabled={busy}
                        aria-label={`Remove category ${cat}`}
                        title="Remove category"
                      >
                        <TrashIcon size={14} color="var(--danger)" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
