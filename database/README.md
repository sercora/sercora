# Database

Le dossier `database/` contient le schema SQL, les migrations et les donnees initiales de Sercora.

## Role

La base de donnees stocke les informations internes de travail:

- catalogue produits;
- types de produits;
- unites;
- projets;
- soumissions;
- pieces;
- lignes de soumission;
- quantites par piece.

## Fichiers

```text
schema.sql       Schema initial principal
seed.sql         Donnees initiales de base
migrations/      Evolutions SQL incrementales
```

## Tables Principales

- `product_type`: familles de produits.
- `unit`: unites de mesure.
- `surface_type`: types de surfaces.
- `product`: catalogue produit interne.
- `project`: projets.
- `estimate`: soumissions et revisions.
- `room`: pieces ou zones d'une soumission.
- `estimate_line`: lignes de produits/services dans une soumission.
- `estimate_quantity`: quantites par ligne et par piece.

## Modele De Soumission

Une soumission est construite autour de:

```text
estimate
  -> rooms
  -> estimate_lines
       -> estimate_quantities par room
```

Ce modele permet a la matrice frontend d'afficher les produits en lignes et les pieces en colonnes.

## Migrations

Les fichiers dans `migrations/` sont numerotes. Ils doivent etre appliques dans l'ordre.

Convention:

```text
NNN_description.sql
```

## Precautions

- Verifier les migrations contre une copie ou un environnement de test avant production.
- Eviter les suppressions destructives sans sauvegarde.
- Garder les changements de schema alignes avec les routes backend et les types frontend.
