TOP'MATH — CONFIGURATION DE LA SÉCURITÉ SERVEUR

Cette branche introduit une authentification serveur. Ne pas fusionner en production avant d'avoir configuré les deux secrets dans l'environnement Preview du projet Cloudflare Pages `topmath-git` et validé les tests.

SECRETS OBLIGATOIRES

1. `TOPMATH_SESSION_SECRET` : secret aléatoire d'au moins 32 caractères. Générer avec `node scripts/generate-session-secret.mjs`.
2. `TOPMATH_TEACHER_PASSWORD_HASH` : hachage PBKDF2-SHA256 du mot de passe enseignant. Le mot de passe doit contenir au moins 12 caractères.

GÉNÉRER LE HACHAGE DU MOT DE PASSE

Dans un terminal Bash local (ne jamais envoyer le mot de passe dans un chat ni le committer) :

```bash
read -s -p "Nouveau mot de passe enseignant : " TOPMATH_NEW_TEACHER_PASSWORD
echo
export TOPMATH_NEW_TEACHER_PASSWORD
node scripts/hash-teacher-password.mjs
unset TOPMATH_NEW_TEACHER_PASSWORD
```

Copier uniquement la chaîne `pbkdf2-sha256$...` produite dans le secret Cloudflare `TOPMATH_TEACHER_PASSWORD_HASH`. Le mot de passe lui-même n'est ni stocké dans GitHub ni transmis à l'application.

CONFIGURATION CLOUDFLARE

- Dans le projet Pages `topmath-git`, configurer ces secrets pour l'environnement Preview d'abord.
- Ne pas modifier les secrets de Production pendant cette phase.
- Les variables doivent être disponibles dans les Pages Functions sous `context.env`.
- Prévoir une règle de limitation de débit WAF sur `POST /api/student-login` et `POST /api/auth/teacher-login`. Adapter le seuil aux connexions simultanées d'une école (plusieurs élèves peuvent partager une même adresse IP). Cette règle doit être validée avant une ouverture réelle aux élèves.

COMPORTEMENT

- Sessions signées HMAC-SHA256 dans un cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
- Durée maximale : 8 heures enseignant, 12 heures élève.
- Les API sont protégées par `functions/_middleware.js` : par défaut enseignant uniquement ; `student-profile` est réservé à l'élève connecté.
- Les écritures API exigent une origine identique et un corps JSON.
- `/api/test`, `/api/roster` et `/api/pedagogy` ne sont plus accessibles sans session enseignant.
- Une rotation de `TOPMATH_SESSION_SECRET` invalide toutes les sessions signées précédemment.
- Le cookie est supprimé à la déconnexion. Les sessions stateless ne peuvent pas être révoquées individuellement avant leur expiration ; une future table D1 sera nécessaire pour une révocation immédiate.

TESTS LOCAUX

```bash
node --test tests/security.test.mjs
```

NE PAS FUSIONNER / DÉPLOYER EN PRODUCTION AVANT : secrets Preview configurés, connexion enseignant et élève vérifiées, refus d'accès API sans session et avec rôle incorrect vérifiés, tests sur iPad et ordinateur, et règle WAF de limitation de débit active.
