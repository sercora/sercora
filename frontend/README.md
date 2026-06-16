# Frontend

Le frontend Sercora est une application React + TypeScript construite avec Vite.

## Commandes

```bash
npm run dev
npm run build
npm run lint
```

## Configuration API

Le client API utilise:

```text
VITE_API_URL
```

Si la variable est absente, il utilise:

```text
https://api.serco.pro
```

Developpement local:

```text
frontend/.env.local
VITE_API_URL=http://localhost:8000
```

Le deploy force l'API publique.

## Structure

```text
src/
  App.tsx
  main.tsx
  pages/
  components/
  utils/
  styles/
  assets/
```

## App.tsx

Gere:

- login/session;
- menu principal;
- sous-menus;
- page active;
- roles admin;
- redirection vers la derniere revision d'un projet;
- footer avec GitHub, documentation et credits.

Menus:

- Clients;
- Projets;
- Produits;
- Outils;
- Soumissions LEGACY;
- Usagers;
- Configuration;
- Profil.

## Pages

```text
ClientsPage.tsx
ProjectsPage.tsx
ProductsPage.tsx
ToolsPage.tsx
MatrixView.tsx
UsersPage.tsx
ProfilePage.tsx
LoginPage.tsx
SetPasswordPage.tsx
ConfigurationPage.tsx
ImportationPage.tsx
```

## Projets

`ProjectsPage.tsx` gere:

- liste des projets en soumission;
- nombre de revisions;
- bouton Derniere revision;
- bouton Dossier avec navigation de l'arborescence projet et apercu PDF/Office/.msg;
- modification de date de depot;
- ajout de clients;
- ajout de `.msg`;
- ajout d'addenda;
- creation de projet;
- drag/drop Outlook `.msg`;
- selection de dossiers a televerser.

## Matrice

`MatrixView.tsx` gere:

- resume de soumission;
- architecte;
- pages de plans;
- devis;
- addenda;
- exclusions;
- fournisseurs;
- echantillons;
- taux;
- profit;
- echeancier;
- locaux;
- lignes;
- quantites;
- sous-totaux;
- heures et jours;
- liens entre lignes;
- remplacement de produits;
- edition produit;
- sauvegarde de nouvelle revision;
- navigateur de fichiers NAS.

## Produits

`ProductsPage.tsx` gere:

- liste paginee;
- recherche;
- sous-menus Tuiles, Schluter, Mapei, Prosol;
- fournisseurs tuiles Centura et Olympia;
- produits actifs/inactifs;
- edition;
- fiches techniques;
- prix liste et coutant;
- imports et mises a jour via Configuration.

## Outils

`ToolsPage.tsx` gere:

- scopes Disponible et Deploye;
- recherche;
- tri;
- pagination;
- images;
- donnees Snipe-IT normalisees.

## Configuration

`ConfigurationPage.tsx` affiche les sous-pages admin:

- Courriel;
- VoIP/SMS;
- Importation.

La sous-page VoIP/SMS gere:

- fournisseur SMS;
- numero expediteur;
- identifiants fournisseur;
- delai d'alerte BSDQ;
- test SMS manuel avec destination et message.

Configuration VoIP.ms dans l'interface:

- `ID compte`: adresse courriel du compte VoIP.ms;
- `Cle API`: cle API du menu API VoIP.ms;
- `Secret / token API`: vide;
- `No expediteur SMS`: DID VoIP.ms autorise SMS/A2P.

`ImportationPage.tsx` gere les mises a jour de prix et catalogues.

## Utils

```text
authApi.ts
businessApi.ts
matrixApi.ts
matrixCalculations.ts
productsApi.ts
prosolApi.ts
toolsApi.ts
```

`matrixCalculations.ts` contient les calculs metier purs de la matrice.

## Styles

```text
App.css
styles/auth.css
styles/business.css
styles/grid.css
styles/products.css
styles/tools.css
```

Le style vise une application professionnelle dense, pas une landing page.

## Build Production

```bash
VITE_API_URL=https://api.serco.pro npm run build
```

Le script `../deploy/deploy.sh` applique deja cette configuration.

## Points D'attention

- `MatrixView.tsx` est volumineux.
- Tester la build apres chaque modification TypeScript.
- Ne pas ajouter de token dans le frontend.
- Garder les tableaux responsifs avec scroll horizontal/vertical.
- Verifier que les boutons longs restent lisibles.
