-- Add onboarding_completed flag to orgs table
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
