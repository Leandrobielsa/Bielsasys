function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });

  res.end(JSON.stringify(data));
}

function sendText(res, status, contentType, data) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(data);
}

function sendNotFound(res, message = 'Ruta no encontrada en la API') {
  sendJson(res, 404, { error: message });
}

module.exports = {
  parseBody,
  sendJson,
  sendText,
  sendNotFound
};
