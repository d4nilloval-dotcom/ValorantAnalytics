/**
 * proxy-server.cjs
 * ValoAnalytics — Proxy local para Riot API interna + Claude AI
 *
 * Rutas:
 *   GET    /health                      → comprobación estado
 *   POST   /riot-auth                   → login Riot (usuario/contraseña)
 *   POST   /riot-auth-mfa               → completar autenticación 2FA
 *   GET    /riot-session                → estado sesión actual
 *   DELETE /riot-session                → logout
 *   GET    /pd/match-history            → historial (?start=0&end=10&queue=custom)
 *   GET    /pd/match-details/:matchId   → detalles de un partido
 *   POST   /claude                      → Anthropic API
 *   GET    /riot/{region}/...           → api.riotgames.com (legacy)
 *
 * Uso: node proxy-server.cjs
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT = 3001;

// ── Sesión en memoria ─────────────────────────────────────────────────────────
let session = null;

// ── Constantes Riot ───────────────────────────────────────────────────────────
const CLIENT_PLATFORM =
  'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
const RIOT_UA = 'RiotClient/63.0.9.4909890.4789131 rso-auth (Windows;10;;Professional, x64)';
const REGION_TO_SHARD = { eu:'eu', na:'na', latam:'na', br:'na', ap:'ap', kr:'kr' };
const VALID_REGIONS   = new Set(['eu', 'na', 'ap', 'kr', 'latam', 'br']);

// ── Helpers HTTPS ─────────────────────────────────────────────────────────────
function riotRequest(method, hostname, path, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    const bodyBuf = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8') : null;
    const opts = {
      hostname, path, method,
      headers: {
        'User-Agent': RIOT_UA,
        'Accept': 'application/json',
        ...(bodyBuf ? { 'Content-Type':'application/json', 'Content-Length': bodyBuf.length } : {}),
        ...(extraHeaders || {}),
      },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status:     res.statusCode,
        headers:    res.headers,
        body:       Buffer.concat(chunks).toString('utf8'),
        setCookies: res.headers['set-cookie'] || [],
      }));
    });
    req.on('error', reject);
    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

function parseCookies(setCookieArr) {
  const map = {};
  for (const c of (setCookieArr || [])) {
    const part = c.split(';')[0];
    const eq   = part.indexOf('=');
    if (eq > 0) map[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return map;
}
const mergeCookies = (a, b) => ({ ...a, ...b });
const cookieStr    = (m)    => Object.entries(m).map(([k,v]) => `${k}=${v}`).join('; ');

// ── Obtener versión del cliente ───────────────────────────────────────────────
async function getClientVersion() {
  try {
    const r = await riotRequest('GET', 'valorant-api.com', '/v1/version', null);
    return JSON.parse(r.body).data?.riotClientVersion || 'release-09.08-shipping-14-2686319';
  } catch { return 'release-09.08-shipping-14-2686319'; }
}

// ── Finalizar auth (post credenciales o post MFA) ─────────────────────────────
async function finishAuth(loginData, cookies) {
  const uri = loginData?.response?.parameters?.uri || '';
  const fragment = uri.includes('#') ? uri.split('#')[1] : (uri.split('?')[1] || '');
  const params   = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('access_token no encontrado en URI de redirección');

  const entR = await riotRequest('POST', 'entitlements.auth.riotgames.com', '/api/token/v1', '{}', {
    'Authorization': `Bearer ${accessToken}`,
  });
  const entD = JSON.parse(entR.body);
  const entitlementToken = entD.entitlements_token;
  if (!entitlementToken) throw new Error('entitlements_token vacío');

  const userR = await riotRequest('GET', 'auth.riotgames.com', '/userinfo', null, {
    'Authorization': `Bearer ${accessToken}`,
  });
  const puuid = JSON.parse(userR.body).sub;
  if (!puuid) throw new Error('PUUID vacío en userinfo');

  const clientVersion = await getClientVersion();
  return { accessToken, entitlementToken, puuid, clientVersion, _cookies: cookies };
}

// ── Login completo ────────────────────────────────────────────────────────────
async function riotLogin(username, password) {
  // 1. Inicializar sesión de cookies
  const initR = await riotRequest('POST', 'auth.riotgames.com', '/api/v1/authorization',
    JSON.stringify({
      client_id:     'play-valorant-web-prod',
      nonce:         '1',
      redirect_uri:  'https://playvalorant.com/opt_in',
      response_type: 'token id_token',
      scope:         'account openid',
    })
  );
  let cookies = parseCookies(initR.setCookies);

  // 2. Enviar credenciales
  const authR = await riotRequest('PUT', 'auth.riotgames.com', '/api/v1/authorization',
    JSON.stringify({ type:'auth', username, password, remember:false, language:'en_US' }),
    { 'Cookie': cookieStr(cookies) }
  );
  cookies = mergeCookies(cookies, parseCookies(authR.setCookies));
  const authD = JSON.parse(authR.body);

  if (authD.type === 'multifactor') {
    return { mfa:true, method: authD.multifactor?.method || 'email',
             email: authD.multifactor?.email || '', _cookies: cookies };
  }
  if (authD.type === 'error') {
    const msg = authD.error === 'auth_failure' ? 'Usuario o contraseña incorrectos' : authD.error;
    throw new Error(msg);
  }
  if (authD.type !== 'response') throw new Error('Respuesta inesperada: ' + authD.type);
  return finishAuth(authD, cookies);
}

// ── MFA ───────────────────────────────────────────────────────────────────────
async function riotMFA(code, savedCookies) {
  const mfaR = await riotRequest('PUT', 'auth.riotgames.com', '/api/v1/authorization',
    JSON.stringify({ type:'multifactor', code: String(code).trim(), rememberDevice:false }),
    { 'Cookie': cookieStr(savedCookies) }
  );
  const cookies = mergeCookies(savedCookies, parseCookies(mfaR.setCookies));
  const mfaD    = JSON.parse(mfaR.body);
  if (mfaD.type === 'error')    throw new Error('Código 2FA incorrecto');
  if (mfaD.type !== 'response') throw new Error('Error MFA: ' + mfaD.type);
  return finishAuth(mfaD, cookies);
}

// ── Proxy a pd.{shard}.a.pvp.net ─────────────────────────────────────────────
async function proxyPD(pdPath, res) {
  if (!session || session._mfaPending) {
    res.writeHead(401, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' });
    res.end(JSON.stringify({ error:'Sesión no iniciada. Haz login primero.' }));
    return;
  }
  try {
    const r = await riotRequest('GET', `pd.${session.shard}.a.pvp.net`, pdPath, null, {
      'Authorization':           `Bearer ${session.accessToken}`,
      'X-Riot-Entitlements-JWT': session.entitlementToken,
      'X-Riot-ClientPlatform':   CLIENT_PLATFORM,
      'X-Riot-ClientVersion':    session.clientVersion,
    });
    console.log(`[pd] ${r.status} ${pdPath.slice(0, 60)}`);
    res.writeHead(r.status, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' });
    res.end(r.body);
  } catch(e) {
    console.error('[pd] Error:', e.message);
    res.writeHead(502, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' });
    res.end(JSON.stringify({ error:'Error contactando Riot PD API', detail: e.message }));
  }
}

// ── Servidor ──────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers',
    'Content-Type, x-api-key, x-anthropic-key, Authorization, anthropic-version');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed   = url.parse(req.url);
  const pathname = parsed.pathname || '/';
  const segments = pathname.split('/').filter(Boolean);

  const ok  = d  => { res.writeHead(200, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify(d)); };
  const err = (c, m) => { res.writeHead(c, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' }); res.end(JSON.stringify({ error: m })); };
  const body = () => new Promise(r => { let b=''; req.on('data',c=>{b+=c;}); req.on('end',()=>r(b)); });

  // /health
  if (pathname === '/health' || pathname === '/') {
    return ok({ status:'ok', port:PORT,
      session: session && !session._mfaPending ? { puuid:session.puuid, shard:session.shard } : null });
  }

  // /riot-session GET
  if (pathname === '/riot-session' && req.method === 'GET') {
    return ok({ loggedIn: !!(session && !session._mfaPending),
      puuid: session?.puuid || null, shard: session?.shard || null, region: session?.region || null });
  }

  // /riot-session DELETE (logout)
  if (pathname === '/riot-session' && req.method === 'DELETE') {
    session = null; return ok({ ok:true });
  }

  // /riot-auth POST
  if (pathname === '/riot-auth' && req.method === 'POST') {
    body().then(async b => {
      let d; try { d = JSON.parse(b); } catch { return err(400,'Body inválido'); }
      const { username, password, region = 'eu' } = d;
      if (!username || !password) return err(400,'Faltan username o password');
      const shard = REGION_TO_SHARD[region] || 'eu';
      try {
        const r = await riotLogin(username, password);
        if (r.mfa) {
          session = { _mfaPending:true, _cookies:r._cookies, shard, region };
          return ok({ mfa:true, method:r.method, email:r.email });
        }
        session = { ...r, shard, region };
        console.log(`[riot-auth] OK | puuid:${r.puuid} shard:${shard}`);
        return ok({ ok:true, puuid:r.puuid, shard });
      } catch(e) { console.error('[riot-auth]',e.message); return err(401, e.message); }
    });
    return;
  }

  // /riot-auth-mfa POST
  if (pathname === '/riot-auth-mfa' && req.method === 'POST') {
    body().then(async b => {
      let d; try { d = JSON.parse(b); } catch { return err(400,'Body inválido'); }
      if (!d.code) return err(400,'Falta code');
      if (!session?._mfaPending) return err(400,'No hay MFA pendiente');
      const { shard, region, _cookies } = session;
      try {
        const r = await riotMFA(d.code, _cookies);
        session = { ...r, shard, region };
        console.log(`[riot-mfa] OK | puuid:${r.puuid}`);
        return ok({ ok:true, puuid:r.puuid, shard });
      } catch(e) { console.error('[riot-mfa]',e.message); return err(401, e.message); }
    });
    return;
  }

  // /pd/match-history
  if (pathname === '/pd/match-history' && req.method === 'GET') {
    const qs    = new URLSearchParams(parsed.search || '');
    const start = qs.get('start') || '0';
    const end   = qs.get('end')   || '10';
    const queue = qs.get('queue') || '';
    if (!session || session._mfaPending) return err(401,'Sesión no iniciada');
    const qp = queue ? `&queue=${encodeURIComponent(queue)}` : '';
    return proxyPD(`/match-history/v1/history/${session.puuid}?startIndex=${start}&endIndex=${end}${qp}`, res);
  }

  // /pd/match-details/:matchId
  if (segments[0] === 'pd' && segments[1] === 'match-details' && segments[2]) {
    return proxyPD(`/match-details/v1/matches/${segments[2]}`, res);
  }

  // /claude POST
  if (pathname === '/claude' && req.method === 'POST') {
    body().then(async b => {
      let pb; try { pb = JSON.parse(b); } catch { return err(400,'Body JSON inválido'); }
      const key = req.headers['x-anthropic-key'] || req.headers['x-api-key'] ||
                  (req.headers['authorization']||'').replace('Bearer ','');
      if (!key) return err(401,'Falta x-anthropic-key');
      const bs = JSON.stringify(pb);
      const pr = https.request({
        hostname:'api.anthropic.com', path:'/v1/messages', method:'POST',
        headers: { 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(bs),
                   'x-api-key':key, 'anthropic-version':'2023-06-01' },
      }, pRes => {
        let rb=''; pRes.on('data',c=>{rb+=c;});
        pRes.on('end',()=>{ res.writeHead(pRes.statusCode,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}); res.end(rb); });
      });
      pr.on('error', e => err(502, e.message));
      pr.write(bs); pr.end();
    });
    return;
  }

  // /riot/{region}/... → api.riotgames.com (legacy)
  if (segments[0] === 'riot' && segments.length >= 3 && VALID_REGIONS.has(segments[1])) {
    const region   = segments[1];
    const riotPath = '/' + segments.slice(2).join('/') + (parsed.search || '');
    const token    = req.headers['x-riot-token'];
    if (!token) return err(401,'Falta X-Riot-Token');
    const pr = https.request({
      hostname: region + '.api.riotgames.com', path: riotPath, method:'GET',
      headers: { 'X-Riot-Token':token, 'Accept':'application/json' },
    }, pRes => {
      res.writeHead(pRes.statusCode,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      pRes.pipe(res);
    });
    pr.on('error', e => err(502, e.message));
    pr.end();
    return;
  }

  err(404, 'Ruta no encontrada: ' + pathname);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════════╗');
  console.log('  ║   ValoAnalytics — Proxy Server v2 (Riot Internal API)   ║');
  console.log('  ║   http://localhost:' + PORT + '                               ║');
  console.log('  ║                                                          ║');
  console.log('  ║   ✓ POST   /riot-auth         (login Riot)               ║');
  console.log('  ║   ✓ POST   /riot-auth-mfa     (código 2FA)               ║');
  console.log('  ║   ✓ GET    /riot-session       (estado sesión)            ║');
  console.log('  ║   ✓ DELETE /riot-session       (logout)                   ║');
  console.log('  ║   ✓ GET    /pd/match-history   (historial partidos)       ║');
  console.log('  ║   ✓ GET    /pd/match-details/  (detalles partido)         ║');
  console.log('  ║   ✓ POST   /claude             (Claude AI)                ║');
  console.log('  ╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Deja esta ventana abierta. Para parar: Ctrl+C');
  console.log('');
});
