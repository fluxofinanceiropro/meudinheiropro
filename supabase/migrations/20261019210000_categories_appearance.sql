ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon text DEFAULT 'circle';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color text DEFAULT '#738094';
