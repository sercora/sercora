# Documentation Sercora

Le dossier `docs/` contient la documentation technique et operationnelle de Sercora.

## Structure

- `architecture.md`: organisation globale du frontend, backend, base de donnees, NAS et integrations.
- `api/index.md`: endpoints FastAPI principaux et payloads utiles.
- `operations.md`: deploiement, verification, services, NAS, SMTP, Snipe-IT et depannage.
- `documentation-audit.md`: etat de la documentation et ecarts avec le code reel.
- `glossary.md`: vocabulaire metier canonique.
- `roadmap.md`: separation entre implemente, partiel, prevu et idee future.
- `user-guide/estimateur.md`: guide quotidien pour estimateurs.
- `user-guide/administration.md`: guide quotidien pour administrateurs.
- `adr/0000-wiki-migration.md`: validation du remplacement de `sercora-wiki` par la documentation integree.

Les README des sous-dossiers completent cette documentation:

- `backend/README.md`
- `backend/app/README.md`
- `frontend/README.md`
- `database/README.md`
- `deploy/README.md`

## Utilisation De Cette Documentation

Lire dans cet ordre:

1. `README.md` a la racine pour comprendre le produit.
2. `docs/glossary.md` pour uniformiser le vocabulaire metier.
3. `docs/roadmap.md` pour comprendre ce qui est livre ou futur.
4. `docs/user-guide/estimateur.md` pour l'utilisation quotidienne en estimation.
5. `docs/user-guide/administration.md` pour l'administration.
6. `docs/architecture.md` pour comprendre les blocs techniques.
7. `docs/api/index.md` pour integrer ou deboguer le frontend/backend.
8. `docs/operations.md` pour deployer ou diagnostiquer la production.

## Modules Documentes

La documentation couvre:

- clients;
- projets;
- produits;
- tuiles et fournisseurs;
- soumissions legacy;
- matrice de soumission;
- exclusions, addenda, devis et pages de plans;
- outils Snipe-IT;
- usagers, roles et profil;
- configuration SMTP;
- configuration VoIP/SMS;
- configuration Snipe-IT;
- imports de catalogues;
- NAS et visualisation de fichiers;
- creation et revisions de projets;
- contacts et fournisseurs;
- chantiers Snipe-IT;
- Calibre;
- preferences utilisateur.

## Regles

- Ne jamais documenter de secrets reels.
- Utiliser des chemins et URLs de production quand ils sont publics.
- Utiliser des placeholders pour les tokens.
- Mettre a jour cette documentation avec chaque changement fonctionnel important.
- Garder les procedures executables telles quelles.

## Liens Publics

- Application: `https://sercora.serco.pro`
- API: `https://api.serco.pro`
- GitHub staging: `https://github.com/sercora/sercora/tree/staging`
- Documentation GitHub staging: `https://github.com/sercora/sercora/tree/staging/docs`
