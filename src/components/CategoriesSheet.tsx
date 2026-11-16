import React, { useState } from 'react';
import { Chip } from './Chip';
import { TrashIcon } from './EntryEditSheet';
import { ModalPortal } from './ModalPortal';
import {
  CategoryItem,
  normalizeCategories,
  updateUserCategories,
  renameCategory,
  deleteCategory,
  updateCategoryDescription,
} from '../lib/settings';
import './CategoriesSheet.css';

export interface CategoriesSheetProps {
  isOpen: boolean;
  userId: string;
  categories: CategoryItem[] | string[];
  onClose: () => void;
  onCategoriesUpdated: (newCategories: CategoryItem[]) => void;
  onToast: (msg: string) => void;
}

export const CategoriesSheet: React.FC<CategoriesSheetProps> = ({
  isOpen,
  userId,
  categories: rawCategories,
  onClose,
  onCategoriesUpdated,
  onToast,
}) => {
  const categories = normalizeCategories(rawCategories);

  // New category form inputs
  const [newCatInput, setNewCatInput] = useState('');
  const [newCatDescInput, setNewCatDescInput] = useState('');

  // Inline rename name state
  const [editingNameCat, setEditingNameCat] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Inline edit description state
  const [editingDescCat, setEditingDescCat] = useState<string | null>(null);
  const [descInput, setDescInput] = useState('');

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  // 1. Add new category (requires both name and description)
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatInput.trim().toLowerCase();
    const cleanDesc = newCatDescInput.trim();

    if (!cleanName) {
      setAlertMessage('Category name cannot be empty.');
      return;
    }
    if (!cleanDesc) {
      setAlertMessage('A written description is required so the AI knows how to categorize it.');
      return;
    }

    if (categories.some((c) => c.name.toLowerCase() === cleanName)) {
      setAlertMessage(`Category "${cleanName}" already exists.`);
      return;
    }

    setBusy(true);
    setAlertMessage(null);
    try {
      const updated: CategoryItem[] = [
        ...categories,
        { name: cleanName, description: cleanDesc },
      ];
      await updateUserCategories(userId, updated);
      onCategoriesUpdated(updated);
      setNewCatInput('');
      setNewCatDescInput('');
      onToast(`Added category "${cleanName}"`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setBusy(false);
    }
  };

  // 2. Start inline renaming
  const handleStartRename = (catName: string) => {
    setEditingNameCat(catName);
    setRenameInput(catName);
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
      setEditingNameCat(null);
      return;
    }

    if (
      categories.some(
        (c) => c.name.toLowerCase() === cleanNew && c.name.toLowerCase() !== oldName.toLowerCase()
      )
    ) {
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
      setEditingNameCat(null);
      onToast(`Renamed to "${cleanNew}" (${updatedCount} segment(s) updated)`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to rename category');
    } finally {
      setBusy(false);
    }
  };

  // 3. Start editing description
  const handleStartEditDesc = (cat: CategoryItem) => {
    setEditingDescCat(cat.name);
    setDescInput(cat.description || '');
    setAlertMessage(null);
  };

  // Save description in place
  const handleSaveDescription = async (catName: string) => {
    setBusy(true);
    setAlertMessage(null);
    try {
      const updated = await updateCategoryDescription(
        userId,
        catName,
        descInput,
        categories
      );
      onCategoriesUpdated(updated);
      setEditingDescCat(null);
      onToast(`Description updated for "${catName}"`);
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to update description');
    } finally {
      setBusy(false);
    }
  };

  // 4. Remove category (blocked if segments use it)
  const handleRemoveCategory = async (catName: string) => {
    setBusy(true);
    setAlertMessage(null);
    try {
      const res = await deleteCategory(userId, catName, categories);
      if (!res.success) {
        setAlertMessage(
          `Cannot remove "${catName}" because ${res.usageCount} segment(s) are currently using it. Reassign or edit those segments first.`
        );
        return;
      }

      if (res.newCategories) {
        onCategoriesUpdated(res.newCategories);
        onToast(`Removed category "${catName}"`);
      }
    } catch (err: unknown) {
      setAlertMessage(err instanceof Error ? err.message : 'Failed to remove category');
    } finally {
      setBusy(false);
    }
  };

  // 5. Reorder categories (move up / down)
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
    <ModalPortal>
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
          <p className="categories-sheet-subtitle">Add, rename, reorder, and edit category descriptions</p>
        </div>

        {/* Body */}
        <div className="categories-sheet-body">
          {/* Note: Re-read all entries to apply changes to old entries */}
          <div className="categories-note-banner" role="note">
            <span className="categories-note-bullet">✦</span>
            <span>Re-read all entries to apply changes to old entries.</span>
          </div>

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

          {/* Add Category Form (requires name and description) */}
          <form onSubmit={handleAddCategory} className="categories-add-form-expanded">
            <h4 className="categories-add-heading">Add a new category</h4>
            <input
              id="new-category-name"
              name="new-category-name"
              type="text"
              className="categories-add-input"
              placeholder="Category name (e.g. pottery)..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              disabled={busy}
            />
            <textarea
              id="new-category-description"
              name="new-category-description"
              className="categories-add-desc-input"
              placeholder="Description (required for AI parsing: describe what belongs in this category)..."
              rows={2}
              value={newCatDescInput}
              onChange={(e) => setNewCatDescInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="categories-add-btn"
              disabled={busy || !newCatInput.trim() || !newCatDescInput.trim()}
            >
              + Add category
            </button>
          </form>

          {/* Categories List */}
          <div className="categories-list" role="list" aria-label="Categories list">
            {categories.map((cat, idx) => {
              const isEditingName = editingNameCat === cat.name;
              const isEditingDesc = editingDescCat === cat.name;

              return (
                <div key={cat.name} className="category-row-card" role="listitem">
                  {/* Top row: Reorder controls + Name chip/rename + Action buttons */}
                  <div className="category-row-top">
                    <div className="category-row-left">
                      <div className="category-order-controls">
                        <button
                          type="button"
                          className="category-order-btn"
                          onClick={() => handleMove(idx, 'up')}
                          disabled={idx === 0 || busy}
                          aria-label={`Move ${cat.name} up`}
                          title="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="category-order-btn"
                          onClick={() => handleMove(idx, 'down')}
                          disabled={idx === categories.length - 1 || busy}
                          aria-label={`Move ${cat.name} down`}
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>

                      {isEditingName ? (
                        <div className="category-inline-rename-form">
                          <label htmlFor={`rename-input-${idx}`} className="visually-hidden">
                            Rename {cat.name}
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
                                handleSaveRename(cat.name);
                              } else if (e.key === 'Escape') {
                                setEditingNameCat(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="category-inline-save-btn"
                            onClick={() => handleSaveRename(cat.name)}
                            disabled={busy}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="category-inline-cancel-btn"
                            onClick={() => setEditingNameCat(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <Chip label={cat.name} size="md" />
                      )}
                    </div>

                    {!isEditingName && (
                      <div className="category-row-actions">
                        <button
                          type="button"
                          className="category-rename-btn"
                          onClick={() => handleStartRename(cat.name)}
                          disabled={busy}
                          aria-label={`Rename category ${cat.name}`}
                          title="Rename"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="category-remove-btn"
                          onClick={() => handleRemoveCategory(cat.name)}
                          disabled={busy}
                          aria-label={`Remove category ${cat.name}`}
                          title="Remove category"
                        >
                          <TrashIcon size={14} color="var(--danger)" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description row */}
                  <div className="category-row-desc-section">
                    {isEditingDesc ? (
                      <div className="category-desc-edit-form">
                        <textarea
                          id={`edit-desc-${idx}`}
                          className="category-desc-textarea"
                          value={descInput}
                          onChange={(e) => setDescInput(e.target.value)}
                          rows={2}
                          autoFocus
                          disabled={busy}
                        />
                        <div className="category-desc-edit-actions">
                          <button
                            type="button"
                            className="category-inline-save-btn"
                            onClick={() => handleSaveDescription(cat.name)}
                            disabled={busy || !descInput.trim()}
                          >
                            Save description
                          </button>
                          <button
                            type="button"
                            className="category-inline-cancel-btn"
                            onClick={() => setEditingDescCat(null)}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="category-desc-display">
                        <p className="category-desc-text">
                          {cat.description || <span className="category-desc-empty">No description set</span>}
                        </p>
                        <button
                          type="button"
                          className="category-desc-edit-btn"
                          onClick={() => handleStartEditDesc(cat)}
                          title="Edit description"
                          aria-label={`Edit description for ${cat.name}`}
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
);
};
