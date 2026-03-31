const http = require('http');
const { config } = require('./backend/config/app');
const { initDatabase } = require('./backend/db/init');
const { handleRequest } = require('./backend/routes');

initDatabase();

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

server.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('  ✅  BielsaSys Backend en marcha');
  console.log('  🐘  Conectado a PostgreSQL');
  console.log(`  🌐  Servidor escuchando en el puerto: ${config.port}`);
  console.log('');
});
