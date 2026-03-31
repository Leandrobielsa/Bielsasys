const { parseBody, sendJson, sendNotFound } = require('../utils/http');
const { extractToken, verifyToken } = require('../utils/jwt');
const { serveStaticRequest } = require('../utils/static');
const { approveClient, listClients, listPendingClients, rejectClient } = require('../services/clientService');
const { createOrder, listOrders, listOrdersByClient, updateOrderStatus } = require('../services/orderService');
const { createProduct, deleteProduct, listProducts, updateProduct } = require('../services/productService');
const { getStats } = require('../services/statsService');
const { getClientSession, loginAdmin, loginClient, registerClient } = require('../services/authService');

function getRequestInfo(req) {
  return {
    method: req.method,
    url: req.url.split('?')[0]
  };
}

function getTokenPayload(req) {
  return verifyToken(extractToken(req) || '');
}

function requireAdmin(req, res) {
  const payload = getTokenPayload(req);
  if (!payload || payload.role !== 'admin') {
    sendJson(res, 401, { error: 'No autorizado.' });
    return null;
  }

  return payload;
}

function requireClient(req, res) {
  const payload = getTokenPayload(req);
  if (!payload || payload.role !== 'cliente') {
    sendJson(res, 401, { error: 'No autorizado' });
    return null;
  }

  return payload;
}

async function withHandler(res, action) {
  try {
    await action();
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || 'Error interno.' });
  }
}

async function handleRequest(req, res) {
  const { method, url } = getRequestInfo(req);

  if (method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (method === 'GET' && !url.startsWith('/api/')) {
    if (serveStaticRequest(url, res)) {
      return;
    }
  }

  if (method === 'POST' && url === '/api/login') {
    await withHandler(res, async () => {
      const { username, password } = await parseBody(req);
      const session = await loginAdmin(username, password);
      if (!session) {
        setTimeout(() => sendJson(res, 401, { error: 'Usuario o contraseña incorrectos.' }), 600);
        return;
      }

      sendJson(res, 200, session);
    });
    return;
  }

  if (method === 'GET' && url === '/api/auth/check') {
    const payload = getTokenPayload(req);
    if (payload && payload.role === 'admin') {
      sendJson(res, 200, { valid: true, username: payload.username });
    } else {
      sendJson(res, 401, { valid: false });
    }
    return;
  }

  if (method === 'POST' && url === '/api/cliente/registro') {
    await withHandler(res, async () => {
      const body = await parseBody(req);
      if (!body.nombre || !body.email || !body.password) {
        sendJson(res, 400, { error: 'Faltan datos obligatorios.' });
        return;
      }

      const result = await registerClient(body);
      sendJson(res, 201, result);
    });
    return;
  }

  if (method === 'POST' && url === '/api/cliente/login') {
    await withHandler(res, async () => {
      const { email, password } = await parseBody(req);
      const session = await loginClient(email, password);
      if (!session) {
        setTimeout(() => sendJson(res, 401, { error: 'Credenciales incorrectas.' }), 600);
        return;
      }

      sendJson(res, 200, session);
    });
    return;
  }

  if (method === 'GET' && url === '/api/cliente/check') {
    const payload = requireClient(req, res);
    if (!payload) {
      return;
    }

    await withHandler(res, async () => {
      const client = await getClientSession(payload.id);
      if (!client) {
        sendJson(res, 401, { valid: false });
        return;
      }

      sendJson(res, 200, { valid: true, cliente: client });
    });
    return;
  }

  if (method === 'GET' && url === '/api/stats') {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await getStats());
    });
    return;
  }

  if (method === 'GET' && url === '/api/orders') {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await listOrders());
    });
    return;
  }

  if (method === 'GET' && url === '/api/orders/mine') {
    const payload = requireClient(req, res);
    if (!payload) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await listOrdersByClient(payload.id));
    });
    return;
  }

  if (method === 'POST' && url === '/api/orders') {
    const payload = requireClient(req, res);
    if (!payload) {
      return;
    }

    await withHandler(res, async () => {
      const body = await parseBody(req);
      if (!body.items || !body.items.length) {
        sendJson(res, 400, { error: 'El pedido está vacío' });
        return;
      }

      sendJson(res, 201, await createOrder(payload.id, body));
    });
    return;
  }

  const orderStatusMatch = url.match(/^\/api\/orders\/(\d+)\/status$/);
  if (method === 'PUT' && orderStatusMatch) {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      const { estado } = await parseBody(req);
      sendJson(res, 200, await updateOrderStatus(parseInt(orderStatusMatch[1], 10), estado));
    });
    return;
  }

  if (method === 'GET' && url === '/api/clients') {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await listClients());
    });
    return;
  }

  if (method === 'GET' && url === '/api/notifications') {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, { pendingClients: await listPendingClients() });
    });
    return;
  }

  const approveMatch = url.match(/^\/api\/clients\/(\d+)\/approve$/);
  if (method === 'PUT' && approveMatch) {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await approveClient(parseInt(approveMatch[1], 10)));
    });
    return;
  }

  const rejectMatch = url.match(/^\/api\/clients\/(\d+)\/reject$/);
  if (method === 'PUT' && rejectMatch) {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await rejectClient(parseInt(rejectMatch[1], 10)));
    });
    return;
  }

  if (method === 'GET' && url === '/api/products') {
    await withHandler(res, async () => {
      sendJson(res, 200, await listProducts());
    });
    return;
  }

  if (method === 'POST' && url === '/api/products') {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      const body = await parseBody(req);
      if (!body.name || !body.price || !body.category) {
        sendJson(res, 400, { error: 'Faltan: name, price, category' });
        return;
      }

      sendJson(res, 201, await createProduct(body));
    });
    return;
  }

  const productMatch = url.match(/^\/api\/products\/(\d+)$/);
  if (method === 'PUT' && productMatch) {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      const body = await parseBody(req);
      if (!body.name || !body.price || !body.category) {
        sendJson(res, 400, { error: 'Faltan datos obligatorios' });
        return;
      }

      sendJson(res, 200, await updateProduct(parseInt(productMatch[1], 10), body));
    });
    return;
  }

  if (method === 'DELETE' && productMatch) {
    if (!requireAdmin(req, res)) {
      return;
    }

    await withHandler(res, async () => {
      sendJson(res, 200, await deleteProduct(parseInt(productMatch[1], 10)));
    });
    return;
  }

  sendNotFound(res);
}

module.exports = {
  handleRequest
};
