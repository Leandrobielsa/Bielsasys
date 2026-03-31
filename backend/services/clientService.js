const { pool } = require('../db/pool');

async function listClients() {
  const result = await pool.query(
    'SELECT id, nombre, empresa, cif, email, telefono, estado, "createdAt" FROM clients ORDER BY id DESC'
  );

  return result.rows;
}

async function listPendingClients() {
  const result = await pool.query("SELECT * FROM clients WHERE estado = 'pendiente' ORDER BY id DESC");
  return result.rows;
}

async function approveClient(clientId) {
  await pool.query("UPDATE clients SET estado = 'activo' WHERE id = $1", [clientId]);
  return { success: true };
}

async function rejectClient(clientId) {
  await pool.query("UPDATE clients SET estado = 'rechazado' WHERE id = $1", [clientId]);
  return { success: true };
}

module.exports = {
  approveClient,
  listClients,
  listPendingClients,
  rejectClient
};
