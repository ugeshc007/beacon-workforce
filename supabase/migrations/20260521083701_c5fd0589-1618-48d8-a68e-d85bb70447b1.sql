
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key text PRIMARY KEY,
  employee_id uuid,
  action text,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON public.idempotency_keys(created_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only service role writes/reads; no client access needed
CREATE POLICY "Admins can view idempotency keys"
ON public.idempotency_keys FOR SELECT
USING (public.is_admin());

-- Cleanup function: delete keys older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_idempotency_keys()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.idempotency_keys WHERE created_at < now() - interval '7 days';
$$;
