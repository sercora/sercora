# Migration De sercora-wiki

Ce document garde la trace de la validation effectuee avant de considerer le depot `sercora-wiki` comme obsolete.

## Conclusion

La documentation canonique de Sercora est maintenant integree directement dans le depot principal:

```text
https://github.com/sercora/sercora/tree/codex
```

Le depot separe `sercora-wiki` peut etre considere obsolete.

## Verification Effectuee

Date de verification: 2026-06-16.

Depot verifie:

```text
git@github.com:sercora/sercora-wiki.git
```

HEAD verifie:

```text
56d1519de511968ae53e5023e313b2d8157806c8
```

Fichiers trouves:

```text
README.md
001-Vision.md
002-Architecture.md
003-ERD.md
003-Technologies.md
004-Database.md
004-ReferenceTables.md
005-Estimate-Module.md
```

Tous les fichiers Markdown du depot `sercora-wiki` etaient vides au moment de la verification:

```text
0 ligne totale
```

Le wiki GitHub natif potentiel a aussi ete verifie:

```text
git@github.com:sercora/sercora.wiki.git
```

Resultat:

```text
Repository not found
```

## Decision

Il n'y avait aucun contenu a rapatrier depuis `sercora-wiki`.

La documentation actuelle du depot principal remplace donc le depot wiki separe.

## Recommendation

Avant suppression definitive, privilegier cet ordre:

1. Archiver `sercora-wiki` sur GitHub.
2. Confirmer que les liens publics pointent vers `sercora/sercora/tree/codex/docs`.
3. Attendre une courte periode de validation.
4. Supprimer `sercora-wiki` seulement si aucun outil externe ne depend de ce depot.

La suppression GitHub est irreversible cote utilisateur si aucun clone local ou backup n'est conserve.
