// Interrogate: the question reader (Cloudflare Worker).
// Paste this whole file into the Cloudflare Worker editor. Bindings and secrets:
//   - AI                 Workers AI binding (required; the free fallback)
//   - DB                 D1 database binding (recommended; shares answers between players)
//   - ANTHROPIC_API_KEY  secret (optional). When set, Claude Haiku reads the questions instead
//                        of the free model. If Claude is unavailable (no credit left, outage),
//                        the free model takes over automatically.
// The dashboard editor can't install npm packages, so Claude is called over plain HTTPS.
//
// The game sends: { question, noun, secret, card, facts: [{ k, t, hint }] }
// It gets back one of:
//   { kind: "fact", key, negated }       a fact from the game's fact sheet
//   { kind: "border", place, negated }
//   { kind: "guess", place }
//   { kind: "open", answer: "yes"|"no" }  answered from the fact card (or, with Claude, sure knowledge)
//   { kind: "unknown" }                  can't confirm it: the game says so and the turn isn't used
//   { kind: "clarify", message }         asks the player what they mean (no turn used)
//   { kind: "invalid", message }         not a yes/no question
//   { kind: "busy" }                     rate limited or out of AI allowance for now

const CLAUDE_MODEL = "claude-haiku-5-5";
const FREE_SMALL = "@cf/meta/llama-3.1-8b-instruct-fast";
const FREE_BIG = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?interrogate\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
const PER_MINUTE = 20;
const KINDS = ["fact", "border", "guess", "open", "unknown", "clarify", "invalid"];

const memo = new Map();
const hits = new Map();
let tableReady = false;

const normQ = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
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
5. Only if the meaning is truly unclear and the answer depends on it: {"kind":"clarify","message":"<one short question back>"}.
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
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2026-10-21" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error("claude " + res.status);
  const msg = await res.json();
  if (msg.stop_reason !== "end_turn") throw new Error("claude stop " + msg.stop_reason);
  const text = (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return JSON.parse(text);
}

async function askFree(env, model, system, question) {
  const out = await env.AI.run(model, { messages: [{ role: "system", content: system }, { role: "user", content: question }], max_tokens: 80, temperature: 0 });
  const text = typeof out.response === "string" ? out.response : JSON.stringify(out.response || {});
  const m = text.match(/\{[\s\S]*?\}/);
  return m ? JSON.parse(m[0]) : null;
}

const valid = (p, facts) => p && KINDS.includes(p.kind) && (p.kind !== "fact" || facts.some(f => f.k === p.key)) && (p.kind !== "open" || p.answer === "yes" || p.answer === "no");

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const ok = ALLOWED.some(re => re.test(origin));
    const cors = {
      "Access-Control-Allow-Origin": ok ? origin : "https://interrogate.pages.dev",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const reply = (obj, status = 200) => Response.json(obj, { status, headers: cors });
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
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
    const card = String(body.card || "").slice(0, 4000);
    const facts = Array.isArray(body.facts) ? body.facts.slice(0, 80) : [];
    if (!normQ(question)) return reply({ kind: "invalid", message: "Type a question first." });

    const useClaude = !!env.ANTHROPIC_API_KEY;
    const key = await sha(`v2|${useClaude ? "claude" : "free"}|${noun}|${secret}|${normQ(question)}`);
    if (memo.has(key)) return reply(memo.get(key));
    if (env.DB) {
      try {
        if (!tableReady) { await env.DB.exec("CREATE TABLE IF NOT EXISTS answers (k TEXT PRIMARY KEY, v TEXT, t INTEGER)"); tableReady = true; }
        const row = await env.DB.prepare("SELECT v FROM answers WHERE k = ?").bind(key).first();
        if (row) { const v = JSON.parse(row.v); remember(key, v); return reply(v); }
      } catch (e) { /* the cache is a bonus; carry on without it */ }
    }

    const factList = facts.map(f => `${String(f.k).slice(0, 20)}: ${String(f.t).slice(0, 80)}${f.hint ? ` (${String(f.hint).slice(0, 100)})` : ""}`).join("\n");
    let result = null, busy = false;

    if (useClaude) {
      try { const p = await askClaude(env, buildPrompt(noun, secret, card, factList, false), question); if (valid(p, facts)) result = p; }
      catch (e) { /* no credit left, outage, etc.: fall through to the free model */ }
    }
    if (!result) {
      const system = buildPrompt(noun, secret, card, factList, true);
      for (const model of [FREE_SMALL, FREE_BIG]) {
        try { const p = await askFree(env, model, system, question); if (valid(p, facts)) { result = p; break; } }
        catch (e) { if (String(e).match(/limit|quota|neuron|429|capacity/i)) busy = true; }
      }
    }
    if (!result) return reply({ kind: busy ? "busy" : "unavailable" });

    if (result.message && secret && result.message.toLowerCase().includes(secret.toLowerCase())) result.message = "Can you ask that more specifically?";
    const clean = { kind: result.kind };
    for (const f of ["key", "place", "answer", "message"]) if (typeof result[f] === "string") clean[f] = result[f].slice(0, 160);
    if (typeof result.negated === "boolean") clean.negated = result.negated;

    remember(key, clean);
    if (env.DB && clean.kind !== "clarify") {
      try { await env.DB.prepare("INSERT OR REPLACE INTO answers (k, v, t) VALUES (?, ?, ?)").bind(key, JSON.stringify(clean), Date.now()).run(); } catch (e) {}
    }
    return reply(clean);
  },
};

function remember(k, v) { memo.set(k, v); if (memo.size > 20000) memo.delete(memo.keys().next().value); }
