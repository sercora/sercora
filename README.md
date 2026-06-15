# Sercora

Sercora est une application interne pour structurer le travail commercial et operationnel de Carrelages Serco autour des produits, des soumissions et des outils. Son objectif est de transformer des informations dispersees en une interface de travail unique, rapide a consulter, facile a maintenir et connectee aux systemes existants.

L'application est construite comme un outil metier: sobre, direct, oriente donnees. Elle vise moins a presenter l'entreprise qu'a aider l'equipe a produire, verifier et suivre les informations necessaires au quotidien.

## Essence

Sercora sert de couche applicative legere entre les besoins de terrain et les donnees internes. L'interface met l'accent sur les tableaux, les formulaires compacts, les calculs visibles et les integrations live.

Les premieres surfaces couvertes sont:

- **Soumissions**: matrice de quantites, prix, pertes, profit et installation par piece.
- **Produits**: catalogue interne des materiaux, unites, types, couleurs, formats et etats actifs/inactifs.
- **Outils**: consultation live des assets Snipe-IT depuis l'inventaire `snipe.serco.pro`.
- **Clients / Projets**: espaces prevus dans la navigation pour les prochains modules.

## But

Le but de Sercora est de reduire la friction entre l'estimation, le suivi des produits et la gestion des actifs.

Concretement, l'application doit permettre de:

- Centraliser les donnees utiles a une soumission.
- Maintenir un catalogue produit exploitable par les estimations.
- Consulter l'inventaire d'outils sans ouvrir un autre systeme.
- Donner une base technique simple pour ajouter des modules metier.
- Garder les integrations sensibles cote serveur, sans exposer les jetons dans le navigateur.

## Forces

- **Interface orientee production**: navigation laterale, tableaux denses, edition directe et peu de distraction visuelle.
- **Matrice de soumission calculee**: les quantites par piece alimentent les totaux, les pertes, le cout materiel, le profit, l'installation et le prix de vente.
- **Catalogue produit modifiable**: creation, edition, desactivation et recherche des produits.
- **Donnees Snipe-IT live**: le module Outils lit l'API Snipe-IT via le backend Sercora.
- **Backend simple**: API FastAPI avec routes explicites et requetes SQL lisibles.
- **Deploiement direct**: build Vite servi par nginx, API uvicorn geree par systemd.

## Technologies

### Frontend

- React 19
- TypeScript
- Vite
- AG Grid pour la matrice de soumission
- CSS modulaire par surface fonctionnelle

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- Uvicorn
- `python-dotenv` pour la configuration locale et serveur

### Donnees

- PostgreSQL
- Schema SQL versionne dans `database/schema.sql`
- Tables principales: `product`, `product_type`, `unit`, `project`, `estimate`, `room`, `estimate_line`, `estimate_quantity`

### Infrastructure

- nginx pour `sercora.serco.pro` et `api.serco.pro`
- systemd pour le service `sercora-api`
- Script de deploiement dans `deploy/deploy.sh`

## Integrations

### Snipe-IT

Le module **Outils** integre Snipe-IT en lecture via:

```text
https://snipe.serco.pro/api/v1/hardware
```

Le navigateur ne parle jamais directement a Snipe-IT. Il appelle l'API Sercora:

```text
GET https://api.serco.pro/tools
```

Le backend relaie ensuite la requete a Snipe-IT avec le jeton API configure dans l'environnement serveur:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
```

Ces valeurs ne doivent pas etre commitees. Elles vivent dans `backend/.env`, ignore par Git.

## Structure Du Code

```text
backend/
  app/
    api/              Routes FastAPI par domaine
    database/         Connexion PostgreSQL
    schemas/          Modeles Pydantic
    main.py           Application FastAPI

database/
  schema.sql          Schema de base
  migrations/         Migrations SQL
  seed.sql            Donnees initiales

deploy/
  deploy.sh           Build frontend, copie web, restart API, reload nginx
  nginx-*.conf        Configurations nginx
  sercora-api.service Service systemd

frontend/
  src/
    pages/            Pages principales
    components/       Composants reutilisables
    utils/            Clients API et calculs
    styles/           CSS par module
```

## Developpement Local

### Backend

```bash
cd backend
/home/simon/sercora/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Pour l'environnement local, `frontend/.env.local` peut definir:

```text
VITE_API_URL=http://localhost:8000
```

Pour un build production, le deploiement force:

```text
VITE_API_URL=https://api.serco.pro
```

## Deploiement

Le deploiement live se fait avec:

```bash
./deploy/deploy.sh
```

Le script:

- construit le frontend React;
- copie `frontend/dist/` dans `/var/www/sercora/`;
- redemarre `sercora-api`;
- recharge nginx.

## Documentation Complementaire

- [Architecture](docs/ARCHITECTURE.md)
- [Operations Et Deploiement](docs/OPERATIONS.md)
- [Reference API](docs/API.md)

## Securite

- Ne jamais committer `backend/.env`.
- Ne jamais committer un jeton Snipe-IT.
- Garder les integrations externes cote backend.
- Utiliser `VITE_API_URL=https://api.serco.pro` pour les builds publics.

## Statut

Sercora est une application interne en evolution active. Les modules Produits, Soumissions et Outils sont les surfaces principales actuelles. Les modules Clients et Projets sont presents dans la navigation comme prochains axes fonctionnels.
