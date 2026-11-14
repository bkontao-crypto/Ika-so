// Mini routeur de test : enregistre les routes de buildRoutes() et les appelle sans serveur HTTP ni dépendance.
// Ce n'est pas Express : il ne couvre que get/post/put/patch/delete, les paramètres « :nom » et les réponses json/send/sendStatus/status.
export function Router() {
  const routes = [];
  const add = (method) => (path, ...handlers) => { routes.push({ method, path, handlers }); };
  const router = { routes, use() {}, get: add("GET"), post: add("POST"), put: add("PUT"), patch: add("PATCH"), delete: add("DELETE") };
  router.call = async (method, url, { headers = {}, body = {}, rawBody, query = {}, user } = {}) => {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    for (const r of routes) {
      if (r.method !== method) continue;
      const names = [];
      const re = new RegExp("^" + r.path.replace(/:([A-Za-z]+)/g, (_, n) => { names.push(n); return "([^/]+)"; }) + "$");
      const m = re.exec(url);
      if (!m) continue;
      const req = { params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])), headers: lower, body, rawBody, query, user, ip: "127.0.0.1" };
      const out = { status: 200, headers: {}, body: undefined, sent: false, error: null };
      const res = {
        setHeader(k, v) { out.headers[k.toLowerCase()] = v; return res; },
        status(code) { out.status = code; return res; },
        json(b) { out.body = b; out.sent = true; return res; },
        send(b) { out.body = b; out.sent = true; return res; },
        sendStatus(code) { out.status = code; out.sent = true; return res; },
        cookie() { return res; }, clearCookie() { return res; },
      };
      try { for (const h of r.handlers) await h(req, res, () => {}); } catch (e) { out.error = e; }
      return out;
    }
    return { status: 404, error: null, body: undefined, headers: {} };
  };
  return router;
}
export default function express() { throw new Error("express de substitution : application non disponible"); }
