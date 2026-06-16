# Operations Et Deploiement

Ce document decrit les operations courantes de Sercora en production.

## Services

```text
Frontend: https://sercora.serco.pro
API:      https://api.serco.pro
Repo:     /home/simon/sercora
Web:      /var/www/sercora
Service:  sercora-api
Proxy:    nginx
```

## Deployer

Depuis la racine du depot:

```bash
./deploy/deploy.sh
```

Le script:

1. construit le frontend avec `npm run build`;
2. force `VITE_API_URL=https://api.serco.pro`;
3. copie `frontend/dist/` vers `/var/www/sercora/`;
4. redemarre `sercora-api`;
5. recharge nginx.

## Verifications Apres Deploiement

```bash
curl -i https://sercora.serco.pro/
curl -i https://api.serco.pro/health
curl -i "https://api.serco.pro/projects?scope=submission"
curl -i "https://api.serco.pro/estimates/1/matrix"
curl -i "https://api.serco.pro/tools?limit=1"
systemctl is-active sercora-api nginx
```

Logs API:

```bash
journalctl -u sercora-api -n 100 --no-pager
```

Etat service:

```bash
systemctl status sercora-api --no-pager -n 40
```

## Configuration Backend

Le service systemd charge:

```text
/home/simon/sercora/backend/.env
```

Variables importantes:

```text
SNIPEIT_URL=https://snipe.serco.pro
SNIPEIT_API_TOKEN=...
PROSOL_API_URL=https://shop.api.prosol.ca
PROSOL_API_TOKEN=...
SERCORA_PROJECT_TEMPLATE_ROOT=/NAS/Soumissions en cours/000-Dossier type
SERCORA_PROJECT_RW_ROOT=/NAS_SERCORA_RW
```

Ne pas committer ce fichier.

## Redemarrer L'API

```bash
sudo systemctl restart sercora-api
```

## Recharger nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Installer Ou Mettre A Jour systemd

```bash
sudo cp deploy/sercora-api.service /etc/systemd/system/sercora-api.service
sudo systemctl daemon-reload
sudo systemctl enable sercora-api
sudo systemctl restart sercora-api
```

## Migrations Base De Donnees

Les migrations sont dans:

```text
database/migrations/
```

Elles doivent etre appliquees dans l'ordre numerique. Plusieurs endpoints ajoutent aussi certains champs avec `ALTER TABLE IF NOT EXISTS` pour eviter une panne lors d'un deploiement progressif.

Verifier le schema avant une operation risquee:

```bash
psql postgresql://sercora@localhost:5432/sercora -c "\d project"
```

## NAS

Sercora doit pouvoir lire:

```text
/NAS/Soumissions en cours
/NAS/Soumissions envoyees
/NAS/@Recycle/Soumissions en cours
```

L'ecriture doit rester limitee au dossier Sercora RW:

```text
/NAS_SERCORA_RW
```

Verifier:

```bash
mount | grep NAS
ls "/NAS/Soumissions en cours"
ls "/NAS_SERCORA_RW"
```

## LibreOffice

Les apercus Word/Excel utilisent LibreOffice cote serveur.

Verifier l'installation:

```bash
which libreoffice
libreoffice --version
```

Si un document Office affiche seulement du texte brut ou ne s'affiche pas, verifier les logs API et la disponibilite de LibreOffice.

## SMTP

La configuration SMTP est disponible dans **Configuration > Courriel** pour les admins.

Fonctions:

- serveur SMTP;
- port;
- TLS/SSL;
- usager/mot de passe;
- expediteur;
- reply-to;
- test d'envoi;
- invitations et reset de mot de passe.

Apres une modification SMTP, utiliser le bouton de test dans l'interface avant d'envoyer des invitations.

## VoIP/SMS

La configuration SMS est disponible dans **Configuration > VoIP/SMS** pour les admins.

Objectif:

- envoyer des tests SMS manuels;
- fournir la configuration des futures alertes BSDQ aux estimateurs;
- alerter par defaut 30 minutes avant la tombee BSDQ.

Configuration VoIP.ms validee:

```text
Fournisseur: VoIP.ms
ID compte: adresse courriel du compte VoIP.ms
Cle API: cle API du menu API VoIP.ms
Secret / token API: vide
No expediteur SMS: DID VoIP.ms autorise SMS/A2P
Alerte avant depot BSDQ: 30
```

Avant de sauvegarder, verifier que le DID est autorise pour SMS/A2P dans VoIP.ms. Le compte peut avoir une limite A2P par defaut, par exemple 100 SMS par jour.

Apres sauvegarde:

1. entrer une destination test;
2. entrer un message court;
3. cliquer **Tester SMS**;
4. lire le detail fournisseur affiche dans Sercora.

Pour VoIP.ms, Sercora normalise `No expediteur SMS` et `Destination test` en chiffres seulement avant l'appel API. Un numero comme `+1 514 555 1212` est envoye comme `15145551212`.

Si le test retourne `Username or Password is incorrect`, verifier:

- que `ID compte` est bien l'adresse courriel du compte VoIP.ms;
- que `Cle API` est bien la cle du menu API VoIP.ms;
- que `Secret / token API` est vide pour VoIP.ms.

## Snipe-IT

Verifier:

```bash
curl -i "https://api.serco.pro/tools?limit=1"
```

Si les outils ne chargent pas:

1. verifier `SNIPEIT_URL`;
2. verifier `SNIPEIT_API_TOKEN`;
3. redemarrer `sercora-api`;
4. verifier les logs.

Les images d'outils passent par:

```text
GET /tools/{tool_id}/image
```

## Prosol

Verifier que les variables Prosol sont presentes dans `backend/.env`.

Endpoints utiles:

```text
GET  /prosol/products/search
POST /prosol/products/import
POST /prosol/products/sync-technical-sheets
POST /prosol/products/update-prices
```

## Imports Fournisseurs

Les imports de prix se font dans **Configuration > Importation**:

- Mise a Jour web Prosol;
- Televersement liste Schluter;
- Televersement liste Centura;
- Televersement du Catalogue PDF Olympia.

Les escomptes fournisseurs doivent etre valides avant d'appliquer un import de prix.

## Developpement Local

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

Frontend local vers API locale:

```text
frontend/.env.local
VITE_API_URL=http://localhost:8000
```

## Problemes Connus

### Le site public appelle localhost

Symptome: les donnees ne chargent pas sur `sercora.serco.pro`.

Correction:

```bash
./deploy/deploy.sh
```

### Produits ou projets ne chargent pas apres migration

Verifier les logs:

```bash
journalctl -u sercora-api -n 100 --no-pager
```

Puis verifier la migration SQL associee.

### La matrice ouvre la mauvaise revision

Depuis **Projets > En Soumission**, utiliser **Derniere revision**. Le menu **Soumissions LEGACY** conserve les vues historiques.

### Les fichiers NAS ne s'ouvrent pas

Verifier:

- montage NFS;
- permissions de lecture;
- chemin relatif;
- LibreOffice pour Word/Excel;
- logs API.

## Git

Branche active de travail:

```text
codex
```

Pousser apres deploy si le changement est valide:

```bash
git push origin codex
```
