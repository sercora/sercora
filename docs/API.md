# Reference API

L'API Sercora est exposee par FastAPI sur:

```text
https://api.serco.pro
```

En developpement local:

```text
http://localhost:8000
```

## Sante

```text
GET /
GET /health
GET /version
```

## Authentification Et Usagers

```text
POST /auth/login
GET  /auth/me
PUT  /auth/me
GET  /users
POST /users
PUT  /users/{user_id}
POST /users/{user_id}/invite
POST /users/{user_id}/password-reset
POST /auth/set-password
```

Roles supportes:

```text
admin
execution
estimation
entrepot
```

La liste des usagers retourne aussi la date de creation et la derniere connexion.

## Courriel

Endpoints admin:

```text
GET  /admin/email-settings
PUT  /admin/email-settings
POST /admin/email-settings/test
POST /user-invitations
```

La configuration inclut SMTP, expediteur et reply-to.

## Clients

```text
GET  /client-types
GET  /clients
POST /clients
PUT  /clients/{client_id}
```

Les clients sont rattaches aux projets et aux invitations.

## Projets

```text
GET  /projects?scope=all
GET  /projects?scope=current
GET  /projects?scope=submission
GET  /projects/{project_id}
POST /projects
POST /projects/with-files
PUT  /projects/{project_id}/current-edit
```

Scopes:

- `all`: tous les projets;
- `current`: projets non fermes/refuses/archives;
- `submission`: projets avec statut `PENDING`.

La liste retourne notamment:

```text
revision_zero_estimate_id
latest_estimate_id
revision_count
invitations
addenda
```

`POST /projects/with-files` cree le projet, copie l'arborescence type NAS et accepte:

- fichiers `.msg`;
- fichiers de dossier projet;
- client;
- date de depot;
- informations de projet.

`PUT /projects/{project_id}/current-edit` permet:

- modifier la date de depot;
- ajouter des clients;
- ajouter des `.msg`;
- ajouter un addenda;
- creer/assurer la revision 0.

## Soumissions Et Revisions

```text
GET  /estimates
GET  /estimates/{estimate_id}
POST /estimates
POST /estimates/{estimate_id}/revisions
```

`POST /estimates/{estimate_id}/revisions` clone la revision affichee:

- estimate;
- rooms;
- estimate_line;
- estimate_quantity;
- liens entre lignes;
- fournisseurs.

## Matrice

```text
GET /estimates/{estimate_id}/matrix
PUT /estimates/{estimate_id}/matrix-summary
GET /surface-types
```

`GET /matrix` retourne:

- resume de projet;
- estimate;
- taux;
- clients;
- fournisseurs;
- echantillons;
- locaux;
- colonnes de locaux;
- lignes;
- quantites.

`PUT /matrix-summary` sauvegarde:

- taux utilise;
- profit global;
- architecte;
- date des plans;
- pages de plans;
- devis;
- addenda;
- exclusions;
- echeancier probable;
- remise;
- garantie.

## Locaux

```text
GET    /rooms
GET    /rooms/{room_id}
POST   /rooms
PUT    /rooms/{room_id}
DELETE /rooms/{room_id}
```

Un local contient:

```text
phase_name
phase_label
floor_name
floor_label
room_name
sort_order
```

L'interface utilise surtout l'etage et son libelle.

## Lignes De Soumission

```text
GET    /estimate-lines
GET    /estimate-lines/{line_id}
POST   /estimate-lines
PUT    /estimate-lines/{line_id}
PUT    /estimate-lines/{line_id}/position
PUT    /estimate-lines/{line_id}/product
DELETE /estimate-lines/{line_id}
```

Champs importants:

```text
estimate_id
product_id
surface_type_id
unit_id
plan_code
loss_percent
purchase_price
profit_percent
profit_forced
installation_cost
installation_link_source_line_id
installation_link_multiplier
quantity_link_source_line_ids
quantity_link_multiplier
manpower_multiplier
sort_order
```

## Quantites

```text
GET    /estimate-quantities
GET    /estimate-quantities/{quantity_id}
POST   /estimate-quantities
PUT    /estimate-quantities/{quantity_id}
DELETE /estimate-quantities/{quantity_id}
```

Les quantites relient une ligne de soumission et un local.

## Produits

```text
GET    /products
GET    /products/{product_id}
POST   /products
PUT    /products/{product_id}
PUT    /products/bulk
DELETE /products/{product_id}
GET    /product-types
GET    /units
```

`DELETE /products/{product_id}` desactive le produit au lieu de le supprimer physiquement.

La liste supporte fournisseurs, recherche, pagination et produits actifs/inactifs.

Champs utiles:

```text
name
manufacturer_name
collection_name
color_name
finish_name
size_name
default_unit_id
default_purchase_price
msrp_price
supplier_name
supplier_product_code
technical_documents
coverage_options
active
```

## Escomptes Fournisseurs

```text
GET  /supplier-discounts
PUT  /supplier-discounts/{supplier_name}
POST /supplier-discounts/{supplier_name}/apply
```

Utilise pour Schluter, Centura, Olympia et autres fournisseurs.

## Imports Produits

```text
POST /products/schluter/price-list
POST /products/centura/price-list
POST /products/olympia/price-list
```

Ces endpoints alimentent les catalogues fournisseurs.

## Prosol

```text
GET  /prosol/products/search
POST /prosol/products/import
POST /prosol/products/sync-technical-sheets
POST /prosol/products/update-prices
```

Fonctions:

- recherche Prosol;
- import produit;
- mise a jour des fiches techniques;
- mise a jour des prix des produits lies.

Le token Prosol reste cote backend.

## Outils Snipe-IT

```text
GET /tools
GET /tools/{tool_id}/image
```

Parametres `/tools`:

```text
scope   available ou deployed
limit   10, 20, 50, 100 ou all cote interface
offset  pagination
search  recherche texte
sort    tag, chantier, nom ou champs Snipe normalises
order   asc ou desc
```

La reponse contient:

```text
id
asset_tag
name
serial
model
category
manufacturer
status
status_type
location
last_checkout
updated_at
image_url
image_proxy_path
```

## Fichiers De Soumission

```text
GET /estimate-folders
GET /estimate-files
GET /estimate-file-preview
```

Ces endpoints naviguent les dossiers NAS et retournent des apercus PDF, MSG, Word ou Excel lorsque possible.

Statuses:

```text
in_progress
sent
rejected
```

## Erreurs Courantes

- `404`: ressource inexistante ou route non deployee.
- `422`: payload invalide ou date invalide.
- `500`: erreur serveur, NAS, conversion de fichier ou integration.
- `503`: integration externe indisponible ou token manquant.
