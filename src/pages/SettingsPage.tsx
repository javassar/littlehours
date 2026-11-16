import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Hummingbird, Chip, Toast, CategoriesSheet } from '../components';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  prepareExportRows,
  generateCSV,
  generateJSON,
  getExportFileName,
  downloadFile,
  ExportEntry,
} from '../lib/export';
import { getQueue } from '../lib/offlineQueue';
import { STARTER_CATEGORIES, getPromptVersionStats } from '../lib/settings';
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  PushStatus,
} from '../lib/push';

export const SettingsPage: React.FC = () => {
  const { user, settings, signOut, refreshSettings } = useAuth();
  const navigate = useNavigate();
  const timeZone = settings?.timezone || 'America/Phoenix';

  // Categories management
  const [categoriesSheetOpen, setCategoriesSheetOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>(
    settings?.categories && settings.categories.length > 0
      ? settings.categories
      : STARTER_CATEGORIES
  );

  useEffect(() => {
    if (settings?.categories && settings.categories.length > 0) {
      setCategories(settings.categories);
    }
  }, [settings?.categories]);

  // Prompt version stats
  const [promptStats, setPromptStats] = useState<Record<string, number>>({});

  const fetchPromptStats = async () => {
    if (!user) return;
    try {
      const stats = await getPromptVersionStats(user.id);
      setPromptStats(stats);
    } catch (err) {
      console.warn('Could not fetch prompt version stats:', err);
    }
  };

  useEffect(() => {
    fetchPromptStats();
  }, [user?.id]);

  // Re-read entries state
  const [includeConfirmed, setIncludeConfirmed] = useState(false);
  const [isReReading, setIsReReading] = useState(false);
  const [reReadProgress, setReReadProgress] = useState<{
    current: number;
    total: number;
    percent: number;
  } | null>(null);
  const [reReadStatusText, setReReadStatusText] = useState<string | null>(null);
  const stopReReadRef = useRef(false);

  // Date range filter for export (optional, defaults to all)
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Push reminders state (Milestone 3.1)
  const [pushStatus, setPushStatus] = useState<PushStatus>({
    isStandalone: false,
    permission: 'default',
    isSubscribed: false,
  });
  const [pushBusy, setPushBusy] = useState(false);

  const loadPushStatus = async () => {
    if (user) {
      const status = await getPushStatus(user.id);
      setPushStatus(status);
    }
  };

  useEffect(() => {
    loadPushStatus();
  }, [user?.id]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleCategoriesUpdated = (newCats: string[]) => {
    setCategories(newCats);
    if (refreshSettings) {
      refreshSettings();
    }
  };

  const handleToggleReminders = async () => {
    if (!user) return;
    setPushBusy(true);

    try {
      if (pushStatus.isSubscribed) {
        const res = await unsubscribeFromPush(user.id);
        if (res.success) {
          showToast('Reminders turned off');
        } else {
          showToast(res.error || 'Failed to turn off reminders');
        }
      } else {
        const res = await subscribeToPush(user.id);
        if (res.success) {
          showToast('Reminders turned on');
        } else if (res.error) {
          showToast(res.error);
        }
      }

      await loadPushStatus();
      if (refreshSettings) {
        await refreshSettings();
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error updating reminders');
    } finally {
      setPushBusy(false);
    }
  };

  const handleReReadAllEntries = async () => {
    if (!user) return;
    setIsReReading(true);
    setReReadStatusText(null);
    stopReReadRef.current = false;

    try {
      const { data: entries, error } = await supabase
        .from('entries')
        .select('id, window_start, segments(id, confirmed)')
        .eq('user_id', user.id)
        .order('window_start', { ascending: true });

      if (error) {
        throw new Error(`Failed to load entries: ${error.message}`);
      }

      if (!entries || entries.length === 0) {
        setReReadStatusText('No entries found to re-read.');
        setIsReReading(false);
        return;
      }

      // Filter entries based on includeConfirmed
      const toProcess = entries.filter((entry) => {
        if (includeConfirmed) return true;
        const segs = (entry as any).segments || [];
        if (segs.length === 0) return true;
        const allConfirmed = segs.every((s: any) => s.confirmed);
        return !allConfirmed;
      });

      if (toProcess.length === 0) {
        setReReadStatusText(
          'All entries have confirmed segments. Turn on "Include confirmed segments" to re-read anyway.'
        );
        setIsReReading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Not logged in. Please sign in again.');
      }

      let processedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < toProcess.length; i++) {
        if (stopReReadRef.current) {
          setReReadStatusText(`Stopped after ${processedCount} entries.`);
          break;
        }

        const entry = toProcess[i];
        setReReadProgress({
          current: i + 1,
          total: toProcess.length,
          percent: Math.round(((i + 1) / toProcess.length) * 100),
        });

        try {
          const { error: invokeErr } = await supabase.functions.invoke('parse-entry', {
            body: { entry_id: entry.id },
            headers: { Authorization: `Bearer ${token}` },
          });

          if (invokeErr) {
            failedCount++;
            console.warn(`Failed to re-read entry ${entry.id}:`, invokeErr.message);
          } else {
            processedCount++;
          }
        } catch (err) {
          failedCount++;
          console.warn(`Exception re-reading entry ${entry.id}:`, err);
        }

        // If there's another entry, pause 4.2 seconds to stay safely inside free tier 15 RPM
        if (i < toProcess.length - 1 && !stopReReadRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 4200));
        }
      }

      if (!stopReReadRef.current) {
        const summary = `Re-read finished: ${processedCount} entry/entries updated${
          failedCount > 0 ? `, ${failedCount} failed` : ''
        }.`;
        setReReadStatusText(summary);
        showToast(`Re-read ${processedCount} entries`);
      }

      await fetchPromptStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setReReadStatusText(`Re-read failed: ${msg}`);
    } finally {
      setIsReReading(false);
      setReReadProgress(null);
    }
  };

  const handleStopReRead = () => {
    stopReReadRef.current = true;
  };

  const fetchExportEntries = async (): Promise<ExportEntry[]> => {
    if (!user) return [];

    let query = supabase
      .from('entries')
      .select(
        'id, window_start, window_end, raw_text, created_at, follow_ups, segments(id, start_time, end_time, activity_label, category, confirmed)'
      )
      .eq('user_id', user.id)
      .order('window_start', { ascending: true });

    if (fromDate) {
      const startOfDay = new Date(`${fromDate}T00:00:00`);
      query = query.gte('window_start', startOfDay.toISOString());
    }

    if (toDate) {
      const endOfDay = new Date(`${toDate}T23:59:59.999`);
      query = query.lte('window_end', endOfDay.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const serverEntries = (data || []).map((e: any) => {
      const segs = Array.isArray(e.segments)
        ? [...e.segments].sort(
            (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          )
        : [];
      return {
        ...e,
        segments: segs,
      };
    }) as ExportEntry[];

    // Also include any matching queued offline entries
    try {
      const queue = await getQueue();
      const userQueue = queue.filter((e) => e.user_id === user.id);
      for (const qEntry of userQueue) {
        if (!serverEntries.some((s) => s.id === qEntry.id)) {
          let match = true;
          if (fromDate) {
            match = match && new Date(qEntry.window_start) >= new Date(`${fromDate}T00:00:00`);
          }
          if (toDate) {
            match = match && new Date(qEntry.window_end) <= new Date(`${toDate}T23:59:59.999`);
          }
          if (match) {
            serverEntries.push({
              id: qEntry.id,
              window_start: qEntry.window_start,
              window_end: qEntry.window_end,
              raw_text: qEntry.raw_text,
              created_at: qEntry.created_at || qEntry.queued_at,
              segments: [],
            });
          }
        }
      }
    } catch (e) {
      console.warn('Could not read offline queue for export:', e);
    }

    serverEntries.sort(
      (a, b) => new Date(a.window_start).getTime() - new Date(b.window_start).getTime()
    );
    return serverEntries;
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    setExportStatus(null);

    try {
      const rawEntries = await fetchExportEntries();

      if (rawEntries.length === 0) {
        setExportStatus('No entries found for the selected date range.');
        showToast('No entries to export');
        setExporting(null);
        return;
      }

      const rows = prepareExportRows(rawEntries, timeZone);
      const filename = getExportFileName(format, timeZone);

      if (format === 'csv') {
        const csvContent = generateCSV(rows);
        downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
        showToast(`Exported ${rows.length} segment(s) to CSV`);
      } else {
        const jsonContent = generateJSON(rows);
        downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
        showToast(`Exported ${rows.length} segment(s) to JSON`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setExportStatus(`Failed to export entries: ${msg}`);
      showToast('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleClearDateRange = () => {
    setFromDate('');
    setToDate('');
    setExportStatus(null);
  };

  // Sort prompt versions so 'v2' comes first
  const sortedPromptVersions = Object.keys(promptStats).sort((a, b) => {
    if (a === 'v2') return -1;
    if (b === 'v2') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="page-container screen-fade-in settings-page">
      <Toast visible={toastVisible} message={toastMessage} onClose={() => setToastVisible(false)} />

      <h2 className="screen-heading">Settings</h2>

      {/* Account Info */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Account</h3>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          Signed in as <strong>{user?.email || 'Guest'}</strong>
        </p>
        <Button variant="secondary" onClick={handleSignOut}>
          Log out
        </Button>
      </Card>

      {/* Categories Management (Milestone 2.6) */}
      <Card className="settings-card mb-4">
        <div className="settings-section-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            Categories ({categories.length})
          </h3>
          <Button
            variant="secondary"
            onClick={() => setCategoriesSheetOpen(true)}
            aria-label="Manage categories"
          >
            Manage categories
          </Button>
        </div>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          Add, rename, reorder, or remove categories for your time segments.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {categories.map((cat) => (
            <Chip key={cat} label={cat} size="sm" />
          ))}
        </div>
      </Card>

      {/* Categories Sheet Dialog */}
      {user && (
        <CategoriesSheet
          isOpen={categoriesSheetOpen}
          userId={user.id}
          categories={categories}
          onClose={() => setCategoriesSheetOpen(false)}
          onCategoriesUpdated={handleCategoriesUpdated}
          onToast={showToast}
        />
      )}

      {/* Re-read All Entries (Milestone 2.6) */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Re-read Entries</h3>
        <p className="section-desc" style={{ marginBottom: 8 }}>
          Re-analyze your entries with the latest AI prompt model. To stay safely inside free tier
          limits (15 requests per minute), entries are read one at a time with a pause between each.
        </p>

        {/* Switch to include confirmed segments */}
        <div className="reread-toggle-group">
          <label className="reread-toggle-label">
            <input
              type="checkbox"
              checked={includeConfirmed}
              onChange={(e) => setIncludeConfirmed(e.target.checked)}
              disabled={isReReading}
              aria-label="Include confirmed segments"
            />
            <span>Include confirmed segments</span>
          </label>
          <p className="reread-toggle-hint">
            When unchecked, entries whose segments are already confirmed will be skipped.
          </p>
        </div>

        {/* Progress Bar while re-reading */}
        {isReReading && reReadProgress && (
          <div className="reread-progress-container">
            <div className="reread-progress-bar">
              <div
                className="reread-progress-fill"
                style={{ width: `${reReadProgress.percent}%` }}
              />
            </div>
            <div className="reread-progress-label">
              Reading entry {reReadProgress.current} of {reReadProgress.total} (
              {reReadProgress.percent}%)
            </div>
          </div>
        )}

        {/* Status text */}
        {reReadStatusText && (
          <div
            className={reReadStatusText.includes('failed') ? 'sheet-error' : 'section-desc'}
            style={{ marginTop: 10, marginBottom: 10 }}
          >
            {reReadStatusText}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          {isReReading ? (
            <Button variant="destructive" onClick={handleStopReRead} aria-label="Stop re-reading">
              Stop re-reading
            </Button>
          ) : (
            <Button onClick={handleReReadAllEntries} aria-label="Re-read all entries">
              Re-read all entries
            </Button>
          )}
        </div>
      </Card>

      {/* Prompt Versions Breakdown (Milestone 2.6) */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Prompt Versions</h3>
        <p className="section-desc" style={{ marginBottom: 6 }}>
          Segments categorized by AI prompt version:
        </p>

        {sortedPromptVersions.length === 0 ? (
          <p className="prompt-versions-empty">No segments logged yet.</p>
        ) : (
          <div className="prompt-versions-container">
            {sortedPromptVersions.map((ver) => (
              <div key={ver} className="prompt-version-pill">
                <span className="prompt-version-tag">
                  {ver === 'v2' ? 'v2 (current)' : ver}
                </span>
                <span className="prompt-version-count">{promptStats[ver]}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Export Section (Milestone 1.6 & 2.6) */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Export Entries</h3>
        <p className="section-desc" style={{ marginBottom: 16 }}>
          Download your complete history as CSV or JSON with segment details and follow-ups. Each
          row represents one segment, matching History.
        </p>

        {/* Date range filter */}
        <div className="export-range-group">
          <div className="export-date-field">
            <label className="sheet-label" htmlFor="export-from-date">
              From (optional)
            </label>
            <input
              id="export-from-date"
              type="date"
              className="sheet-datetime-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="Export from date"
            />
          </div>

          <div className="export-date-field">
            <label className="sheet-label" htmlFor="export-to-date">
              To (optional)
            </label>
            <input
              id="export-to-date"
              type="date"
              className="sheet-datetime-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="Export to date"
            />
          </div>
        </div>

        {(fromDate || toDate) && (
          <div style={{ marginTop: 8, marginBottom: 14 }}>
            <button
              type="button"
              className="window-reset-link"
              onClick={handleClearDateRange}
            >
              Clear date filter (export all entries)
            </button>
          </div>
        )}

        {exportStatus && (
          <div className="sheet-error" style={{ marginTop: 12, marginBottom: 12 }}>
            {exportStatus}
          </div>
        )}

        <div className="export-button-row" style={{ marginTop: 16 }}>
          <Button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            aria-label="Export CSV"
          >
            {exporting === 'csv' ? 'Exporting CSV...' : 'Export CSV'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            aria-label="Export JSON"
          >
            {exporting === 'json' ? 'Exporting JSON...' : 'Export JSON'}
          </Button>
        </div>
      </Card>

      {/* Push Reminders (Milestone 3.1) */}
      <Card className="settings-card mb-4">
        <div className="reminders-status-row">
          <h3 className="section-title" style={{ margin: 0 }}>
            Push Reminders
          </h3>
          <span
            className={`reminders-status-pill status-${
              !pushStatus.isStandalone
                ? 'browser'
                : pushStatus.permission === 'denied'
                ? 'blocked'
                : pushStatus.isSubscribed
                ? 'on'
                : 'off'
            }`}
          >
            {!pushStatus.isStandalone
              ? 'Browser Tab'
              : pushStatus.permission === 'denied'
              ? 'Blocked'
              : pushStatus.isSubscribed
              ? 'On'
              : 'Off'}
          </span>
        </div>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          Hourly notifications from 8 AM to 11 PM that open directly to your log screen.
        </p>

        {!pushStatus.isStandalone ? (
          /* When in a normal Safari tab, show install explanation */
          <div className="reminders-standalone-guide">
            <h4 className="reminders-guide-title">Add Little Hours to your Home Screen</h4>
            <p className="section-desc" style={{ marginBottom: 10, fontSize: 14 }}>
              iPhone only allows web push notifications for apps installed to your Home Screen:
            </p>
            <ol className="reminders-steps-list">
              <li>
                Tap the <strong>Share</strong> button (the square with an arrow pointing up) at the
                bottom of Safari.
              </li>
              <li>
                Scroll down the menu and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Open <strong>Little Hours</strong> from your Home Screen to turn on reminders.
              </li>
            </ol>
            <p className="reminders-guide-note">
              Once opened from your Home Screen, the &ldquo;Turn on reminders&rdquo; button will
              appear here.
            </p>
          </div>
        ) : pushStatus.permission === 'denied' ? (
          /* When notifications are blocked in system settings */
          <div className="reminders-blocked-box">
            <strong>Notifications are blocked in your device settings.</strong>
            <p style={{ margin: '6px 0 0' }}>
              To enable reminders, open your device{' '}
              <strong>Settings &gt; Safari (or Little Hours) &gt; Notifications</strong>, turn on{' '}
              <strong>Allow Notifications</strong>, and reload this screen.
            </p>
          </div>
        ) : pushStatus.isSubscribed ? (
          /* When reminders are on */
          <div>
            <p
              className="section-desc"
              style={{ marginBottom: 14, color: '#3b5c34', fontWeight: 500 }}
            >
              Reminders are turned on. You will receive an hourly check-in between 8 AM and 11 PM.
            </p>
            <Button
              variant="secondary"
              onClick={handleToggleReminders}
              disabled={pushBusy}
              aria-label="Turn off reminders"
            >
              {pushBusy ? 'Updating...' : 'Turn off reminders'}
            </Button>
          </div>
        ) : (
          /* When reminders are off */
          <div>
            <p className="section-desc" style={{ marginBottom: 14 }}>
              Tap below to grant notification permission and receive hourly check-ins.
            </p>
            <Button
              onClick={handleToggleReminders}
              disabled={pushBusy}
              aria-label="Turn on reminders"
            >
              {pushBusy ? 'Turning on...' : 'Turn on reminders'}
            </Button>
          </div>
        )}
      </Card>

      {/* Preferences & Default Timezone */}
      <Card className="settings-card mb-4">
        <h3 className="section-title">Preferences</h3>
        <p className="section-desc" style={{ marginBottom: 8 }}>
          Timezone: <strong>{timeZone}</strong>
        </p>
        <p className="section-desc">
          Schedule settings (quiet hours, snooze) will appear in Milestone 3.4.
        </p>
      </Card>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Button variant="secondary" onClick={() => navigate('/design')}>
          View Design System (/design)
        </Button>
      </div>

      <div className="settings-footer">
        <Hummingbird size={60} />
        <p className="footer-note">Little Hours · Soft storybook time logger</p>
      </div>
    </div>
  );
};
