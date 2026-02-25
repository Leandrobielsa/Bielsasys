// ═══════════════════════════════════════════════════════
//  BielsaSys — Backend completo v2
//  Node.js puro · crypto nativo · db.json
//
//  RUTAS:
//  GET  /                        → tienda
//  GET  /login                   → login admin
//  GET  /admin                   → panel admin
//  GET  /registro                → registro cliente
//  GET  /portal                  → portal cliente
//
//  POST /api/login               → auth admin (JWT)
//  POST /api/cliente/registro    → registrar cliente
//  POST /api/cliente/login       → login cliente (JWT)
//  GET  /api/auth/check          → verificar token admin
//  GET  /api/cliente/check       → verificar token cliente
//
//  GET  /api/products            → listar productos (público)
//  POST /api/products            → crear producto (admin)
//  PUT  /api/products/:id        → editar producto (admin)
//  DELETE /api/products/:id      → eliminar producto (admin)
//
//  GET  /api/orders              → todos los pedidos (admin)
//  GET  /api/orders/mine         → pedidos del cliente (cliente)
//  POST /api/orders              → crear pedido (cliente)
//  PUT  /api/orders/:id/status   → cambiar estado (admin)
//
//  GET  /api/stats               → estadísticas dashboard (admin)
// ═══════════════════════════════════════════════════════

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const PORT    = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

const ADMIN_USER     = 'admin';
const ADMIN_PASS     = 'bielsasys2025';
const JWT_SECRET     = 'bielsasys_jwt_super_secret_key_2025_asir';
const JWT_EXPIRES_IN = 8 * 60 * 60;

// ─── JWT ────────────────────────────────────────────────
function b64url(s) { return Buffer.from(s).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function b64dec(s) { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4)s+='='; return Buffer.from(s,'base64').toString('utf8'); }

function jwtSign(payload, expiresIn = JWT_EXPIRES_IN) {
  const h = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const b = b64url(JSON.stringify({...payload, iat:Math.floor(Date.now()/1000), exp:Math.floor(Date.now()/1000)+expiresIn}));
  const s = crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+b).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return `${h}.${b}.${s}`;
}
function jwtVerify(token) {
  try {
    const [h,b,s] = (token||'').split('.');
    if(!h||!b||!s) return null;
    const exp = crypto.createHmac('sha256',JWT_SECRET).update(h+'.'+b).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    if(exp!==s) return null;
    const p = JSON.parse(b64dec(b));
    if(p.exp < Math.floor(Date.now()/1000)) return null;
    return p;
  } catch { return null; }
}
function getToken(req) { const a=req.headers['authorization']||''; return a.startsWith('Bearer ')?a.slice(7):null; }
function requireAdmin(req,res) { const p=jwtVerify(getToken(req)); if(!p||p.role!=='admin'){send(res,401,{error:'No autorizado'}); return null;} return p; }
function requireClient(req,res) { const p=jwtVerify(getToken(req)); if(!p||p.role!=='cliente'){send(res,401,{error:'No autorizado'}); return null;} return p; }
function requireAny(req,res) { const p=jwtVerify(getToken(req)); if(!p){send(res,401,{error:'No autorizado'}); return null;} return p; }

// ─── Contraseñas ─────────────────────────────────────────
function hashPass(pass) { return crypto.createHash('sha256').update(pass+JWT_SECRET).digest('hex'); }

// ─── Base de datos ───────────────────────────────────────
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
        {id:7,name:'Pimiento Rojo',category:'verdura',emoji:'🫑',price:1.80,unit:'kg',origin:'Almería',badge:'',badgeType:'',minOrder:'15 kg',stock:true},
        {id:8,name:'Sandía sin pepitas',category:'fruta',emoji:'🍉',price:0.35,unit:'kg',origin:'Almería',badge:'',badgeType:'',minOrder:'50 kg',stock:true},
      ],
      clients: [],
      orders: [],
      nextProductId: 9,
      nextOrderId: 1,
      nextClientId: 1,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// ─── HTTP helpers ─────────────────────────────────────────
function parseBody(req) {
  return new Promise((ok,ko) => { let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{ok(b?JSON.parse(b):{});}catch(e){ko(e);} }); });
}
function send(res, status, data) {
  res.writeHead(status, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});
  res.end(JSON.stringify(data));
}
function serveFile(res, fp, ct) {
  fs.readFile(fp, (err,data) => { if(err){res.writeHead(404);res.end('Not found');return;} res.writeHead(200,{'Content-Type':ct}); res.end(data); });
}

// ─── Servidor ─────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;
  if (method==='OPTIONS') { send(res,204,{}); return; }

  // ── Páginas HTML ──
  const pages = { '/':'index.html', '/login':'login.html', '/admin':'admin.html', '/registro':'registro.html', '/portal':'portal.html' };
  if (method==='GET' && pages[url]) { serveFile(res, path.join(__dirname,'public',pages[url]), 'text/html'); return; }

  // ══ AUTH ADMIN ══
  if (method==='POST' && url==='/api/login') {
    try {
      const {username,password} = await parseBody(req);
      if (username===ADMIN_USER && password===ADMIN_PASS) {
        send(res,200,{token:jwtSign({username,role:'admin'}), role:'admin'});
      } else {
        setTimeout(()=>send(res,401,{error:'Credenciales incorrectas.'}), 600);
      }
    } catch(e) { send(res,500,{error:'Error interno'}); }
    return;
  }
  if (method==='GET' && url==='/api/auth/check') {
    const p=jwtVerify(getToken(req));
    p&&p.role==='admin' ? send(res,200,{valid:true,username:p.username,role:p.role}) : send(res,401,{valid:false});
    return;
  }

  // ══ AUTH CLIENTE ══
  if (method==='POST' && url==='/api/cliente/registro') {
    try {
      const {nombre,empresa,cif,email,telefono,password} = await parseBody(req);
      if (!nombre||!email||!password) { send(res,400,{error:'Faltan campos obligatorios.'}); return; }
      const db = readDB();
      if (db.clients.find(c=>c.email===email)) { send(res,409,{error:'Ya existe una cuenta con ese email.'}); return; }
      const client = {
        id: db.nextClientId++,
        nombre, empresa:empresa||'', cif:cif||'', email, telefono:telefono||'',
        passwordHash: hashPass(password),
        createdAt: new Date().toISOString(),
        estado: 'activo'
      };
      db.clients.push(client);
      writeDB(db);
      const {passwordHash, ...safe} = client;
      send(res,201,{cliente:safe, token:jwtSign({clientId:client.id,email:client.email,role:'cliente'})});
    } catch(e) { send(res,500,{error:'Error interno'}); }
    return;
  }
  if (method==='POST' && url==='/api/cliente/login') {
    try {
      const {email,password} = await parseBody(req);
      const db = readDB();
      const client = db.clients.find(c=>c.email===email && c.passwordHash===hashPass(password));
      if (!client) { setTimeout(()=>send(res,401,{error:'Email o contraseña incorrectos.'}),600); return; }
      const {passwordHash,...safe} = client;
      send(res,200,{cliente:safe, token:jwtSign({clientId:client.id,email:client.email,nombre:client.nombre,role:'cliente'})});
    } catch(e) { send(res,500,{error:'Error interno'}); }
    return;
  }
  if (method==='GET' && url==='/api/cliente/check') {
    const p=jwtVerify(getToken(req));
    if (p&&p.role==='cliente') {
      const db=readDB(); const c=db.clients.find(x=>x.id===p.clientId);
      if(c){ const {passwordHash,...safe}=c; send(res,200,{valid:true,cliente:safe}); }
      else send(res,401,{valid:false});
    } else send(res,401,{valid:false});
    return;
  }

  // ══ PRODUCTS ══
  if (method==='GET' && url==='/api/products') {
    send(res,200,readDB().products); return;
  }
  if (method==='POST' && url==='/api/products') {
    if (!requireAdmin(req,res)) return;
    try {
      const {name,category,emoji,price,unit,origin,badge,badgeType,minOrder} = await parseBody(req);
      if (!name||!price||!category) { send(res,400,{error:'Faltan: name, price, category'}); return; }
      const db=readDB();
      const p={id:db.nextProductId++,name,category,emoji:emoji||'📦',price:parseFloat(price),unit:unit||'kg',origin:origin||'',badge:badge||'',badgeType:badgeType||'',minOrder:minOrder||'10 kg',stock:true};
      db.products.push(p); writeDB(db); send(res,201,p);
    } catch(e){send(res,500,{error:e.message});}
    return;
  }
  const putProd = url.match(/^\/api\/products\/(\d+)$/);
  if (method==='PUT' && putProd) {
    if (!requireAdmin(req,res)) return;
    try {
      const id=parseInt(putProd[1]); const db=readDB();
      const idx=db.products.findIndex(p=>p.id===id);
      if(idx===-1){send(res,404,{error:'No encontrado'});return;}
      const body=await parseBody(req);
      db.products[idx]={...db.products[idx],...body, id, price:parseFloat(body.price||db.products[idx].price)};
      writeDB(db); send(res,200,db.products[idx]);
    } catch(e){send(res,500,{error:e.message});}
    return;
  }
  const delProd = url.match(/^\/api\/products\/(\d+)$/);
  if (method==='DELETE' && delProd) {
    if (!requireAdmin(req,res)) return;
    const id=parseInt(delProd[1]),db=readDB(),idx=db.products.findIndex(p=>p.id===id);
    if(idx===-1){send(res,404,{error:'No encontrado'});return;}
    const deleted=db.products.splice(idx,1)[0]; writeDB(db); send(res,200,{deleted});
    return;
  }

  // ══ ORDERS ══
  if (method==='POST' && url==='/api/orders') {
    const p=requireClient(req,res); if(!p) return;
    try {
      const {items,nota,fechaEntrega} = await parseBody(req);
      if(!items||!items.length){send(res,400,{error:'El pedido está vacío.'});return;}
      const db=readDB();
      const client=db.clients.find(c=>c.id===p.clientId);
      const total=items.reduce((s,i)=>s+(i.precio*i.cantidad),0);
      const order={
        id:db.nextOrderId++, clientId:p.clientId,
        clienteNombre:client?.nombre||'', clienteEmpresa:client?.empresa||'', clienteEmail:p.email,
        items, total:parseFloat(total.toFixed(2)),
        nota:nota||'', fechaEntrega:fechaEntrega||'',
        estado:'pendiente',
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
      };
      db.orders.push(order); writeDB(db); send(res,201,order);
    } catch(e){send(res,500,{error:e.message});}
    return;
  }
  if (method==='GET' && url==='/api/orders') {
    if(!requireAdmin(req,res)) return;
    const db=readDB();
    send(res,200,[...db.orders].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)));
    return;
  }
  if (method==='GET' && url==='/api/orders/mine') {
    const p=requireClient(req,res); if(!p) return;
    const db=readDB();
    const mine=db.orders.filter(o=>o.clientId===p.clientId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    send(res,200,mine); return;
  }
  const statusMatch = url.match(/^\/api\/orders\/(\d+)\/status$/);
  if (method==='PUT' && statusMatch) {
    if(!requireAdmin(req,res)) return;
    try {
      const id=parseInt(statusMatch[1]); const db=readDB();
      const idx=db.orders.findIndex(o=>o.id===id);
      if(idx===-1){send(res,404,{error:'Pedido no encontrado'});return;}
      const {estado}=await parseBody(req);
      if(!['pendiente','confirmado','en_preparacion','enviado','entregado','cancelado'].includes(estado)){send(res,400,{error:'Estado inválido'});return;}
      db.orders[idx].estado=estado; db.orders[idx].updatedAt=new Date().toISOString();
      writeDB(db); send(res,200,db.orders[idx]);
    } catch(e){send(res,500,{error:e.message});}
    return;
  }

  // ══ STATS (admin) ══
  if (method==='GET' && url==='/api/stats') {
    if(!requireAdmin(req,res)) return;
    const db=readDB();
    const orders=db.orders;
    const now=new Date(); const thisMonth=now.getMonth(); const thisYear=now.getFullYear();
    const monthOrders=orders.filter(o=>{const d=new Date(o.createdAt);return d.getMonth()===thisMonth&&d.getFullYear()===thisYear;});
    const revenue=orders.filter(o=>o.estado!=='cancelado').reduce((s,o)=>s+o.total,0);
    const monthRevenue=monthOrders.filter(o=>o.estado!=='cancelado').reduce((s,o)=>s+o.total,0);

    // Pedidos por estado
    const byStatus={};
    orders.forEach(o=>{ byStatus[o.estado]=(byStatus[o.estado]||0)+1; });

    // Últimos 7 días de actividad
    const last7=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const dayStr=d.toISOString().slice(0,10);
      const dayOrders=orders.filter(o=>o.createdAt.slice(0,10)===dayStr);
      last7.push({dia:dayStr.slice(5), pedidos:dayOrders.length, importe:parseFloat(dayOrders.reduce((s,o)=>s+o.total,0).toFixed(2))});
    }

    // Top productos pedidos
    const prodCount={};
    orders.filter(o=>o.estado!=='cancelado').forEach(o=>{
      o.items.forEach(i=>{ prodCount[i.nombre]=(prodCount[i.nombre]||0)+i.cantidad; });
    });
    const topProducts=Object.entries(prodCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([nombre,cantidad])=>({nombre,cantidad}));

    send(res,200,{
      totalProducts: db.products.length,
      totalClients:  db.clients.length,
      totalOrders:   orders.length,
      pendingOrders: orders.filter(o=>o.estado==='pendiente').length,
      totalRevenue:  parseFloat(revenue.toFixed(2)),
      monthRevenue:  parseFloat(monthRevenue.toFixed(2)),
      monthOrders:   monthOrders.length,
      byStatus, last7, topProducts,
    });
    return;
  }

  // ══ CLIENTS list (admin) ══
  if (method==='GET' && url==='/api/clients') {
    if(!requireAdmin(req,res)) return;
    const db=readDB();
    send(res,200,db.clients.map(({passwordHash,...c})=>c));
    return;
  }

  send(res,404,{error:'Ruta no encontrada'});
});

server.listen(PORT, () => {
  console.log('\n  ✅  BielsaSys v2 arrancado');
  console.log(`  🌐  Tienda:   http://localhost:${PORT}`);
  console.log(`  🔑  Login:    http://localhost:${PORT}/login`);
  console.log(`  🔧  Admin:    http://localhost:${PORT}/admin`);
  console.log(`  👥  Registro: http://localhost:${PORT}/registro`);
  console.log(`  📦  Portal:   http://localhost:${PORT}/portal`);
  console.log(`\n  👤  Admin: ${ADMIN_USER} / ${ADMIN_PASS}\n`);
});
