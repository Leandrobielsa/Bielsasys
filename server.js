// ─────────────────────────────────────────────
//  BielsaSys — API Backend con JWT Auth y PostgreSQL
//  Node.js puro, sin express.
// ─────────────────────────────────────────────

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const PORT    = process.env.PORT || 3000;

const ADMIN_USER    = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS    = process.env.ADMIN_PASS || 'bielsasys2025';
const JWT_SECRET    = process.env.JWT_SECRET || 'bielsasys_jwt_super_secret_key_2025_asir';
const JWT_EXPIRES_IN = 8 * 60 * 60; // 8 horas en segundos

// ══════════════════════════════════════════════
//  Conexión a PostgreSQL
// ══════════════════════════════════════════════
const pool = process.env.DATABASE_URL 
  ? new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'bielsauser',
      password: process.env.DB_PASS || 'bielsapassword',
      database: process.env.DB_NAME || 'bielsasys',
    });

// Inicializar base de datos
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, category VARCHAR(50), emoji VARCHAR(10),
        price DECIMAL(10,2), unit VARCHAR(20), origin VARCHAR(100), badge VARCHAR(50),
        badgeType VARCHAR(20), minOrder VARCHAR(30), stock BOOLEAN DEFAULT TRUE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY, nombre VARCHAR(100), empresa VARCHAR(100), cif VARCHAR(20),
        email VARCHAR(100) UNIQUE, telefono VARCHAR(20), "passwordHash" VARCHAR(255),
        estado VARCHAR(20) DEFAULT 'activo', "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY, "clientId" INT, "clienteNombre" VARCHAR(100), "clienteEmpresa" VARCHAR(100),
        "clienteEmail" VARCHAR(100), items JSONB, total DECIMAL(10,2), nota TEXT, "fechaEntrega" VARCHAR(50),
        estado VARCHAR(20) DEFAULT 'pendiente', "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Base de datos PostgreSQL inicializada.');
  } catch (err) {
    console.error('❌ Error al inicializar PostgreSQL:', err);
  }
}
initDB();

// ══════════════════════════════════════════════
//  JWT con crypto nativo
// ══════════════════════════════════════════════
function b64url(str) { return Buffer.from(str).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,''); }
function b64urlDecode(str) { str = str.replace(/-/g,'+').replace(/_/g,'/'); while (str.length % 4) str += '='; return Buffer.from(str,'base64').toString('utf8'); }
function jwtSign(payload) {
  const h = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const b = b64url(JSON.stringify({...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + JWT_EXPIRES_IN }));
  const s = crypto.createHmac('sha256', JWT_SECRET).update(h+'.'+b).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  return `${h}.${b}.${s}`;
}
function jwtVerify(token) {
  try {
    const [h,b,s] = token.split('.'); if (!h||!b||!s) return null;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(h+'.'+b).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
    if (expected !== s) return null;
    const payload = JSON.parse(b64urlDecode(b));
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}
function extractToken(req) { const auth = req.headers['authorization'] || ''; return auth.startsWith('Bearer ') ? auth.slice(7) : null; }
function requireAuth(req, res) {
  const payload = jwtVerify(extractToken(req) || '');
  if (!payload) { send(res, 401, {error:'No autorizado.'}); return false; }
  return payload; // Devolvemos el payload para saber quién es
}

// ══════════════════════════════════════════════
//  Helpers HTTP
// ══════════════════════════════════════════════
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''; req.on('data', c => body += c);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); } });
  });
}
function send(res, status, data) {
  res.writeHead(status, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type,Authorization' });
  res.end(JSON.stringify(data));
}
function serveFile(res, filePath, ct) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': ct}); res.end(data);
  });
}

// ══════════════════════════════════════════════
//  Rutas del Servidor
// ══════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method;

  if (method === 'OPTIONS') { send(res, 204, {}); return; }

  // 1. Archivos estáticos
  if (method==='GET' && url==='/') { serveFile(res, path.join(__dirname,'public','index.html'), 'text/html'); return; }
  if (method==='GET' && url==='/login') { serveFile(res, path.join(__dirname,'public','login.html'), 'text/html'); return; }
  if (method==='GET' && url==='/admin') { serveFile(res, path.join(__dirname,'public','admin.html'), 'text/html'); return; }
  if (method==='GET' && url==='/portal') { serveFile(res, path.join(__dirname,'public','portal.html'), 'text/html'); return; }
  if (method==='GET' && url==='/registro') { serveFile(res, path.join(__dirname,'public','registro.html'), 'text/html'); return; }

  // 2. Autenticación Administrador
  if (method==='POST' && url==='/api/login') {
    try {
      const {username, password} = await parseBody(req);
      if (username===ADMIN_USER && password===ADMIN_PASS) {
        send(res, 200, { token: jwtSign({username, role:'admin'}), expiresIn: JWT_EXPIRES_IN });
      } else { setTimeout(() => send(res, 401, {error:'Usuario o contraseña incorrectos.'}), 600); }
    } catch(e) { send(res, 500, {error:'Error interno.'}); }
    return;
  }

  if (method==='GET' && url==='/api/auth/check') {
    const p = jwtVerify(extractToken(req)||'');
    p && p.role === 'admin' ? send(res, 200, {valid:true, username:p.username}) : send(res, 401, {valid:false});
    return;
  }

  // 3. Autenticación y Gestión de Clientes B2B
  if (method === 'POST' && url === '/api/cliente/registro') {
    try {
      const { nombre, email, password, empresa, cif, telefono } = await parseBody(req);
      if (!nombre || !email || !password) { send(res, 400, {error:'Faltan datos obligatorios.'}); return; }
      
      const check = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
      if (check.rows.length > 0) { send(res, 400, {error:'El email ya está registrado.'}); return; }

      const hash = crypto.createHash('sha256').update(password).digest('hex');
      const query = `INSERT INTO clients (nombre, empresa, cif, email, telefono, "passwordHash", estado) VALUES ($1, $2, $3, $4, $5, $6, 'pendiente') RETURNING id, nombre, email, empresa`;
      const result = await pool.query(query, [nombre, empresa||'', cif||'', email, telefono||'', hash]);
      
      const client = result.rows[0];
      const token = jwtSign({ id: client.id, email: client.email, role: 'cliente' });
      send(res, 201, { token, cliente: client });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  if (method === 'POST' && url === '/api/cliente/login') {
    try {
      const { email, password } = await parseBody(req);
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      
      const result = await pool.query('SELECT * FROM clients WHERE email = $1 AND "passwordHash" = $2', [email, hash]);
      if (result.rows.length === 0) { setTimeout(() => send(res, 401, {error:'Credenciales incorrectas.'}), 600); return; }
      
      const client = result.rows[0];
      if (client.estado === 'rechazado') { send(res, 403, {error:'Cuenta rechazada por un administrador.'}); return; }
      
      const token = jwtSign({ id: client.id, email: client.email, role: 'cliente' });
      delete client.passwordHash;
      send(res, 200, { token, cliente: client });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  if (method === 'GET' && url === '/api/cliente/check') {
    const payload = jwtVerify(extractToken(req) || '');
    if (!payload || payload.role !== 'cliente') { send(res, 401, {valid:false}); return; }
    try {
      const result = await pool.query('SELECT * FROM clients WHERE id = $1', [payload.id]);
      if (result.rows.length === 0) { send(res, 401, {valid:false}); return; }
      const client = result.rows[0]; delete client.passwordHash;
      send(res, 200, { valid: true, cliente: client });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  // 4. API Panel de Administración
  if (method==='GET' && url==='/api/stats') {
    if (!requireAuth(req,res)) return;
    try {
      const ordersRes = await pool.query('SELECT * FROM orders');
      const clientsRes = await pool.query('SELECT COUNT(*) FROM clients');
      const prodsRes = await pool.query('SELECT COUNT(*) FROM products');
      const orders = ordersRes.rows;
      let totalRevenue = 0; let pendingOrders = 0; const byStatus = {}; const productCounts = {};

      orders.forEach(o => {
        const total = parseFloat(o.total); totalRevenue += total;
        if (o.estado === 'pendiente') pendingOrders++;
        byStatus[o.estado] = (byStatus[o.estado] || 0) + 1;
        if (o.items) {
          let itemsArr = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
          itemsArr.forEach(i => { productCounts[i.nombre] = (productCounts[i.nombre] || 0) + i.cantidad; });
        }
      });

      const topProducts = Object.entries(productCounts).map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
      send(res, 200, { totalOrders: orders.length, monthOrders: orders.length, pendingOrders, monthRevenue: totalRevenue, totalRevenue, totalClients: parseInt(clientsRes.rows[0].count), totalProducts: parseInt(prodsRes.rows[0].count), last7: [{ dia: 'Hoy', pedidos: orders.length }], byStatus, topProducts });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  // 5. API Pedidos
  if (method==='GET' && url==='/api/orders') {
    if (!requireAuth(req,res)) return;
    try {
      const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
      send(res, 200, result.rows.map(o => ({ ...o, total: parseFloat(o.total) })));
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  if (method === 'GET' && url === '/api/orders/mine') {
    const payload = jwtVerify(extractToken(req) || '');
    if (!payload || payload.role !== 'cliente') { send(res, 401, {error:'No autorizado'}); return; }
    try {
      const result = await pool.query('SELECT * FROM orders WHERE "clientId" = $1 ORDER BY id DESC', [payload.id]);
      send(res, 200, result.rows.map(o => ({ ...o, total: parseFloat(o.total) })));
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  if (method === 'POST' && url === '/api/orders') {
    const payload = jwtVerify(extractToken(req) || '');
    if (!payload || payload.role !== 'cliente') { send(res, 401, {error:'No autorizado'}); return; }
    try {
      const { items, nota } = await parseBody(req);
      if (!items || !items.length) { send(res, 400, {error:'El pedido está vacío'}); return; }
      
      const cliRes = await pool.query('SELECT * FROM clients WHERE id = $1', [payload.id]);
      const client = cliRes.rows[0];
      if (client.estado !== 'activo') { send(res, 403, {error:'Cuenta pendiente de aprobación.'}); return; }
      
      const total = items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
      const query = `INSERT INTO orders ("clientId", "clienteNombre", "clienteEmpresa", "clienteEmail", items, total, nota, estado) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente') RETURNING *`;
      const result = await pool.query(query, [client.id, client.nombre, client.empresa, client.email, JSON.stringify(items), total, nota||'']);
      send(res, 201, result.rows[0]);
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  const statusMatch = url.match(/^\/api\/orders\/(\d+)\/status$/);
  if (method === 'PUT' && statusMatch) {
    if (!requireAuth(req,res)) return;
    try {
      const { estado } = await parseBody(req);
      await pool.query('UPDATE orders SET estado = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2', [estado, parseInt(statusMatch[1])]);
      send(res, 200, { success: true });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  // 6. API Clientes Admin
  if (method==='GET' && url==='/api/clients') {
    if (!requireAuth(req,res)) return;
    try {
      const result = await pool.query("SELECT id, nombre, empresa, cif, email, telefono, estado, \"createdAt\" FROM clients ORDER BY id DESC");
      send(res, 200, result.rows);
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  if (method==='GET' && url==='/api/notifications') {
    if (!requireAuth(req,res)) return;
    try {
      const result = await pool.query("SELECT * FROM clients WHERE estado = 'pendiente' ORDER BY id DESC");
      send(res, 200, { pendingClients: result.rows });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  const approveMatch = url.match(/^\/api\/clients\/(\d+)\/approve$/);
  if (method === 'PUT' && approveMatch) {
    if (!requireAuth(req,res)) return;
    try {
      await pool.query("UPDATE clients SET estado = 'activo' WHERE id = $1", [parseInt(approveMatch[1])]);
      send(res, 200, { success: true });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  const rejectMatch = url.match(/^\/api\/clients\/(\d+)\/reject$/);
  if (method === 'PUT' && rejectMatch) {
    if (!requireAuth(req,res)) return;
    try {
      await pool.query("UPDATE clients SET estado = 'rechazado' WHERE id = $1", [parseInt(rejectMatch[1])]);
      send(res, 200, { success: true });
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  // 7. API Productos
  if (method==='GET' && url==='/api/products') {
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
      send(res, 200, result.rows.map(p => ({ ...p, price: parseFloat(p.price) })));
    } catch (e) { send(res, 500, {error: e.message}); }
    return;
  }

  if (method==='POST' && url==='/api/products') {
    if (!requireAuth(req,res)) return;
    try {
      const {name,category,emoji,price,unit,origin,badge,badgeType,minOrder} = await parseBody(req);
      if (!name||!price||!category) { send(res,400,{error:'Faltan: name, price, category'}); return; }
      const query = `INSERT INTO products (name, category, emoji, price, unit, origin, badge, badgeType, minOrder, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;`;
      const result = await pool.query(query, [name, category, emoji||'📦', parseFloat(price), unit||'kg', origin||'', badge||'', badgeType||'', minOrder||'10 kg', true]);
      const newProduct = result.rows[0]; newProduct.price = parseFloat(newProduct.price);
      send(res,201,newProduct);
    } catch(e) { send(res,500,{error:e.message}); }
    return;
  }

  // PUT /api/products/:id — 🔒 Admin (Editar producto)
  const putMatch = url.match(/^\/api\/products\/(\d+)$/);
  if (method === 'PUT' && putMatch) {
    if (!requireAuth(req,res)) return;
    try {
      const id = parseInt(putMatch[1]);
      const {name, category, emoji, price, unit, origin, badge, badgeType, minOrder} = await parseBody(req);
      
      if (!name || !price || !category) { send(res, 400, {error:'Faltan datos obligatorios'}); return; }
      
      const query = `
        UPDATE products 
        SET name = $1, category = $2, emoji = $3, price = $4, unit = $5, origin = $6, badge = $7, badgeType = $8, minOrder = $9 
        WHERE id = $10 RETURNING *;
      `;
      const values = [name, category, emoji||'📦', parseFloat(price), unit||'kg', origin||'', badge||'', badgeType||'', minOrder||'', id];
      
      const result = await pool.query(query, values);
      
      if (result.rowCount === 0) { send(res, 404, {error:'Producto no encontrado'}); return; }
      
      const updatedProduct = result.rows[0]; 
      updatedProduct.price = parseFloat(updatedProduct.price);
      
      send(res, 200, updatedProduct);
    } catch(e) { send(res, 500, {error: e.message}); }
    return;
  }

  const delMatch = url.match(/^\/api\/products\/(\d+)$/);
  if (method==='DELETE' && delMatch) {
    if (!requireAuth(req,res)) return;
    try {
      const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [parseInt(delMatch[1])]);
      if (result.rowCount === 0) { send(res,404,{error:'No encontrado'}); return; }
      send(res,200,{deleted: result.rows[0]});
    } catch(e) { send(res,500,{error:e.message}); }
    return;
  }

  send(res, 404, {error:'Ruta no encontrada en la API'});
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ✅  BielsaSys Backend en marcha');
  console.log('  🐘  Conectado a PostgreSQL');
  console.log(`  🌐  Servidor escuchando en el puerto: ${PORT}`);
  console.log('');
});