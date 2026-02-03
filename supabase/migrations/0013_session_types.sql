-- Session types table - configurable by org
CREATE TABLE session_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  duration_mins integer NOT NULL DEFAULT 60,
  price_cents integer,
  color text DEFAULT '#3B82F6', -- blue-500
  is_active boolean DEFAULT true,
  allow_online_booking boolean DEFAULT true,
  buffer_before_mins integer DEFAULT 0,
  buffer_after_mins integer DEFAULT 0,
  max_per_day integer,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id, slug)
);

-- Create index for fast lookups
CREATE INDEX idx_session_types_org ON session_types(org_id);
CREATE INDEX idx_session_types_active ON session_types(org_id, is_active);

-- Enable RLS
ALTER TABLE session_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view session types for their org"
  ON session_types FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage session types for their org"
  ON session_types FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Public policy for booking pages
CREATE POLICY "Public can view active session types"
  ON session_types FOR SELECT
  USING (is_active = true);

-- Platform admin policy
CREATE POLICY "Platform admins can manage all session types"
  ON session_types FOR ALL
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

-- Default session types function (called when creating new org)
CREATE OR REPLACE FUNCTION create_default_session_types(p_org_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO session_types (org_id, name, slug, duration_mins, price_cents, color, sort_order) VALUES
    (p_org_id, 'PT Session', 'pt_session', 60, 8000, '#3B82F6', 1),
    (p_org_id, '30 Min Session', 'short_session', 30, 5000, '#10B981', 2),
    (p_org_id, 'Assessment', 'assessment', 90, 0, '#8B5CF6', 3),
    (p_org_id, 'Consultation', 'consultation', 30, 0, '#F59E0B', 4),
    (p_org_id, 'Group Class', 'group_class', 60, 3000, '#EC4899', 5);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add session_type_id to bookings (optional, keeps backward compatibility with session_type string)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_type_id uuid REFERENCES session_types(id);
