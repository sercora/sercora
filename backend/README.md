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
