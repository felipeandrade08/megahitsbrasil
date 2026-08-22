// Single Vercel Serverless Function for the entire /api/* surface.

const handlers = {
  admin: require('../lib/handlers/admin'),
  'create-checkout': require('../lib/handlers/create-checkout'),
  'create-pix-order': require('../lib/handlers/create-pix-order'),
  download: require('../lib/handlers/download'),
  login: require('../lib/handlers/login'),
  logout: require('../lib/handlers/logout'),
  'my-purchase': require('../lib/handlers/my-purchase'),
  'session-status': require('../lib/handlers/session-status'),
  'upload-proof': require('../lib/handlers/upload-proof'),
  webhook: require('../lib/handlers/webhook')
};

function getRoute(req) {
  const raw = String(req.url || '').split('?')[0];
  const m = raw.match(/^\/api\/(.*)$/);

  if (!m) return '';

  return m[1]
    .replace(/^\/+|\/+$/g, '')
    .split('/')[0]
    .toLowerCase();
}

function parseQuery(req) {
  const base = 'https://megahitsbrasil.vercel.app';
  const u = new URL(req.url || '/', base);

  const query = {};

  for (const [k, v] of u.searchParams.entries()) {
    query[k] = v;
  }

  req.query = query;
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];

    req.on('data', chunk => {
      chunks.push(Buffer.from(chunk));
    });

    req.on('end', () => {
      const raw = Buffer.concat(chunks);

      if (!raw.length) {
        return resolve({});
      }

      const type = String(
        req.headers['content-type'] || ''
      ).toLowerCase();

      if (
        type.includes('application/json') ||
        type.includes('+json')
      ) {
        try {
          return resolve(JSON.parse(raw.toString('utf8')));
        } catch (error) {
          console.error('[API] JSON inválido:', error);
          return resolve({});
        }
      }

      return resolve({});
    });

    req.on('error', error => {
      console.error('[API] Erro lendo body:', error);
      resolve({});
    });
  });
}

module.exports = async (req, res) => {
  const route = getRoute(req);

  console.log('[API] Método:', req.method);
  console.log('[API] Rota:', route);

  const handler = handlers[route];

  if (!handler) {
    return res.status(404).json({
      error: 'API route não encontrada.'
    });
  }

  parseQuery(req);

  // Stripe webhook precisa do body original.
  if (route === 'webhook') {
    return handler(req, res);
  }

  req.body = await parseJsonBody(req);

  console.log('[API] Body recebido:', req.body);

  return handler(req, res);
};
