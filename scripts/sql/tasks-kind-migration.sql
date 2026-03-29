BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS "orderSnapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "folderChecklist" jsonb;

ALTER TABLE public.tasks
  ALTER COLUMN kind SET DEFAULT 'general';

UPDATE public.tasks
SET kind = CASE
  WHEN "orderId" IS NOT NULL THEN 'order'
  WHEN "folderId" IS NOT NULL THEN 'folder'
  ELSE 'general'
END
WHERE kind IS NULL;

ALTER TABLE public.tasks
  ALTER COLUMN kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_kind_check'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_kind_check
      CHECK (kind IN ('general', 'order', 'folder'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
