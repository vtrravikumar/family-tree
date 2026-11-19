export interface Env {
  APP_ENV: string;
}

const json = (data: unknown, init: ResponseInit = {}) =>
  Response.json(data, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "family-tree-api", environment: env.APP_ENV });
    }
    return json({ error: { code: "not_found", message: "Route not found." } }, { status: 404 });
  },
};
