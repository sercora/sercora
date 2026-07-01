# Guide Administration

Ce guide resume les operations d'administration de Sercora.

## Objectif

L'administrateur gere:

- usagers;
- roles;
- configuration courriel;
- configuration VoIP/SMS;
- configuration Snipe-IT;
- imports fournisseurs;
- verification du statut applicatif.

## 1. Usagers Et Roles

Menu: `Configuration > Usagers`

Roles disponibles:

```text
admin
execution
estimation
entrepot
```

Fonctions:

- creer un usager;
- modifier un usager;
- inviter un usager;
- forcer ou envoyer un reset de mot de passe;
- consulter derniere connexion;
- gerer le numero de telephone pour les futures alertes SMS.

Regle pratique:

- limiter le role `admin` aux personnes qui doivent modifier la configuration systeme.

## 2. Courriel SMTP

Menu: `Configuration > Courriel`

Champs:

- serveur SMTP;
- port;
- TLS/SSL;
- usager;
- mot de passe;
- expediteur;
- reply-to;
- actif.

Utilisations:

- invitations;
- resets de mot de passe;
- tests d'envoi.

Apres une modification, utiliser le bouton de test avant d'envoyer des invitations.

## 3. VoIP/SMS

Menu: `Configuration > VoIP/SMS`

Fonctions implementees:

- sauvegarder la configuration SMS;
- tester un envoi manuel;
- conserver le delai d'alerte BSDQ.

Configuration VoIP.ms:

```text
Fournisseur: VoIP.ms
ID compte: adresse courriel du compte VoIP.ms
Cle API: cle API du menu API VoIP.ms
Secret / token API: vide
No expediteur SMS: DID autorise SMS/A2P
Alerte avant depot BSDQ: 30
```

Limite actuelle:

- les alertes BSDQ automatiques sont prevues mais pas finalisees.

## 4. Snipe-IT

Menu: `Configuration > Snipe-IT`

Champs:

- URL Snipe-IT;
- usager/libelle;
- token API;
- actif.

Fonctions:

- changer l'instance Snipe-IT sans modifier le serveur;
- tester la connexion;
- alimenter les menus `Outils` et `Chantiers`.

Regle de securite:

- le token Snipe-IT ne doit jamais etre expose au frontend;
- le backend Sercora agit comme proxy vers Snipe-IT.

Si la configuration DB est absente ou inactive, le backend peut utiliser les variables d'environnement.

## 5. Imports Fournisseurs

Menu: `Configuration > Importation`

Fonctions:

- mise a jour web Prosol;
- import liste Schluter;
- import liste Centura;
- import catalogue Olympia;
- gestion des escomptes fournisseurs.

Avant un import:

- verifier l'escompte fournisseur;
- privilegier un echantillon si le fichier est nouveau;
- confirmer que les colonnes attendues sont presentes.

## 6. Statut Operations

Menu: `Configuration > Statut`

Affiche:

- etat frontend;
- healthcheck backend;
- commit courant;
- backlog operations genere au build;
- releases detectees.

Cette page sert a confirmer rapidement qu'un deploy est charge par le navigateur et que l'API repond.

## 7. Staging Et Production

Staging:

```text
/home/simon/sercora-staging
deploy/deploy-staging.sh
sercora-staging-api
```

Production:

```text
/home/simon/sercora
deploy/deploy.sh
sercora-api
```

Regle:

- valider sur staging avant de promouvoir vers `main` ou production.

## 8. Integrations Futures

Visibles mais non implementees:

- QuickBooks;
- Mobile-Punch.

Ne pas documenter ces integrations comme actives tant que les endpoints, schemas et ecrans fonctionnels n'existent pas.
