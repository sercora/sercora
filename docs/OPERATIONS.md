# Operations Et Deploiement

Ce document decrit les operations de base pour lancer, verifier et deployer Sercora.

## Services Live

- Frontend: `https://sercora.serco.pro`
- API: `https://api.serco.pro`
- Service systemd: `sercora-api`
- Repertoire web: `/var/www/sercora`
- Repertoire projet: `/home/simon/sercora`

## Deploiement

Depuis la racine du repo:

```bash
./deploy/deploy.sh
```

Le script:

1. lance `npm run build` dans `frontend/`;
2. force `VITE_API_URL=https://api.serco.pro` pour le build public;
3. copie `frontend/dist/` vers `/var/www/sercora/`;
4. redemarre `sercora-api`;
5. recharge nginx.

## Verifications Apres Deploiement

```bash
curl -i https://sercora.serco.pro/
curl -i https://api.serco.pro/health
curl -i "https://api.serco.pro/tools?limit=1"
```

Verifier les services:

```bash
systemctl is-active sercora-api nginx
systemctl status sercora-api --no-pager -n 40
```

## Configuration Snipe-IT

Le service systemd charge:

```text
/home/simon/sercora/backend/.env
```

Variables attendues:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
```

Apres modification de `backend/.env`:

```bash
sudo systemctl restart sercora-api
```

## Installer Ou Mettre A Jour Le Service API

```bash
sudo cp deploy/sercora-api.service /etc/systemd/system/sercora-api.service
sudo systemctl daemon-reload
sudo systemctl enable sercora-api
sudo systemctl restart sercora-api
```

## Configurations nginx

Les fichiers de reference sont:

- `deploy/nginx-sercora.conf`
- `deploy/nginx-api.conf`

Apres modification d'une configuration nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Developpement Local

Backend:

```bash
cd backend
/home/simon/sercora/backend/.venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

Pour que le frontend local appelle l'API locale:

```text
frontend/.env.local
VITE_API_URL=http://localhost:8000
```

## Pieges Connus

### Le Site Public Appelle `localhost:8000`

Symptome:

- Produits, Soumissions ou Outils ne chargent pas sur `sercora.serco.pro`.

Cause:

- Le build production a ete fait avec `frontend/.env.local`.

Correction:

```bash
VITE_API_URL=https://api.serco.pro npm run build
```

ou utiliser:

```bash
./deploy/deploy.sh
```

### `/tools` Retourne 503

Cause probable:

- `SNIPEIT_API_TOKEN` absent du contexte systemd.

Correction:

```bash
sudo systemctl cat sercora-api
sudo systemctl restart sercora-api
curl -i "https://api.serco.pro/tools?limit=1"
```

### `/tools` Retourne 404

Cause probable:

- L'API live n'a pas ete redemarree apres l'ajout de `backend/app/api/tools.py`.

Correction:

```bash
sudo systemctl restart sercora-api
```

## Securite Operationnelle

- Ne jamais afficher ou committer le jeton Snipe-IT.
- Ne jamais ajouter `backend/.env` au depot.
- Verifier avec `git status --ignored` que les `.env` restent ignores.
- Tester `https://api.serco.pro/tools?limit=1` apres tout changement Snipe-IT.
