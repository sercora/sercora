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
limit   Nombre maximal d'outils, defaut 100, max 500
offset  Decalage de pagination
search  Recherche Snipe-IT
sort    Colonne de tri, defaut asset_tag
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
