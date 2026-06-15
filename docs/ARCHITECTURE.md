# Architecture

Sercora est organisee en deux applications principales:

- un frontend React servi comme fichiers statiques;
- une API FastAPI qui centralise les acces aux donnees internes et aux integrations externes.

## Vue D'ensemble

```text
Navigateur
  |
  | HTTPS
  v
nginx: sercora.serco.pro
  |
  v
Frontend React statique
  |
  | HTTPS API
  v
nginx: api.serco.pro
  |
  v
FastAPI / Uvicorn
  |
  +--> PostgreSQL
  |
  +--> Snipe-IT API
```

## Frontend

Le frontend est responsable de l'experience utilisateur et des interactions rapides:

- navigation principale;
- matrices et tableaux;
- formulaires produit;
- recherche et rafraichissement des outils;
- calculs visibles cote client pour la matrice.

Le frontend ne contient pas de secret. Les appels externes passent par le backend.

### Pages

- `MatrixView`: soumissions et calculs par piece.
- `ProductsPage`: catalogue produit.
- `ToolsPage`: inventaire des outils.

### Utilitaires

- `matrixApi.ts`: appels `/estimates/1/matrix`, `/estimate-quantities`, `/estimate-lines`.
- `productsApi.ts`: appels `/products`, `/product-types`, `/units`.
- `toolsApi.ts`: appel `/tools`.
- `matrixCalculations.ts`: calculs de couts, pertes, profits et prix.

## Backend

Le backend FastAPI expose une API metier simple. Chaque fichier dans `backend/app/api/` couvre un domaine:

- `products.py`: produits, types de produit et unites;
- `matrix.py`: matrice de soumission;
- `estimate_lines.py`: lignes de soumission;
- `estimate_quantities.py`: quantites par piece;
- `projects.py`: projets;
- `estimates.py`: soumissions;
- `rooms.py`: pieces;
- `tools.py`: proxy Snipe-IT.

Les routes sont enregistrees dans `backend/app/main.py`.

## Base De Donnees

PostgreSQL stocke les donnees internes. Le schema central se trouve dans `database/schema.sql`.

### Tables Metier

- `product_type`: categories de produits internes.
- `unit`: unites de mesure.
- `surface_type`: types de surfaces.
- `product`: catalogue produit.
- `project`: projets.
- `estimate`: soumissions et revisions.
- `room`: pieces rattachees a une soumission.
- `estimate_line`: lignes produit/surface d'une soumission.
- `estimate_quantity`: quantites par ligne et par piece.

## Integration Snipe-IT

Le module Outils utilise `backend/app/api/tools.py`.

Flux:

```text
Frontend ToolsPage
  -> GET /tools
  -> FastAPI tools.py
  -> GET {SNIPEIT_URL}/api/v1/hardware
  -> normalisation des assets
  -> reponse JSON Sercora
```

La normalisation reduit la reponse Snipe-IT aux champs utiles pour l'interface:

- `asset_tag`
- `name`
- `serial`
- `model`
- `category`
- `manufacturer`
- `status`
- `assigned_to`
- `location`
- `updated_at`

## Configuration

### Backend

`backend/.env` peut contenir:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
```

### Frontend

`frontend/.env.local` peut contenir:

```text
VITE_API_URL=http://localhost:8000
```

Le deploiement production force:

```text
VITE_API_URL=https://api.serco.pro
```

## Principes De Code

- Garder les secrets cote backend.
- Preferer des routes API explicites.
- Garder les ecrans metier compacts et orientes tableau.
- Utiliser les patterns existants avant d'ajouter une abstraction.
- Documenter les operations sensibles dans `docs/OPERATIONS.md`.
