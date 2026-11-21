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
