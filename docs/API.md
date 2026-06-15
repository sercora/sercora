# Reference API

Cette page resume les endpoints principaux exposes par Sercora.

## Sante Et Version

```text
GET /
GET /health
GET /version
```

## Produits

```text
GET    /products
GET    /products/{product_id}
POST   /products
PUT    /products/{product_id}
DELETE /products/{product_id}
GET    /product-types
GET    /units
```

Le `DELETE /products/{product_id}` desactive le produit au lieu de le supprimer physiquement.

Les produits peuvent inclure un fournisseur et un code fournisseur via les champs:

```text
supplier_name
supplier_product_code
prosol_product_id
prosol_uuid
prosol_sku
manufacturer_sku
category_name
default_purchase_price
msrp_price
price_updated_at
```

Les champs fournisseur alimentent la table de liaison `product_supplier`.
Les champs Prosol restent dans `product` pour lier le produit local a l'article API et rafraichir les prix sans recreer le produit.

## Prosol

```text
GET  /prosol/products/search?query={texte}&limit=20
POST /prosol/products/import
POST /prosol/products/update-prices
```

`GET /prosol/products/search` recherche les produits Prosol et enrichit les resultats avec le code, le format, la categorie, le prix d'achat et le MSRP quand l'API Prosol retourne une offre.

`POST /prosol/products/import` cree ou met a jour un produit local a partir de Prosol:

```json
{
  "prosol_product_id": 10041,
  "prosol_uuid": "89c5263f-9938-11eb-a3fb-f6968cef729a"
}
```

`POST /prosol/products/update-prices` ne modifie que les prix des produits locaux deja lies a Prosol.

Le backend utilise l'API:

```text
https://shop.api.prosol.ca/api/storefront/products/search
```

Le backend utilise:

```text
PROSOL_API_URL=https://shop.api.prosol.ca
PROSOL_API_TOKEN=...
```

Le token Prosol doit rester dans `backend/.env`.

## Soumissions

```text
GET  /estimates
GET  /estimates/{estimate_id}
POST /estimates
```

## Matrice

```text
GET /estimates/{estimate_id}/matrix
```

Retourne les pieces, les lignes de soumission et les quantites necessaires a la matrice frontend.

## Lignes De Soumission

```text
GET    /estimate-lines
GET    /estimate-lines/{line_id}
POST   /estimate-lines
PUT    /estimate-lines/{line_id}
DELETE /estimate-lines/{line_id}
```

## Quantites

```text
GET    /estimate-quantities
GET    /estimate-quantities/{quantity_id}
POST   /estimate-quantities
PUT    /estimate-quantities/{quantity_id}
DELETE /estimate-quantities/{quantity_id}
```

## Projets

```text
GET  /projects
GET  /projects/{project_id}
POST /projects
```

## Pieces

```text
GET  /rooms
GET  /rooms/{room_id}
POST /rooms
```

## Outils

```text
GET /tools
```

Parametres:

```text
limit   Nombre maximal d'outils, defaut 100, max 10000
offset  Decalage de pagination
search  Recherche Snipe-IT
sort    Colonne de tri, defaut asset_tag. L'interface utilise asset_tag, location ou name
order   asc ou desc
```

Exemple:

```text
GET /tools?limit=100&search=drill
```

Reponse:

```json
{
  "total": 467,
  "rows": [
    {
      "id": 527,
      "asset_tag": "3WAY 02",
      "name": "3-way",
      "serial": "",
      "model": "outils",
      "model_number": "",
      "category": "outils",
      "manufacturer": "",
      "status": "Ready to Deploy",
      "status_type": "deployable",
      "assigned_to": "",
      "location": "",
      "last_checkout": "",
      "updated_at": "2026-04-22 1:17PM"
    }
  ]
}
```

L'API `/tools` depend de `SNIPEIT_URL` et `SNIPEIT_API_TOKEN` cote serveur.
