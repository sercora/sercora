# Architecture

Sercora est une application web interne composee d'un frontend React, d'une API FastAPI, d'une base PostgreSQL, d'un acces NAS et de plusieurs integrations externes.

## Vue D'ensemble

```text
Navigateur
  |
  | HTTPS
  v
nginx sercora.serco.pro
  |
  v
Frontend React statique
  |
  | HTTPS API
  v
nginx api.serco.pro
  |
  v
FastAPI / Uvicorn / systemd
  |
  +--> PostgreSQL
  +--> NAS NFS
  +--> Snipe-IT
  +--> Prosol
  +--> SMTP
  +--> LibreOffice pour apercus Office
```

## Frontend

Le frontend vit dans `frontend/src`.

Responsabilites:

- navigation principale;
- affichage des pages metier;
- appels API;
- calculs de matrice visibles;
- edition de cellules;
- recherche et pagination;
- rendu des apercus de fichiers;
- experience utilisateur dense et orientee production.

Fichiers importants:

```text
frontend/src/App.tsx
frontend/src/pages/MatrixView.tsx
frontend/src/pages/ProductsPage.tsx
frontend/src/pages/ProjectsPage.tsx
frontend/src/pages/ContactsPage.tsx
frontend/src/pages/ToolsPage.tsx
frontend/src/pages/ChantiersPage.tsx
frontend/src/pages/CalibreView.tsx
frontend/src/pages/UsersPage.tsx
frontend/src/pages/ConfigurationPage.tsx
frontend/src/hooks/useColumnPreferences.ts
frontend/src/utils/
frontend/src/styles/
```

## Shell Applicatif

`App.tsx` gere:

- authentification et session;
- menu principal;
- sous-menus;
- page active;
- redirection depuis Projets vers la derniere revision de matrice;
- footer avec liens GitHub, documentation et credits.
- rafraichissement de la vue quand un menu ou sous-menu actif est reclique.

Menus principaux:

- Clients;
- Fournisseurs;
- Contacts;
- Projets;
- Produits;
- Outils;
- Calibre;
- Soumissions LEGACY;
- Usagers;
- Configuration;
- Profil.

## Matrice De Soumission

`MatrixView.tsx` est le plus gros module frontend. Il utilise AG Grid et combine:

- resume de projet;
- architecte, date plans, pages de plans;
- devis;
- addenda;
- exclusions;
- fournisseurs;
- echantillons;
- taux et profit;
- locaux;
- surfaces;
- lignes de produits;
- quantites;
- calculs de couts;
- heures et jours.

Les calculs purs sont dans:

```text
frontend/src/utils/matrixCalculations.ts
```

## Backend

Le backend vit dans `backend/app`.

Point d'entree:

```text
backend/app/main.py
```

Routers:

```text
clients.py
projects.py
products.py
matrix.py
estimates.py
estimate_lines.py
estimate_quantities.py
rooms.py
tools.py
prosol.py
auth.py
email.py
contacts.py
preferences.py
```

Le backend utilise surtout des requetes SQL explicites avec SQLAlchemy. Ce choix garde les comportements proches du schema et facilite le debogage.

`email.py` couvre les notifications:

- SMTP;
- invitations et resets;
- configuration VoIP/SMS;
- test SMS manuel;
- connecteurs Twilio, Telnyx et VoIP.ms.

## Base De Donnees

PostgreSQL stocke les donnees internes.

Domaines principaux:

- authentification et usagers;
- clients;
- contacts;
- produits;
- fournisseurs et escomptes;
- preferences utilisateur;
- projets;
- soumissions/revisions;
- locaux;
- lignes;
- quantites;
- courriel SMTP;
- VoIP/SMS;
- invitations;
- exclusions et addenda;
- fiches techniques et options de couverture.
- configuration Snipe-IT.

Schema et migrations:

```text
database/schema.sql
database/seed.sql
database/migrations/
```

## Projets Et Revisions

Un projet peut avoir plusieurs revisions dans `estimate`.

Structure:

```text
project
  -> estimate revision 0
  -> estimate revision 1
  -> estimate revision N
```

Le menu **Projets > En Soumission** ouvre la derniere revision disponible via `latest_estimate_id`.
Le bouton **Dossier** ouvre l'arborescence du projet dans le dossier RW Sercora et reutilise les apercus PDF, Office et `.msg` du backend.

Le bouton **Enregistrer sous nouvelle revision** clone:

- l'estime;
- les locaux;
- les lignes;
- les quantites;
- les liens entre lignes;
- les soumissions fournisseurs.

## NAS

Sercora lit les dossiers de soumissions et peut ecrire uniquement dans le dossier de travail prevu.

Racines utilisees:

```text
/NAS/Soumissions en cours
/NAS/Soumissions envoyees
/NAS/@Recycle/Soumissions en cours
/NAS_SERCORA_RW
```

La creation de projet copie l'arborescence de:

```text
/NAS/Soumissions en cours/000-Dossier type
```

vers le dossier RW Sercora.

## Apercus De Fichiers

Les navigateurs de fichiers supportent:

- dossiers;
- PDF;
- `.msg`;
- Word;
- Excel.

Les fichiers Office sont convertis en PDF via LibreOffice cote serveur lorsque possible. Les `.msg` sont decodes avec texte, HTML et images distantes lorsque disponibles.

## Integrations

### Snipe-IT

`tools.py` sert de proxy vers Snipe-IT.

Le frontend ne voit jamais le token. Les images d'outils passent aussi par le backend.

Sercora utilise Snipe-IT comme systeme maitre pour les outils, chantiers/locations, statuts, checkout, images et codes QR.

La configuration peut provenir de `app_snipeit_settings` ou des variables d'environnement.

### Prosol

`prosol.py` gere:

- recherche API;
- import de produits;
- synchronisation des fiches techniques;
- mise a jour des prix.

### Catalogues Fournisseurs

`products.py` gere les imports:

- Schluter Excel;
- Centura Excel;
- Olympia PDF;
- escomptes fournisseurs configurables;
- application en lot.

### SMTP

`email.py` gere:

- configuration SMTP admin;
- test d'envoi;
- invitations d'usager;
- reset de mot de passe;
- reply-to configurable.

### Preferences Utilisateur

`preferences.py` stocke des preferences JSON par usager, notamment les colonnes visibles par page.

### Calibre

Calibre est un module frontend de releve de plans:

- import PDF/image;
- calibration;
- mesures lignes, rectangles et polygones;
- calques et secteurs;
- resultats de surfaces et longueurs.

La persistance serveur Calibre est partielle et doit rester documentee comme telle tant que le flux complet n'est pas stabilise.

## Securite

Principes:

- secrets seulement dans `backend/.env`;
- API externe seulement cote backend;
- roles applicatifs pour limiter les fonctions admin;
- NAS en lecture seule sauf dossier Sercora RW;
- pas de token dans le frontend.

## Points A Surveiller

- `MatrixView.tsx` est volumineux et concentre beaucoup de logique UI.
- Les migrations doivent suivre les champs ajoutes dynamiquement dans certains endpoints.
- Les apercus Office dependent de LibreOffice cote serveur.
- Les URLs NAS et montages NFS sont propres a l'environnement actuel.
- Les integrations QuickBooks et Mobile-Punch sont visibles dans l'UI mais non implementees.
