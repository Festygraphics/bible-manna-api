const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, plan = 'monthly' } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id required' });
  }

  try {
    // Send invoice via Telegram Bot API
    // 499 Stars = ~$4.99 (1 Star ≈ $0.01)
    // Plan config
    const plans = {
      monthly: {
        payload: 'premium_monthly',
        title: 'Bible Manna Premium — Monthly',
        description: 'Unlimited AI Bible Chat, all Bible translations, all reading plans, unlimited prayer journal and more.',
        amount: 499,   // 499 Stars ≈ $4.99
        label: 'Bible Manna Premium (1 month)',
      },
      yearly: {
        payload: 'premium_yearly',
        title: 'Bible Manna Premium — Yearly',
        description: 'Everything in Premium for a full year. Save 50% vs monthly! Unlimited AI, all Bibles, all plans.',
        amount: 2999,  // 2999 Stars ≈ $29.99
        label: 'Bible Manna Premium (1 year — Save 50%)',
      },
    };

    const selectedPlan = plans[plan] || plans.monthly;

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user_id,
          title: selectedPlan.title,
          description: selectedPlan.description,
          payload: selectedPlan.payload,
          currency: 'XTR',
          prices: [{ label: selectedPlan.label, amount: selectedPlan.amount }],
          need_name: false,
          need_email: false,
          need_phone_number: false,
          is_flexible: false,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram invoice error:', data);
      return res.status(400).json({ error: data.description });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Invoice error:', err);
    return res.status(500).json({ error: 'Failed to send invoice' });
  }
}
