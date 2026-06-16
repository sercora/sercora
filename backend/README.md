# Backend

Le dossier `backend/` contient l'API Sercora. C'est le point d'entree serveur pour PostgreSQL, NAS, Snipe-IT, Prosol, SMTP et les operations qui ne doivent pas etre exposees directement au navigateur.

## Role

Le backend sert a:

- exposer les endpoints FastAPI;
- lire et modifier PostgreSQL;
- proteger les tokens externes;
- normaliser les reponses de Snipe-IT et Prosol;
- gerer les usagers, roles, invitations et mots de passe;
- creer les projets et revisions;
- naviguer les dossiers NAS;
- convertir ou previsualiser des fichiers;
- appliquer les imports fournisseurs.

## Technologies

- Python;
- FastAPI;
- Uvicorn;
- SQLAlchemy;
- Pydantic;
- PostgreSQL avec `psycopg2-binary`;
- python-dotenv;
- LibreOffice pour certains apercus Office.

## Structure

```text
backend/
  requirements.txt
  scripts/
    import_prosol_price_list.py
    import_olympia_price_list.py
  app/
    main.py
    api/
    database/
    schemas/
    models/
```

## Configuration

Le backend lit `backend/.env` via systemd et en local. Ce fichier est ignore par Git.

Variables importantes:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
PROSOL_API_URL=https://shop.api.prosol.ca
PROSOL_API_TOKEN=...
SERCORA_PROJECT_TEMPLATE_ROOT=/NAS/Soumissions en cours/000-Dossier type
SERCORA_PROJECT_RW_ROOT=/NAS_SERCORA_RW
```

La connexion PostgreSQL est definie dans:

```text
backend/app/database/database.py
```

## Lancer Localement

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verifier:

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/version
```

## Valider Le Code

```bash
cd /home/simon/sercora
backend/.venv/bin/python -m py_compile backend/app/api/matrix.py
cd backend
.venv/bin/python -c "from app.main import app; print(len(app.routes))"
```

## Domaines API

```text
auth.py                 login, profil, usagers, roles
email.py                SMTP, invitations, reset mot de passe
clients.py             clients et types
projects.py            projets, creation, invitations, addenda, NAS
products.py            produits, fournisseurs, imports catalogues, escomptes
prosol.py              integration Prosol
tools.py               integration Snipe-IT et images outils
estimates.py           soumissions, revisions, fichiers NAS
matrix.py              matrice et resume de soumission
estimate_lines.py      lignes
estimate_quantities.py quantites
rooms.py               locaux
```

## Projets

`projects.py` gere:

- creation de projet;
- copie de l'arborescence NAS;
- televersement de `.msg`;
- ajout de clients;
- addenda;
- revision 0;
- liste des projets en soumission;
- derniere revision et nombre total de revisions.

## Revisions

`estimates.py` expose:

```text
POST /estimates/{estimate_id}/revisions
```

Cette route clone une revision avec ses locaux, lignes, quantites, liens et fournisseurs.

## Matrice

`matrix.py` retourne la structure complete utilisee par `MatrixView`.

Il sauvegarde aussi le resume:

- taux;
- profit;
- architecte;
- plans;
- devis;
- addenda;
- exclusions;
- echeancier;
- remise;
- garantie.

## Produits

`products.py` gere:

- CRUD produits;
- produits actifs/inactifs;
- types et unites;
- fiches techniques;
- options de couverture;
- imports Schluter, Centura, Olympia;
- escomptes fournisseurs;
- edition en lot.

## Prosol

`prosol.py` gere:

- recherche API;
- import dans la DB;
- fiches techniques;
- mise a jour des prix.

## Snipe-IT

`tools.py` gere:

- outils disponibles;
- outils deployes;
- recherche, tri et pagination;
- images via proxy.

## Fichiers NAS

`estimates.py` gere la navigation de dossiers et l'apercu:

- PDF;
- `.msg`;
- Word;
- Excel;
- images HTML dans les `.msg`.

## Scripts

### Import Prosol Excel

Simulation:

```bash
cd backend
.venv/bin/python scripts/import_prosol_price_list.py /tmp/prosol.xlsx --dry-run
```

Import reel:

```bash
cd backend
.venv/bin/python scripts/import_prosol_price_list.py /tmp/prosol.xlsx
```

### Import Olympia

```bash
cd backend
.venv/bin/python scripts/import_olympia_price_list.py /tmp/olympia.pdf --dry-run
```

## Regles De Maintenance

- Garder les secrets dans `.env`.
- Fermer les sessions DB.
- Ajouter les champs DB dans une migration.
- Garder les reponses API stables pour le frontend.
- Eviter de faire parler le navigateur directement aux APIs externes.
- Tester l'import FastAPI avant deploy.
