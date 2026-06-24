const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  }
});

const isAdmin = (request, env) => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN);
};

const cleanText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);

const getStats = async (db, appId) => {
  const rows = await db.prepare(`
    SELECT event_type, COUNT(*) AS count
    FROM app_events
    WHERE app_id = ?
    GROUP BY event_type
  `).bind(appId).all();

  const comments = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM comments
    WHERE app_id = ? AND status = 'visible'
  `).bind(appId).first();

  const base = { impressions: 0, likes: 0, shares: 0, comments: comments?.count || 0 };
  for (const row of rows.results || []) {
    if (row.event_type === "impression") base.impressions = row.count;
    if (row.event_type === "like") base.likes = row.count;
    if (row.event_type === "share") base.shares = row.count;
  }
  return base;
};

const recordEvent = async (db, appId, eventType, request) => {
  const visitorKey = request.headers.get("cf-connecting-ip") || "";
  await db.prepare("INSERT INTO app_events (app_id, event_type, visitor_key) VALUES (?, ?, ?)")
    .bind(appId, eventType, visitorKey)
    .run();
  return getStats(db, appId);
};

const readBody = async (request) => {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
};

const upsertApp = async (db, payload) => {
  const id = cleanText(payload.id, 80);
  if (!id) return null;

  const app = {
    id,
    title: cleanText(payload.title, 120),
    category: cleanText(payload.category, 40) || "app",
    status: cleanText(payload.status, 40) || "public",
    badge: cleanText(payload.badge, 80),
    stack: cleanText(payload.stack, 120),
    image: cleanText(payload.image, 400),
    url: cleanText(payload.url, 400),
    summary: cleanText(payload.summary, 600),
    detail: cleanText(payload.detail, 1600),
    sortOrder: Number(payload.sortOrder || 0)
  };

  await db.prepare(`
    INSERT INTO apps (id, title, category, status, badge, stack, image, url, summary, detail, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      status = excluded.status,
      badge = excluded.badge,
      stack = excluded.stack,
      image = excluded.image,
      url = excluded.url,
      summary = excluded.summary,
      detail = excluded.detail,
      sort_order = excluded.sort_order,
      updated_at = CURRENT_TIMESTAMP
  `).bind(app.id, app.title, app.category, app.status, app.badge, app.stack, app.image, app.url, app.summary, app.detail, app.sortOrder).run();

  return app;
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json({});

    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (!env.DB) return json({ error: "D1 binding DB is not configured" }, 500);

    if (request.method === "GET" && url.pathname === "/apps") {
      const rows = await env.DB.prepare("SELECT * FROM apps ORDER BY sort_order ASC, created_at DESC").all();
      return json(rows.results || []);
    }

    if (request.method === "GET" && url.pathname === "/rankings") {
      const rows = await env.DB.prepare(`
        SELECT
          app_id,
          SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) AS impressions,
          SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) AS likes,
          SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) AS shares,
          COUNT(*) AS score
        FROM app_events
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY app_id
        ORDER BY score DESC
        LIMIT 20
      `).all();
      return json(rows.results || []);
    }

    if (parts[0] === "apps" && parts[1]) {
      const appId = decodeURIComponent(parts[1]);
      const action = parts[2];

      if (request.method === "GET" && !action) {
        const app = await env.DB.prepare("SELECT * FROM apps WHERE id = ?").bind(appId).first();
        return app ? json(app) : json({ error: "not found" }, 404);
      }

      if (request.method === "GET" && action === "stats") {
        return json(await getStats(env.DB, appId));
      }

      if (request.method === "POST" && action === "impressions") {
        return json(await recordEvent(env.DB, appId, "impression", request));
      }

      if (request.method === "POST" && action === "likes") {
        return json(await recordEvent(env.DB, appId, "like", request));
      }

      if (request.method === "POST" && action === "shares") {
        return json(await recordEvent(env.DB, appId, "share", request));
      }

      if (request.method === "GET" && action === "comments") {
        const rows = await env.DB.prepare(`
          SELECT id, author_name, body, created_at
          FROM comments
          WHERE app_id = ? AND status = 'visible'
          ORDER BY created_at DESC
          LIMIT 50
        `).bind(appId).all();
        return json(rows.results || []);
      }

      if (request.method === "POST" && action === "comments") {
        const payload = await readBody(request);
        const body = cleanText(payload.body, 800);
        if (!body) return json({ error: "comment body is required" }, 400);
        await env.DB.prepare("INSERT INTO comments (app_id, author_name, body) VALUES (?, ?, ?)")
          .bind(appId, cleanText(payload.authorName, 40), body)
          .run();
        return json(await getStats(env.DB, appId), 201);
      }
    }

    if (parts[0] === "admin" && parts[1] === "apps") {
      if (!isAdmin(request, env)) return json({ error: "unauthorized" }, 401);

      if (request.method === "POST" || request.method === "PUT") {
        const app = await upsertApp(env.DB, await readBody(request));
        return app ? json(app) : json({ error: "app id is required" }, 400);
      }

      if (request.method === "DELETE" && parts[2]) {
        await env.DB.prepare("DELETE FROM apps WHERE id = ?").bind(decodeURIComponent(parts[2])).run();
        return json({ ok: true });
      }
    }

    return json({ error: "not found" }, 404);
  }
};
