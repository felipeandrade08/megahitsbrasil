// Single Vercel Serverless Function for the entire /api/* surface.
// This keeps the project below the Vercel Hobby 12-function limit.
module.exports.config = { api: { bodyParser: false, sizeLimit: '5mb' } };

const handlers = {
  admin: require('./lib/handlers/admin'),
  'create-checkout': require('./lib/handlers/create-checkout'),
  'create-pix-order': require('./lib/handlers/create-pix-order'),
  download: require('./lib/handlers/download'),
  login: require('./lib/handlers/login'),
  logout: require('./lib/handlers/logout'),
  'my-purchase': require('./lib/handlers/my-purchase'),
  'session-status': require('./lib/handlers/session-status'),
  'upload-proof': require('./lib/handlers/upload-proof'),
  webhook: require('./lib/handlers/webhook')
};

function getRoute(req) {
  const raw = String(req.url || '').split('?')[0];
  const m = raw.match(/^\/api\/(.*)$/);
  if (!m) return '';
  return m[1].replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase();
}

function parseQuery(req) {
  const base = 'https://megahitsbrasil.vercel.app';
  const u = new URL(req.url || '/', base);
  const query = {};
  for (const [k, v] of u.searchParams.entries()) query[k] = v;
  req.query = query;
}

function parseJsonBody(req, raw) {
  if (!raw.length) return {};
  const type = String(req.headers['content-type'] || '').toLowerCase();
  if (type.includes('application/json') || type.includes('+json')) {
    try { return JSON.parse(raw.toString('utf8')); }
    catch { return {}; }
  }
  return {};
}

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  const route = getRoute(req);
  const handler = handlers[route];
  if (!handler) return res.status(404).json({ error: 'API route não encontrada.' });

  parseQuery(req);

  // Stripe webhook MUST receive the exact raw request body for signature verification.
  if (route === 'webhook') {
    return handler(req, res);
  }

  // All other JSON endpoints use the same parsed body.
  const raw = await readRaw(req);
  req.body = parseJsonBody(req, raw);
  return handler(req, res);
};
