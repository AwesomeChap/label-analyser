-- Optional: OBB pipeline metadata (detection count and fallback flag) for display in the app.
-- Run in Supabase SQL Editor if you use the YOLO OBB pipeline and your table was created without these columns.
alter table public.label_analyses
  add column if not exists obb_detection_count integer,
  add column if not exists obb_fallback boolean;

comment on column public.label_analyses.obb_detection_count is 'When using YOLO OBB pipeline: number of label detections (null if Gemini-only pipeline).';
comment on column public.label_analyses.obb_fallback is 'When using YOLO OBB pipeline: true if 0 detections and full-image Gemini was used.';
