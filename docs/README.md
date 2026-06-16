# Documentation Sercora

Le dossier `docs/` contient la documentation technique et operationnelle de Sercora.

## Documents

- `ARCHITECTURE.md`: organisation globale du frontend, backend, base de donnees, NAS et integrations.
- `API.md`: endpoints FastAPI principaux et payloads utiles.
- `OPERATIONS.md`: deploiement, verification, services, NAS, SMTP, Snipe-IT et depannage.

Les README des sous-dossiers completent cette documentation:

- `backend/README.md`
- `backend/app/README.md`
- `frontend/README.md`
- `database/README.md`
- `deploy/README.md`

## Utilisation De Cette Documentation

Lire dans cet ordre:

1. `README.md` a la racine pour comprendre le produit.
2. `docs/ARCHITECTURE.md` pour comprendre les blocs techniques.
3. `docs/API.md` pour integrer ou deboguer le frontend/backend.
4. `docs/OPERATIONS.md` pour deployer ou diagnostiquer la production.

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
- imports de catalogues;
- NAS et visualisation de fichiers;
- creation et revisions de projets.

## Regles

- Ne jamais documenter de secrets reels.
- Utiliser des chemins et URLs de production quand ils sont publics.
- Utiliser des placeholders pour les tokens.
- Mettre a jour cette documentation avec chaque changement fonctionnel important.
- Garder les procedures executables telles quelles.

## Liens Publics

- Application: `https://sercora.serco.pro`
- API: `https://api.serco.pro`
- GitHub: `https://github.com/sercora/sercora/tree/codex`
- Documentation GitHub: `https://github.com/sercora/sercora/tree/codex/docs`
