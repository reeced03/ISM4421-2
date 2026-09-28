// Thin proxy between the browser and https://api.sunoapi.org.
// The user's own API key arrives in the `x-suno-key` header on every request
// and is forwarded as a Bearer token. It is never stored or logged here.

const SUNO_BASE = "https://api.sunoapi.org";

const MODELS = ["V6", "V6_WILD", "V6_MINI", "V5_5", "V5", "V4_5PLUS", "V4_5ALL", "V4_5", "V4"];
const DURATION_MODELS = ["V6", "V6_WILD", "V6_MINI", "V5_5"];

export const config = { path: "/api/*" };

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const fail = (msg, status = 400) => json({ code: status, msg, data: null }, status);

const str = (v, max) => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return max ? t.slice(0, max) : t;
};

const unit = (v) => {
  const n = Number(v);
  if (v === "" || v === null || v === undefined || Number.isNaN(n)) return undefined;
  return Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
};

function callbackUrl(req) {
  // Suno requires a callback URL. We poll for results instead, so the callback
  // endpoint below just acknowledges delivery.
  const base = process.env.URL || new URL(req.url).origin;
  return `${base}/api/callback`;
}

function buildGenerate(body, req) {
  const model = MODELS.includes(body.model) ? body.model : "V6";
  const instrumental = Boolean(body.instrumental);
  const customMode = Boolean(body.customMode);
  const p = { customMode, instrumental, model, callBackUrl: callbackUrl(req) };

  if (!customMode) {
    p.prompt = str(body.prompt, 3000);
    p.style = str(body.style, 1000);
    if (!instrumental) p.lyrics = str(body.lyrics, 5000);
    if (!p.prompt && !p.style && !p.lyrics) {
      throw new Error("Describe the song you want (prompt or style).");
    }
    return p;
  }

  p.title = str(body.title, 80);
  p.style = str(body.style, 1000);
  p.negativeTags = str(body.negativeTags, 1000);
  if (!instrumental) {
    p.lyrics = str(body.lyrics, 5000);
    if (body.vocalGender === "m" || body.vocalGender === "f") p.vocalGender = body.vocalGender;
  }
  p.styleWeight = unit(body.styleWeight);
  p.weirdnessConstraint = unit(body.weirdnessConstraint);
  if (!instrumental) p.audioWeight = unit(body.audioWeight);

  const variety = Number(body.variety);
  if (Number.isInteger(variety) && variety >= 0 && variety <= 4) p.variety = variety;

  const duration = Number(body.duration);
  if (DURATION_MODELS.includes(model) && duration >= 10 && duration <= 360) {
    p.duration = Math.round(duration);
  }

  if (!p.style && !p.lyrics && !p.negativeTags) {
    throw new Error("Custom mode needs at least a style, lyrics, or exclude tags.");
  }
  return p;
}

function buildExtend(body, req) {
  const audioId = str(body.audioId, 200);
  if (!audioId) throw new Error("Missing audioId of the track to extend.");
  const instrumental = Boolean(body.instrumental);
  const p = {
    audioId,
    model: MODELS.includes(body.model) ? body.model : "V6",
    callBackUrl: callbackUrl(req),
    instrumental,
    taskId: str(body.taskId, 200),
    style: str(body.style, 1000),
    title: str(body.title, 100),
  };
  if (!instrumental) p.lyrics = str(body.lyrics, 5000);
  const continueAt = Number(body.continueAt);
  if (continueAt > 0) p.continueAt = continueAt;
  return p;
}

function buildLyrics(body, req) {
  const prompt = str(body.prompt, 200);
  if (!prompt) throw new Error("Describe what the lyrics should be about.");
  return { prompt, callBackUrl: callbackUrl(req) };
}

const ROUTES = {
  "POST generate": { path: "/api/v1/generate", build: buildGenerate },
  "POST extend": { path: "/api/v1/generate/extend", build: buildExtend },
  "POST lyrics": { path: "/api/v1/lyrics", build: buildLyrics },
  "GET status": { path: "/api/v1/generate/record-info", query: true },
  "GET lyrics-status": { path: "/api/v1/lyrics/record-info", query: true },
  "GET credits": { path: "/api/v1/generate/credit" },
};

export default async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.replace(/^\/api\//, "").replace(/\/+$/, "");

  if (action === "callback") return json({ code: 200, msg: "received" });

  const route = ROUTES[`${req.method} ${action}`];
  if (!route) return fail("Not found", 404);

  const key = (req.headers.get("x-suno-key") || "").trim();
  if (!key) return fail("Enter your Suno API key first.", 401);

  let target = SUNO_BASE + route.path;
  const init = { method: req.method, headers: { Authorization: `Bearer ${key}` } };

  if (route.query) {
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return fail("Missing taskId");
    target += `?taskId=${encodeURIComponent(taskId)}`;
  }

  if (route.build) {
    let body;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON body");
    }
    try {
      init.body = JSON.stringify(route.build(body, req));
    } catch (e) {
      return fail(e.message);
    }
    init.headers["content-type"] = "application/json";
  }

  try {
    const res = await fetch(target, init);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return fail(`Upstream returned an unexpected response (HTTP ${res.status}).`, 502);
    }
    return json(data, res.ok ? 200 : res.status);
  } catch {
    return fail("Could not reach the Suno API. Try again shortly.", 502);
  }
};
