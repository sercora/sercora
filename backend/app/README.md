# Application FastAPI

`backend/app/` contient l'application FastAPI de Sercora.

## Point D'entree

```text
main.py
```

`main.py` cree l'objet FastAPI, configure CORS et enregistre tous les routers.

Endpoints de base:

```text
GET /
GET /health
GET /version
```

## Dossiers

```text
api/        routes HTTP par domaine
database/   connexion SQLAlchemy
models/     modeles SQLAlchemy historiques ou futurs
schemas/    schemas Pydantic
```

## Routers

```text
clients.py
products.py
projects.py
estimates.py
rooms.py
estimate_lines.py
estimate_quantities.py
matrix.py
tools.py
prosol.py
auth.py
email.py
```

## Auth Et Usagers

`auth.py` gere:

- login;
- session courante;
- profil;
- liste des usagers;
- creation/modification;
- roles;
- derniere connexion.

Roles:

```text
admin
execution
estimation
entrepot
```

## Courriel

`email.py` gere:

- configuration SMTP;
- reply-to;
- test d'envoi;
- invitations;
- reset de mot de passe;
- creation de mot de passe via token.

## Projets

`projects.py` gere les projets en soumission:

- creation;
- copie d'arborescence NAS;
- `.msg` Outlook;
- dossier de televersement;
- clients;
- addenda;
- revision 0;
- derniere revision;
- nombre de revisions.

## Soumissions Et Matrice

`estimates.py` gere les soumissions, revisions et fichiers NAS.

`matrix.py` gere la lecture de la matrice et la sauvegarde du resume.

`estimate_lines.py`, `estimate_quantities.py` et `rooms.py` gerent les elements editables de la matrice.

## Produits

`products.py` et `prosol.py` gerent:

- catalogue;
- fournisseurs;
- imports;
- escomptes;
- fiches techniques;
- couvertures;
- prix.

## Outils

`tools.py` proxy Snipe-IT:

- liste des outils;
- scopes disponible/deploye;
- tri;
- recherche;
- pagination;
- image.

## Donnees

Les routes utilisent principalement:

```python
from sqlalchemy import text
```

Les requetes SQL explicites sont preferees pour garder la logique proche du schema PostgreSQL.

## Ajouter Un Domaine API

1. Creer `backend/app/api/mon_domaine.py`.
2. Creer les schemas Pydantic si necessaire.
3. Enregistrer le router dans `main.py`.
4. Ajouter les migrations DB.
5. Ajouter le client API frontend.
6. Documenter dans `docs/API.md`.

## Regles

- Pas de secret dans le code.
- Pas d'appel direct aux APIs externes depuis le frontend.
- Les erreurs utilisateur doivent etre des `HTTPException` claires.
- Les sessions DB doivent etre fermees.
- Les migrations doivent etre idempotentes quand possible.
