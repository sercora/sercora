# Roadmap Documentaire Et Produit

Ce document separe l'etat reel du depot des intentions futures.

## Implemente

- Authentification, roles, usagers, profil.
- SMTP, invitations et reset mot de passe.
- Configuration VoIP/SMS et test manuel.
- Clients enrichis, estimateurs, taxes et edition en lot.
- Contacts clients/fournisseurs avec taches.
- Fournisseurs enrichis.
- Catalogue produits, imports, Prosol, rabais et edition en lot.
- Projets en soumission, BSDQ, creation avec fichiers et navigation NAS.
- Soumissions, revisions et matrice d'estimation.
- Resume de soumission avec plans, devis, addenda, exclusions, fournisseurs, echeancier, retenue et garantie.
- Snapshots de prix current/quoted par ligne de soumission.
- Outils Snipe-IT, chantiers, edition, checkout, images et QR.
- Configuration Snipe-IT en DB.
- Calibre cote frontend.
- Preferences utilisateur pour colonnes visibles.
- Statut operations et backlog de commits.
- Deploiement staging et production.

## Partiellement Implemente

- Edition multiple pour tous les modules: disponible pour clients et produits; incomplet pour contacts/fournisseurs.
- Contacts dans les flux transactionnels: modele present, utilisation future dans soumissions, commandes et factures.
- Calibre persistant et connecte a la matrice: frontend present, integration complete a finaliser.
- Alertes BSDQ: champs, VoIP/SMS et donnees usager presents; envoi automatique non finalise.
- Snipe-IT dans Sercora: gestion operationnelle utile, mais Snipe-IT reste le systeme maitre.

## Prevu

- Production de lettres.
- Envoi complet de soumission.
- Selection des produits a lister dans la soumission finale.
- Gestion avancee des exclusions et addenda dans les documents finaux.
- Bons de commande.
- Factures.
- Alertes BSDQ automatiques.

## Idee Future

- QuickBooks.
- Mobile-Punch.
- Generation automatique de documentation OpenAPI.
- Diagrammes DB et flux metier.
- Guides visuels avec captures d'ecran.

## Phases Documentation

### Phase 1 - MVP Utilisable Quotidiennement

- Corriger les liens de branche.
- Mettre a jour la reference API.
- Mettre a jour la documentation DB.
- Ajouter le glossaire.
- Ajouter un guide rapide estimateur.
- Ajouter un guide rapide admin.

### Phase 2 - Documentation De Production

- Documenter staging et production separement.
- Ajouter les runbooks NAS, Snipe-IT, SMTP, Prosol et migrations.
- Documenter les procedures de validation apres deploy.
- Documenter les limites connues.

### Phase 3 - Long Terme Et Integrations

- Ajouter des ADR courts.
- Documenter QuickBooks et Mobile-Punch seulement lorsque le code existe.
- Ajouter la documentation des lettres, soumissions finales, bons de commande et factures lorsque ces modules seront construits.
