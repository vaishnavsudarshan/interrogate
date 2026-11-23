// Interrogate: the question reader (Cloudflare Worker).
// Paste this whole file into the Cloudflare Worker editor. Bindings and secrets:
//   - AI                 Workers AI binding (required)
//   - DB                 D1 database binding (strongly recommended: the shared answer cache)
//   - ANTHROPIC_API_KEY  secret (optional). When set, Claude Opus 5.5 answers new questions.
//                        If Claude can't be reached, the free model answers from the fact card.
// The dashboard editor can't install npm packages, so Claude is called over plain HTTPS.
//
// How a question is handled:
//   1. Exact cache: the same question (ignoring case and punctuation) about the same secret.
//   2. Reworded cache: a free embedding model finds the closest saved questions about this
//      secret, and a free model decides whether the new one asks exactly the same thing.
//   3. Otherwise Claude Haiku (or the free model) answers using the secret's fact card, and the
//      answer is saved for everyone.
//
// The game sends: { question, noun, secret, card, facts: [{ k, t, hint }] }
// It gets back one of:
//   { kind: "fact", key, negated }       a fact from the game's fact sheet
//   { kind: "border", place, negated }
//   { kind: "guess", place }
//   { kind: "open", answer: "yes"|"no" }
//   { kind: "unknown" }                  can't confirm it (no turn used)
//   { kind: "clarify", message }         asks the player what they mean (no turn used)
//   { kind: "invalid", message }         not a yes/no question
//   { kind: "busy" }                     rate limited or out of AI allowance for now
// GET /status returns today's counts for the owner stats page.

// Claude Opus 5.5: the most capable standard model. "medium" effort lets it reason briefly
// (comparisons, directions) before answering.
const CLAUDE_MODEL = "claude-opus-5-5";
const CLAUDE_EFFORT = "medium";
const FREE_SMALL = "@cf/meta/llama-3.1-8b-instruct-fast";
const FREE_BIG = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const EMBED = "@cf/baai/bge-small-en-v1.5";

const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?interrogate\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
const PER_MINUTE = 20;
const KINDS = ["fact", "border", "guess", "open", "unknown", "clarify", "invalid"];
const SIMILAR = 0.8;           // how close a saved question must be before the judge looks at it
// Words that flip or change a question's meaning. Two questions only count as the same if
// they use the same ones ("north of Chad" is never treated like "south of Chad").
const DIRECTION = /\b(north|south|east|west|northern|southern|eastern|western|more|less|fewer|over|under|above|below|before|after|bigger|smaller|larger|higher|lower|older|newer|first|last|entirely|partly|partially|only|all|any|most|least|than)\b/g;

const memo = new Map();
const hits = new Map();
let tablesReady = false;
let lastClaudeError = "";

const normQ = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const dirWords = s => [...new Set(normQ(s).match(DIRECTION) || [])].sort().join(" ");

async function ensureTables(env) {
  if (tablesReady) return;
  await env.DB.exec("CREATE TABLE IF NOT EXISTS qa (s TEXT, q TEXT, v TEXT, e TEXT, t INTEGER, PRIMARY KEY (s, q))");
  await env.DB.exec("CREATE TABLE IF NOT EXISTS health (day TEXT, k TEXT, n INTEGER, PRIMARY KEY (day, k))");
  tablesReady = true;
}
async function count(env, k) {
  if (!env.DB) return;
  try { await ensureTables(env); await env.DB.prepare("INSERT INTO health (day, k, n) VALUES (?, ?, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1").bind(new Date().toISOString().slice(0, 10), k).run(); } catch (e) {}
}

function buildPrompt(noun, secret, card, factList, strict) {
  const rule4 = strict
    ? `4. Any other clear yes/no question: answer it ONLY if the fact card below states the answer or it follows directly from the card: {"kind":"open","answer":"yes"} or {"kind":"open","answer":"no"}. If the card doesn't settle it, reply {"kind":"unknown"}. Never guess.`
    : `4. Any other clear yes/no question: if the fact card settles it, answer from the card. Otherwise answer from your own knowledge only if you are certain: {"kind":"open","answer":"yes"} or {"kind":"open","answer":"no"}. If you are not certain, reply {"kind":"unknown"}. A wrong answer is much worse than "unknown".`;
  return `You read questions in "Interrogate", a yes/no guessing game. The secret ${noun} is ${secret}.
Reply with exactly one JSON object and nothing else.
1. Same meaning as a known fact below (any wording): {"kind":"fact","key":"<key>","negated":false}. Use "negated":true if it asks the opposite (e.g. "Does it have a coast?" = ll negated; "Is it outside Europe?" = c_eu negated).
2. Asks if it borders/neighbours/touches a named place: {"kind":"border","place":"<place>","negated":false}.
3. Names one specific ${noun} as a guess ("Is it Peru?"): {"kind":"guess","place":"<name>"}.
${rule4}
5. If the question can reasonably be read in more than one way AND the answer would differ between those readings, ask which they mean instead of picking one: {"kind":"clarify","message":"<one short question back>"}. Examples: "Is it north of Chad?" -> "Do you mean entirely north of Chad, or just partly?"; "Is it big?" -> "Big by area or by population?"; "Is it near the sea?" -> "Do you mean does it have a coastline, or is it close to one?". Don't ask when every reading gives the same answer.
6. Not answerable with yes or no: {"kind":"invalid","message":"<one short sentence asking for a yes or no question>"}.
Treat unusual terms sensibly, e.g. "Afroeurasia" means Africa, Europe and Asia together.
Never reveal or hint at the secret's name in a message.

Fact card for ${secret}:
${card || "(none)"}

Known facts (keys):
${factList}`;
}

const SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: KINDS },
    key: { type: "string" },
    place: { type: "string" },
    answer: { type: "string", enum: ["yes", "no"] },
    message: { type: "string" },
    negated: { type: "boolean" },
  },
  required: ["kind"],
  additionalProperties: false,
};

async function askClaude(env, system, question) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2026-10-21",
      // If a safety check ever declines a question, the API retries it on a fallback model.
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      fallbacks: "default",
      output_config: { effort: CLAUDE_EFFORT, format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error(`Claude returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const msg = await res.json();
  if (msg.stop_reason === "refusal") return { kind: "unknown" };
  if (msg.stop_reason !== "end_turn") throw new Error("Claude stopped: " + msg.stop_reason);
  return JSON.parse((msg.content || []).filter(b => b.type === "text").map(b => b.text).join(""));
}

async function askFree(env, model, system, question, maxTokens = 80) {
  const out = await env.AI.run(model, { messages: [{ role: "system", content: system }, { role: "user", content: question }], max_tokens: maxTokens, temperature: 0 });
  const text = typeof out.response === "string" ? out.response : JSON.stringify(out.response || {});
  const m = text.match(/\{[\s\S]*?\}/);
  return m ? JSON.parse(m[0]) : null;
}

async function embed(env, text) {
  const out = await env.AI.run(EMBED, { text: [text] });
  return out && out.data && out.data[0];
}
const cosine = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y || 1); };

// Is the new question the same as a saved one? Returns { result } or null.
async function reworded(env, secret, question, vec) {
  if (!vec) return null;
  const rows = (await env.DB.prepare("SELECT q, v, e FROM qa WHERE s = ? AND e IS NOT NULL ORDER BY t DESC LIMIT 400").bind(secret).all()).results || [];
  const dir = dirWords(question);
  const near = rows.map(r => ({ q: r.q, v: JSON.parse(r.v), sim: cosine(vec, JSON.parse(r.e)) }))
    .filter(r => r.sim >= SIMILAR && dirWords(r.q) === dir && ["fact", "border", "open"].includes(r.v.kind))
    .sort((a, b) => b.sim - a.sim).slice(0, 5);
  if (!near.length) return null;
  const list = near.map((r, i) => `${i + 1}. "${r.q}"`).join("\n");
  const judge = await askFree(env, FREE_BIG, `You compare questions about the same secret place in a yes/no game.
Decide if the NEW question asks exactly the same thing as one of the SAVED questions, so the same yes/no answer applies.
Reply with one JSON object only: {"match": <number of the saved question, or 0>, "opposite": <true if the new question asks the exact opposite of that saved question, else false>}.
Only match if you are completely sure the meaning is the same (or exactly opposite). If there is any difference in detail, place, amount, direction or scope, reply {"match": 0, "opposite": false}.

SAVED:
${list}`, `NEW: "${question}"`, 40);
  const n = judge && Number(judge.match);
  if (!n || n < 1 || n > near.length) return null;
  const v = { ...near[n - 1].v };
  if (judge.opposite === true) {
    if (v.kind === "open") v.answer = v.answer === "yes" ? "no" : "yes";
    else if (v.kind === "fact" || v.kind === "border") v.negated = !v.negated;
    else return null;
  }
  return v;
}

const valid = (p, facts) => p && KINDS.includes(p.kind) && (p.kind !== "fact" || facts.some(f => f.k === p.key)) && (p.kind !== "open" || p.answer === "yes" || p.answer === "no");

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const ok = ALLOWED.some(re => re.test(origin));
    const cors = {
      "Access-Control-Allow-Origin": ok ? origin : "https://interrogate.pages.dev",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (obj, status = 200) => Response.json(obj, { status, headers: cors });
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (request.method === "GET" && new URL(request.url).pathname === "/status" && ok) {
      const day = new Date().toISOString().slice(0, 10), counts = {};
      if (env.DB) { try { await ensureTables(env); const r = await env.DB.prepare("SELECT k, n FROM health WHERE day = ?").bind(day).all(); for (const x of r.results || []) counts[x.k] = x.n; } catch (e) {} }
      return reply({ claudeConfigured: !!env.ANTHROPIC_API_KEY, cacheConfigured: !!env.DB, day, counts, lastClaudeError: lastClaudeError || null });
    }
    if (request.method !== "POST" || !ok) return new Response("Not allowed", { status: 403, headers: cors });

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    const minute = Math.floor(Date.now() / 60000);
    const h = hits.get(ip);
    if (h && h[0] === minute) { if (++h[1] > PER_MINUTE) return reply({ kind: "busy" }); }
    else hits.set(ip, [minute, 1]);
    if (hits.size > 5000) hits.clear();

    let body;
    try { body = await request.json(); } catch { return reply({ kind: "invalid", message: "Bad request." }, 400); }
    const question = String(body.question || "").slice(0, 200);
    const noun = String(body.noun || "country").slice(0, 40);
    const secret = String(body.secret || "").slice(0, 80);
    const card = String(body.card || "").slice(0, 6000);
    const facts = Array.isArray(body.facts) ? body.facts.slice(0, 80) : [];
    // "fresh": the player said the earlier reading was wrong, so skip the caches and ask the AI again.
    const fresh = body.fresh === true;
    let src = "";
    const q = normQ(question);
    if (!q) return reply({ kind: "invalid", message: "Type a question first." });
    const sKey = `${noun}|${secret}`;
    const mKey = `${sKey}|${q}`;

    // 1. Exact cache.
    if (!fresh && memo.has(mKey)) { await count(env, "cache_exact"); return reply({ ...memo.get(mKey), src: "cache" }); }
    if (env.DB) {
      try {
        await ensureTables(env);
        const row = await env.DB.prepare("SELECT v FROM qa WHERE s = ? AND q = ?").bind(sKey, q).first();
        const v = !fresh && row && JSON.parse(row.v); if (v && v.kind !== "unknown") { remember(mKey, v); await count(env, "cache_exact"); return reply({ ...v, src: "cache" }); }
      } catch (e) {}
    }

    // 2. Reworded cache.
    let vec = null;
    if (env.DB) {
      try {
        vec = await embed(env, q);
        const v = fresh ? null : await reworded(env, sKey, q, vec);
        if (v) { remember(mKey, v); await save(env, sKey, q, v, vec); await count(env, "cache_reworded"); return reply({ ...v, src: "reworded" }); }
      } catch (e) {}
    }

    // 3. Ask Claude (or the free model).
    const factList = facts.map(f => `${String(f.k).slice(0, 20)}: ${String(f.t).slice(0, 80)}${f.hint ? ` (${String(f.hint).slice(0, 100)})` : ""}`).join("\n");
    let result = null, busy = false;
    if (env.ANTHROPIC_API_KEY) {
      try { const p = await askClaude(env, buildPrompt(noun, secret, card, factList, false), question); if (valid(p, facts)) { result = p; src = "claude"; await count(env, fresh ? "claude_reread" : "claude_ok"); } }
      catch (e) { lastClaudeError = `${new Date().toISOString()} ${String(e.message || e).slice(0, 240)}`; await count(env, "claude_failed"); }
    }
    if (!result) {
      const system = buildPrompt(noun, secret, card, factList, true);
      for (const model of [FREE_SMALL, FREE_BIG]) {
        try { const p = await askFree(env, model, system, question); if (valid(p, facts)) { result = p; src = "free"; await count(env, "free_answered"); break; } }
        catch (e) { if (String(e).match(/limit|quota|neuron|429|capacity/i)) busy = true; }
      }
    }
    if (!result) { await count(env, busy ? "busy" : "unanswered"); return reply({ kind: busy ? "busy" : "unavailable" }); }

    if (result.message && secret && result.message.toLowerCase().includes(secret.toLowerCase())) result.message = "Can you ask that more specifically?";
    const clean = { kind: result.kind };
    for (const f of ["key", "place", "answer", "message"]) if (typeof result[f] === "string") clean[f] = result[f].slice(0, 160);
    if (typeof result.negated === "boolean") clean.negated = result.negated;

    if (clean.kind !== "unknown") remember(mKey, clean);
    if (clean.kind !== "clarify" && clean.kind !== "unknown") await save(env, sKey, q, clean, vec);
    return reply({ ...clean, src });
  },
};

async function save(env, s, q, v, vec) {
  if (!env.DB) return;
  try { await env.DB.prepare("INSERT OR REPLACE INTO qa (s, q, v, e, t) VALUES (?, ?, ?, ?, ?)").bind(s, q, JSON.stringify(v), vec ? JSON.stringify(vec.map(x => Math.round(x * 1e4) / 1e4)) : null, Date.now()).run(); } catch (e) {}
}
function remember(k, v) { memo.set(k, v); if (memo.size > 20000) memo.delete(memo.keys().next().value); }
