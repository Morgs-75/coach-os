-- Add proforma disclaimer column to orgs table
-- This will store the disclaimer text that appears on proforma invoices

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS proforma_disclaimer text;

COMMENT ON COLUMN public.orgs.proforma_disclaimer IS 'Disclaimer text displayed on proforma invoices';
