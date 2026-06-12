import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update = req.body;
    console.log('Webhook received:', JSON.stringify(update));

    // ── HANDLE PRE-CHECKOUT QUERY ──
    // Telegram requires you to answer this within 10 seconds
    if (update.pre_checkout_query) {
      const pcq = update.pre_checkout_query;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: pcq.id,
          ok: true,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    // ── HANDLE SUCCESSFUL PAYMENT ──
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const userId = update.message.from.id;
      const payload = payment.invoice_payload; // "premium_monthly"

      console.log(`Payment received from user ${userId}, payload: ${payload}`);

      // ── DONATION ──
      if (payload.startsWith('donation_')) {
        const stars = payload.replace('donation_', '');
        console.log(`Donation of ${stars} Stars from user ${userId}`);

        // Save donation to Supabase
        try {
          await sb.from('donations').insert({
            user_id: userId,
            stars: parseInt(stars),
            created_at: new Date().toISOString(),
          });
        } catch(e) { console.warn('Could not save donation:', e); }

        // Thank you message
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            text: `🙏 Thank you so much for your generous donation of ${stars} Stars!

"God loves a cheerful giver." — 2 Corinthians 9:7

Your support helps keep Bible Manna free for Christians around the world. May God bless you abundantly! 🌟`,
          }),
        });

        return res.status(200).json({ ok: true });
      }

      if (payload === 'premium_monthly' || payload === 'premium_yearly') {
        // Set expiry based on plan
        const days = payload === 'premium_yearly' ? 365 : 30;
        // Set premium expiry 30 days from now
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        // Update user in Supabase
        const { error } = await sb.from('users')
          .update({
            is_premium: true,
            premium_expires_at: expiresAt,
          })
          .eq('id', userId);

        if (error) {
          console.error('Supabase update error:', error);
        } else {
          console.log(`User ${userId} upgraded to premium until ${expiresAt}`);
        }

        // Send confirmation message to user
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            text: `🎉 Welcome to Bible Manna Premium${payload === 'premium_yearly' ? ' — Annual Plan 🏆' : ''}!\n\n✦ Unlimited AI Bible Chat\n✦ All Bible translations\n✦ All reading plans\n✦ Unlimited prayer journal\n\nMay God bless your daily walk with His Word. 🙏\n\nOpen Bible Manna to start enjoying your premium features!`,
            parse_mode: 'HTML',
          }),
        });
      }

      return res.status(200).json({ ok: true });
    }

    // ── HANDLE /start COMMAND ──
    if (update.message?.text?.startsWith('/start')) {
      const userId = update.message.from.id;
      const firstName = update.message.from.first_name || 'Friend';

      // Upsert user
      await sb.from('users').upsert({
        id: userId,
        username: update.message.from.username || '',
        first_name: firstName,
        language_code: update.message.from.language_code || 'en',
        last_active: new Date().toISOString().split('T')[0],
      }, { onConflict: 'id' });

      // Send welcome message with Mini App button
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          text: `📖 Welcome to Bible Manna, ${firstName}!\n\n"What if you could ask the Bible anything and get a real answer? Now you can."\n\nTap below to open Bible Manna 👇`,
          reply_markup: {
            inline_keyboard: [[{
              text: '📖 Open Bible Manna',
              web_app: { url: process.env.MINI_APP_URL }
            }]]
          }
        }),
      });

      return res.status(200).json({ ok: true });
    }

    // Default — acknowledge all other updates
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
