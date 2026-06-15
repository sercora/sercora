# Documentation

Le dossier `docs/` regroupe la documentation technique et operationnelle de Sercora.

## Documents

- `API.md`: reference des endpoints exposes par FastAPI.
- `ARCHITECTURE.md`: vue d'ensemble frontend, backend, base de donnees et integration Snipe-IT.
- `OPERATIONS.md`: procedures de lancement, deploiement, verification et depannage.

## Objectif

Cette documentation complete le `README.md` racine. Le README donne la vision globale du produit; `docs/` detaille les aspects qui changent moins souvent que le code mais qui sont essentiels pour maintenir l'application.

## Quand Mettre A Jour

Mettre a jour `docs/` quand:

- un nouveau module est ajoute;
- un endpoint API change;
- le schema PostgreSQL evolue;
- le deploiement change;
- une integration externe est ajoutee ou modifiee;
- un incident revele une procedure utile a documenter.

## Regles

- Ne pas inclure de secrets.
- Utiliser des exemples avec des placeholders.
- Garder les commandes executables telles quelles quand c'est possible.
- Preferer les chemins reels du projet pour reduire l'ambiguite.
