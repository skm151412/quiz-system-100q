// Minimal Express server to serve static files for Render
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic security headers (keep it lightweight, avoid extra deps)
app.disable('x-powered-by');

// Cache-control: long cache for static assets, no-cache for HTML
app.use((req, res, next) => {
  if (/\.(?:css|js|png|jpe?g|gif|svg|ico|webp|woff2?)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
  } else if (/\.(?:html)$/i.test(req.path) || req.path === '/' ) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// Service worker must be served from the site root
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});

// Static files from repo root
app.use(express.static(path.join(__dirname)));

// Health check endpoint for Render
app.get('/health', (_req, res) => {
  res.type('text').send('ok');
});

// Fallback: if route not found, serve index.html (useful for deep links)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
