import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Swan, Toast, WorkCategoriesSheet, DayDetailSheet } from '../components';
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
  formatGapRange,
  generateReportText,
  WeekSummaryResult,
  DaySummary,
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
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [selectedDayForSheet, setSelectedDayForSheet] = useState<DaySummary | null>(null);
  const [gapsExpanded, setGapsExpanded] = useState(false);

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

      {/* 6.3 Data quality notice */}
      {(() => {
        const hasAttention = summary.quality.entriesNeedingAttention > 0;
        const hasUnconfirmed = summary.quality.unconfirmedSegments > 0;
        const hasUnsynced = summary.quality.unsyncedChanges > 0;
        if (!hasAttention && !hasUnconfirmed && !hasUnsynced) return null;

        return (
          <div className="week-quality-notice-card" role="alert">
            <div className="week-quality-notice-items">
              {hasAttention && (
                <div className="week-quality-notice-row">
                  <span className="week-quality-notice-text">
                    {summary.quality.entriesNeedingAttention === 1
                      ? '1 entry is still waiting to be sorted. Totals may change.'
                      : `${summary.quality.entriesNeedingAttention} entries are still waiting to be sorted. Totals may change.`}
                  </span>
                  <Link to="/history" className="week-notice-action-btn">
                    Open History
                  </Link>
                </div>
              )}
              {hasUnconfirmed && (
                <div className="week-quality-notice-row">
                  <span className="week-quality-notice-text">
                    {summary.quality.unconfirmedSegments === 1
                      ? '1 segment is unchecked.'
                      : `${summary.quality.unconfirmedSegments} segments are unchecked.`}
                  </span>
                  <Link to="/history?filter=unchecked" className="week-notice-action-btn">
                    Open History
                  </Link>
                </div>
              )}
              {hasUnsynced && (
                <div className="week-quality-notice-row">
                  <span className="week-quality-notice-text">
                    {summary.quality.unsyncedChanges === 1
                      ? '1 change has not synced yet.'
                      : `${summary.quality.unsyncedChanges} changes have not synced yet.`}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 6.4 Where the hours went */}
      {(loading || summary.loggedMs > 0) && (
        <Card className="week-breakdown-card">
          <div className="week-card-header">
            <h3 className="section-title">Where the hours went</h3>
          </div>

          {summary.isAllVacation && (
            <p className="week-vacation-heading-sub">This week was vacation</p>
          )}

          {/* Category Rows */}
          <div className="week-categories-list" role="list">
            {(showAllCategories ? summary.byCategory : summary.byCategory.slice(0, 8)).map(
              (cat) => {
                const topMin = summary.byCategory[0]?.minutes || 1;
                const barWidthPct = Math.min(100, Math.max(3, (cat.minutes / topMin) * 100));

                return (
                  <div key={cat.category} className="week-cat-row" role="listitem">
                    <div className="week-cat-row-top">
                      <div className="week-cat-row-left">
                        <span
                          className="chip-indicator"
                          style={{ backgroundColor: cat.color }}
                          aria-hidden="true"
                        />
                        <span className="week-cat-name">{cat.category}</span>
                      </div>
                      <div className="week-cat-row-right">
                        <span className="week-cat-time">{formatHoursMinutes(cat.minutes)}</span>
                        <span className="week-cat-share">{cat.shareOfCounted}%</span>
                      </div>
                    </div>
                    <div
                      className="week-cat-bar-track"
                      role="img"
                      aria-label={`${cat.category}: ${formatHoursMinutes(cat.minutes)}, ${cat.shareOfCounted}%`}
                    >
                      <div
                        className="week-cat-bar-fill"
                        style={{
                          width: `${barWidthPct}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>

          {/* Expand/Collapse Button */}
          {summary.byCategory.length > 8 && (
            <div className="week-show-all-wrap">
              <button
                type="button"
                className="week-show-all-btn"
                onClick={() => setShowAllCategories(!showAllCategories)}
              >
                {showAllCategories
                  ? 'Show fewer'
                  : `Show all (${summary.byCategory.length})`}
              </button>
            </div>
          )}

          {/* Vacation Line (Separated, no bar, no share) */}
          {summary.vacationMs > 0 && (
            <div className="week-vacation-line">
              <span className="week-vacation-label">
                Vacation: {formatHoursMinutes(Math.round(summary.vacationMs / 60000))}
              </span>
            </div>
          )}

          {/* Coverage Line */}
          <div className="week-coverage-line">
            <span className="week-coverage-text">{summary.coverage.text}</span>
          </div>
        </Card>
      )}

      {/* 6.5 Against last week */}
      {(loading || summary.loggedMs > 0) && !summary.isAllVacation && !isEarliestWeek && (
        <Card className="week-comparison-card">
          <div className="week-card-header">
            <h3 className="section-title">Against last week</h3>
          </div>

          {!summary.comparison.available ? (
            <p className="week-comparison-notice">
              {summary.comparison.reason || 'Last week has too little data to compare.'}
            </p>
          ) : (
            <div className="week-comparison-list" role="list">
              <div className="week-comparison-row week-comparison-work-row" role="listitem">
                <span className="week-comparison-label">Hours worked</span>
                <span className="week-comparison-delta">
                  {summary.comparison.workDeltaMinutes > 0
                    ? `+${formatHoursMinutes(summary.comparison.workDeltaMinutes)}`
                    : summary.comparison.workDeltaMinutes < 0
                    ? `-${formatHoursMinutes(Math.abs(summary.comparison.workDeltaMinutes))}`
                    : 'no change'}
                </span>
              </div>

              {summary.comparison.deltas.map((d) => (
                <div key={d.category} className="week-comparison-row" role="listitem">
                  <span className="week-comparison-label">{d.category}</span>
                  <span className="week-comparison-delta">
                    {d.deltaMinutes > 0
                      ? `+${formatHoursMinutes(d.deltaMinutes)}`
                      : `-${formatHoursMinutes(Math.abs(d.deltaMinutes))}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 6.6 Day by day */}
      {(loading || summary.loggedMs > 0) && (
        <Card className="week-days-card">
          <div className="week-card-header">
            <h3 className="section-title">Day by day</h3>
          </div>

          <div className="week-days-list" role="list">
            {summary.byDay.map((day) => {
              if (day.isFuture) {
                return (
                  <div
                    key={day.date}
                    className="week-day-row week-day-row-future"
                    role="listitem"
                    aria-label={`${day.dayLabel}, future day with nothing logged`}
                  >
                    <span className="week-day-label">{day.dayLabel}</span>
                    <div className="week-day-bar-track week-day-bar-track-future" />
                    <span className="week-day-time">—</span>
                  </div>
                );
              }

              return (
                <button
                  key={day.date}
                  type="button"
                  className="week-day-row-btn"
                  onClick={() => setSelectedDayForSheet(day)}
                  aria-label={`${day.dayLabel}: logged ${formatHoursMinutes(day.loggedMinutes)}. Tap to view day breakdown.`}
                >
                  <span className="week-day-label">{day.dayLabel}</span>

                  <div className="week-day-bar-track">
                    {day.byCategory.map((cat, cIdx) => {
                      const segWidthPct = Math.min(100, (cat.minutes / 1440) * 100);
                      return (
                        <div
                          key={cIdx}
                          className="week-day-bar-seg"
                          style={{
                            width: `${segWidthPct}%`,
                            backgroundColor: cat.color,
                          }}
                        />
                      );
                    })}
                  </div>

                  <span className="week-day-time">
                    {formatHoursMinutes(day.loggedMinutes)}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* 6.7 Company kept */}
      {(loading || summary.loggedMs > 0) && !summary.isAllVacation && (
        <Card className="week-company-card">
          <div className="week-card-header">
            <h3 className="section-title">Company kept</h3>
          </div>

          <div className="week-company-list" role="list">
            {summary.people.map((p) => (
              <div key={p.name} className="week-company-row" role="listitem">
                <span className="week-company-name">{p.name}</span>
                <span className="week-company-time">{formatHoursMinutes(p.minutes)}</span>
              </div>
            ))}

            <div className="week-company-row week-company-alone-row" role="listitem">
              <span className="week-company-name">Alone</span>
              <span className="week-company-time">{formatHoursMinutes(summary.aloneMinutes)}</span>
            </div>
          </div>

          <p className="week-company-note">
            Segments with multiple people count fully toward each person.
          </p>
        </Card>
      )}

      {/* 6.8 Unlogged stretches */}
      {(loading || summary.loggedMs > 0) && summary.gaps.length > 0 && (
        <Card className="week-gaps-card">
          <button
            type="button"
            className="week-gaps-header-btn"
            onClick={() => setGapsExpanded(!gapsExpanded)}
            aria-expanded={gapsExpanded}
            aria-controls="week-gaps-list"
          >
            <h3 className="section-title week-gaps-title">
              Unlogged stretches ({summary.gaps.length},{' '}
              {formatHoursMinutes(summary.gaps.reduce((acc, g) => acc + g.minutes, 0))})
            </h3>
            <svg
              className={`week-gaps-chevron ${gapsExpanded ? 'week-gaps-chevron-open' : ''}`}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {gapsExpanded && (
            <div id="week-gaps-list" className="week-gaps-list" role="list">
              {summary.gaps.map((gap, gIdx) => (
                <div key={gIdx} className="week-gap-row" role="listitem">
                  <span className="week-gap-label">
                    {formatGapRange(gap.start, gap.end, timeZone)}
                  </span>
                  <span className="week-gap-time">{formatHoursMinutes(gap.minutes)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Day Detail Bottom Sheet */}
      <DayDetailSheet
        isOpen={Boolean(selectedDayForSheet)}
        day={selectedDayForSheet}
        onClose={() => setSelectedDayForSheet(null)}
      />

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
