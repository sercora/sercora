# Guide Estimateur

Ce guide resume l'utilisation quotidienne de Sercora pour preparer une soumission.

## Objectif

L'estimateur utilise Sercora pour:

- creer ou suivre un projet en soumission;
- consulter les clients et contacts utiles;
- construire une matrice d'estimation;
- choisir les produits;
- saisir les quantites par local et surface;
- comparer les prix courants avec les prix quotes;
- preparer les informations necessaires a la future transmission de soumission.

## 1. Projets En Soumission

Menu: `Projets > En Soumission`

Fonctions disponibles:

- voir les projets avec statut `PENDING`;
- filtrer par etat de decision: nouveaux, approuves, indecis, refuses, envoyes;
- consulter le nombre de revisions;
- ouvrir la derniere revision de matrice;
- ouvrir le dossier projet;
- modifier les informations courantes du projet.

Informations importantes:

- nom du projet;
- adresse;
- client;
- date de depot;
- numero BSDQ;
- heure de tombee BSDQ;
- addenda.

## 2. Creation De Projet

Menu: `Projets > Creation`

La creation peut:

- creer le projet dans Sercora;
- copier l'arborescence type du NAS;
- associer des clients;
- ajouter des fichiers et courriels `.msg`;
- creer ou assurer la revision initiale.

La recherche BSDQ peut pre-remplir:

- numero BSDQ;
- nom du projet;
- adresse;
- date et heure de tombee.

## 3. Matrice De Soumission

La matrice est le coeur du travail d'estimation.

Elle permet de gerer:

- locaux;
- etages;
- surfaces;
- produits;
- quantites;
- pertes;
- coutants;
- profit;
- installation;
- heures;
- multiplicateur d'hommes;
- jours;
- sous-totaux.

Les donnees sont organisees par lignes de produits et colonnes de locaux.

## 4. Prix Current Et Quoted

Le prix `quoted` est le prix fige dans la ligne de soumission avec une date.

Le prix `current` est le prix courant du catalogue produit.

Utilisation:

- `quoted`: comprendre le prix utilise lors de la preparation d'une revision;
- `current`: voir si le catalogue a change depuis;
- delta: evaluer l'impact potentiel d'une mise a jour de prix.

Cette distinction est importante pour ne pas modifier retroactivement le contexte de prix d'une soumission deja travaillee.

## 5. Resume De Soumission

La matrice contient un resume avec:

- architecte;
- date des plans;
- pages de plans;
- devis;
- addenda;
- exclusions;
- fournisseurs;
- echeancier probable;
- retenue;
- garantie.

Ces champs preparent les futures lettres, transmissions et documents finaux.

## 6. Produits

Menu: `Produits`

Fonctions disponibles:

- rechercher un produit;
- filtrer par famille ou fournisseur;
- consulter les fiches techniques;
- consulter les prix;
- modifier un produit;
- modifier plusieurs produits selectionnes;
- choisir les colonnes visibles.

Le fournisseur dans l'edition produit provient des fournisseurs du systeme.

## 7. Clients, Fournisseurs Et Contacts

Menus:

- `Clients`;
- `Fournisseurs`;
- `Contacts`.

Utilisation:

- valider les coordonnees client;
- consulter les estimateurs associes au client;
- consulter les contacts fournisseur;
- identifier les contacts par tache: payables, commande, estimation, direction, projets.

## 8. Calibre

Menu: `Calibre`

Calibre sert au releve de plans.

Fonctions disponibles:

- importer PDF ou image;
- calibrer l'echelle;
- mesurer lignes, rectangles et polygones;
- organiser par calques et secteurs;
- consulter les resultats de surfaces et longueurs.

Limite actuelle:

- Calibre est avance cote frontend, mais son flux complet vers la matrice et la persistance serveur doivent rester consideres partiels.

## 9. Limites Actuelles

Implemente:

- preparation de matrice;
- revisions;
- prix quotes;
- resume;
- navigation NAS;
- consultation produits/clients/fournisseurs.

Partiel:

- Calibre connecte completement a la matrice;
- contacts utilises dans les documents transactionnels;
- alertes BSDQ automatiques.

Futur:

- envoi complet de soumission;
- production de lettres;
- bons de commande;
- factures.
