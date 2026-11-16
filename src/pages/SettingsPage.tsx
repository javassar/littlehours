import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Hummingbird, Chip, Toast, CategoriesSheet, PeopleSheet } from '../components';
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
import {
  CategoryItem,
  normalizeCategories,
  getPromptVersionStats,
  COMMON_TIMEZONES,
  updateUserSettings,
  setVacationMode,
  snoozeReminders,
  cancelSnooze,
  computeNextReminderTime,
  formatFriendlyTime,
} from '../lib/settings';
import { formatDurationMs } from '../lib/time';
import {
  getPushStatus,
  subscribeToPush,
  isPushSupported,
  getNotificationPermission,
  PushStatus,
  PushPermission,
} from '../lib/push';

export const SettingsPage: React.FC = () => {
  const { user, settings, signOut, refreshSettings } = useAuth();
  const navigate = useNavigate();
  const timeZone = settings?.timezone || 'America/Phoenix';

  // Categories management
  const [categoriesSheetOpen, setCategoriesSheetOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>(
    normalizeCategories(settings?.categories)
  );

  useEffect(() => {
    if (settings?.categories) {
      setCategories(normalizeCategories(settings.categories));
    }
  }, [settings?.categories]);

  // People management (Milestone 3.7)
  const [peopleSheetOpen, setPeopleSheetOpen] = useState(false);

  // Vacation mode state & toggle (Milestone 3.7)
  const [vacationMode, setVacationModeState] = useState<boolean>(Boolean(settings?.vacation_mode));
  const [vacationBusy, setVacationBusy] = useState(false);

  useEffect(() => {
    if (settings?.vacation_mode !== undefined) {
      setVacationModeState(Boolean(settings.vacation_mode));
    }
  }, [settings?.vacation_mode]);

  const handleToggleVacationMode = async (checked: boolean) => {
    if (!user) return;
    setVacationModeState(checked);
    setVacationBusy(true);
    try {
      await setVacationMode(user.id, checked);
      if (refreshSettings) await refreshSettings();
      showToast(checked ? 'Vacation mode turned on' : 'Vacation mode turned off');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update vacation mode');
    } finally {
      setVacationBusy(false);
    }
  };

  // Vacation hours calculation (Milestone 3.7)
  const [vacationDurationMs, setVacationDurationMs] = useState<number>(0);

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

  // Compute vacation hours for selected date range (Milestone 3.7)
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    (async () => {
      try {
        let query = supabase
          .from('segments')
          .select('start_time, end_time, category')
          .eq('user_id', user.id)
          .eq('category', 'vacation');

        if (fromDate) {
          const startOfDay = new Date(`${fromDate}T00:00:00`);
          query = query.gte('start_time', startOfDay.toISOString());
        }
        if (toDate) {
          const endOfDay = new Date(`${toDate}T23:59:59.999`);
          query = query.lte('end_time', endOfDay.toISOString());
        }

        const { data, error } = await query;
        if (error || !data) return;

        let totalMs = 0;
        for (const seg of data) {
          const s = new Date(seg.start_time).getTime();
          const e = new Date(seg.end_time).getTime();
          if (e > s) {
            totalMs += e - s;
          }
        }
        if (isMounted) {
          setVacationDurationMs(totalMs);
        }
      } catch (err) {
        console.warn('Error calculating vacation hours:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, fromDate, toDate]);

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

  // Reminders state (Milestone 3.4 & 3.5)
  const [remindersEnabled, setRemindersEnabled] = useState<boolean>(
    settings?.reminders_enabled !== false
  );
  const [startHour, setStartHour] = useState<number>(settings?.reminder_start_hour ?? 8);
  const [endHour, setEndHour] = useState<number>(settings?.reminder_end_hour ?? 23);
  const [userTimezone, setUserTimezone] = useState<string>(settings?.timezone || 'America/Phoenix');
  const [snoozeUntil, setSnoozeUntil] = useState<string | null>(settings?.snooze_until || null);
  const [latestEntryEnd, setLatestEntryEnd] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [snoozing, setSnoozing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      (async () => {
        try {
          const { data } = await supabase
            .from('entries')
            .select('window_end')
            .eq('user_id', user.id)
            .order('window_end', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data?.window_end) {
            setLatestEntryEnd(data.window_end);
          }
        } catch {
          // Ignore
        }
      })();
    }
  }, [user?.id]);

  useEffect(() => {
    if (settings) {
      setRemindersEnabled(settings.reminders_enabled !== false);
      setStartHour(
        typeof settings.reminder_start_hour === 'number' ? settings.reminder_start_hour : 8
      );
      setEndHour(
        typeof settings.reminder_end_hour === 'number' ? settings.reminder_end_hour : 23
      );
      setUserTimezone(settings.timezone || 'America/Phoenix');
      setSnoozeUntil(settings.snooze_until || null);
    }
  }, [settings]);

  const availableTimezones = React.useMemo(() => {
    const list = [...COMMON_TIMEZONES];
    try {
      const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (localTz && !list.includes(localTz)) {
        list.unshift(localTz);
      }
    } catch {
      // Ignore
    }
    if (userTimezone && !list.includes(userTimezone)) {
      list.unshift(userTimezone);
    }
    return list;
  }, [userTimezone]);

  const isSnoozed = Boolean(snoozeUntil && new Date(snoozeUntil) > new Date());

  const nextReminderDate = computeNextReminderTime(
    {
      reminders_enabled: remindersEnabled,
      timezone: userTimezone,
      reminder_start_hour: startHour,
      reminder_end_hour: endHour,
      snooze_until: snoozeUntil,
    },
    new Date(),
    latestEntryEnd
  );

  const nextReminderText = nextReminderDate
    ? formatFriendlyTime(nextReminderDate, userTimezone)
    : null;

  const snoozeTimeFormatted =
    isSnoozed && snoozeUntil
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(snoozeUntil))
      : null;

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

  const handleCategoriesUpdated = (newCats: CategoryItem[]) => {
    setCategories(newCats);
    if (refreshSettings) {
      refreshSettings();
    }
  };

  const handleToggleSwitch = async (checked: boolean) => {
    if (!user) return;
    setRemindersEnabled(checked);
    setPushBusy(true);

    try {
      if (checked) {
        if (!pushStatus.isSubscribed) {
          const res = await subscribeToPush(user.id);
          if (!res.success) {
            setRemindersEnabled(false);
            showToast(res.error || 'Failed to enable reminders');
            setPushBusy(false);
            return;
          }
        } else {
          await updateUserSettings(user.id, { reminders_enabled: true });
        }
        showToast('Reminders turned on');
      } else {
        await updateUserSettings(user.id, { reminders_enabled: false });
        showToast('Reminders turned off');
      }

      await loadPushStatus();
      if (refreshSettings) await refreshSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update reminders');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTimezoneChange = async (newTz: string) => {
    if (!user) return;
    setUserTimezone(newTz);
    try {
      await updateUserSettings(user.id, { timezone: newTz });
      showToast(`Timezone updated to ${newTz}`);
      if (refreshSettings) await refreshSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update timezone');
    }
  };

  const handleStartHourChange = async (h: number) => {
    if (!user) return;
    setStartHour(h);
    try {
      await updateUserSettings(user.id, { reminder_start_hour: h });
      if (refreshSettings) await refreshSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update start hour');
    }
  };

  const handleEndHourChange = async (h: number) => {
    if (!user) return;
    setEndHour(h);
    try {
      await updateUserSettings(user.id, { reminder_end_hour: h });
      if (refreshSettings) await refreshSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update end hour');
    }
  };

  const handleSnooze = async () => {
    if (!user) return;
    setSnoozing(true);
    try {
      const until = await snoozeReminders(user.id, 60);
      setSnoozeUntil(until);
      showToast('Snoozed reminders for 1 hour');
      if (refreshSettings) await refreshSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to snooze reminders');
    } finally {
      setSnoozing(false);
    }
  };

  const handleCancelSnooze = async () => {
    if (!user) return;
    try {
      await cancelSnooze(user.id);
      setSnoozeUntil(null);
      showToast('Snooze cancelled');
      if (refreshSettings) await refreshSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to cancel snooze');
    }
  };

  const handleSendTestNotification = async () => {
    if (!user) return;

    if (!isPushSupported()) {
      showToast('Notifications are not supported in this browser');
      return;
    }

    setSendingTest(true);
    try {
      // 1. Request notification permission if not yet granted
      let perm = getNotificationPermission();
      if (perm === 'default') {
        const requested = await Notification.requestPermission();
        perm = requested as PushPermission;
      }

      if (perm === 'denied') {
        showToast('Notifications are blocked in your browser or device settings');
        await loadPushStatus();
        return;
      }

      // 2. Ensure device is registered and subscribed to push
      let isSubscribed = pushStatus.isSubscribed;
      if (!isSubscribed) {
        const subRes = await subscribeToPush(user.id);
        if (subRes.success) {
          isSubscribed = true;
          setRemindersEnabled(true);
          await updateUserSettings(user.id, { reminders_enabled: true });
        }
      }
      await loadPushStatus();
      if (refreshSettings) await refreshSettings();

      // 3. Immediately display a test notification through the service worker
      let shownLocally = false;
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification('Little Hours', {
            body: 'Tell me how you spent the past hour.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'hourly',
            data: { url: '/?focus=1' },
          });
          shownLocally = true;
        } catch (swErr) {
          console.warn('Local service worker notification failed:', swErr);
        }
      }

      // 4. Also call the backend Edge Function send-reminders to test the full push pipeline
      let serverSent = false;
      try {
        const { data, error } = await supabase.functions.invoke('send-reminders', {
          body: {
            user_id: user.id,
            ignore_quiet_hours: true,
            ignore_recent_log: true,
          },
        });
        if (!error && data && data.notifications_sent > 0) {
          serverSent = true;
        }
      } catch (backendErr) {
        console.warn('Backend send-reminders invoke failed:', backendErr);
      }

      if (shownLocally || serverSent) {
        showToast('Test notification sent! Check your notification tray');
      } else {
        showToast('Test notification processed');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to send test notification');
    } finally {
      setSendingTest(false);
    }
  };

  const formatHourLabel = (h: number): string => {
    if (h === 0) return '12:00 AM (midnight)';
    if (h === 12) return '12:00 PM (noon)';
    if (h < 12) return `${h}:00 AM`;
    return `${h - 12}:00 PM`;
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
        'id, window_start, window_end, raw_text, created_at, on_vacation, follow_ups, segments(id, start_time, end_time, activity_label, category, company, confirmed)'
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
              on_vacation: Boolean(qEntry.on_vacation),
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

      {/* Vacation Mode (Milestone 3.7) */}
      <Card className="settings-card mb-4">
        <div className="reminders-status-row">
          <h3 className="section-title" style={{ margin: 0 }}>
            Vacation Mode
          </h3>
          <span className={`reminders-status-pill status-${vacationMode ? 'on' : 'off'}`}>
            {vacationMode ? 'On' : 'Off'}
          </span>
        </div>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          While on, new entries are automatically categorized as vacation time.
        </p>
        <div className="reminders-toggle-container">
          <label htmlFor="settings-vacation-switch" className="reminders-toggle-label">
            <input
              id="settings-vacation-switch"
              type="checkbox"
              className="reminders-switch-input"
              checked={vacationMode}
              onChange={(e) => handleToggleVacationMode(e.target.checked)}
              disabled={vacationBusy}
              aria-label="Toggle vacation mode"
            />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
              On vacation
            </span>
          </label>
        </div>
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
            <Chip key={cat.name} label={cat.name} size="sm" />
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

      {/* People Management (Milestone 3.7) */}
      <Card className="settings-card mb-4">
        <div className="settings-section-header">
          <h3 className="section-title" style={{ margin: 0 }}>
            People
          </h3>
          <Button
            variant="secondary"
            onClick={() => setPeopleSheetOpen(true)}
            aria-label="Manage people"
          >
            Manage people
          </Button>
        </div>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          View and manage the people you log time with, rename or merge duplicate spellings, and see
          total hours.
        </p>
      </Card>

      {/* People Sheet Dialog */}
      {user && (
        <PeopleSheet
          isOpen={peopleSheetOpen}
          userId={user.id}
          onClose={() => setPeopleSheetOpen(false)}
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
        <p className="section-desc" style={{ marginBottom: 14 }}>
          Download your complete history as CSV or JSON with segment details and follow-ups. Each
          row represents one segment, matching History.
        </p>

        {/* Vacation hours line (Milestone 3.7) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: 'rgba(201, 187, 214, 0.25)',
            border: '1px solid rgba(142, 107, 122, 0.25)',
            borderRadius: '14px',
            marginBottom: '16px',
            fontFamily: 'var(--font-body)',
            fontSize: '13.5px',
            color: 'var(--ink)',
          }}
        >
          <span>Vacation hours:</span>
          <strong>{formatDurationMs(vacationDurationMs)}</strong>
        </div>

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

      {/* Reminders Section (Milestone 3.1 & 3.4) */}
      <Card className="settings-card mb-4">
        <div className="reminders-status-row">
          <h3 className="section-title" style={{ margin: 0 }}>
            Reminders
          </h3>
          <span
            className={`reminders-status-pill status-${
              !pushStatus.isStandalone
                ? 'browser'
                : pushStatus.permission === 'denied'
                ? 'blocked'
                : remindersEnabled && pushStatus.isSubscribed
                ? 'on'
                : 'off'
            }`}
          >
            {!pushStatus.isStandalone
              ? 'Browser Tab'
              : pushStatus.permission === 'denied'
              ? 'Blocked'
              : remindersEnabled && pushStatus.isSubscribed
              ? 'On'
              : 'Off'}
          </span>
        </div>
        <p className="section-desc" style={{ marginBottom: 12 }}>
          Hourly notifications that open directly to your log screen.
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
            <div style={{ marginTop: 14 }}>
              <Button
                variant="secondary"
                onClick={handleSendTestNotification}
                disabled={sendingTest}
                aria-label="Send a test notification"
              >
                {sendingTest ? 'Sending...' : 'Send a test notification'}
              </Button>
            </div>
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
            <div style={{ marginTop: 12 }}>
              <Button
                variant="secondary"
                onClick={handleSendTestNotification}
                disabled={sendingTest}
                aria-label="Send a test notification"
              >
                {sendingTest ? 'Checking...' : 'Send a test notification'}
              </Button>
            </div>
          </div>
        ) : (
          /* When in standalone mode and not blocked */
          <div>
            {/* On / Off Switch */}
            <div className="reminders-toggle-container">
              <label htmlFor="reminders-enabled-switch" className="reminders-toggle-label">
                <input
                  id="reminders-enabled-switch"
                  type="checkbox"
                  className="reminders-switch-input"
                  checked={remindersEnabled}
                  onChange={(e) => handleToggleSwitch(e.target.checked)}
                  disabled={pushBusy}
                  aria-label="Toggle hourly reminders"
                />
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 17,
                    color: 'var(--ink)',
                  }}
                >
                  Hourly check-ins
                </span>
              </label>
            </div>

            {/* Next scheduled reminder time under the switch */}
            <p className="reminders-next-time">
              {!remindersEnabled ? (
                'Reminders are currently paused.'
              ) : isSnoozed ? (
                <>
                  Snoozed until <strong>{snoozeTimeFormatted}</strong> · Next reminder:{' '}
                  <strong>{nextReminderText}</strong>
                </>
              ) : (
                <>
                  Next reminder: <strong>{nextReminderText || 'Calculating...'}</strong>
                </>
              )}
            </p>

            {/* Active snooze banner with cancel option */}
            {isSnoozed && (
              <div className="reminders-snooze-banner">
                <span>Reminders are snoozed for 1 hour</span>
                <button
                  type="button"
                  className="reminders-cancel-snooze-btn"
                  onClick={handleCancelSnooze}
                  aria-label="Cancel snooze"
                >
                  Resume now
                </button>
              </div>
            )}

            {/* Schedule Range: First and Last Reminder Hours */}
            <div className="reminders-schedule-group">
              <div className="reminders-schedule-field">
                <label className="sheet-label" htmlFor="reminder-start-hour-select">
                  First reminder
                </label>
                <select
                  id="reminder-start-hour-select"
                  className="reminders-select"
                  value={startHour}
                  onChange={(e) => handleStartHourChange(parseInt(e.target.value, 10))}
                  aria-label="First reminder hour"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHourLabel(i)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="reminders-schedule-field">
                <label className="sheet-label" htmlFor="reminder-end-hour-select">
                  Last reminder
                </label>
                <select
                  id="reminder-end-hour-select"
                  className="reminders-select"
                  value={endHour}
                  onChange={(e) => handleEndHourChange(parseInt(e.target.value, 10))}
                  aria-label="Last reminder hour"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHourLabel(i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Timezone Picker */}
            <div style={{ marginBottom: 16 }}>
              <label className="sheet-label" htmlFor="reminder-timezone-select">
                Timezone
              </label>
              <select
                id="reminder-timezone-select"
                className="reminders-select"
                value={userTimezone}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                aria-label="Reminder timezone"
              >
                {availableTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions: Snooze 1 hour & Send test notification */}
            <div className="reminders-actions-row">
              <Button
                variant="secondary"
                onClick={handleSnooze}
                disabled={snoozing || !remindersEnabled}
                aria-label="Snooze for 1 hour"
              >
                {snoozing ? 'Snoozing...' : 'Snooze for 1 hour'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSendTestNotification}
                disabled={sendingTest}
                aria-label="Send a test notification"
              >
                {sendingTest ? 'Sending...' : 'Send a test notification'}
              </Button>
            </div>
          </div>
        )}
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
