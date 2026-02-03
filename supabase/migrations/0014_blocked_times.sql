-- Blocked times table - for blocking out unavailable times
-- All hours are available by default, PTs block out times they don't want
CREATE TABLE blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  date date, -- For specific date blocks (NULL for recurring)
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6), -- For recurring weekly blocks (0=Sunday)
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text, -- Optional reason for blocking
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_block_type CHECK (
    (date IS NOT NULL AND day_of_week IS NULL) OR
    (date IS NULL AND day_of_week IS NOT NULL)
  )
);

CREATE INDEX idx_blocked_times_org ON blocked_times(org_id);
CREATE INDEX idx_blocked_times_date ON blocked_times(org_id, date);
CREATE INDEX idx_blocked_times_day ON blocked_times(org_id, day_of_week);

ALTER TABLE blocked_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view blocked times for their org"
  ON blocked_times FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert blocked times for their org"
  ON blocked_times FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update blocked times for their org"
  ON blocked_times FOR UPDATE
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete blocked times for their org"
  ON blocked_times FOR DELETE
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
