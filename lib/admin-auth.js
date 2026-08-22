const crypto = require('crypto');

const COOKIE = 'mh_admin';

function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET ou ACCESS_TOKEN_SECRET não configurado.');

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!secret || !token) return null;

    const [body, sig] = token.split('.');
    if (!body || !sig) return null;

    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now() || payload.role !== 'admin') return null;

    return payload;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const found = raw.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
}

function getAdmin(req) {
  return verify(getCookie(req, COOKIE));
}

function setAdminCookie(res, payload) {
  const token = sign(payload);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60 * 8}; HttpOnly; SameSite=Lax; Secure`
  );
}

function clearAdminCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`
  );
}

function requireAdmin(req, res) {
  const admin = getAdmin(req);
  if (!admin) {
    res.status(401).json({ authenticated: false, error: 'Acesso administrativo não autorizado.' });
    return null;
  }
  return admin;
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

module.exports = {
  setAdminCookie,
  clearAdminCookie,
  getAdmin,
  requireAdmin,
  safeEqual
};
