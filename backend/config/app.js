const path = require('path');

const config = {
  port: process.env.PORT || 3000,
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'bielsasys2025',
  jwtSecret: process.env.JWT_SECRET || 'bielsasys_jwt_super_secret_key_2025_asir',
  jwtExpiresIn: 8 * 60 * 60,
  publicDir: path.join(__dirname, '..', '..', 'public')
};

module.exports = { config };
