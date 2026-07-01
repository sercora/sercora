ALTER TABLE estimate_line
    ADD COLUMN IF NOT EXISTS quoted_purchase_price NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS quoted_price_date TIMESTAMP;

UPDATE estimate_line l
SET
    quoted_purchase_price = COALESCE(l.quoted_purchase_price, l.purchase_price),
    quoted_price_date = COALESCE(l.quoted_price_date, e.created_at, CURRENT_TIMESTAMP)
FROM estimate e
WHERE e.id = l.estimate_id
    AND (
        l.quoted_purchase_price IS NULL
        OR l.quoted_price_date IS NULL
    );
