# Glossaire Metier

Ce glossaire fixe le vocabulaire a utiliser dans la documentation Sercora.

## Projet

Dossier commercial ou operationnel associe a une opportunite, une soumission ou un chantier.

Dans le code: `project`.

## Soumission

Offre de prix preparee pour un projet. Dans Sercora, elle est principalement representee par une matrice d'estimation et ses revisions.

## Revision

Version numerotee d'une soumission. Une revision est clonee depuis une soumission existante pour conserver l'historique.

Dans le code: `estimate.revision_number`.

## Local

Zone logique d'un projet utilisee pour ventiler les quantites.

Exemples: hall, corridor, salle de bain.

Dans le code: `room`.

## Surface

Type de surface ou un produit est applique.

Exemples: plancher, mur, plinthe.

Dans le code: `surface_type`.

## Produit

Article du catalogue utilise dans une soumission. Un produit peut avoir un type, une unite, un fournisseur, un code fournisseur, un prix, des fiches techniques et des options de couverture.

Dans le code: `product`.

## Fournisseur

Entreprise qui fournit des produits ou services.

Dans le code: `supplier`.

## Type De Produit

Classification d'un produit.

Exemples: Tuile, Schluter, Mapei, Prosol.

Dans le code: `product_type`.

## Perte

Pourcentage ajoute a une quantite pour couvrir coupes, bris et surplus.

Dans le code: `estimate_line.loss_percent`.

## Coutant

Prix d'achat ou cout interne utilise pour calculer le prix de vente.

Dans le code: `purchase_price` ou `default_purchase_price`.

## Vendant

Prix facture au client apres application du profit, de l'installation et des autres regles de calcul.

## Marge

Ecart entre le coutant et le vendant. La methode exacte de calcul doit etre precisee lorsqu'elle est utilisee, car marge et profit peuvent etre confondus.

## Profit

Pourcentage applique dans la matrice pour etablir le prix vendant.

Dans le code: `profit_percent` et `global_profit_percent`.

## Rendement

Productivite d'installation. Dans Sercora, le rendement est actuellement exprime indirectement par les couts d'installation, heures, multiplicateur d'hommes et jours.

## Estimation

Processus de calcul des quantites, couts, pertes, installation, temps et profit qui produit une soumission.

## Prix Current

Prix courant du catalogue produit au moment de la consultation.

Dans le code: `current_purchase_price`.

## Prix Quoted

Prix fige dans une ligne de soumission, avec sa date, pour conserver le contexte de prix utilise dans une revision.

Dans le code: `quoted_purchase_price` et `quoted_price_date`.
