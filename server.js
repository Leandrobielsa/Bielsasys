// ─────────────────────────────────────────────
//  BielsaSys — API Backend con JWT Auth
//  Node.js puro (crypto nativo), sin npm.
// ─────────────────────────────────────────────

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PORT    = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// ⚠️  CAMBIA ESTO
const ADMIN_USER    = 'admin';
const ADMIN_PASS    = 'bielsasys2025';
const JWT_SECRET    = 'bielsasys_jwt_super_secret_key_2025_asir';
const JWT_EXPIRES_IN = 8 * 60 * 60; // 8 horas en segundos

// ══════════════════════════════════════════════
//  JWT con crypto nativo
// ══════════════════════════════════════════════
function b64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function b64urlDecode(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return Buffer.from(str,'base64').toString('utf8');
}
function jwtSign(payload) {
  const h = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const b = b64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now()/1000),
    exp: Math.floor(Date.now()/1000) + JWT_EXPIRES_IN,
  }));
  const s = crypto.createHmac('sha256', JWT_SECRET)
    .update(h+'.'+b).digest('base64')
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return `${h}.${b}.${s}`;
}
function jwtVerify(token) {
  try {
    const [h,b,s] = token.split('.');
    if (!h||!b||!s) return null;
    const expected = crypto.createHmac('sha256', JWT_SECRET)
      .update(h+'.'+b).digest('base64')
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    if (expected !== s) return null;
    const payload = JSON.parse(b64urlDecode(b));
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}
function extractToken(req) {
  const auth = req.headers['authorization'] || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}
function requireAuth(req, res) {
  const payload = jwtVerify(extractToken(req) || '');
  if (!payload) { send(res, 401, {error:'No autorizado. Inicia sesión.'}); return false; }
  return true;
}

// ══════════════════════════════════════════════
//  Base de datos
// ══════════════════════════════════════════════
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      products: [
        {id:1,name:'Naranja Valencia Extra',category:'citrico',emoji:'🍊',price:0.38,unit:'kg',origin:'Valencia',badge:'Temporada',badgeType:'',minOrder:'50 kg',stock:true},
        {id:2,name:'Limón Fino Murcia',category:'citrico',emoji:'🍋',price:0.65,unit:'kg',origin:'Murcia',badge:'',badgeType:'',minOrder:'25 kg',stock:true},
        {id:3,name:'Tomate Pera',category:'verdura',emoji:'🍅',price:1.20,unit:'kg',origin:'Almería',badge:'Eco',badgeType:'eco',minOrder:'20 kg',stock:true},
        {id:4,name:'Lechuga Romana',category:'verdura',emoji:'🥬',price:0.55,unit:'ud',origin:'Murcia',badge:'Eco',badgeType:'eco',minOrder:'20 ud',stock:true},
        {id:5,name:'Fresas Huelva',category:'fruta',emoji:'🍓',price:2.20,unit:'kg',origin:'Huelva',badge:'Temporada',badgeType:'',minOrder:'10 kg',stock:true},
        {id:6,name:'Melón Piel de Sapo',category:'fruta',emoji:'🍈',price:0.60,unit:'kg',origin:'C.La Mancha',badge:'',badgeType:'',minOrder:'30 kg',stock:true},
      ],
      nextId: 7
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// ══════════════════════════════════════════════
//  Helpers HTTP
// ══════════════════════════════════════════════
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); } });
  });
}
function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,Authorization',
  });
  res.end(JSON.stringify(data));
}
function serveFile(res, filePath, ct) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': ct});
    res.end(data);
  });
}

// ══════════════════════════════════════════════
//  Rutas
// ══════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method;

  if (method === 'OPTIONS') { send(res, 204, {}); return; }

  // Páginas
  if (method==='GET' && url==='/') { serveFile(res, path.join(__dirname,'public','index.html'), 'text/html'); return; }
  if (method==='GET' && url==='/login') { serveFile(res, path.join(__dirname,'public','login.html'), 'text/html'); return; }
  if (method==='GET' && url==='/admin') { serveFile(res, path.join(__dirname,'public','admin.html'), 'text/html'); return; }

  // POST /api/login
  if (method==='POST' && url==='/api/login') {
    try {
      const {username, password} = await parseBody(req);
      if (username===ADMIN_USER && password===ADMIN_PASS) {
        send(res, 200, { token: jwtSign({username, role:'admin'}), expiresIn: JWT_EXPIRES_IN });
      } else {
        setTimeout(() => send(res, 401, {error:'Usuario o contraseña incorrectos.'}), 600);
      }
    } catch(e) { send(res, 500, {error:'Error interno.'}); }
    return;
  }

  // GET /api/auth/check
  if (method==='GET' && url==='/api/auth/check') {
    const p = jwtVerify(extractToken(req)||'');
    p ? send(res, 200, {valid:true, username:p.username}) : send(res, 401, {valid:false});
    return;
  }

  // GET /api/products  — público
  if (method==='GET' && url==='/api/products') {
    send(res, 200, readDB().products); return;
  }

  // POST /api/products  — 🔒
  if (method==='POST' && url==='/api/products') {
    if (!requireAuth(req,res)) return;
    try {
      const {name,category,emoji,price,unit,origin,badge,badgeType,minOrder} = await parseBody(req);
      if (!name||!price||!category) { send(res,400,{error:'Faltan: name, price, category'}); return; }
      const db = readDB();
      const p = {id:db.nextId++,name,category,emoji:emoji||'📦',price:parseFloat(price),unit:unit||'kg',origin:origin||'',badge:badge||'',badgeType:badgeType||'',minOrder:minOrder||'10 kg',stock:true};
      db.products.push(p); writeDB(db); send(res,201,p);
    } catch(e) { send(res,500,{error:e.message}); }
    return;
  }

  // DELETE /api/products/:id  — 🔒
  const delMatch = url.match(/^\/api\/products\/(\d+)$/);
  if (method==='DELETE' && delMatch) {
    if (!requireAuth(req,res)) return;
    const id=parseInt(delMatch[1]), db=readDB(), idx=db.products.findIndex(p=>p.id===id);
    if (idx===-1) { send(res,404,{error:'No encontrado'}); return; }
    const deleted=db.products.splice(idx,1)[0]; writeDB(db); send(res,200,{deleted});
    return;
  }

  send(res, 404, {error:'Ruta no encontrada'});
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ✅  BielsaSys con JWT Auth');
  console.log(`  🌐  Tienda:  http://localhost:${PORT}`);
  console.log(`  🔑  Login:   http://localhost:${PORT}/login`);
  console.log(`  🔧  Admin:   http://localhost:${PORT}/admin`);
  console.log('');
  console.log(`  👤  Usuario: ${ADMIN_USER}   🔐  Clave: ${ADMIN_PASS}`);
  console.log('');
});
