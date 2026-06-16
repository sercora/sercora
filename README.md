# Sercora

Sercora est l'application interne de Carrelages Serco pour centraliser les produits, les projets, les soumissions, les outils, les clients, les usagers et les integrations metier.

Le produit vise un usage quotidien de production: estimation, catalogue, matrice de soumission, gestion de projets en soumission, navigation des dossiers NAS, consultation d'inventaire Snipe-IT et preparation progressive des automatisations fournisseur/courriel.

## Essence

Sercora transforme des informations dispersees en une interface de travail unique:

- catalogue produits exploitable par l'estimation;
- matrice de soumission avec quantites, pertes, coutants, profits, vendants, heures et jours;
- projets en soumission rattaches a des clients, invitations, addenda et revisions;
- outils Snipe-IT visibles dans Sercora avec images;
- importations de listes fournisseurs;
- configuration courriel, usagers et roles.

L'application est volontairement dense et orientee travail. Elle n'est pas une page marketing; c'est un logiciel interne pour produire plus vite et reduire les doubles entrees.

## Modules

### Clients

Le menu Clients affiche la liste des clients. Une fenetre permet d'ajouter ou modifier un client. Les clients sont reutilises dans les projets et les invitations.

### Projets

Le menu Projets contient:

- **En cours**: grise pour l'instant; reserve aux projets gagnes par bon de commande.
- **En Soumission**: liste les projets avec statut `PENDING`.
- **Creation**: creation d'un projet, copie d'arborescence NAS, ajout de courriels `.msg` et televersement de fichiers.

Dans **En Soumission**, chaque projet affiche le nombre de revisions et un bouton **Derniere revision** qui ouvre la derniere matrice disponible.
Un bouton **Dossier** ouvre aussi l'arborescence NAS du projet avec apercu PDF, Office et `.msg`.

### Produits

Le menu Produits regroupe:

- **Tuiles**
  - Centura
  - Olympia
- **Schluter**
- **Mapei**
- **Prosol**

Le catalogue supporte la recherche, la pagination, les produits actifs/inactifs, l'edition, les fiches techniques, les prix de liste, les coutants et les fournisseurs.

### Soumissions LEGACY

Le menu Soumissions a ete renomme **Soumissions LEGACY**. Il donne acces aux anciennes vues par dossiers:

- En cours
- Envoyees
- Refuse
- Template

Ces vues naviguent dans les repertoires NAS associes.

### Matrice De Soumission

La matrice permet de travailler une soumission par locaux et surfaces:

- locaux avec etage et libelle;
- surfaces classees;
- code plan;
- produits par ligne;
- quantites par local;
- pertes en pourcentage et unite;
- coutant;
- profit global ou force par ligne;
- prix vendant;
- installation unitaire et totale;
- heures, multiplicateur d'hommes et jours;
- sous-totaux par local, surface, fourniture et installation;
- selection de cellules avec sous-total;
- suppression de lignes selectionnees;
- changement de produit ou de surface;
- edition rapide du produit depuis une ligne;
- sauvegarde d'une nouvelle revision.

Le resume de soumission contient aussi:

- projet, numero, adresse;
- client;
- architecte;
- date des plans;
- pages de plans;
- devis;
- addenda;
- exclusions cochables;
- fournisseurs et dates d'expiration;
- echantillons;
- taux utilise;
- profit global;
- echeancier probable;
- remise de fin de projet;
- garantie.

### Outils

Le menu Outils est son propre module et contient:

- **Disponible**: outils Snipe-IT au chantier `Entrepot` ou sans chantier.
- **Deploye**: outils deployes hors entrepot.

La liste supporte recherche, tri, pagination et images provenant de Snipe-IT via proxy backend.

### Usagers Et Profil

Sercora gere ses propres usagers avec mots de passe et roles:

- admin;
- execution;
- estimation;
- entrepot.

Les admins peuvent creer, modifier et inviter les usagers. La liste affiche la date de creation et la derniere connexion. Chaque usager a une page de profil.

### Configuration

Le menu Configuration est reserve aux admins.

Sous-menus:

- **Courriel**: configuration SMTP, adresse d'expediteur, reply-to forgeable, test d'envoi, invitations et rafraichissements de mot de passe.
- **Importation**: mises a jour de prix et catalogues fournisseurs.

## Integrations

### Snipe-IT

Sercora lit l'inventaire Snipe-IT via le backend. Les images d'outils sont servies par proxy pour eviter d'exposer le token Snipe-IT au navigateur.

Variables:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
```

### Prosol

Sercora integre Prosol pour la recherche/import de produits, la synchronisation des fiches techniques et la mise a jour web des prix.

Variables:

```text
PROSOL_API_URL=https://shop.api.prosol.ca
PROSOL_API_TOKEN=...
```

### Fournisseurs

Les catalogues fournisseurs sont geres par importation:

- Schluter: liste Excel, escompte configurable.
- Centura: liste Excel, escompte configurable.
- Olympia: catalogue PDF, escompte configurable.
- Prosol: mise a jour web via API.

### NAS

Sercora lit les dossiers de soumissions sur le NAS. Le dossier de travail Sercora est le seul endroit prevu pour l'ecriture.

Racines utilisees:

```text
/NAS/Soumissions en cours
/NAS/Soumissions envoyees
/NAS/@Recycle/Soumissions en cours
/NAS_SERCORA_RW
```

### Courriel

La configuration SMTP permet:

- test d'envoi;
- invitation de creation de compte;
- rafraichissement de mot de passe;
- reply-to configurable.

Migadu est le fournisseur SMTP vise, mais le code reste generique.

## Technologies

Frontend:

- React;
- TypeScript;
- Vite;
- AG Grid;
- CSS par module.

Backend:

- Python;
- FastAPI;
- SQLAlchemy;
- Pydantic;
- PostgreSQL;
- Uvicorn;
- systemd.

Infrastructure:

- nginx;
- NAS NFS;
- Snipe-IT;
- LibreOffice pour certains apercus Office;
- GitHub branche `codex`.

## Structure

```text
backend/      API FastAPI, schemas, scripts d'importation
database/     schema SQL, seed et migrations
deploy/       systemd, nginx et script de deploiement
docs/         documentation technique
frontend/     application React/Vite
```

## Developpement

Backend:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Build frontend:

```bash
cd frontend
npm run build
```

## Deploiement

Depuis la racine:

```bash
./deploy/deploy.sh
```

Le script construit le frontend, copie les fichiers statiques, redemarre l'API et recharge nginx.

## Liens

- Application: `https://sercora.serco.pro`
- API: `https://api.serco.pro`
- GitHub branche codex: `https://github.com/sercora/sercora/tree/codex`
- Documentation GitHub: `https://github.com/sercora/sercora/tree/codex/docs`

## Documentation

- [Documentation technique](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Operations](docs/OPERATIONS.md)
- [API](docs/API.md)
- [Backend](backend/README.md)
- [Frontend](frontend/README.md)
- [Database](database/README.md)
- [Deploy](deploy/README.md)

## Securite

- Ne pas committer `backend/.env`.
- Ne pas committer de token API.
- Garder les integrations sensibles cote backend.
- Limiter l'ecriture NAS au dossier Sercora prevu.
- Verifier les migrations avant production.

## Credits

Simon Mathieu 2026.
