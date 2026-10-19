/*
 * Preview local do protótipo.
 *
 * Uso: npm run preview
 *      PORT=4173 npm run preview
 *      HOST=0.0.0.0 npm run preview   (para abrir no celular na mesma rede)
 *
 * O protótipo é um único arquivo estático; este servidor existe apenas para
 * facilitar o desenvolvimento e evitar restrições de file:// no navegador.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8766);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch (err) {
    send(res, 400, 'bad request');
    return;
  }

  if (pathname === '/' || pathname === '/prototipo' || pathname === '/prototipo/') {
    pathname = '/prototipo/index.html';
  }

  const relative = pathname.replace(/^\/+/, '');
  const blocked = relative.split(/[\\/]/).some((segment) => (
    segment === '.git' || segment === 'node_modules' || segment === '.env'
  ));

  if (blocked) {
    send(res, 404, 'not found');
    return;
  }

  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(root + path.sep)) {
    send(res, 403, 'forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      send(res, 404, 'not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Porta ${port} em uso. Rode com outra porta, por exemplo:`);
    console.error(`  PowerShell:  $env:PORT=4173; npm run preview`);
    console.error(`  bash:        PORT=4173 npm run preview`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, host, () => {
  const shownHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`Wyntech Campo TJMG — preview em http://${shownHost}:${port}/`);
  console.log(`Raiz do projeto: ${root}`);
  if (host === '0.0.0.0') {
    console.log('Aberto na rede local; use o IP da máquina para testar no celular.');
  }
});
