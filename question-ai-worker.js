// Interrogate: the question reader.
// A free Cloudflare Worker that uses Workers AI to work out what a player's typed
// question means. Paste this whole file into a Cloudflare Worker, then add:
//   - a Workers AI binding named AI   (required)
//   - a D1 database binding named DB  (optional, strongly recommended: shares answers
//     between players so each new question only costs one AI call per secret)
// Steps are in SETUP.md.
//
// The game sends: { question, noun, secret, facts: [{ k, t, hint }] }
// It gets back one of:
//   { kind: "fact", key, negated }      a fact from the game's fact sheet
//   { kind: "border", place, negated }
//   { kind: "guess", place }
//   { kind: "open", answer: "yes"|"no" } answered from the model's own knowledge
//   { kind: "clarify", message }        asks the player what they mean (no turn used)
//   { kind: "invalid", message }        not a yes/no question
//   { kind: "busy" }                    rate limited or out of free AI for today

// Small model first (cheap, stretches the free tier). The big one only runs if the small
// one's reply can't be read.
const SMALL = "@cf/meta/llama-3.1-8b-instruct-fast";
const BIG = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?interrogate\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];
const PER_MINUTE = 20;          // questions per visitor per minute
const KINDS = ["fact", "border", "guess", "open", "clarify", "invalid"];

const memo = new Map();          // answers this worker instance has seen recently
const hits = new Map();          // visitor -> [minute, count]
let tableReady = false;

const normQ = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
async function sha(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

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

    // Rate limit per visitor (approximate: counted per worker instance).
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
    const facts = Array.isArray(body.facts) ? body.facts.slice(0, 80) : [];
    if (!normQ(question)) return reply({ kind: "invalid", message: "Type a question first." });

    // Same secret + same question = same answer, for every player.
    const key = await sha(`v1|${noun}|${secret}|${normQ(question)}`);
    if (memo.has(key)) return reply(memo.get(key));
    if (env.DB) {
      try {
        if (!tableReady) { await env.DB.exec("CREATE TABLE IF NOT EXISTS answers (k TEXT PRIMARY KEY, v TEXT, t INTEGER)"); tableReady = true; }
        const row = await env.DB.prepare("SELECT v FROM answers WHERE k = ?").bind(key).first();
        if (row) { const v = JSON.parse(row.v); remember(key, v); return reply(v); }
      } catch (e) { /* cache is a bonus; carry on without it */ }
    }

    const factList = facts.map(f => `${String(f.k).slice(0, 20)}: ${String(f.t).slice(0, 80)}${f.hint ? ` (${String(f.hint).slice(0, 100)})` : ""}`).join("\n");
    const system = `You read questions in "Interrogate", a yes/no guessing game. The secret ${noun} is ${secret}.
Reply with exactly one JSON object and nothing else.
1. Same meaning as a known fact below (any wording): {"kind":"fact","key":"<key>","negated":false}. Use "negated":true if it asks the opposite (e.g. "Does it have a coast?" = ll negated; "Is it outside Europe?" = c_eu negated).
2. Asks if it borders/neighbours/touches a named place: {"kind":"border","place":"<place>","negated":false}.
3. Names one specific ${noun} as a guess ("Is it Peru?"): {"kind":"guess","place":"<name>"}.
4. Any other clear yes/no question: answer it truthfully about ${secret} from your knowledge: {"kind":"open","answer":"yes"} or {"kind":"open","answer":"no"}. Treat unusual terms sensibly, e.g. "Afroeurasia" means Africa, Europe and Asia together.
5. Only if the meaning is truly unclear and the answer depends on it: {"kind":"clarify","message":"<one short question back>"}.
6. Not answerable with yes or no: {"kind":"invalid","message":"<one short sentence asking for a yes or no question>"}.
Never reveal or hint at the secret in a message.
Known facts:
${factList}`;

    let result = null;
    for (const model of [SMALL, BIG]) {
      try {
        const out = await env.AI.run(model, { messages: [{ role: "system", content: system }, { role: "user", content: question }], max_tokens: 80, temperature: 0 });
        const text = typeof out.response === "string" ? out.response : JSON.stringify(out.response || {});
        const m = text.match(/\{[\s\S]*?\}/);
        const p = m ? JSON.parse(m[0]) : null;
        if (p && KINDS.includes(p.kind) && (p.kind !== "fact" || facts.some(f => f.k === p.key))) { result = p; break; }
      } catch (e) {
        if (String(e).match(/limit|quota|neuron|429|capacity/i)) return reply({ kind: "busy" });
      }
    }
    if (!result) return reply({ kind: "unavailable" });
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
