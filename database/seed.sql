INSERT INTO product_type (name)
VALUES
('Tuile'),
('Pierre'),
('Quartz'),
('Colle'),
('Coulis'),
('Membrane'),
('Autonivelant'),
('Moulure'),
('Scellant'),
('Service'),
('Location'),
('Sous-traitance');

INSERT INTO unit (name, symbol)
VALUES
('Square Foot', 'pi²'),
('Linear Foot', 'pi lin'),
('Bag', 'sac'),
('Unit', 'unité'),
('Hour', 'h'),
('Day', 'jour'),
('Gallon', 'gal'),
('Litre', 'L');

INSERT INTO surface_type (name, category, sort_order)
VALUES
('Plancher', 'Plancher', 10),
('Plinthe', 'Plancher', 20),
('Mur', 'Mur', 10),
('Demi-mur', 'Mur', 20),
('Dosseret', 'Mur', 30),
('Plafond', 'Mur', 40),
('Colonne', 'Mur', 50),
('Mobilier', 'Mur', 60),
('Marche', 'Plancher', 30),
('Contremarche', 'Plancher', 40);

