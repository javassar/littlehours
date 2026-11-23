-- Milestone 4.1: Work report categories setting
-- Adds work_report_categories text[] on settings, defaulting to '{work}'

alter table public.settings
  add column if not exists work_report_categories text[] not null default '{work}';
