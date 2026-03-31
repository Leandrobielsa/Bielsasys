const { config } = require('../config/app');
const { pool } = require('../db/pool');
const { hashPassword } = require('../utils/security');
const { signToken } = require('../utils/jwt');

async function loginAdmin(username, password) {
  if (username !== config.adminUser || password !== config.adminPass) {
    return null;
  }

  return {
    token: signToken({ username, role: 'admin' }),
    expiresIn: config.jwtExpiresIn
  };
}

async function registerClient({ nombre, email, password, empresa, cif, telefono }) {
  const existing = await pool.query('SELECT id FROM clients WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    const error = new Error('El email ya está registrado.');
    error.status = 400;
    throw error;
  }

  const passwordHash = hashPassword(password);
  const result = await pool.query(
    `INSERT INTO clients (nombre, empresa, cif, email, telefono, "passwordHash", estado)
     VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
     RETURNING id, nombre, email, empresa`,
    [nombre, empresa || '', cif || '', email, telefono || '', passwordHash]
  );

  const client = result.rows[0];
  return {
    token: signToken({ id: client.id, email: client.email, role: 'cliente' }),
    cliente: client
  };
}

async function loginClient(email, password) {
  const passwordHash = hashPassword(password);
  const result = await pool.query(
    'SELECT * FROM clients WHERE email = $1 AND "passwordHash" = $2',
    [email, passwordHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const client = result.rows[0];
  if (client.estado === 'rechazado') {
    const error = new Error('Cuenta rechazada por un administrador.');
    error.status = 403;
    throw error;
  }

  delete client.passwordHash;
  return {
    token: signToken({ id: client.id, email: client.email, role: 'cliente' }),
    cliente: client
  };
}

async function getClientSession(clientId) {
  const result = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
  if (result.rows.length === 0) {
    return null;
  }

  const client = result.rows[0];
  delete client.passwordHash;
  return client;
}

module.exports = {
  getClientSession,
  loginAdmin,
  loginClient,
  registerClient
};
