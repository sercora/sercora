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
Les payloads usagers et profil contiennent aussi `phone_number`, utilise pour les alertes SMS.

## Courriel

Endpoints admin:

```text
GET  /admin/email-settings
PUT  /admin/email-settings
POST /admin/email-settings/test
POST /user-invitations
```

La configuration inclut SMTP, expediteur et reply-to.

## VoIP/SMS

Endpoints admin:

```text
GET  /admin/sms-settings
PUT  /admin/sms-settings
POST /admin/sms-settings/test
```

Champs principaux:

```text
provider_name
account_id
api_key
api_secret
from_number
alert_minutes_before
active
```

Configuration VoIP.ms:

- `provider_name`: `VoIP.ms`;
- `account_id`: adresse courriel du compte VoIP.ms;
- `api_key`: cle API du menu API VoIP.ms;
- `api_secret`: vide;
- `from_number`: DID VoIP.ms autorise SMS/A2P;
- `alert_minutes_before`: delai des alertes BSDQ, normalement `30`.

`POST /admin/sms-settings/test` accepte:

```text
destination
message
```

La reponse inclut le fournisseur, le code HTTP fournisseur et le detail retourne par le fournisseur. Sercora ne considere pas un SMS comme accepte tant que la reponse fournisseur ne confirme pas explicitement le succes.

## Clients

```text
GET  /client-types
GET  /clients
POST /clients
PUT  /clients/bulk
PUT  /clients/{client_id}
```

Les clients sont rattaches aux projets et aux invitations.

Champs enrichis:

```text
phone
fax
mobile
billing_address
billing_postal_code
rbq
federal_tax_number
provincial_tax_number
estimators[]
```

`PUT /clients/bulk` permet de modifier plusieurs clients selectionnes.

## Contacts Et Fournisseurs

```text
GET  /contact-types
GET  /contact-tasks
GET  /contacts/options
GET  /contacts
POST /contacts
PUT  /contacts/{contact_id}
GET  /suppliers
PUT  /suppliers/{supplier_id}
```

Types de contacts:

```text
client
supplier
```

Taches de contacts:

```text
payables
commande
estimation
direction
projets
```

Les fournisseurs sont exposes avec les champs de fiche suivants:

```text
name
phone
fax
mobile
billing_address
billing_postal_code
email
contact_name
account_number
website
company_name
tax_identification_number
federal_tax_number
provincial_tax_number
active
```

## Projets

```text
GET  /projects?scope=all
GET  /projects?scope=current
GET  /projects?scope=submission
GET  /projects/{project_id}
GET  /projects/bsdq/search
POST /projects
POST /projects/with-files
PUT  /projects/{project_id}/current-edit
PUT  /projects/{project_id}/submission-state
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

`GET /projects/bsdq/search` interroge le babillard BSDQ public pour pre-remplir un projet.

`PUT /projects/{project_id}/submission-state` modifie l'etat de decision:

```text
new
approved
undecided
rejected
sent
```

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

Les lignes de matrice retournent aussi les prix de comparaison:

```text
quoted_purchase_price
quoted_price_date
current_purchase_price
current_price_date
current_quoted_price_delta
current_quoted_price_delta_percent
```

`quoted_*` represente le prix fige dans la soumission. `current_*` represente le prix courant du catalogue.

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

`PUT /products/bulk` permet de modifier plusieurs produits selectionnes.

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
GET /tools/{tool_id}
PUT /tools/{tool_id}
POST /tools/{tool_id}/checkout
GET /tools/{tool_id}/image
GET /tools/{tool_id}/qr
GET /status-labels
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
qr_proxy_path
asset_url
```

Le backend agit comme proxy vers Snipe-IT. Les modifications faites depuis Sercora appellent l'API Snipe-IT et modifient donc Snipe-IT.

### Chantiers Snipe-IT

Les chantiers correspondent aux locations Snipe-IT.

```text
GET  /locations
POST /locations
PUT  /locations/{location_id}
GET  /locations/{location_id}/tools
```

Parametres `/locations`:

```text
limit
offset
search
sort
order
min_tools
max_tools
```

### Configuration Snipe-IT

Endpoints admin:

```text
GET  /admin/snipeit-settings
PUT  /admin/snipeit-settings
POST /admin/snipeit-settings/test
```

Champs:

```text
base_url
username
api_token
active
```

Si aucune configuration DB active n'est presente, le backend peut utiliser les variables `SNIPEIT_URL` et `SNIPEIT_API_TOKEN`.

## Preferences Utilisateur

```text
GET /user-preferences/{preference_key}
PUT /user-preferences/{preference_key}
```

Ces routes conservent les preferences JSON par utilisateur, notamment les colonnes visibles par page.

## Fichiers De Soumission

```text
GET /estimate-folders
GET /estimate-files
GET /estimate-file-preview
GET /project-folders
GET /project-files
GET /project-file-preview
```

Ces endpoints naviguent les dossiers NAS et retournent des apercus PDF, MSG, Word ou Excel lorsque possible.

Les endpoints `estimate-*` naviguent les racines legacy par statut.
Les endpoints `project-*` naviguent l'arborescence du projet dans le dossier RW Sercora a partir de `project_id`.

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
