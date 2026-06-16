INSERT INTO supplier (
    supplier_type_id,
    name
)
VALUES
    (
        (
            SELECT id
            FROM supplier_type
            WHERE name = 'Produits de pose'
            LIMIT 1
        ),
        'Olympia'
    )
ON CONFLICT (name)
DO NOTHING;
