/**
 * Minimal static file server for the QA summary report.
 * Spawned as a detached background process by send-report.js.
 * If the port is already in use (server already running), this process
 * exits silently and the existing server keeps serving fresh files.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = parseInt(process.env.QA_REPORT_PORT || '9323', 10);
const DIR  = process.env.QA_REPORT_DIR || __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Strip query string and hash; default to summary-report.html
  const urlPath  = req.url.split('?')[0].split('#')[0];
  const fileName = urlPath === '/' ? 'summary-report.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(DIR, fileName);

  // Prevent path traversal attacks
  if (!filePath.startsWith(path.resolve(DIR))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // A server from a previous run is still running — that's fine, it serves fresh files.
    process.exit(0);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  // Running detached — stdout is ignored, so no console output needed.
});
