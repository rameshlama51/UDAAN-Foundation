// Local server for the AI Foundation Course interface.
// No dependencies, no network access needed. Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const COURSE_FILE = path.join(ROOT, 'AI-Foundation-Course.md');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // The course is read from disk on every request, so editing the markdown
  // file and reloading the page is enough to update the interface.
  if (url.pathname === '/course.md') {
    fs.readFile(COURSE_FILE, 'utf8', (err, data) => {
      if (err) return send(res, 500, TYPES['.md'], 'Could not read AI-Foundation-Course.md');
      send(res, 200, TYPES['.md'], data);
    });
    return;
  }

  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'text/plain', 'Forbidden');

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'text/plain', 'Not found');
    send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI Foundation Course running at http://localhost:${PORT}`);
});
