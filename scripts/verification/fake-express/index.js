// SUBSTITUT DE VÉRIFICATION d'Express (non livré en production, jamais installé par `npm install`).
// Il n'existe que parce que le registre npm était inaccessible dans l'environnement de test.
// Il imite seulement ce que server/ utilise. Un test vert ici ne remplace PAS un test avec le vrai Express.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".json": "application/json" };

function compile(path) {
  const keys = [];
  const re = new RegExp("^" + path.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
  return { re, keys };
}

class Layer { constructor(method, path, fns, prefix) { this.method = method; this.prefix = prefix; this.fns = fns; if (!prefix && path != null) Object.assign(this, compile(path)); this.path = path; } }

function makeStack() {
  const layers = [];
  const api = {
    layers,
    use(a, ...rest) {
      if (typeof a === "string") layers.push(new Layer(null, a, rest, true));
      else layers.push(new Layer(null, "", [a, ...rest], true));
      return api;
    },
  };
  for (const m of ["get", "post", "put", "delete"]) api[m] = (path, ...fns) => (layers.push(new Layer(m.toUpperCase(), path, fns, false)), api);
  return api;
}

export function Router() {
  const r = makeStack();
  const fn = (req, res, next) => run(r.layers, req, res, next);
  Object.assign(fn, r);
  fn.isRouter = true;
  return fn;
}

async function call(fn, req, res, err) {
  return new Promise((resolve) => {
    const next = (e) => resolve({ next: true, error: e });
    try {
      let out;
      if (err !== undefined) { if (fn.length === 4) out = fn(err, req, res, next); else return resolve({ next: true, error: err }); }
      else if (fn.length === 4) return resolve({ next: true });
      else out = fn(req, res, next);
      if (out && typeof out.then === "function") out.then(() => { if (fn.length < 3 && !fn.isRouter) resolve({ done: true }); }, (e) => resolve({ next: true, error: e }));
      if (fn.length < 3 && !fn.isRouter && !(out && typeof out.then === "function")) resolve({ done: true });
      if (!res.__fin) { res.__fin = true; res.once("finish", () => res.__resolvers?.forEach((f) => f({ done: true }))); res.__resolvers = []; }
      res.__resolvers.push(resolve);
    } catch (e) { resolve({ next: true, error: e }); }
  });
}

async function run(layers, req, res, done) {
  let error;
  for (const layer of layers) {
    const savedUrl = req.url;
    let match = false;
    const path = req.url.split("?")[0];
    if (layer.prefix) {
      if (layer.path === "" || path === layer.path || path.startsWith(layer.path + "/")) { match = true; if (layer.path) req.url = req.url.slice(layer.path.length) || "/"; }
    } else if (layer.method === req.method) {
      const m = layer.re.exec(path);
      if (m) { match = true; req.params = Object.fromEntries(layer.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])); }
    }
    if (!match) continue;
    let finished = false;
    for (const fn of layer.fns) {
      const r = await call(fn, req, res, error);
      req.url = layer.prefix ? savedUrl : req.url;
      if (r.done) { finished = true; break; }
      error = r.error;
    }
    req.url = savedUrl;
    if (finished) return;
  }
  done?.(error);
}

export default function express() {
  const settings = {};
  const s = makeStack();
  const app = (req, res) => {
    req.originalUrl = req.url;
    req.ip = settings["trust proxy"] ? (req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() || req.socket.remoteAddress : req.socket.remoteAddress;
    req.query = Object.fromEntries(new URL(req.url, "http://x").searchParams);
    req.get = (n) => req.headers[n.toLowerCase()];
    req.is = (t) => (String(req.headers["content-type"] ?? "").split(";")[0].trim() === t ? t : false);
    res.status = (c) => ((res.statusCode = c), res);
    res.redirect = (a, b) => { const [code, url] = b === undefined ? [302, a] : [a, b]; res.statusCode = code; res.setHeader("Location", url); res.end(); return res; };
    res.json = (o) => { if (!res.getHeader("content-type")) res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
    run(s.layers, req, res, (error) => {
      if (res.writableEnded) return;
      if (error) { res.statusCode = 500; res.end("error"); } else { res.statusCode = 404; res.end("Cannot " + req.method + " " + req.url); }
    });
  };
  Object.assign(app, s);
  app.disable = (k) => (settings[k] = false);
  app.set = (k, v) => (settings[k] = v);
  app.listen = (...args) => createServer(app).listen(...args);
  return app;
}

express.Router = Router;
express.json = ({ limit = "100kb", verify } = {}) => {
  const max = /mb$/i.test(limit) ? parseFloat(limit) * 1048576 : parseFloat(limit) * 1024;
  return (req, res, next) => {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
    // Comme le vrai analyseur : un contenu qui n'est pas du JSON n'est pas lu (et un corps déjà lu par un middleware précédent n'est pas relu).
    if (req.rawBody !== undefined || !/json/.test(req.headers["content-type"] ?? "")) { if (req.body === undefined) req.body = undefined; return next(); }
    const chunks = []; let size = 0; let failed = false;
    req.on("data", (c) => { size += c.length; if (size > max) { failed = true; req.removeAllListeners("data"); req.resume(); next(Object.assign(new Error("trop gros"), { type: "entity.too.large" })); } else chunks.push(c); });
    req.on("end", () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString(); if (verify && raw) verify(req, res, Buffer.from(raw));
      if (!raw || !/json/.test(req.headers["content-type"] ?? "")) { req.body = undefined; return next(); }
      try { req.body = JSON.parse(raw); next(); } catch { next(Object.assign(new Error("json"), { type: "entity.parse.failed" })); }
    });
  };
};
express.static = (dir, { extensions = [] } = {}) => (req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  let rel = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = join(dir, rel);
  if (!file.startsWith(dir)) return next();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  for (const ext of ["", ...extensions.map((e) => "." + e)]) {
    if (existsSync(file + ext) && statSync(file + ext).isFile()) {
      res.setHeader("Content-Type", TYPES[extname(file + ext)] ?? "application/octet-stream");
      return res.end(readFileSync(file + ext));
    }
  }
  next();
};
export { express };
