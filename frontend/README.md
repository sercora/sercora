# Frontend Sercora

Le frontend Sercora est une application React + TypeScript construite avec Vite. Il fournit l'interface de travail pour les soumissions, les produits et les outils.

## Commandes

```bash
npm run dev
npm run build
npm run lint
```

## Configuration API

Le client API utilise `VITE_API_URL` quand la variable est definie. Sinon il utilise `https://api.serco.pro`.

Exemple local:

```text
VITE_API_URL=http://localhost:8000
```

Cette valeur locale doit rester dans `.env.local`, ignore par Git.

## Surfaces

- `Soumissions`: matrice AG Grid pour quantites et calculs.
- `Produits`: catalogue produit interne.
- `Outils`: inventaire live via l'API backend `/tools`.

## Fichiers Importants

- `src/App.tsx`: shell, navigation et selection de page.
- `src/pages/MatrixView.tsx`: experience Soumissions.
- `src/pages/ProductsPage.tsx`: experience Produits.
- `src/pages/ToolsPage.tsx`: experience Outils.
- `src/utils/matrixApi.ts`: base URL API et appels matrice.
- `src/utils/productsApi.ts`: appels produits.
- `src/utils/toolsApi.ts`: appels outils.
- `src/utils/matrixCalculations.ts`: calculs metier de la matrice.

## Note Lint

`npm run lint` peut encore signaler des `any` historiques dans la matrice. Les nouveaux fichiers lies aux outils peuvent etre verifies separement avec:

```bash
npx eslint src/pages/ToolsPage.tsx src/utils/toolsApi.ts
```
