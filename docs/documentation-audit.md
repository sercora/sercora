# Audit Documentation Sercora

Audit realise sur la branche `staging`.

Objectif: comparer la documentation existante a l'etat reel du depot et separer clairement ce qui est implemente, partiel, prevu ou futur.

## Etat Actuel

### Forces

- La documentation couvre deja les blocs principaux: frontend, backend, database, API, operations et deploiement.
- Le README racine explique bien la vision produit d'un ERP interne pour une entreprise de carrelage.
- Les regles de securite importantes sont presentes: secrets cote backend, pas de token externe dans le frontend, ecriture NAS limitee au dossier Sercora RW.
- Les modules critiques sont identifies: clients, projets, produits, matrice, NAS, Snipe-IT, SMTP, VoIP/SMS et Prosol.

### Faiblesses

- Plusieurs liens pointaient encore vers la branche `codex` au lieu de `staging` ou `main`.
- La documentation API ne couvrait pas tous les endpoints presents dans FastAPI.
- La documentation database etait arretee aux migrations `024`/`025`, alors que staging contient des migrations jusqu'a `033`.
- Les modules recents etaient peu documentes: contacts, fournisseurs enrichis, preferences utilisateur, Snipe-IT configurable, chantiers, QR outils, snapshots de prix.
- La documentation melange parfois vision produit et etat implemente sans etiquette claire.

### Dette Documentaire

- Dette API: reference non exhaustive.
- Dette database: migrations recentes pas assez expliquees.
- Dette utilisateur: pas encore de guide quotidien pour estimateur, admin ou operateur.
- Dette terminologique: mots metier non definis de facon centralisee.

### Maturite Globale

- Technique: moyenne.
- Operationnelle: moyenne.
- Produit/metier: moyenne-faible.
- Onboarding developpeur: utilisable mais incomplet.
- Onboarding estimateur/admin: insuffisant.

## Fonctionnalites Reellement Terminees

Base sur le code present.

- Authentification, session, profil utilisateur, roles et usagers.
- Invitations, reset et creation de mot de passe.
- Configuration SMTP avec test d'envoi.
- Configuration VoIP/SMS avec test manuel.
- Clients enrichis: taxes, telephone, mobile, fax, adresse, RBQ.
- Estimateurs multiples par client.
- Edition en lot des clients.
- Contacts avec types client/fournisseur et taches.
- Fournisseurs enrichis: coordonnees, adresse, taxes, compte, site web, contact principal.
- Produits: CRUD, recherche, pagination, actif/inactif, types, unites, fournisseurs, documents, couverture.
- Edition en lot des produits.
- Imports fournisseurs Schluter, Centura et Olympia.
- Integration Prosol: recherche, import, fiches techniques, mise a jour des prix.
- Projets en soumission avec etats de decision.
- Recherche BSDQ et pre-remplissage du projet.
- Creation de projet avec fichiers et copie NAS.
- Navigation NAS et apercus PDF, Office et MSG.
- Soumissions, revisions et clonage de revision.
- Matrice de soumission: locaux, surfaces, produits, quantites, pertes, coutants, profits, installation, heures, jours.
- Resume de soumission: plans, devis, addenda, exclusions, fournisseurs, echeancier, retenue, garantie.
- Snapshots de prix par ligne de soumission: `quoted_purchase_price`, `quoted_price_date`.
- Calibre cote frontend: import PDF/image, calibration, mesures, calques, secteurs, resultats.
- Snipe-IT configurable en DB avec fallback environnement.
- Outils Snipe-IT: liste, recherche, tri, pagination, edition, checkout, images et QR via proxy backend.
- Chantiers Snipe-IT: liste, filtre par nombre d'outils, creation, edition, outils par chantier.
- Preferences utilisateur DB pour colonnes visibles.
- Page Statut operations avec healthcheck backend et backlog de commits.
- Deploiement staging separe.

## Fonctionnalites Partiellement Implementees

- Edition multiple universelle: clients et produits ont un vrai endpoint bulk; contacts/fournisseurs ont une selection UI, mais pas de bulk backend general.
- Contacts: modele et ecran presents, mais pas encore branches aux transmissions de soumissions, bons de commande ou factures.
- Snipe-IT: integration utile dans Sercora, mais pas remplacement complet de Snipe-IT.
- Calibre: outil frontend avance, mais persistance serveur et lien complet avec la production de soumission restent a stabiliser/documenter.
- Prix current/quoted: donnees et affichage presents, mais le guide metier doit expliquer l'usage attendu.
- BSDQ: recherche et pre-remplissage presents; alertes automatiques et workflow complet restent futurs.
- VoIP/SMS: test manuel present; alertes automatiques non finalisees.

## Fonctionnalites Prevues Ou Futures

- QuickBooks: entree UI grisee, aucune integration active.
- Mobile-Punch: entree UI grisee, aucune integration active.
- Alertes BSDQ automatiques.
- Production complete des lettres.
- Envoi complet de soumission.
- Bons de commande et factures.
- Projets obtenus par bon de commande dans `Projets > En cours`.
- Automatisation complete des communications fournisseur/courriel.

## Recommandations Prioritaires

### Critique

- Garder la documentation sur `staging` synchronisee avec les routes et migrations.
- Documenter explicitement ce qui est implemente, partiel et futur.
- Completer la reference API avec les endpoints recents.
- Mettre a jour la documentation DB jusqu'a la migration `033`.

### Important

- Ajouter un glossaire metier canonique.
- Ajouter un guide estimateur pour projets, matrice, produits et Calibre.
- Ajouter un guide admin pour usagers, SMTP, VoIP/SMS, Snipe-IT et imports.
- Documenter les limites connues des integrations.

### Amelioration Future

- Generer une reference OpenAPI statique.
- Ajouter des ADR courts pour les decisions structurantes.
- Ajouter des captures d'ecran lorsque l'interface sera stabilisee.
- Ajouter des runbooks d'incident pour NAS, Snipe-IT, SMTP et migrations.
