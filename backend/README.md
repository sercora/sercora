# Backend

Le dossier `backend/` contient l'API Sercora. C'est le point d'entree serveur pour les donnees internes, les calculs persistants et les integrations externes comme Snipe-IT.

## Role

Le backend sert a:

- exposer une API HTTP pour le frontend;
- lire et modifier les donnees PostgreSQL;
- centraliser les integrations qui necessitent des secrets;
- normaliser les reponses externes avant de les envoyer au navigateur;
- fournir les endpoints de sante et de version.

## Technologies

- Python
- FastAPI
- Uvicorn
- SQLAlchemy
- Pydantic
- PostgreSQL avec `psycopg2-binary`
- `python-dotenv` pour charger les variables locales et serveur

## Structure

```text
backend/
  requirements.txt     Dependances Python
  app/
    main.py            Creation FastAPI et enregistrement des routers
    api/               Endpoints HTTP par domaine
    database/          Connexion SQLAlchemy
    schemas/           Schemas Pydantic
    models/            Modeles SQLAlchemy existants
```

## Configuration

Le backend peut lire `backend/.env`. Ce fichier est ignore par Git et ne doit pas etre commite.

Variables importantes:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
PROSOL_API_URL=https://shop.api.prosol.ca
PROSOL_API_TOKEN=...
```

La connexion PostgreSQL est actuellement definie dans `app/database/database.py`.

## Lancer Localement

```bash
cd backend
/home/simon/sercora/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Endpoints de base:

```text
GET http://localhost:8000/health
GET http://localhost:8000/version
GET http://localhost:8000/tools?limit=1
```

## Verification

```bash
python3 -m compileall backend/app
```

En production, le backend est gere par systemd avec le service `sercora-api`.

## Import Excel Prosol

Le script `scripts/import_prosol_price_list.py` importe une liste de prix Excel Prosol dans la table `product`.

Il utilise la feuille `Worksheet`, dedoublonne par `CODE`, ignore les lignes discontinues, conserve la ligne avec la plus petite quantite minimum, puis alimente les champs fournisseur, code, manufacturier, categorie, collection, couleur, prix liste et prix d'achat.

Simulation:

```bash
cd backend
.venv/bin/python scripts/import_prosol_price_list.py /tmp/sercora-prosol.xlsx --dry-run
```

Import reel:

```bash
cd backend
.venv/bin/python scripts/import_prosol_price_list.py /tmp/sercora-prosol.xlsx
```

Avant d'importer une liste complete de plusieurs dizaines de milliers de produits, la page `Produits` doit utiliser une pagination ou une recherche serveur pour eviter de charger tout le catalogue dans le navigateur.
