import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { referrer_id, new_user_id } = req.body;
  if (!referrer_id || !new_user_id) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Check referral hasn't been used already
    const { data: existing } = await sb
      .from('referrals')
      .select('id')
      .eq('referrer_id', referrer_id)
      .eq('new_user_id', new_user_id)
      .single();

    if (existing) return res.status(200).json({ ok: true, message: 'Already rewarded' });

    // Save referral
    await sb.from('referrals').insert({ referrer_id, new_user_id });

    // Give referrer +5 bonus questions (stored in referral_bonus column)
    const { data: referrer } = await sb
      .from('users')
      .select('referral_bonus')
      .eq('id', referrer_id)
      .single();

    const currentBonus = referrer?.referral_bonus || 0;
    await sb.from('users')
      .update({ referral_bonus: currentBonus + 5 })
      .eq('id', referrer_id);

    // Notify referrer
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: referrer_id,
        text: `🎉 Someone joined Bible Manna using your invite link!\n\n✦ You've earned +5 free AI questions today.\n\nKeep sharing to get more! 📖`,
      }),
    });

    return res.status(200).json({ ok: true });
  } catch(err) {
    console.error('Referral error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
