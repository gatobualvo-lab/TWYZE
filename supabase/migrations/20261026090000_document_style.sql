/*
  # Document appearance

  Lets each business choose how its invoices, quotations and receipts look:
  brand colour, header/table style, font, paper size, custom headings and
  whether the logo, tax ids and signature/stamp are shown.

  Stored as one small JSON object on the existing business_settings row, so the
  existing row-level security (a user can only read/change their own row)
  already covers it. The check keeps it an object and stops it growing large.
*/

ALTER TABLE business_settings
  ADD COLUMN IF NOT EXISTS document_style jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE business_settings
  DROP CONSTRAINT IF EXISTS business_settings_document_style_check;

ALTER TABLE business_settings
  ADD CONSTRAINT business_settings_document_style_check
  CHECK (jsonb_typeof(document_style) = 'object' AND octet_length(document_style::text) <= 4000);
