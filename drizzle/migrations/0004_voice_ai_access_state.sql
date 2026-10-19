CREATE TABLE public.voice_ai_access_states (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 surface text NOT NULL CHECK (surface IN ('transcription','interpretation')),
 message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 UNIQUE(user_id, surface)
);
GRANT SELECT ON public.voice_ai_access_states TO authenticated;
GRANT ALL ON public.voice_ai_access_states TO service_role;
ALTER TABLE public.voice_ai_access_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_access_read ON public.voice_ai_access_states FOR SELECT TO authenticated USING (user_id = auth.uid());