# Milestone 3.7: Hourly pain rating (1 to 5)

This file extends `SPEC.md` and `SPEC-3.6.md`. Milestones 1.1 to 3.6 are finished. Do not edit `SPEC.md` or `SPEC-3.6.md`. Build only milestone 3.7 from this file, and follow the standing rules in `AGENTS.md`.

Before writing any code, read `SPEC.md`, `SPEC-3.6.md`, and the current code for the Log screen, History, the offline queue, the export, and the reminder sender. Where the existing code differs from the specs, follow the code and mention the difference in your summary. Where this file conflicts with an earlier spec, this file wins.

## Goal

Let me rate my pain from 1 to 5 each time I log, or on its own, in one tap. The ratings are saved as a time series so that at the end of the month I can analyze trends in my pain and how it relates to how I spent my time.

## Design decisions

These are settled. Do not change them without telling me.

1. **A rating describes my average pain over the 60 minutes ending at `rated_at`.** It matches the hourly question I answer when I log, so each rating compares directly with what I did in that same hour. By default `rated_at` is the time of the save. The rated hour is independent of the entry window, so a rating saved with an entry can cover a different stretch than the entry does.
2. **Ratings live in their own table**, linked to an entry when I save them together. A rating can also be saved alone, with no text. This lets me rate every hour even when I do not log every hour.
3. **A rating never changes the entry window.** Saving a rating alone does not move the default start time of my next entry.
4. **The rating is optional, with no default.** No button is preselected, and the previous rating is never prefilled or shown beside the buttons. Seeing the last value can bias the next one.
5. **Pain data never goes to the AI parser.** The `parse-entry` function does not receive ratings. Pain is health data, and the parser's input stays limited to the entry text.
6. **The scale anchors are fixed for the month.** Changing the wording of the anchors midway would make the early and late ratings incomparable.

## Step 1: Database migration

Write a migration in `supabase/migrations/` and tell me how to apply it. Show me the migration before running it.

```sql
create table pain_ratings (
  id uuid primary key,                         -- generated on the phone so offline retries never duplicate
  user_id uuid not null default auth.uid() references auth.users(id),
  entry_id uuid references entries(id) on delete set null,   -- kept if the entry is deleted
  rating smallint not null check (rating between 1 and 5),
  rated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pain_ratings_rated_at_idx on pain_ratings (rated_at desc);

alter table pain_ratings enable row level security;
create policy "own ratings" on pain_ratings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Deleting an entry keeps its rating, because the rating is valuable on its own.

## Step 2: The scale and its guide

1. Create `src/lib/painScale.ts` as the single source for the five anchors. Use these placeholder anchors. I will replace the wording with my own before I start collecting data, and every screen must read from this file. Each anchor describes the hour as a whole.

| Rating | Word | Meaning, averaged over the past hour |
| --- | --- | --- |
| 1 | none or very mild | Barely there, easy to ignore. |
| 2 | mild | Noticeable, does not limit what I do. |
| 3 | moderate | Hard to ignore, limits some activities. |
| 4 | severe | Limits most activities and my concentration. |
| 5 | very severe | I cannot do my normal activities. |

2. Add a small "?" icon beside the rating row. Tapping it opens a bottom sheet titled "Average pain over the past hour" that lists all five ratings with their word and meaning, in the style of the other sheets.

## Step 3: The rating control

Build a `PainRating` component and add it to the `/design` page.

1. A row of five round buttons labeled 1 to 5, each at least 48 px across, evenly spaced, with the label "Average pain, past hour" above in Cormorant italic and the "?" icon at the end of the label line.
2. Unselected: `--surface` fill with a 1.5 px `--rose-deep` outline and the number in `--ink`. Selected: `--mauve` fill with the number in `--surface`. Numbers are Cormorant Garamond, weight 600, 20 px.
3. When a rating is selected, show its word (such as "moderate") in small Lora italic under the row. When nothing is selected, show nothing there.
4. Tapping the selected button again clears the rating.
5. Accessibility: the row is a `radiogroup`, each button is a `radio` with an `aria-label` such as "3, moderate", and the left and right arrow keys move the selection. The gold focus ring applies.
6. Use only the colors and fonts in the Design section of `SPEC.md`. Do not add a color ramp, because color must not be the only signal of the rating.

## Step 4: Saving from the Log screen

1. Place the `PainRating` row on the Log screen directly under the text box and above the Save button.
2. The Save button is enabled when the text box has text, or a rating is selected, or both.
3. The Save button reads "Save" when there is text, and "Save rating" when there is only a rating.
4. When I save text and a rating together, create the entry and the rating in one action. The rating's `entry_id` is the new entry's ID, and its `rated_at` is the time of the save, which is the end of the hour being rated.
5. When I save only a rating, create the rating alone, with `entry_id` empty. Do not change the next entry's default start time. Show the "Saved" toast and the sparkle burst as usual, and keep the text box and its draft untouched.
6. After saving, clear the rating selection. The next save starts with nothing selected.
7. `rated_at` can be edited. When a rating is selected, the pencil sheet from Milestone 1.3 shows an extra "Hour ends at" field (a `datetime-local` input) that defaults to now and sets the end of the 60-minute hour I am rating. Show the hour it covers under the field, for example "Rates 2:00 to 3:00 PM". This lets me rate a past hour I forgot to rate on time. Validate that it is not in the future and not more than 24 hours in the past.
8. Generate rating IDs on the phone with `crypto.randomUUID()`, as for entries. Disable the Save button while a save is in progress, so a double tap creates one rating.

## Step 5: Offline

1. When the network is off, queue the rating in IndexedDB with its ID, alongside its entry if there is one. A rating-only save is queued by itself.
2. On sync, insert the entry first and the rating second, because the rating references the entry. Use upserts on the ID so retries never duplicate.
3. Queued ratings show the same "Waiting to sync" badge as queued entries.

## Step 6: History

1. Show a rating on an entry's card as a small pill at the end of the time-range line, in the form "Pain 3", using `--mauve` text and a thin `--rose-deep` border, with no color coding.
2. A rating saved alone appears in the day list as its own compact card at its `rated_at` time: a small row with the hour it covers (such as "2 to 3 PM"), "Pain 3", and the word. Use the same card frame, but visibly smaller than an entry card.
3. Tapping a rating opens an edit sheet with the `PainRating` control and the "Hour ends at" field. Include a Delete button with the confirmation "Delete this rating?".
4. Editing an entry's rating works from the entry's edit sheet. If an entry has a rating, the sheet shows the control with the current value selected. Clearing the selection removes the rating, after the same confirmation.
5. History days with ratings show a small count, such as "6 ratings", beside the day heading.

## Step 7: Reminders

1. Change the notification body from "Tell me how you spent the past hour." to "Tell me how you spent the past hour, and rate your pain." Keep the title and the tag unchanged.
2. The skip rule from Milestone 3.5 skips a reminder when I logged within the last 30 minutes. Extend it so that a rating counts as a log. A reminder is skipped when the latest entry end time or the latest rating time is within the last 30 minutes.
3. Log the skip reason, as before.

## Step 8: Export for analysis

1. Add "Export pain ratings (CSV)" and "Export pain ratings (JSON)" buttons to the export area in Settings. They use the same optional date range as the other exports.
2. Each row is one rating. Write the join in `src/lib/export.ts` in TypeScript, not in the database, and describe it in the README.

| Column | Meaning |
| --- | --- |
| `id` | Rating ID |
| `rated_at` | End of the hour being rated, ISO 8601 with the UTC offset |
| `local_rated_at` | The same time in my time zone |
| `hour_start` | `rated_at` minus 60 minutes, ISO 8601 with the UTC offset |
| `rating` | Average pain over the hour, 1 to 5 |
| `entered_at` | When I actually saved the rating (`created_at`), so the delay after `rated_at` can be computed |
| `minutes_since_previous_rating` | Minutes between the previous rating's `rated_at` and this one, empty for the first. A value under 60 means the two rated hours overlap |
| `entry_id` | The linked entry, empty for rating-only saves |
| `segment_category` | Category of the segment that contains `rated_at`, the last moment of the rated hour, empty if none |
| `segment_label` | Activity label of that segment |
| `segment_company` | People in that segment, joined with semicolons in CSV, an array in JSON |
| `on_vacation` | True if the containing segment's entry has `on_vacation` set |
| `prior_60_min_by_category` | JSON object of minutes per category in the 60 minutes before `rated_at`. This is the same hour the rating describes, so it is the main comparison |
| `prior_180_min_by_category` | The same for the 180 minutes before |
| `prior_1440_min_by_category` | The same for the 24 hours before |
| `prior_60_unlogged_min` | Minutes in the 60 before that no segment covers |
| `prior_180_unlogged_min` | The same for 180 |
| `prior_1440_unlogged_min` | The same for 1440 |

3. A segment contains `rated_at` when `start_time <= rated_at < end_time`.
4. For each lookback window `[rated_at - N minutes, rated_at]`, add up each category's overlapping minutes across all segments, clipping segments at the window edges. Unlogged minutes are `N` minus the total covered minutes.
5. Only segments from parsed entries count. Entries still pending or failed contribute nothing, and their time counts as unlogged.
6. Write a short test for the overlap calculation with these cases: a segment fully inside the window, a segment cut by the window start, a segment that straddles `rated_at`, and a window with a gap.

## Step 9: Privacy check

1. Confirm that `parse-entry` and every other function that calls the Gemini API never reads `pain_ratings`. Report the files you checked.
2. The ratings export is created in the browser from my own data and sent nowhere.

## Check

- [ ] The migration applies cleanly and existing entries, segments, and exports still work.
- [ ] The rating row shows five buttons with no preselection, and the "?" sheet lists all five anchors from `painScale.ts`.
- [ ] Saving text with a rating creates one entry and one linked rating. Saving a rating alone creates only a rating, and the next entry's default start time is unchanged.
- [ ] Tapping the selected number clears it, and the arrow keys move the selection.
- [ ] Saving with an empty text box and no rating is not possible.
- [ ] With the network off, a rating-only save and a text-plus-rating save both appear once, in the right order, after the network returns.
- [ ] History shows "Pain 3" on an entry card and shows rating-only saves as compact cards at the right time. Editing and deleting a rating works.
- [ ] Deleting an entry leaves its rating in place, shown as a rating-only card.
- [ ] A rating at 2:40 PM suppresses the 3:00 PM reminder, and the 4:00 PM reminder arrives normally.
- [ ] The ratings export for a day with known entries matches a hand calculation for at least two rows, including the prior-window minutes and unlogged minutes.
- [ ] The overlap tests pass.
- [ ] Saving a rating at 2:20 PM with "Hour ends at" set to 2:00 PM exports `hour_start` of 1:00 PM and prior-window columns that cover 1:00 to 2:00 PM.
- [ ] Two ratings saved 30 minutes apart show `minutes_since_previous_rating` of 30 on the second.
- [ ] No file that calls the Gemini API reads pain ratings.
- [ ] Only colors, fonts, and components from the Design section of `SPEC.md` are used.

## Notes for month-end analysis (not built in this milestone)

These notes are for when I analyze the exported data. The app builds none of this.

- A 1 to 5 rating is an ordinal scale. Medians, proportions in each rating, and rank-based or ordinal methods fit it better than means.
- Each rating describes the hour ending at `rated_at`, so the `prior_60` columns are the same-hour comparison. The 180 and 1440 columns support lagged analysis, such as pain this hour against activity over the previous three hours or the previous day.
- People tend to rate an hour by how they feel now. Ratings entered long after `rated_at` (compare `entered_at`) are less reliable and may be worth flagging or dropping.
- Two ratings less than 60 minutes apart describe overlapping hours. `minutes_since_previous_rating` identifies them, and they can be analyzed together or reduced to one.
- Rows with a large `unlogged` value have incomplete activity data and may need to be dropped or flagged.
- Vacation rows can be analyzed separately, since vacation hours are removed from the activity denominators.
- Time of day, sleep in the prior 24 hours, and day of week can confound the relationships, so they are worth including as covariates.

## Notes

- Show me the migration before running it, and ask before running it.
- Propose one git commit message at the end, such as "Milestone 3.7: hourly pain rating", and wait for my yes.
- Update `README.md` with the new table, the export columns, and the export join.
