-- Scanned Insights Repository
-- Stores AI-extracted business insights from Reddit and other sources

CREATE TABLE IF NOT EXISTS scanned_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- e.g., 'reddit/r/personaltraining'
  source_url TEXT NOT NULL UNIQUE, -- Prevent duplicate scans
  raw_content TEXT NOT NULL,
  extracted_insight TEXT NOT NULL,
  deep_analysis TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('acquisition', 'retention', 'pricing', 'marketing', 'operations', 'mindset', 'sales', 'scaling')),
  sub_category TEXT NOT NULL,
  actionable_takeaway TEXT NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  novelty_score INTEGER NOT NULL CHECK (novelty_score >= 0 AND novelty_score <= 100),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('anecdotal', 'data_backed', 'expert_opinion', 'case_study')),
  key_quotes JSONB, -- Important quotes from the source
  related_concepts JSONB, -- Connected business concepts
  potential_pitfalls JSONB, -- What could go wrong
  upvotes INTEGER,
  comments INTEGER,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_scanned_insights_category ON scanned_insights(category);
CREATE INDEX idx_scanned_insights_approved ON scanned_insights(approved);
CREATE INDEX idx_scanned_insights_scanned_at ON scanned_insights(scanned_at DESC);
CREATE INDEX idx_scanned_insights_confidence ON scanned_insights(confidence_score DESC);

-- Enable RLS
ALTER TABLE scanned_insights ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage insights
CREATE POLICY "Platform admins can manage insights"
  ON scanned_insights
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
    )
  );

-- All authenticated users can view approved insights
CREATE POLICY "Users can view approved insights"
  ON scanned_insights
  FOR SELECT
  TO authenticated
  USING (approved = true);

-- Add fields to inquiries table for services interested and follow-up
ALTER TABLE inquiries
ADD COLUMN IF NOT EXISTS services_interested TEXT[],
ADD COLUMN IF NOT EXISTS follow_up_date DATE;

-- Comment on table
COMMENT ON TABLE scanned_insights IS 'AI-scanned business insights from Reddit and other sources for PT coaching';

-- Generated Newsletters Table
CREATE TABLE IF NOT EXISTS generated_newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  preheader TEXT,
  theme TEXT NOT NULL,
  audience_level TEXT NOT NULL CHECK (audience_level IN ('beginner', 'intermediate', 'advanced', 'all')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  angle_used TEXT,
  sections JSONB NOT NULL,
  call_to_action JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
  sent_at TIMESTAMPTZ,
  sent_to_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_generated_newsletters_status ON generated_newsletters(status);
CREATE INDEX idx_generated_newsletters_generated_at ON generated_newsletters(generated_at DESC);
CREATE INDEX idx_generated_newsletters_theme ON generated_newsletters(theme);

-- Enable RLS
ALTER TABLE generated_newsletters ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage newsletters
CREATE POLICY "Platform admins can manage newsletters"
  ON generated_newsletters
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE generated_newsletters IS 'AI-generated newsletters for PT business coaching';
