# Top’Math — Contrôle de non-régression Tech Premium
Date : 21 novembre 2026
Portée : branche `design/tech-premium-2026`. Aucun test d'écriture sur le D1 réel.

## Tests effectués
- [x] Navigation : pages Mes classes, Évaluations par classe, Tableaux de compétences, Accès aux évaluations, Fiche officielle reliées à l'ancien `enseignant.html`.
- [x] Syntaxe JavaScript du fichier enseignant original (2 Mo) valide.
- [x] Syntaxe des routes D1 examinées valide.
- [x] Règle originale : 0 date = pas commencé ; 1 ou 2 = en cours ; 3 = validé ; effacement d'une date = retour en cours.
- [x] Simulation isolée de `/api/evaluation-edit` avec une base factice : ajout de dates 1/3, 2/3, 3/3, annulation d'une date, annulation des trois. Réponses OK et nombre de passages actifs correct.
- [x] Test isolé du calcul des éléments PDF : identité et année sur la couverture, 3 dates et état « Validé » sur la page de compétence, suppression d'une date et affichage « En cours ».
- [x] Correction sur la branche : lors de la suppression d'une année, suppression dangereuse des `evaluation_schedule_overrides` indexée uniquement par élève évitée. Une migration vers un schéma lié à l'année serait préférable.

## À vérifier impérativement dans un environnement de test avec D1 de démonstration
- [ ] Création d'une année, changement d'année active, archivage et suppression sans toucher aux autres années.
- [ ] Ajout, modification, retrait et réaffectation d'un élève. Le parcours de retrait individuel n'est pas établi.
- [ ] Enregistrement réel de trois dates dans D1, rechargement de la page, vérification des listes « Mes classes » et « Évaluations à prévoir ».
- [ ] Téléchargement et inspection visuelle du PDF quatre pages, en NORMAL et ÉCO, avec identification et dates correctes.
- [ ] Cycle d'ouverture/fermeture d'une évaluation, vérification qu'un élève ne peut pas démarrer si elle est fermée.
- [ ] Historique des exercices : actuellement `getStudentExercises` retourne `DEMO_EXERCISES[id]` dans le module historique ; connexion aux résultats réels requise.
- [ ] Suivi de présence et comportement cohérent entre les écrans ; la synchronisation complète reste à établir.
- [ ] Autorisation des endpoints : les routes D1 modifiant les données ne contiennent pas de contrôle explicite de session/rôle. Vérifier le mécanisme d'authentification externe puis appliquer des contrôles côté serveur avant publication.
- [ ] Test de navigation mobile/iPad, PDF depuis iframe, et retour vers les menus.

## Publication
**Non validée.** Garder la pull request en brouillon et ne pas fusionner vers `main` tant que les tests sur un D1 de démonstration et la vérification des autorisations ne sont pas réalisés.


## Deuxième série de tests — 21 novembre 2026

### API élèves : simulation sans données réelles
- [x] `/api/student-save` : ajout d'un élève et de son inscription (base simulée).
- [x] `/api/student-save` : modification du prénom d'un élève existant.
- [x] `/api/student-save` : date de naissance impossible (30 février) rejetée (HTTP 400).

### API années : simulation sans données réelles
- [x] `/api/year-manage` : création d'une nouvelle année qui devient active.
- [x] `/api/year-manage` : suppression simulée d'une ancienne année, année active conservée.
- [x] Vérification du correctif : aucune suppression globale de `evaluation_schedule_overrides` basée uniquement sur `student_id`.

### PDF : vérification fonctionnelle isolée
- [x] La couverture utilise les données d'identité et l'année active.
- [x] Les trois dates figurent dans le tableau de compétences.
- [x] Trois dates donnent « Validé ».
- [x] Effacement d'une date la retire du contenu PDF et revient à « En cours ».
- [ ] Vérifier le PDF complet sur iPad et dans un lecteur PDF, pour NORMAL et ÉCO.

### Bloquants persistants
- Contrôle d'autorisation côté serveur des routes D1 non confirmé. Ne pas publier avant vérification.
- Retrait individuel d'un élève non repéré dans les routes examinées.
- Progrès d'exercices historiques alimentés par des données de démonstration.
- L'intégration Tech Premium utilise encore une iframe du moteur historique.
- Aucun test sur D1 réel, aucune suppression de données réelles.

**Statut global : vérifications de code et simulations encourageantes, mais réception en production non validée.**


## Troisième série — tests de validation des API sur données fictives

Sept cas invalides ont été exécutés directement sur les handlers réels, avec DB factice :
- [x] Modification de compétence sans identifiant élève → HTTP 400.
- [x] Date impossible dans une évaluation (2026-02-30) → HTTP 400.
- [x] Deux dates seulement au lieu des trois positions obligatoires → HTTP 400.
- [x] Ajout d'élève sans prénom → HTTP 400.
- [x] Date de naissance impossible (2026-02-30) → HTTP 400.
- [x] Année scolaire incorrecte (2026/2027) → HTTP 400.
- [x] Suppression d'année sans identifiant → HTTP 400.

Les tests précédents des cas valides d'ajout / modification d'élève, création / suppression simulées d'année et de 0 à 3 dates demeurent valides.

### Limites de réception
- Aucune connexion au Cloudflare D1 réel, aucun clic iPad ni lecture PDF via un navigateur connecté à la branche.
- Le rendu HTML du PDF, et particulièrement les éventuels écarts de dimensions NORMAL/ÉCO, doivent encore être testés visuellement.
- Les routes critiques (évaluations, élève, année, classe) ne contiennent pas de vérification explicite de l'identité / rôle enseignant. Toute publication ou test d'écriture sur l'environnement réel doit attendre un audit des contrôles d'accès.
- Le retrait individuel de l'élève, les progrès réels dans les exercices et le blocage serveur de l'accès aux évaluations sont des fonctionnalités à terminer ou prouver.

**Décision : ne pas fusionner la PR ; tests d’intégration Cloudflare sur une base dédiée à prévoir.**


## Quatrième série : tests automatisés dans GitHub Actions (21 novembre 2026)

Workflow : `.github/workflows/topmath-regression.yml`
Tests exécutables : `tests/legacy-regression.test.cjs` et `tests/school-management.test.cjs`

**Résultat confirmé : 11 tests exécutés, 11 réussis** dans GitHub Actions, exécution id `44930031975`, commit `296aef6f1a1daf80fa4e8156e965b2dfc981337c`.

Couverture :
- Syntaxe JavaScript du moteur historique
- Règle des trois dates et recalcul du statut
- Contenu calculé de la couverture et des trois validations du PDF
- Enregistrement / annulation des évaluations par l'endpoint D1 simulé
- Rejet des valeurs invalides dans les APIs
- Protection contre la suppression de planifications d'autres années
- Présence des raccordements entre nouveaux menus et moteur historique
- Création / modification d'élève sur base simulée
- Création / suppression d'année sur base simulée
- Génération de la structure PDF quatre pages (test avec images fictives, pas de contrôle visuel)

**Ce résultat ne valide pas la production.**
Les contrôles d'autorisation des routes Cloudflare D1, les opérations de retrait individuel, la synchronisation des résultats réels, l'ouverture des évaluations côté élève, l'inspection PDF NORMAL / ÉCO et la navigation iPad demeurent à traiter / vérifier avec un environnement isolé.

Aucun écrit ni suppression sur la base réelle.


## Cinquième série — gestion des classes, 21 novembre 2026

GitHub Actions `44930388086` : **succès**, 14 tests automatisés réussis sur la branche.
Nouveau fichier : `tests/class-management.test.cjs`.

- [x] Création et renommage d'une classe sur base simulée, sans supprimer un élève.
- [x] Affectation d'un élève sans classe, suppression de la classe, conservation de sa ligne d'inscription et retour en non-affecté.
- [x] Rejet des noms de classes vides et de la suppression sans identifiant.
- [ ] Retrait individuel d'un élève : route spécifique non encore implémentée / vérifiée.
- [ ] Authentification serveur : l'ancien accès enseignant repose sur une vérification locale par le navigateur. Les endpoints D1 modifiant les données ne comportent pas d'autorisation explicite. La protection par configuration Cloudflare externe reste à confirmer.

Les tests simulent D1 sans atteindre de données de production ; ce ne sont pas des tests bout en bout sur l'école.

**Ne pas fusionner la branche avant contrôle d'accès serveur et tests D1 isolés.**
