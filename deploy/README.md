# Deploy

Le dossier `deploy/` contient les fichiers necessaires pour mettre Sercora en production sur le serveur actuel.

## Fichiers

```text
deploy.sh              Script de deploiement applicatif
nginx-sercora.conf     Site frontend sercora.serco.pro
nginx-api.conf         Proxy API api.serco.pro
sercora-api.service    Service systemd FastAPI/Uvicorn
```

## Flux De Deploiement

`deploy.sh` effectue les etapes suivantes:

1. construire le frontend avec Vite;
2. forcer `VITE_API_URL=https://api.serco.pro` pour eviter un build public vers `localhost`;
3. copier `frontend/dist/` vers `/var/www/sercora/`;
4. redemarrer `sercora-api`;
5. recharger nginx.

Commande:

```bash
./deploy/deploy.sh
```

## Service API

`sercora-api.service` lance:

```bash
/home/simon/sercora/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Il charge aussi:

```text
/home/simon/sercora/backend/.env
```

Ce fichier contient les secrets serveur comme le jeton Snipe-IT.

## nginx

`nginx-sercora.conf` sert le frontend statique:

```text
sercora.serco.pro -> /var/www/sercora
```

`nginx-api.conf` relaie l'API:

```text
api.serco.pro -> http://127.0.0.1:8000
```

## Verifications

Apres deploiement:

```bash
curl -i https://sercora.serco.pro/
curl -i https://api.serco.pro/health
curl -i "https://api.serco.pro/tools?limit=1"
systemctl is-active sercora-api nginx
```

## Piege Important

Ne jamais builder le frontend public avec `VITE_API_URL=http://localhost:8000`. Le script de deploiement force l'URL de production pour eviter ce probleme.
