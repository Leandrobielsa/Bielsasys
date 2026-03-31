const { pool } = require('../db/pool');

async function getStats() {
  const [ordersRes, clientsRes, productsRes] = await Promise.all([
    pool.query('SELECT * FROM orders'),
    pool.query('SELECT COUNT(*) FROM clients'),
    pool.query('SELECT COUNT(*) FROM products')
  ]);

  const orders = ordersRes.rows;
  let totalRevenue = 0;
  let pendingOrders = 0;
  const byStatus = {};
  const productCounts = {};

  orders.forEach((order) => {
    totalRevenue += parseFloat(order.total);
    if (order.estado === 'pendiente') {
      pendingOrders += 1;
    }

    byStatus[order.estado] = (byStatus[order.estado] || 0) + 1;

    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
    if (!items) {
      return;
    }

    items.forEach((item) => {
      productCounts[item.nombre] = (productCounts[item.nombre] || 0) + item.cantidad;
    });
  });

  const topProducts = Object.entries(productCounts)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5);

  return {
    totalOrders: orders.length,
    monthOrders: orders.length,
    pendingOrders,
    monthRevenue: totalRevenue,
    totalRevenue,
    totalClients: parseInt(clientsRes.rows[0].count, 10),
    totalProducts: parseInt(productsRes.rows[0].count, 10),
    last7: [{ dia: 'Hoy', pedidos: orders.length }],
    byStatus,
    topProducts
  };
}

module.exports = { getStats };
