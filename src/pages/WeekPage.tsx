import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Swan, Toast, WorkCategoriesSheet } from '../components';
import { useAuth } from '../lib/auth';
import {
  computeWeekSummary,
  getDefaultSelectedWeekStart,
  getPreviousWeekStart,
  getNextWeekStart,
  getWeekStartForDate,
  formatWeekDateRange,
  formatHoursMinutes,
  formatDecimalHours,
  generateReportText,
  WeekSummaryResult,
} from '../lib/weekSummary';
import { fetchWeekReviewData, WeekReviewFetchedData } from '../lib/weekData';
import './WeekPage.css';

export const WeekPage: React.FC = () => {
  const { user } = useAuth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix';

  // 1. Initial selected week: on Monday opens on week that just ended, otherwise current week
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    getDefaultSelectedWeekStart(new Date(), timeZone)
  );

  const [fetchedData, setFetchedData] = useState<WeekReviewFetchedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [workCategoriesSheetOpen, setWorkCategoriesSheetOpen] = useState(false);

  // 2. Format toggle (stored in localStorage)
  const [hoursFormat, setHoursFormat] = useState<'hours_minutes' | 'decimal'>(() => {
    try {
      const stored = localStorage.getItem('littlehours_work_hours_format');
      return stored === 'decimal' ? 'decimal' : 'hours_minutes';
    } catch {
      return 'hours_minutes';
    }
  });

  const toggleHoursFormat = () => {
    const next = hoursFormat === 'hours_minutes' ? 'decimal' : 'hours_minutes';
    setHoursFormat(next);
    try {
      localStorage.setItem('littlehours_work_hours_format', next);
    } catch {
      // ignore
    }
  };

  // 3. Load data for selected week
  const loadWeekData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchWeekReviewData({
        userId: user.id,
        weekStart: selectedWeekStart,
        timeZone,
      });
      setFetchedData(data);
    } catch (err) {
      console.error('Error loading week review data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeekData();
  }, [user, selectedWeekStart]);

  // 4. Compute week summary
  const summary: WeekSummaryResult = useMemo(() => {
    return computeWeekSummary({
      segments: fetchedData?.segments || [],
      entries: fetchedData?.entries || [],
      settings: fetchedData?.settings || { timezone: timeZone },
      weekStart: selectedWeekStart,
      now: new Date(),
      previousSegments: fetchedData?.previousSegments || [],
    });
  }, [fetchedData, selectedWeekStart, timeZone]);

  // 5. Navigation bounds
  const currentWeekStart = useMemo(
    () => getWeekStartForDate(new Date(), timeZone),
    [timeZone]
  );
  const isCurrentWeek = summary.isCurrentWeek;
  const lastWeekStart = useMemo(
    () => getPreviousWeekStart(currentWeekStart, timeZone),
    [currentWeekStart, timeZone]
  );
  const isLastWeek = selectedWeekStart.getTime() === lastWeekStart.getTime();

  const earliestWeekStart = useMemo(() => {
    if (!fetchedData?.earliestEntryDate) return null;
    return getWeekStartForDate(fetchedData.earliestEntryDate, timeZone);
  }, [fetchedData?.earliestEntryDate, timeZone]);

  const isEarliestWeek = Boolean(
    earliestWeekStart && selectedWeekStart.getTime() <= earliestWeekStart.getTime()
  );

  const handlePrevWeek = () => {
    if (isEarliestWeek) return;
    setSelectedWeekStart((prev) => getPreviousWeekStart(prev, timeZone));
  };

  const handleNextWeek = () => {
    if (isCurrentWeek) return;
    setSelectedWeekStart((prev) => getNextWeekStart(prev, timeZone));
  };

  // 6. Copy for my report
  const handleCopyReport = async () => {
    const text = generateReportText(summary, timeZone, hoursFormat);
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch {
      // Fallback
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        success = true;
      } catch (err) {
        console.error('Copy fallback failed:', err);
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const longestWorkDay = Math.max(1, ...summary.work.perDay);
  const dayInitials = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="week-page-container">
      {/* 6.1 Week Selector */}
      <nav className="week-selector" aria-label="Week navigation">
        <button
          type="button"
          className="week-nav-arrow"
          onClick={handlePrevWeek}
          disabled={isEarliestWeek}
          aria-label="Previous week"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="week-selector-info">
          <span className="week-selector-range">
            {formatWeekDateRange(selectedWeekStart, timeZone)}
          </span>
          {isCurrentWeek && (
            <span className="week-selector-sub">This week so far</span>
          )}
          {!isCurrentWeek && isLastWeek && (
            <span className="week-selector-sub">Last week</span>
          )}
        </div>

        <button
          type="button"
          className="week-nav-arrow"
          onClick={handleNextWeek}
          disabled={isCurrentWeek}
          aria-label="Next week"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </nav>

      {/* 6.9 Empty State (No logged segments) */}
      {!loading && summary.loggedMs === 0 && (
        <div className="week-empty-state">
          <div className="week-empty-swan" aria-hidden="true">
            <Swan size={88} color="var(--rose-deep)" opacity={0.65} />
          </div>
          <p className="week-empty-text">Nothing logged this week yet.</p>
        </div>
      )}

      {/* 6.2 Hours Worked (Hero Card) */}
      {(loading || summary.loggedMs > 0) && (
        <Card ornamental className="week-hero-card">
          <div className="week-hero-header">
            <span className="week-hero-label">
              {isCurrentWeek ? 'Hours worked so far' : 'Hours worked'}
            </span>
          </div>

          <div className="week-hero-number-wrap">
            <button
              type="button"
              className="week-hero-number-btn"
              onClick={toggleHoursFormat}
              aria-label={`Hours worked: ${hoursFormat === 'decimal' ? formatDecimalHours(summary.work.totalMinutes) : formatHoursMinutes(summary.work.totalMinutes)}. Tap to toggle format.`}
              title="Tap to toggle format"
            >
              <span className="week-hero-number">
                {hoursFormat === 'decimal'
                  ? formatDecimalHours(summary.work.totalMinutes)
                  : formatHoursMinutes(summary.work.totalMinutes)}
              </span>
            </button>
          </div>

          {summary.work.totalMinutes === 0 && summary.loggedMs > 0 && (
            <p className="week-zero-work-notice">
              Nothing logged in the work categories this week.
            </p>
          )}

          {summary.work.missingCategories.length > 0 && (
            <p className="week-missing-cat-notice">
              Some work categories no longer exist.{' '}
              <Link to="/settings" className="week-settings-link">
                Check Settings.
              </Link>
            </p>
          )}

          {/* 7 Vertical Daily Work Bars */}
          <div
            className="week-bars-container"
            role="img"
            aria-label={`Hours worked per day, total ${formatHoursMinutes(summary.work.totalMinutes)}`}
          >
            {summary.work.perDay.map((min, idx) => {
              const heightPct = Math.min(100, (min / longestWorkDay) * 100);
              const formattedDayTime =
                hoursFormat === 'decimal'
                  ? `${(min / 60).toFixed(1)}h`.replace('.0h', 'h')
                  : formatHoursMinutes(min);

              return (
                <div key={idx} className="week-bar-col">
                  <div className="week-bar-track">
                    <div
                      className="week-bar-fill"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="week-bar-day-initial">{dayInitials[idx]}</span>
                  <span className="week-bar-day-time">{formattedDayTime}</span>
                </div>
              );
            })}
          </div>

          {/* Counting categories info */}
          <div className="week-counting-line">
            <span className="week-counting-text">
              Counting:{' '}
              <button
                type="button"
                className="week-counting-btn"
                onClick={() => setWorkCategoriesSheetOpen(true)}
                aria-label="Change work categories in settings"
              >
                {summary.work.categoriesUsed.join(', ') || 'none'}
              </button>
            </span>
          </div>

          {/* Copy for my report */}
          <div className="week-copy-wrap">
            <Button
              variant="primary"
              className="week-copy-btn"
              onClick={handleCopyReport}
              aria-label="Copy for my report"
            >
              {copied ? 'Copied' : 'Copy for my report'}
            </Button>
          </div>
        </Card>
      )}

      {/* Work Categories Multi-select Sheet */}
      {user && (
        <WorkCategoriesSheet
          isOpen={workCategoriesSheetOpen}
          userId={user.id}
          categories={fetchedData?.settings?.categories || []}
          workCategories={summary.work.categoriesUsed}
          onClose={() => setWorkCategoriesSheetOpen(false)}
          onWorkCategoriesUpdated={(_newCats) => {
            loadWeekData();
            setToastMsg('Work categories updated');
          }}
          onToast={setToastMsg}
        />
      )}

      <Toast visible={Boolean(toastMsg)} message={toastMsg || ''} onClose={() => setToastMsg(null)} />
    </div>
  );
};

export default WeekPage;
