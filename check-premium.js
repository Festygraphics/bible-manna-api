import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    const { data, error } = await sb
      .from('users')
      .select('is_premium, premium_expires_at')
      .eq('id', user_id)
      .single();

    if (error || !data) {
      return res.status(200).json({ is_premium: false });
    }

    // Check if premium is still valid
    let isPremium = false;
    if (data.is_premium) {
      if (data.premium_expires_at) {
        isPremium = new Date(data.premium_expires_at) > new Date();
      } else {
        isPremium = true;
      }
    }

    // Auto-expire if needed
    if (data.is_premium && !isPremium) {
      await sb.from('users')
        .update({ is_premium: false })
        .eq('id', user_id);
    }

    return res.status(200).json({
      is_premium: isPremium,
      expires_at: data.premium_expires_at || null,
    });

  } catch (err) {
    console.error('Check premium error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
