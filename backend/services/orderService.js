const { pool } = require('../db/pool');

function normalizeOrder(order) {
  return {
    ...order,
    total: parseFloat(order.total)
  };
}

async function listOrders() {
  const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
  return result.rows.map(normalizeOrder);
}

async function listOrdersByClient(clientId) {
  const result = await pool.query('SELECT * FROM orders WHERE "clientId" = $1 ORDER BY id DESC', [clientId]);
  return result.rows.map(normalizeOrder);
}

async function createOrder(clientId, { items, nota }) {
  const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
  const client = clientResult.rows[0];

  if (!client) {
    const error = new Error('Cliente no encontrado.');
    error.status = 404;
    throw error;
  }

  if (client.estado !== 'activo') {
    const error = new Error('Cuenta pendiente de aprobación.');
    error.status = 403;
    throw error;
  }

  const total = items.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  const result = await pool.query(
    `INSERT INTO orders ("clientId", "clienteNombre", "clienteEmpresa", "clienteEmail", items, total, nota, estado)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
     RETURNING *`,
    [client.id, client.nombre, client.empresa, client.email, JSON.stringify(items), total, nota || '']
  );

  return normalizeOrder(result.rows[0]);
}

async function updateOrderStatus(orderId, estado) {
  await pool.query(
    'UPDATE orders SET estado = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
    [estado, orderId]
  );

  return { success: true };
}

module.exports = {
  createOrder,
  listOrders,
  listOrdersByClient,
  updateOrderStatus
};
