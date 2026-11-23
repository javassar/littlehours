# SPEC-3.9: Week in Review

This spec adds a "Week in Review" screen to Little Hours. It follows the same conventions as SPEC-3.6 through SPEC-3.8: staged milestones, each with acceptance criteria, built one at a time.

## 1. Purpose

The screen answers two questions for one calendar week:

1. How many hours did I work? (Jackie reports this to her workplace every Monday, so the number has to be exact and easy to copy.)
2. Where did the rest of the week go, and what would I change next week? (Useful to any user who wants to look at their habits.)

Everything on the screen is calculated from data the app already stores. No new logging steps are added.

## 2. Instructions for Antigravity

- Before writing code, read `README.md`, `AGENTS.md`, `spec.md`, every `SPEC-*.md` in the repo root, the files in `supabase/`, and the styles and components in `src/`. This spec describes things in plain terms (for example "the segment's category"). Find the real table, column, type, and component names in the repo and use those. Do not invent new names for things that already exist.
- Reuse the existing design tokens, fonts, bottom sheet, framed card, pill chip, and header components. Do not add new colors, fonts, or UI libraries. Charts are built from CSS and inline SVG, with no charting library.
- Do not add any dependency without telling Jackie first. None should be needed. If the repo already has a date library, use it. If it does not, use `Intl.DateTimeFormat` with the user's timezone.
- Work through the milestones in order (4.1, 4.2, and so on). Finish and verify one before starting the next.
- At the end of each milestone: run `npm test` and `npm run build`, fix any failures, then give Jackie a plain-language summary of what changed and the manual checks from the "Check it on your phone" list for that milestone.
- Work freely. Ask Jackie only before making a git commit and before deleting any file.
- Match the repo's existing test style. New tests go in `test/` and follow the naming used by the earlier milestones (for example `test/milestone-4-1.test.mjs`).

## 3. Key decisions and why

| Decision | Reason |
| --- | --- |
| Weeks run Monday 00:00 to the next Monday 00:00 in the user's timezone | Jackie reports on Mondays, so a Monday-to-Sunday week matches the report. |
| The screen opens on the current week, except on Mondays, when it opens on the week that just ended | Monday is the reporting moment. Other days, the person most likely wants to see the week in progress. |
| Totals are computed by plain code, with no LLM call | The hours go to an employer, so they must be exact and repeatable. It also costs nothing and works without sending data anywhere. |
| Only the "work" category counts as work hours by default, and the person can change which categories count | Jackie has separate categories for job search, networking, and professional development, which her workplace probably does not count. Other people will define work differently. |
| Unlogged time is shown as a coverage line and a list of gaps, never as a category row | Jackie decided earlier that she dislikes an "unaccounted" row. A gap list is separate from the breakdown and tells her where to go back and fill something in before she reports. |
| Vacation time is removed from percentage calculations and shown on its own | This matches the existing decision for month-end analysis. |
| Percentages and comparisons use logged time as the base, not 168 hours | Someone who logged 120 of 168 hours still gets meaningful shares, and the coverage line explains the missing time. |
| No scores, streaks, or "good" and "bad" labels | Version 1 of the app left out goals and gamification. The screen describes the week and leaves the judgment to the person. |
| Pain ratings are not read or shown on this screen | They are health data and the README promises they never leave the client. The week screen does not touch them. |

## 4. Definitions

- **Week**: Monday 00:00 (inclusive) to the following Monday 00:00 (exclusive), in the timezone saved in the user's settings. A week can be 167, 168, or 169 hours long when daylight saving time changes. Compute the boundaries with the timezone, not by adding 168 hours.
- **Segment**: one parsed slice of time with a start, end, category, activity label, and company (people) tags. All totals come from segments, clipped to the week. A segment that crosses a week boundary only counts the part inside the week.
- **Logged time**: the sum of all segment time inside the week, including vacation.
- **Vacation time**: segments whose category is vacation, or whose parent entry has the vacation flag.
- **Counted time**: logged time minus vacation time. This is the base for every percentage.
- **Work categories**: the list of categories whose time counts as "hours worked". Default is `work`. Stored in settings (see section 5).
- **Coverage**: logged time compared with the time the week offers. For a finished week, that is the full week length. For the current week, it runs from Monday 00:00 to now.
- **Gap**: a stretch of at least 15 minutes inside the week (and before now, for the current week) that no segment covers. Keep the 15 minute value in one named constant (`MIN_GAP_MINUTES`).

## 5. Data

### Reads

- Fetch segments, and the status and vacation flag of their parent entries, for two weeks at once: the selected week and the week before it (for comparison). Fetch only the columns needed.
- Supabase returns at most 1000 rows per request by default. Page through results using `.range()` until a page comes back shorter than the page size, so a heavy logging fortnight is never cut off.
- Fetch entries that overlap the selected week and have a status of `pending`, `needs_clarification`, or `failed`. These feed the data quality notice.
- Read the user's timezone, category definitions (including each category's color, if one is stored), and the new work-categories setting from settings.
- One lightweight query finds the earliest entry date, so the previous-week arrow can stop at the first week that has data.

### Writes

**A. New setting for which categories count as work.** Check how `settings` is stored. If it is one row per user with columns, add a column like this (adjust to match the repo):

```sql
alter table settings
  add column if not exists work_report_categories text[] not null default '{work}';
```

If settings are stored as a JSON blob, add a `work_report_categories` key with the default `["work"]`. Put the change in a new file in `supabase/` following the repo's migration conventions. RLS already covers the settings table.

**B. Weekly note table (Milestone 4.6 only).**

```sql
create table if not exists week_notes (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table week_notes enable row level security;
create policy "own week notes" on week_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Because of `on delete cascade`, the existing demo cleanup job removes these notes when it deletes expired anonymous users.

### Calculation module

Put all the math in one file of pure functions (no network calls, no React), for example `src/lib/weekSummary.ts`. The screen only displays what this module returns.

```ts
computeWeekSummary({
  segments, entries, settings, weekStart, now, previousSegments
}) => {
  weekStart, weekEnd, isCurrentWeek,
  loggedMs, vacationMs, countedMs, coverage,
  work: { totalMinutes, perDay: [7 numbers], categoriesUsed: [...] },
  byCategory: [{ category, color, minutes, shareOfCounted }],
  byDay: [{ date, loggedMinutes, byCategory: [...] }],
  people: [{ name, minutes }], aloneMinutes,
  gaps: [{ start, end, minutes }],
  comparison: { available, deltas: [{ category, deltaMinutes }], workDeltaMinutes },
  quality: { unconfirmedSegments, entriesNeedingAttention, unsyncedChanges }
}
```

Rounding rules, chosen so that the numbers Jackie sends add up when someone checks them:

- Do all arithmetic in milliseconds.
- Round each day's work time to the nearest minute. The week's work total is the sum of those rounded days.
- Each category total in the breakdown is rounded to the nearest minute on its own. A one minute difference between the category list and the grand total is acceptable.
- Percentages are shown as whole numbers.

## 6. Screen layout

New route and a fourth bottom navigation tab labeled **Week**, placed between Log and History. The icon is a thin line drawing (a small calendar or a ribbon) with the same stroke weight as the existing icons. Check that four items fit the pill on a small iPhone and widen the pill slightly if needed, keeping the safe-area spacing.

The screen uses the standard header ("Week in Review" in the same serif as "Little Hours", with the lace edge beneath). In demo mode the lavender "Demo with sample data" banner stays at the top, like on the other screens.

Sections appear in this order.

### 6.1 Week selector

A row with a left arrow, the label, and a right arrow. The label shows the date range ("Nov 16 to Nov 22") with a small line under it: "This week so far", "Last week", or nothing for older weeks. The right arrow is disabled on the current week. The left arrow is disabled at the earliest week with data.

### 6.2 Hours worked (hero card)

- Uses the framed card with corner ornaments, since this is the main card.
- The big number is the week's work total in the serif with the old-style numerals used elsewhere, for example `37h 45m`. Tapping the number switches between `37h 45m` and `37.75 hours`. The chosen format is remembered in `localStorage`.
- Under the number, seven small vertical bars (Mon to Sun) with the day initial below and that day's work time under that. Bar height is proportional to the longest work day of the week.
- Small text line: "Counting: work" (listing the selected work categories). It links to the setting that changes them.
- A filled pill button, **Copy for my report**. It copies this text, using the format currently shown:

```
Week of Nov 16 to Nov 22
Hours worked: 37h 45m
Mon 8h 0m
Tue 7h 30m
Wed 8h 15m
Thu 7h 0m
Fri 7h 0m
Sat 0h 0m
Sun 0h 0m
```

Use `navigator.clipboard.writeText`, with a fallback for browsers that block it. Confirm with a short in-theme message ("Copied") that disappears after two seconds.

- For the current week, the card label reads "Hours worked so far".
- If the week has zero work time but has logged time, show `0h 0m` and the line "Nothing logged in the work categories this week."

### 6.3 Data quality notice

Shown directly under the hero card only when something may change the totals. It is a soft pink-tinted card with one sentence and one button. Examples:

- "2 entries are still waiting to be sorted. Totals may change." Button: **Open History**.
- "1 change has not synced yet." No button.
- "4 segments are unchecked." Button: **Open History**. Unchecked segments are included in totals. The notice only tells the person.

If more than one condition applies, combine them into one card with one line each. When none apply, show nothing.

### 6.4 Where the hours went

- Horizontal bars, one row per category, sorted by time descending. Each row shows the category name (with its colored dot as in the settings chips), the time, and the share of counted time.
- Show the top 8 categories. A **Show all** text button expands the rest.
- Vacation appears once at the bottom as its own line ("Vacation: 12h 0m") with no bar and no share.
- Below the list, the coverage line: "Logged 151h 30m of 168h." For the current week: "Logged 61h 10m of 64h 20m so far."

### 6.5 Against last week

- For the five categories with the largest absolute change, show the category and the difference, such as "social time +2h 10m" or "doomscrolling -1h 30m". Also show the change in hours worked as its own first line.
- Show this section only when last week has at least 24 hours of logged time (`MIN_COMPARISON_HOURS`, one named constant). Otherwise show: "Last week has too little data to compare."
- The first week with any data never shows the comparison.
- The text is neutral. No colors that mean good or bad, no arrows that imply progress.

### 6.6 Day by day

- Seven rows, Monday to Sunday. Each row has the day label ("Mon 16"), the logged time, and one thin horizontal stacked bar colored by category. A full-width bar equals 24 hours, so days are comparable.
- Tapping a row opens the existing bottom sheet component (drag handle and close button, like the pain rating guide). The sheet title is the full date and it lists that day's category totals.
- Future days of the current week are shown dimmed with no bar.

### 6.7 Company kept

- Top 5 people by time, then an "Alone" row (time with no one tagged).
- Use the same canonical names as the existing people management screen, so merged or renamed spellings are counted together. Match names ignoring case and extra spaces.
- A segment with two tagged people counts fully toward each person, so these numbers can add up to more than the week. Add one line of small text explaining that.
- Vacation time is left out of this section, matching the percentages.

### 6.8 Unlogged stretches

- A collapsed section titled "Unlogged stretches (3, 2h 45m)" listing each gap as "Tue 2:10 PM to 4:45 PM".
- Hidden when there are no gaps.
- If the Log screen can already open with a chosen time window (check how "Since 1:39 AM" and the edit window sheet work), tapping a gap opens the Log screen with that window. If it cannot, show gaps as plain text. Do not rebuild the Log screen for this.

### 6.9 Empty state

When the selected week has no segments, show the existing swan illustration and one line: "Nothing logged this week yet." Keep the week selector visible so the person can navigate away.

## 7. Visual design

The screen has to look like the rest of the app. Read the existing CSS for the exact token names. From the current screenshots:

- Blush background, dusty rose for primary buttons, lavender for the demo banner, soft rose borders.
- Headings in Cormorant Garamond, body text in Lora, old-style numerals for times.
- Cards have rounded corners and a soft shadow. Only the hero card gets the double-line frame and corner ornaments, so the screen does not become heavy.
- Pills and chips follow the settings screen: a small colored dot and a lowercase label.
- Buttons follow the existing two types: filled rose for the main action, outlined for secondary actions.
- Category bars use each category's stored color. If a category has no color, cycle through the existing palette tokens. Do not introduce new hues.
- Spacing and card padding match the History screen.

Accessibility:

- Every bar has a visible text value beside it. Color is never the only way to read a value.
- Each chart container has an `aria-label` summarizing it (for example "Hours worked per day, total 37 hours 45 minutes").
- Tap targets are at least 44 by 44 pixels.
- Respect `prefers-reduced-motion`. Bars may animate in on load otherwise, with a short ease.

## 8. Edge cases

- Segments crossing Monday 00:00 or the following Monday 00:00 are clipped to the week.
- A week containing a daylight saving change has 167 or 169 hours. Day boundaries come from the timezone.
- If two segments overlap because of a data problem, count each overlapping minute once and write a warning to the console.
- Entries with status `pending` or `failed` have no segments yet. Their time is not counted. It appears as a gap, and the data quality notice mentions them.
- If every logged hour in the week is vacation, show the hero as `0h 0m`, show "This week was vacation" under the breakdown heading, and skip the comparison and company sections.
- If a category named in the work categories setting no longer exists (renamed or deleted), ignore it in the math and show a small line on the hero card: "Some work categories no longer exist. Check Settings."
- Timezone comes from settings. If settings have no timezone, use the device timezone.
- Offline: show the last data loaded for that week if the app already keeps it, otherwise a short message: "Connect to the internet to load this week."
- Demo mode works with the sandbox's anonymous user. Nothing on this screen calls an external API.

## 9. Milestones

### Milestone 4.1: Calculations and data loading

Build:
- The work-categories setting and its migration.
- The pure calculation module and the paged data fetch for two weeks.
- The unit tests listed in section 10.

Acceptance:
- [ ] All tests in section 10 pass with `npm test`.
- [ ] `npm run build` succeeds.
- [ ] No UI changes yet.

### Milestone 4.2: Screen, navigation, and hours worked

Build:
- The fourth tab and route, header, demo banner, and week selector (6.1).
- The empty state (6.9).
- The hero card (6.2), including the format toggle and Copy for my report.
- A Settings row, "Hours I report to my workplace", that opens a multi-select of categories. It reads and writes the setting from 4.1.

Acceptance:
- [ ] The Week tab appears and the nav fits on a 375px wide screen.
- [ ] On a Monday the screen opens on the previous week. On other days it opens on the current week.
- [ ] The hours worked total matches the sum of `work` segments in History for the same week.
- [ ] Copy for my report puts the text from section 6.2 on the clipboard.
- [ ] Changing the work categories in Settings changes the hero number.

Check it on your phone:
- Open the installed app, tap Week, and compare the number with what you expect from History.
- Tap Copy for my report and paste into Notes.
- In Settings, add "job search" to the work categories and watch the number go up.

### Milestone 4.3: Breakdown and day by day

Build: sections 6.4 and 6.6, including the bottom sheet.

Acceptance:
- [ ] Category rows are sorted by time and use each category's stored color.
- [ ] Shares are calculated from counted time, and vacation is listed separately.
- [ ] The coverage line is correct for a finished week and for the current week.
- [ ] Tapping a day opens the sheet with that day's category totals.
- [ ] Nothing runs off the right edge on an iPhone (the Edit Entry sheet had this problem before, so test this one).

### Milestone 4.4: Comparison, company, gaps, and quality notice

Build: sections 6.3, 6.5, 6.7, and 6.8.

Acceptance:
- [ ] The comparison hides itself when last week has under 24 logged hours.
- [ ] Merging two spellings of a person's name in Settings merges them here too.
- [ ] Gaps of 15 minutes or more appear, and shorter gaps do not.
- [ ] The notice appears when an entry has `needs_clarification` status and disappears after it is resolved.

### Milestone 4.5: Demo data, polish, and README

Build:
- Extend the demo seed data from 7 days to 14 days, with `work` segments on weekdays, so the demo shows a full week and a comparison. The existing 7-day sandbox purge stays as it is.
- An accessibility pass using the checklist in section 7.
- Add a Week in Review screenshot entry and a short architecture note to `README.md`. The note says that weekly totals are computed by deterministic code with no LLM call. Jackie will take the screenshot herself and put it in `docs/screenshots/`.

Acceptance:
- [ ] The demo sandbox shows a populated Week in Review with a comparison section.
- [ ] `scripts/test-demo.ts` still passes.
- [ ] The README mentions the new screen.

### Milestone 4.6 (optional): Note for next week

Build:
- The `week_notes` table from section 5.
- At the bottom of the screen, a card titled "For next week" with a short text box labeled "One thing I want to change". The note saves to the selected week when the text box loses focus, with a small "Saved" confirmation.
- When the selected week has a note from the week before, show it at the top of the screen in a small card: "Last week you wrote:" followed by the note.
- Use the existing offline mutation queue for the write if the other tables go through it. If not, disable the box while offline.

Acceptance:
- [ ] A note saved on one week appears at the top of the following week.
- [ ] Another user cannot read the note (RLS check, in the same style as the demo isolation tests).
- [ ] Deleting an anonymous demo user also deletes its notes.

## 10. Tests

Write unit tests for `computeWeekSummary` covering:

1. A segment fully inside the week is counted exactly.
2. A segment that crosses the end of Sunday into the next week is clipped, and only the part inside the week counts.
3. A segment that crosses Monday 00:00 from the previous week is clipped the same way.
4. Vacation segments are excluded from counted time and reported separately, and they do not add to work time.
5. Several work categories selected: all of them add into the work total.
6. Day-level rounding: day totals are rounded first, and the week total equals the sum of rounded days.
7. Timezone handling for `America/Phoenix` (no daylight saving), `America/New_York`, and the daylight saving week of Oct 26 to Nov 1, 2026 in `America/New_York`, which is 169 hours long.
8. Gap detection: a 14 minute gap is ignored, a 15 minute gap is reported, and the current week stops at `now`.
9. People: two tags on one segment each get the full duration, and segments with no tags count as alone. Names match ignoring case.
10. Comparison is unavailable when the previous week has under 24 logged hours.
11. An empty week returns zeros and no errors.
12. Overlapping segments count each minute once.
13. Percentages use counted time, and a week of only vacation does not divide by zero.

## 11. Out of scope for this spec

- AI-written weekly summaries. They would add cost, send personal data to an external service, and are unnecessary for a first version.
- A Monday-morning push notification saying the week is ready. Worth adding later using the existing push reminder system.
- Charts for time of day, trends across many weeks, or month views. The month-end analysis is a separate piece of work.
- Pain rating summaries on this screen.
- Exporting the week as CSV. The existing export covers the underlying data.
- Goals, streaks, scores, or any judgment of how the week went.
