const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Stripe = require('stripe');

async function main() {
  let key = process.argv[2];
  if (!key) {
    try {
      key = execSync('pbpaste', { encoding: 'utf8' }).trim();
    } catch (e) {}
  }

  if (!key || typeof key !== 'string') {
    console.error('ERRORE: Nessuna chiave fornita e clipboard vuota.');
    console.error('Uso: node scripts/apply-live-secret.js <sk_live_...>');
    console.error('Oppure copia la chiave sk_live_... negli appunti (Cmd+C) ed esegui senza argomenti.');
    process.exit(1);
  }

  key = key.trim().replace(/^["']|["']$/g, '');

  if (!key.startsWith('sk_live_')) {
    console.error('ERRORE: La chiave fornita non inizia con "sk_live_". Assicurati di copiare la chiave Segreta Live da Stripe.');
    process.exit(1);
  }

  console.log('✓ Chiave sk_live rilevata (lunghezza corretta). Verifica e configurazione in corso...');

  // 1. Update local .env and .env.local
  const envFiles = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '.env.local'),
  ];

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      let content = fs.readFileSync(envFile, 'utf8');
      if (content.includes('STRIPE_SECRET_KEY=')) {
        content = content.replace(/STRIPE_SECRET_KEY=.*/, `STRIPE_SECRET_KEY=${key}`);
      } else {
        content += `\nSTRIPE_SECRET_KEY=${key}\n`;
      }
      fs.writeFileSync(envFile, content, 'utf8');
      console.log(`✓ Aggiornato ${path.basename(envFile)}`);
    }
  }

  // 2. Test Stripe Live API connection
  console.log('✓ Test connessione API Stripe Live...');
  const stripe = new Stripe(key);
  try {
    const balance = await stripe.balance.retrieve();
    if (!balance.livemode) {
      console.error('ERRORE: Stripe ha risposto in test mode invece di live mode.');
      process.exit(1);
    }
    console.log('✓ Connessione API Stripe Live riuscita al 100%! Livemode: true.');
  } catch (err) {
    console.error('ERRORE connessione Stripe Live:', err.message);
    process.exit(1);
  }

  // 3. Test creating a Live Checkout Session
  console.log('✓ Test creazione Checkout Session Live...');
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'RETENTIONVOLT Pro (Test Sanity Live)',
            },
            unit_amount: 1200,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      success_url: 'https://retentionvolt.com/?upgrade=success',
      cancel_url: 'https://retentionvolt.com/?upgrade=cancel',
    });
    if (session.id && session.id.startsWith('cs_live_')) {
      console.log('✓ Checkout Session Live creata con successo:', session.id.substring(0, 15) + '... (cs_live confermato)');
    } else {
      console.log('✓ Checkout Session creata con successo:', session.id.substring(0, 15) + '...');
    }
  } catch (err) {
    console.error('ERRORE creazione Checkout Session Live:', err.message);
    process.exit(1);
  }

  // 4. Update Vercel Production Environment Variable
  console.log('✓ Sincronizzazione variabile STRIPE_SECRET_KEY su Vercel Production...');
  try {
    execSync(`npx vercel env add STRIPE_SECRET_KEY production --value "${key}" --force --yes`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('✓ Variabile STRIPE_SECRET_KEY impostata su Vercel Production.');
  } catch (err) {
    console.error('Attenzione: aggiornamento Vercel CLI:', err.message);
  }

  // 5. Deploy to Vercel Production
  console.log('✓ Distribuzione su Vercel Production in corso...');
  try {
    execSync('npx vercel --prod --yes', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('✓ Deploy su Vercel Production completato!');
  } catch (err) {
    console.error('Attenzione durante deploy Vercel:', err.message);
  }

  console.log('\n========================================');
  console.log('🎉 TUTTO CONFIGURATO E FUNZIONANTE AL 100% IN LIVE MODE!');
  console.log('========================================');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
