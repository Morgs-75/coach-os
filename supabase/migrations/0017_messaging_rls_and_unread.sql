-- Messaging RLS policies (security fix: RLS was enabled but no policies existed)
-- Plus unread tracking for trainer sidebar badge

-- ============================================================
-- 1. RLS POLICIES FOR message_threads
-- ============================================================

-- Trainers can read threads in their org
CREATE POLICY "threads read by org members"
  ON public.message_threads FOR SELECT
  USING (public.is_org_member(org_id));

-- Trainers can create threads
CREATE POLICY "threads insert by trainer"
  ON public.message_threads FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

-- Trainers can update threads (for trainer_last_read_at)
CREATE POLICY "threads update by trainer"
  ON public.message_threads FOR UPDATE
  USING (public.org_role(org_id) IN ('owner', 'staff'))
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

-- Clients can read their own thread
CREATE POLICY "threads read by own client"
  ON public.message_threads FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- ============================================================
-- 2. RLS POLICIES FOR messages
-- ============================================================

-- Trainers can read messages in their org
CREATE POLICY "messages read by org members"
  ON public.messages FOR SELECT
  USING (public.is_org_member(org_id));

-- Trainers can send messages
CREATE POLICY "messages insert by trainer"
  ON public.messages FOR INSERT
  WITH CHECK (public.org_role(org_id) IN ('owner', 'staff'));

-- Clients can read messages in their thread
CREATE POLICY "messages read by own client"
  ON public.messages FOR SELECT
  USING (
    thread_id IN (
      SELECT mt.id FROM public.message_threads mt
      JOIN public.clients c ON c.id = mt.client_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- Clients can send messages in their thread
CREATE POLICY "messages insert by own client"
  ON public.messages FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT mt.id FROM public.message_threads mt
      JOIN public.clients c ON c.id = mt.client_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. FIX push_tokens INSERT POLICY
-- ============================================================

-- Drop the existing broken policy (uses client_invites join instead of auth_user_id)
DROP POLICY IF EXISTS "Clients can insert own tokens" ON public.push_tokens;

-- Clients can insert their own push tokens
CREATE POLICY "push_tokens insert by own client"
  ON public.push_tokens FOR INSERT
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- Clients can update their own push tokens
CREATE POLICY "push_tokens update by own client"
  ON public.push_tokens FOR UPDATE
  USING (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()))
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE auth_user_id = auth.uid()));

-- Trainers can read push tokens for their org (needed for push dispatch)
CREATE POLICY "push_tokens read by org members"
  ON public.push_tokens FOR SELECT
  USING (public.is_org_member(org_id));

-- ============================================================
-- 4. UNREAD TRACKING
-- ============================================================

-- Trainer's last read timestamp per thread
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS trainer_last_read_at timestamptz;

-- ============================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_messages_thread_sender_created
  ON public.messages (thread_id, sender_type, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON public.messages (thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_threads_org_id
  ON public.message_threads (org_id);
