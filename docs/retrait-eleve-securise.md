# Top’Math — retrait individuel d'un élève

## État
Correctif serveur préparé **sur branche de développement uniquement**. Il n'est pas intégré à l'interface enseignant et n'est pas déployé.

## Comportement
- POST /api/student-withdraw
- Exige un jeton administrateur serveur TOPMATH_ADMIN_TOKEN (32 caractères minimum) et un en-tête Authorization: Bearer <jeton>.
- Exige student_id, confirm_withdrawal=true et confirmation exactement égale au prénom suivi du nom, tels qu'enregistrés dans D1.
- Supprime uniquement l'inscription dans l'année scolaire active; ne supprime ni la fiche élève ni les évaluations historiques.
- Révoque le code d'accès si aucune inscription dans l'année active ne subsiste.
- Si le secret serveur n'est pas configuré, renvoie 503 et ne change rien.

## Conditions avant activation
1. Mettre en place une authentification enseignant côté serveur appropriée, avec une session sécurisée (ne jamais intégrer TOPMATH_ADMIN_TOKEN dans du JavaScript public ou un HTML téléchargeable).
2. Intégrer un bouton à l'interface de gestion des élèves et une confirmation nominative; prévoir un état de chargement et actualiser le registre après réussite.
3. Vérifier les éventuelles données liées à une inscription, le comportement lors de la réinscription, et tester sur une base D1 de préproduction avec des élèves fictifs.
4. Faire valider explicitement la mise en ligne; ne jamais toucher aux données réelles pour tester.

## Test du module
Depuis la racine : node tests/student-withdraw.test.mjs

## Prudence
Ne pas configurer TOPMATH_ADMIN_TOKEN tant que l'authentification et le parcours enseignant ne sont pas prêts. Le jeton est une barrière technique temporaire, pas un mécanisme complet de session navigateur.
