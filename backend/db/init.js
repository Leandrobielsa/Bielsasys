const { pool } = require('./pool');

async function initDatabase() {
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
  } catch (error) {
    console.error('❌ Error al inicializar PostgreSQL:', error);
  }
}

module.exports = { initDatabase };
