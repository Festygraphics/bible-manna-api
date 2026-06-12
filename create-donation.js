const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, stars, label } = req.body;

  if (!user_id || !stars) {
    return res.status(400).json({ error: 'user_id and stars required' });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user_id,
          title: 'Donation — Bible Manna',
          description: `${label} — Thank you for supporting Bible Manna! Your generosity helps keep the Word free for everyone. 🙏`,
          payload: `donation_${stars}`,
          currency: 'XTR',
          prices: [
            { label: label || 'Donation', amount: stars }
          ],
          need_name: false,
          need_email: false,
          need_phone_number: false,
          is_flexible: false,
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      console.error('Telegram donation error:', data);
      return res.status(400).json({ error: data.description });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Donation error:', err);
    return res.status(500).json({ error: 'Failed to send donation invoice' });
  }
}
