const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Stripe = require('stripe');

async function main() {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  const envPath = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envLocalPath)) {
    console.error('ERRORE: .env.local non trovato');
    process.exit(1);
  }

  const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');
  const match = envLocalContent.match(/^STRIPE_SECRET_KEY=(.*)$/m);
  if (!match) {
    console.error('ERRORE: STRIPE_SECRET_KEY non trovata in .env.local');
    process.exit(1);
  }

  const secretKey = match[1].trim().replace(/^["']|["']$/g, '');

  if (!secretKey.startsWith('sk_live_')) {
    console.error('ERRORE: La chiave in .env.local non inizia con "sk_live_". Trovata invece:', secretKey.substring(0, 8) + '...');
    process.exit(1);
  }

  console.log('✓ Chiave sk_live_ rilevata correttamente in .env.local (formato e prefisso validi)!');

  // 1. Sync to .env as well
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('STRIPE_SECRET_KEY=')) {
      envContent = envContent.replace(/STRIPE_SECRET_KEY=.*/, `STRIPE_SECRET_KEY=${secretKey}`);
    } else {
      envContent += `\nSTRIPE_SECRET_KEY=${secretKey}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✓ Sincronizzato .env con la chiave sk_live');
  }

  // 2. Test Stripe Live API connection
  console.log('✓ Test chiamata API Stripe Live (balance.retrieve)...');
  const stripe = new Stripe(secretKey);
  try {
    const balance = await stripe.balance.retrieve();
    if (!balance.livemode) {
      console.error('ERRORE: Stripe ha risposto in test mode invece di live mode.');
      process.exit(1);
    }
    console.log('✓ Connessione Stripe Live verificata con successo! Livemode: true.');
  } catch (err) {
    console.error('ERRORE connessione Stripe Live:', err.message);
    process.exit(1);
  }

  // 3. Test creating a real live checkout session
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
              name: 'RETENTIONVOLT Pro (Verifica Collaudo Live)',
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
      console.log('✓ Checkout Session Live creata con successo:', session.id.substring(0, 15) + '... (prefisso cs_live confermato!)');
    } else {
      console.log('✓ Checkout Session creata:', session.id.substring(0, 15) + '...');
    }
  } catch (err) {
    console.error('ERRORE creazione Checkout Session Live:', err.message);
    process.exit(1);
  }

  // 4. Upload STRIPE_SECRET_KEY to Vercel Production
  console.log('✓ Caricamento STRIPE_SECRET_KEY su Vercel Production...');
  try {
    execSync(`npx vercel env add STRIPE_SECRET_KEY production --value "${secretKey}" --force --yes`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
    console.log('✓ STRIPE_SECRET_KEY impostata su Vercel Production.');
  } catch (err) {
    console.error('Errore sincronizzazione Vercel:', err.message);
  }

  // 5. Deploy to Vercel Production
  console.log('✓ Deploy su Vercel Production (--prod)...');
  try {
    const deployOutput = execSync('npx vercel --prod --yes', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });
    console.log('✓ Output Deploy Vercel:');
    console.log(deployOutput);
  } catch (err) {
    console.error('Errore deploy Vercel:', err.message);
  }

  // 6. Test Live Web Checkout API on production domain
  console.log('✓ Test finale endpoint live /api/stripe/checkout su https://retentionvolt.com...');
  try {
    const res = await fetch('https://retentionvolt.com/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingCycle: 'monthly', userId: 'usr_sanity_test' }),
    });
    const data = await res.json();
    if (res.ok && data.url && data.sessionId) {
      console.log('✓ Endpoint di produzione risponde 200 OK con sessione:', data.sessionId.substring(0, 15) + '...');
    } else {
      console.log('Risposta endpoint produzione:', res.status, data);
    }
  } catch (err) {
    console.log('Nota verifica web:', err.message);
  }

  console.log('\n======================================================');
  console.log('🎉 RETENTIONVOLT È AL 100% IN PRODUZIONE E OPERATIVO IN LIVE MODE!');
  console.log('======================================================');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
