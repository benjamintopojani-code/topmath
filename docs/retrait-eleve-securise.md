# Top’Math — retrait individuel d’un élève (chantier de développement)

## État
Code uniquement sur `amelioration-gestion-eleves-24-11-2026`. Le site en ligne reste inchangé.
La page autonome `/gestion-eleves-retrait.html` est créée. Un lien vers cette page est injecté dans la section Gestion des accès de `/enseignant.html` par `functions/_middleware.js`, uniquement après configuration des paramètres Access côté serveur. Le fichier HTML principal volumineux reste intact.

## Sécurité
Les API `GET /api/student-withdraw-list` et `POST /api/student-withdraw` exigent un jeton **Cloudflare Access signé** validé côté serveur (signature RS256, clé publique distante, émetteur, audience, dates d’expiration, adresse e-mail autorisée).
Toutes les variables sont requises, sans quoi les fonctions refusent les demandes :
- `TOPMATH_ACCESS_TEAM_DOMAIN` : `https://<nom-equipe>.cloudflareaccess.com`
- `TOPMATH_ACCESS_AUD` : audience de l’application Access protégeant l’interface et les deux API.
- `TOPMATH_ACCESS_EMAILS` : adresses e-mail enseignantes autorisées, séparées par des virgules.

Ne jamais injecter de jeton de session ou de secret dans les pages HTML. Configurer les paramètres côté serveur dans Cloudflare Pages avec une **application Cloudflare Access** protégeant explicitement `/gestion-eleves-retrait.html` et les routes `/api/student-withdraw*`. L'authentification actuelle de Top’Math n’est pas réutilisée ici. Sans configuration, la page ne peut pas consulter la liste et l’action de retrait est refusée.

## Fonctionnalité
- Recherche de l’élève dans la liste de l’année active, bouton Retirer.
- Confirmation du nom exact et d’une case d’accord explicite.
- Suppression de **l’inscription active uniquement**, jamais de la fiche élève ni des évaluations historiques.
- Révocation de l’ancien code d’accès si aucune inscription active ne subsiste.
- Refus en cas d’absence de configuration, de JWT invalide ou de confirmation incorrecte.

## Avant publication
1. Vérifier et valider les paramètres Cloudflare Access de l’environnement de préproduction et la politique d’accès limitée aux enseignants.
2. Tester avec des **élèves fictifs** sur une base D1 de préproduction ; vérifier les références externes, les données liées, les réinscriptions et l’historique.
3. Vérifier le rendu du lien injecté dans la section Gestion des accès sur navigateur et sur iPad.
4. Valider explicitement la fusion dans `main` et la mise en ligne.

## Tests
`node tests/student-withdraw.test.mjs`
`node tests/teacher-withdraw-link.test.mjs`
Tests avec clé RSA générée localement, signature JWT simulée, fausses données D1 et contrôle simulé du middleware. Ces simulations ne remplacent pas les tests Cloudflare et D1 de préproduction.
