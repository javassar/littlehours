import { createRequire } from 'module';
import fs from 'fs';

const require = createRequire(import.meta.url);
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

const vapidData = {
  publicKey: keys.publicKey,
  privateKey: keys.privateKey,
  subject: 'mailto:jacqueline@littlehours.app',
};

fs.writeFileSync('.vapid_keys.json', JSON.stringify(vapidData, null, 2), 'utf-8');

let envContent = '';
if (fs.existsSync('.env.local')) {
  envContent = fs.readFileSync('.env.local', 'utf-8');
}

if (!envContent.includes('VITE_VAPID_PUBLIC_KEY')) {
  envContent = envContent.trim() + `\nVITE_VAPID_PUBLIC_KEY=${keys.publicKey}\n`;
  fs.writeFileSync('.env.local', envContent, 'utf-8');
}

console.log('Successfully generated VAPID keys and updated .env.local with VITE_VAPID_PUBLIC_KEY');
