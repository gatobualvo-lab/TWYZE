/*
  # Discounts typed as money on document lines

  A line's discount can now be keyed in either as a percentage (as before) or as a
  money figure for the whole line.

  - discount_mode   'percent' (default, what existing lines use) or 'amount'
  - discount_amount the discount in money for the line, always kept in step with the
                    figure that was applied (the percentage column only holds two decimals,
                    which is not enough to store a typed amount exactly)

  Existing lines stay in 'percent' mode with their amount worked out from the percentage,
  so nothing about an existing document changes.
*/

ALTER TABLE document_items
  ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE document_items
  DROP CONSTRAINT IF EXISTS document_items_discount_mode_check;

ALTER TABLE document_items
  ADD CONSTRAINT document_items_discount_mode_check
  CHECK (discount_mode IN ('percent', 'amount'));

-- Fill in the money value for existing percentage discounts.
UPDATE document_items
SET discount_amount = ROUND(COALESCE(quantity, 0) * COALESCE(unit_price, 0) * COALESCE(discount_percent, 0) / 100, 2)
WHERE discount_amount = 0 AND COALESCE(discount_percent, 0) > 0;
