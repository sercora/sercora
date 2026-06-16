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
- exclusions;
- addenda.

## Tables Principales

```text
app_user
client
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
estimate
room
estimate_line
estimate_quantity
estimate_supplier_quote
email_settings
password_setup_token
```

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

## Modele Soumission

```text
estimate
  -> room
  -> estimate_line
       -> estimate_quantity
  -> estimate_supplier_quote
```

Une nouvelle revision clone cette structure.

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

## Migrations

Les migrations sont numerotees:

```text
002_clients_suppliers.sql
...
021_project_exclusions.sql
```

Regles:

- appliquer dans l'ordre;
- preferer `ADD COLUMN IF NOT EXISTS`;
- eviter les suppressions destructives;
- garder `schema.sql` coherent avec les migrations;
- documenter les changements dans `docs/API.md` si l'API est affectee.

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
