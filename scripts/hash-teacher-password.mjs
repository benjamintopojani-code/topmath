import {pbkdf2Sync,randomBytes} from 'node:crypto';
const password=process.env.TOPMATH_NEW_TEACHER_PASSWORD||'';
if(password.length<10){console.error('Le mot de passe doit contenir au moins 10 caractères.');process.exit(1);}
const iterations=100000,salt=randomBytes(16),derived=pbkdf2Sync(password,salt,iterations,32,'sha256'),b64=value=>value.toString('base64url');
console.log('pbkdf2-sha256$'+iterations+'$'+b64(salt)+'$'+b64(derived));
