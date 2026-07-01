# Database

Le dossier `database/` contient le schema PostgreSQL, les donnees initiales et les migrations de Sercora.

## Fichiers

```text
schema.sql
seed.sql
migrations/
```

## Domaines Stockes

- usagers et roles;
- clients;
- contacts;
- fournisseurs;
- produits;
- prix;
- fiches techniques;
- options de couverture;
- projets;
- invitations;
- soumissions;
- revisions;
- locaux;
- lignes de matrice;
- quantites;
- soumissions fournisseurs;
- configuration SMTP;
- configuration VoIP/SMS;
- exclusions;
- addenda.

## Tables Principales

```text
app_user
app_email_settings
app_sms_settings
app_snipeit_settings
app_user_preference
client
client_estimator
client_type
supplier
product_type
unit
surface_type
product
product_supplier
product_document
product_coverage_option
supplier_discount
project
project_client
project_invitation
contact
contact_task
contact_task_link
contact_type
estimate
room
estimate_line
estimate_quantity
estimate_supplier_quote
app_user_token
```

`app_user.phone_number` sert aux alertes SMS par usager.

## Modele Projet

```text
project
  -> project_client
  -> project_invitation
  -> estimate
```

Le projet contient aussi:

- architecte;
- date des plans;
- pages de plans;
- devis;
- addenda;
- exclusions;
- date de depot;
- echeancier;
- remise;
- garantie.

## Contacts Et Fournisseurs

Les contacts sont separes des clients et fournisseurs.

Tables:

```text
contact_type
contact_task
contact
contact_task_link
```

Un contact appartient soit a un client, soit a un fournisseur.

Taches initiales:

```text
payables
commande
estimation
direction
projets
```

Les fournisseurs ont ete enrichis avec:

```text
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
```

## Clients Enrichis

Les clients ont ete enrichis avec:

```text
phone
fax
mobile
billing_address
billing_postal_code
rbq
federal_tax_number
provincial_tax_number
```

Les estimateurs de clients sont stockes dans:

```text
client_estimator
```

## Modele Soumission

```text
estimate
  -> room
  -> estimate_line
       -> estimate_quantity
  -> estimate_supplier_quote
```

Une nouvelle revision clone cette structure.

Les lignes de soumission conservent aussi un snapshot de prix:

```text
estimate_line.quoted_purchase_price
estimate_line.quoted_price_date
```

## Produits

Les produits peuvent etre relies a plusieurs fournisseurs par `product_supplier`.

Champs importants:

- manufacturier;
- collection;
- couleur;
- fini;
- format;
- unite par defaut;
- prix liste;
- coutant;
- fournisseur;
- code fournisseur;
- fiches techniques;
- options de couverture;
- actif/inactif.

## Escomptes

`supplier_discount` permet de configurer les escomptes par fournisseur, par exemple:

- Schluter;
- Centura;
- Olympia.

Ces escomptes peuvent etre appliques en lot.

## Preferences Utilisateur

`app_user_preference` stocke les preferences JSON par utilisateur, notamment les colonnes visibles par page.

## Configuration Snipe-IT

`app_snipeit_settings` stocke l'instance Snipe-IT configurable depuis l'interface admin.

Si la configuration DB est absente ou inactive, le backend peut utiliser les variables d'environnement.

## Migrations

Les migrations sont numerotees:

```text
002_clients_suppliers.sql
...
033_estimate_line_price_snapshots.sql
```

Regles:

- appliquer dans l'ordre;
- preferer `ADD COLUMN IF NOT EXISTS`;
- eviter les suppressions destructives;
- garder `schema.sql` coherent avec les migrations;
- documenter les changements dans `docs/api/index.md` si l'API est affectee.

Migrations recentes:

- `024_sms_settings.sql`: table `app_sms_settings`;
- `025_app_user_phone_number.sql`: colonne `app_user.phone_number`.
- `026_contacts.sql`: contacts, types de contacts et taches;
- `027_client_enrichment.sql`: champs clients enrichis et `client_estimator`;
- `028_snipeit_settings.sql`: configuration Snipe-IT en DB;
- `029_supplier_tax_numbers.sql`: coordonnees et taxes fournisseurs;
- `030_client_tax_numbers.sql`: taxes clients;
- `031_supplier_profile_fields.sql`: champs profil fournisseur;
- `032_app_user_preferences.sql`: preferences utilisateur JSON;
- `033_estimate_line_price_snapshots.sql`: prix quote et date par ligne de soumission.

## Verifications Utiles

```bash
psql postgresql://sercora@localhost:5432/sercora -c "\dt"
psql postgresql://sercora@localhost:5432/sercora -c "\d project"
psql postgresql://sercora@localhost:5432/sercora -c "\d estimate_line"
```

## Sauvegarde

Avant une migration risquee:

```bash
pg_dump postgresql://sercora@localhost:5432/sercora > /tmp/sercora-backup.sql
```

## Precautions

- Ne jamais tester une migration destructive directement en production.
- Verifier les imports fournisseur sur un echantillon quand possible.
- Les champs ajoutes pour le frontend doivent exister dans le schema, la migration et les types TypeScript.
