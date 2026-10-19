/*
 * Wyntech Campo TJMG — build do protótipo.
 *
 * Fontes:  prototipo/src/{styles.css,body.html,app.js}
 * Saída:   prototipo/index.html (arquivo único, autocontido, sem dependências)
 *
 * Uso: npm run build  (ou node prototipo/build.js)
 * Não edite prototipo/index.html diretamente: ele é gerado.
 */
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const src = path.join(dir, 'src');
const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const body = fs.readFileSync(path.join(src, 'body.html'), 'utf8');
const js = fs.readFileSync(path.join(src, 'app.js'), 'utf8');

const favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23b3261e'/%3E%3Cpath d='M14 20l8 24 10-18 10 18 8-24' fill='none' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

const parts = [
  '<!DOCTYPE html>',
  '<html lang="pt-BR">',
  '<head>',
  '  <meta charset="utf-8">',
  '  <meta name="viewport" content="width=device-width, initial-scale=1">',
  '  <meta name="color-scheme" content="light">',
  '  <meta name="theme-color" content="#12201b">',
  '  <meta name="description" content="Wyntech Campo TJMG — protótipo operacional de atendimento, rollout, POP030 e documentos.">',
  '  <title>Wyntech Campo · TJMG</title>',
  `  <link rel="icon" href="${favicon}">`,
  '  <style>',
  css,
  '  </style>',
  '</head>',
  '<body>',
  body,
  '<script>',
  js,
  '</script>',
  '</body>',
  '</html>'
];

const out = path.join(dir, 'index.html');
fs.writeFileSync(out, parts.join('\n'), 'utf8');
console.log(`OK ${out}`);
console.log(`CSS ${Buffer.byteLength(css)} bytes | HTML ${Buffer.byteLength(body)} | JS ${Buffer.byteLength(js)}`);
