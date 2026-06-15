# Application Backend

Le dossier `backend/app/` contient l'application FastAPI proprement dite.

## Point D'entree

`main.py` cree l'objet FastAPI, configure CORS et enregistre les routers:

- produits;
- projets;
- soumissions;
- pieces;
- lignes de soumission;
- quantites;
- matrice;
- outils Snipe-IT.

Il expose aussi:

```text
GET /
GET /health
GET /version
```

## Dossiers

```text
api/        Routes HTTP par domaine metier
database/   Connexion PostgreSQL
models/     Modeles SQLAlchemy historiques ou futurs
schemas/    Schemas Pydantic d'entree/sortie
```

## API

Les fichiers `api/*.py` sont organises par domaine:

- `products.py`: catalogue produit, types et unites;
- `matrix.py`: lecture de la matrice de soumission;
- `estimate_lines.py`: lignes de soumission;
- `estimate_quantities.py`: quantites par piece;
- `estimates.py`: soumissions;
- `projects.py`: projets;
- `rooms.py`: pieces;
- `tools.py`: proxy Snipe-IT pour l'inventaire d'outils.

## Donnees

Les routes utilisent principalement SQLAlchemy avec des requetes SQL explicites. Ce choix garde les operations lisibles et proches du schema PostgreSQL.

## Integration Snipe-IT

`api/tools.py` lit:

```text
SNIPEIT_URL
SNIPEIT_API_TOKEN
```

Il appelle ensuite:

```text
{SNIPEIT_URL}/api/v1/hardware
```

La reponse Snipe-IT est normalisee avant d'etre renvoyee au frontend.

## Regles De Maintenance

- Ajouter un router dans `api/` par domaine metier.
- Enregistrer le router dans `main.py`.
- Garder les secrets hors du code.
- Fermer les sessions DB dans un bloc `finally`.
- Garder les payloads de reponse stables pour le frontend.
