/*
# Fix Document Numbering System - Atomic Number Generator

## Problem
Document creation fails with "Business settings not found" and "Failed to generate document number"
because:
1. No business_settings row exists for the user
2. The frontend generates numbers non-atomically (read then update separately)
3. No unique constraint prevents duplicate document numbers

## Changes

1. Add unique constraint on documents(user_id, document_type, document_number)
   - Prevents duplicate document numbers for the same user and type

2. Create function: generate_document_number(p_document_type text, p_user_id uuid)
   - Validates document type (quotation, invoice, receipt)
   - Auto-creates business_settings row if missing (with defaults)
   - Locks the settings row with FOR UPDATE to prevent race conditions
   - Reads the correct prefix and next-number
   - Formats number with 6-digit padding (e.g. QT-000001)
   - Atomically increments the counter
   - Returns the generated number

3. Security
   - Function uses SECURITY INVOKER (runs as calling user)
   - Explicit search_path for safety
*/

-- 1. Add unique constraint on documents to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'documents_user_type_number_unique'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_user_type_number_unique
      UNIQUE (user_id, document_type, document_number);
  END IF;
END $$;

-- 2. Create the atomic document number generator function
CREATE OR REPLACE FUNCTION generate_document_number(
  p_document_type text,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next_number bigint;
  v_result text;
  v_settings_id uuid;
BEGIN
  -- Validate document type
  IF p_document_type NOT IN ('quotation', 'invoice', 'receipt') THEN
    RAISE EXCEPTION 'Invalid document type: %. Must be quotation, invoice, or receipt.', p_document_type;
  END IF;

  -- Validate user
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Find or create business settings for this user
  SELECT id INTO v_settings_id
  FROM business_settings
  WHERE user_id = p_user_id;

  IF v_settings_id IS NULL THEN
    INSERT INTO business_settings (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id INTO v_settings_id;

    -- If ON CONFLICT hit, fetch the id
    IF v_settings_id IS NULL THEN
      SELECT id INTO v_settings_id
      FROM business_settings
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  -- Lock the row and read prefix + next number atomically
  IF p_document_type = 'quotation' THEN
    SELECT quotation_prefix, quotation_next_number
    INTO v_prefix, v_next_number
    FROM business_settings
    WHERE id = v_settings_id
    FOR UPDATE;

    UPDATE business_settings
    SET quotation_next_number = v_next_number + 1,
        updated_at = now()
    WHERE id = v_settings_id;

  ELSIF p_document_type = 'invoice' THEN
    SELECT invoice_prefix, invoice_next_number
    INTO v_prefix, v_next_number
    FROM business_settings
    WHERE id = v_settings_id
    FOR UPDATE;

    UPDATE business_settings
    SET invoice_next_number = v_next_number + 1,
        updated_at = now()
    WHERE id = v_settings_id;

  ELSIF p_document_type = 'receipt' THEN
    SELECT receipt_prefix, receipt_next_number
    INTO v_prefix, v_next_number
    FROM business_settings
    WHERE id = v_settings_id
    FOR UPDATE;

    UPDATE business_settings
    SET receipt_next_number = v_next_number + 1,
        updated_at = now()
    WHERE id = v_settings_id;
  END IF;

  -- Handle null prefix/number (shouldn't happen with defaults, but be safe)
  v_prefix := COALESCE(v_prefix, 
    CASE p_document_type
      WHEN 'quotation' THEN 'QT-'
      WHEN 'invoice' THEN 'INV-'
      WHEN 'receipt' THEN 'RCPT-'
    END
  );
  v_next_number := COALESCE(v_next_number, 1);

  -- Format: PREFIX + 6-digit padded number (prefix already includes dash from defaults)
  -- Strip trailing dash if present to normalize, then add dash
  v_prefix := rtrim(v_prefix, '-');
  v_result := v_prefix || '-' || lpad(v_next_number::text, 6, '0');

  RETURN v_result;
END;
$$;
