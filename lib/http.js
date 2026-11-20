'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { HttpError } = require('./errors');

class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler, options = {}) {
    const segments = pattern.split('/').filter(Boolean);
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      segments,
      handler,
      public: Boolean(options.public)
    });
    return this;
  }

  match(method, pathname) {
    const parts = pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
    for (const route of this.routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== parts.length) continue;
      const params = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i];
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = parts[i];
        } else if (segment !== parts[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { route, params };
    }
    return null;
  }
}

function createRouter() {
  return new Router();
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

function sendError(res, status, message, details = null) {
  sendJson(res, status, {
    error: message,
    ...(details ? { details } : {})
  });
}

function parseCookies(header = '') {
  const cookies = {};
  for (const piece of String(header).split(';')) {
    const index = piece.indexOf('=');
    if (index === -1) continue;
    const key = piece.slice(0, index).trim();
    if (!key) continue;
    const value = piece.slice(index + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      const contentType = String(req.headers['content-type'] || '');
      if (!contentType.includes('application/json')) {
        return reject(new HttpError(415, 'Content-Type must be application/json.'));
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return reject(new HttpError(400, 'JSON body must be an object.'));
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, 'Request body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

async function serveStatic(req, res, publicDir, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  let relative = pathname === '/' ? '/index.html' : pathname;
  relative = decodeURIComponent(relative.split('?')[0]);
  const resolved = path.resolve(publicDir, `.${relative}`);
  const root = path.resolve(publicDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    sendError(res, 403, 'Forbidden.');
    return true;
  }
  let stat;
  try {
    stat = await fs.promises.stat(resolved);
  } catch {
    if (!path.extname(relative)) {
      const fallback = path.join(publicDir, 'index.html');
      const content = await fs.promises.readFile(fallback);
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME_TYPES['.html']);
      res.setHeader('Content-Length', content.length);
      res.end(req.method === 'HEAD' ? undefined : content);
      return true;
    }
    sendError(res, 404, 'File not found.');
    return true;
  }
  if (stat.isDirectory()) {
    sendError(res, 404, 'File not found.');
    return true;
  }
  const extension = path.extname(resolved).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(resolved);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  });
  return true;
}

module.exports = {
  Router,
  createRouter,
  sendJson,
  sendError,
  parseCookies,
  serializeCookie,
  readBody,
  serveStatic
};
