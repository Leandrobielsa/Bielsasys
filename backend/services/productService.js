const { pool } = require('../db/pool');

function normalizeProduct(product) {
  return {
    ...product,
    price: parseFloat(product.price)
  };
}

async function listProducts() {
  const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
  return result.rows.map(normalizeProduct);
}

async function createProduct(data) {
  const result = await pool.query(
    `INSERT INTO products (name, category, emoji, price, unit, origin, badge, badgeType, minOrder, stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.category,
      data.emoji || '📦',
      parseFloat(data.price),
      data.unit || 'kg',
      data.origin || '',
      data.badge || '',
      data.badgeType || '',
      data.minOrder || '10 kg',
      true
    ]
  );

  return normalizeProduct(result.rows[0]);
}

async function updateProduct(productId, data) {
  const result = await pool.query(
    `UPDATE products
     SET name = $1, category = $2, emoji = $3, price = $4, unit = $5, origin = $6, badge = $7, badgeType = $8, minOrder = $9
     WHERE id = $10
     RETURNING *`,
    [
      data.name,
      data.category,
      data.emoji || '📦',
      parseFloat(data.price),
      data.unit || 'kg',
      data.origin || '',
      data.badge || '',
      data.badgeType || '',
      data.minOrder || '',
      productId
    ]
  );

  if (result.rowCount === 0) {
    const error = new Error('Producto no encontrado');
    error.status = 404;
    throw error;
  }

  return normalizeProduct(result.rows[0]);
}

async function deleteProduct(productId) {
  const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [productId]);
  if (result.rowCount === 0) {
    const error = new Error('No encontrado');
    error.status = 404;
    throw error;
  }

  return { deleted: result.rows[0] };
}

module.exports = {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct
};
