const { setAdminCookie, safeEqual } = require('./admin-auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const configuredEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredPassword = String(process.env.ADMIN_PASSWORD || '');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!configuredEmail || !configuredPassword) {
    return res.status(503).json({
      error: 'Administrador não configurado. Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.'
    });
  }

  if (!safeEqual(email, configuredEmail) || !safeEqual(password, configuredPassword)) {
    return res.status(401).json({ error: 'E-mail ou senha de administrador inválidos.' });
  }

  setAdminCookie(res, {
    role: 'admin',
    email: configuredEmail,
    exp: Date.now() + 1000 * 60 * 60 * 8
  });

  return res.status(200).json({ ok: true, email: configuredEmail });
};
