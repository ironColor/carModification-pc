import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const api = readFileSync(resolve(root, 'src/api.ts'), 'utf8');
const auth = readFileSync(resolve(root, 'src/auth.ts'), 'utf8');

const checks = [
  {
    name: 'auth session is stored in sessionStorage instead of persistent localStorage',
    pass: auth.includes('sessionStorage.setItem(TOKEN_KEY, token)') &&
      auth.includes('sessionStorage.setItem(USER_KEY, JSON.stringify(user))') &&
      auth.includes('sessionStorage.getItem(TOKEN_KEY)') &&
      auth.includes('sessionStorage.getItem(USER_KEY)') &&
      !auth.includes('localStorage.setItem(TOKEN_KEY') &&
      !auth.includes('localStorage.setItem(USER_KEY') &&
      !auth.includes('localStorage.getItem(TOKEN_KEY') &&
      !auth.includes('localStorage.getItem(USER_KEY'),
  },
  {
    name: 'API requests read token from the current browser session',
    pass: api.includes('sessionStorage.getItem(TOKEN_KEY)') &&
      !api.includes('localStorage.getItem(TOKEN_KEY)'),
  },
  {
    name: 'login flow does not persist remembered user data in localStorage',
    pass: !app.includes('localStorage.setItem') &&
      !app.includes('xy-login-username'),
  },
  {
    name: 'app clears persistent localStorage on startup and page close',
    pass: app.includes('clearPersistentStorage') &&
      app.includes("window.addEventListener('pagehide'") &&
      app.includes("window.removeEventListener('pagehide'") &&
      auth.includes('export function clearPersistentStorage()') &&
      auth.includes('localStorage.clear()'),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length) {
  console.error('Session storage checks failed:');
  for (const check of failed) {
    console.error(`- ${check.name}`);
  }
  process.exit(1);
}

console.log('Session storage checks passed.');
