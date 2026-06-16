# Deploy

Le dossier `deploy/` contient les fichiers de production de Sercora.

## Fichiers

```text
deploy.sh
nginx-sercora.conf
nginx-api.conf
sercora-api.service
```

## Script Principal

Depuis la racine du depot:

```bash
./deploy/deploy.sh
```

Le script:

1. entre dans `frontend/`;
2. lance `npm run build`;
3. force l'API publique avec `VITE_API_URL=https://api.serco.pro`;
4. copie `frontend/dist/` vers `/var/www/sercora/`;
5. redemarre `sercora-api`;
6. recharge nginx.

## Frontend nginx

`nginx-sercora.conf` sert:

```text
https://sercora.serco.pro
```

Racine web:

```text
/var/www/sercora
```

## API nginx

`nginx-api.conf` proxy:

```text
https://api.serco.pro -> http://127.0.0.1:8000
```

## systemd

`sercora-api.service` lance FastAPI avec Uvicorn.

Commande equivalente:

```bash
/home/simon/sercora/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Le service charge:

```text
/home/simon/sercora/backend/.env
```

## Installer Le Service

```bash
sudo cp deploy/sercora-api.service /etc/systemd/system/sercora-api.service
sudo systemctl daemon-reload
sudo systemctl enable sercora-api
sudo systemctl restart sercora-api
```

## Installer nginx

Les fichiers doivent etre copies dans la configuration nginx du serveur selon la convention locale.

Verifier:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verifier Apres Deploy

```bash
curl -i https://sercora.serco.pro/
curl -i https://api.serco.pro/health
curl -i "https://api.serco.pro/projects?scope=submission"
curl -i "https://api.serco.pro/estimates/1/matrix"
systemctl is-active sercora-api nginx
```

## Rollback Simple

Le rollback applicatif le plus simple est Git:

```bash
git log --oneline
git revert <commit>
./deploy/deploy.sh
```

Eviter `git reset --hard` sur le serveur de travail sans decision explicite.

## Pieges

### Build Avec localhost

Ne jamais deployer un build public pointe vers:

```text
http://localhost:8000
```

Utiliser toujours:

```bash
./deploy/deploy.sh
```

### Service API Non Redemarre

Si une route backend nouvelle retourne `404`, redemarrer:

```bash
sudo systemctl restart sercora-api
```

### Erreur NAS Ou LibreOffice

Verifier:

```bash
mount | grep NAS
which libreoffice
journalctl -u sercora-api -n 100 --no-pager
```

## Liens

- Application: `https://sercora.serco.pro`
- API: `https://api.serco.pro`
- GitHub codex: `https://github.com/sercora/sercora/tree/codex`
- Documentation: `https://github.com/sercora/sercora/tree/codex/docs`
