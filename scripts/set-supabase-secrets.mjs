import { execSync } from 'child_process';
import fs from 'fs';

try {
  const data = JSON.parse(fs.readFileSync('.vapid_keys.json', 'utf-8'));
  console.log('Setting Supabase secrets from .vapid_keys.json...');
  execSync(
    `npx supabase secrets set --yes VAPID_PUBLIC_KEY="${data.publicKey}" VAPID_PRIVATE_KEY="${data.privateKey}" VAPID_SUBJECT="${data.subject}"`,
    { stdio: 'inherit' }
  );
  console.log('Successfully set Supabase secrets!');
} catch (err) {
  console.log('Note: Supabase secrets can be set manually in Dashboard or CLI:', err.message);
}
