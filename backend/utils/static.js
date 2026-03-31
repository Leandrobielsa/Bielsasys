const fs = require('fs');
const path = require('path');
const { config } = require('../config/app');
const { sendText } = require('./http');

const pageMap = {
  '/': 'index.html',
  '/login': 'login.html',
  '/admin': 'admin.html',
  '/portal': 'portal.html',
  '/registro': 'registro.html'
};

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function getContentType(filePath) {
  return contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolvePublicFile(urlPath) {
  if (pageMap[urlPath]) {
    return path.join(config.publicDir, pageMap[urlPath]);
  }

  const filePath = path.normalize(path.join(config.publicDir, urlPath));
  return filePath.startsWith(config.publicDir) ? filePath : null;
}

function serveStaticRequest(urlPath, res) {
  const filePath = resolvePublicFile(urlPath);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  const data = fs.readFileSync(filePath);
  sendText(res, 200, getContentType(filePath), data);
  return true;
}

module.exports = {
  serveStaticRequest
};
