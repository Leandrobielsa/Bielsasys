const crypto = require('crypto');

function hashPassword(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = { hashPassword };
