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
