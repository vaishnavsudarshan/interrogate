// Interrogate: the question reader.
// A free Cloudflare Worker that uses Workers AI to work out what a player's typed
// question means. Paste this whole file into a Cloudflare Worker and add a Workers AI
// binding named AI (steps in SETUP.md).
//
// The game sends: { question, noun, secret, facts: [{ k, t, hint }] }
// It gets back one of:
//   { kind: "fact", key, negated }   -> a fact from the game's fact sheet
//   { kind: "border", place, negated }
//   { kind: "guess", place }
//   { kind: "open", answer: "yes" | "no" } -> answered from the model's own knowledge
//   { kind: "clarify", message }     -> asks the player what they mean (no turn used)
//   { kind: "invalid", message }     -> not a yes/no question

// The bigger model understands odd phrasing better but uses more of the free daily allowance.
// Swap to "@cf/meta/llama-3.1-8b-instruct-fast" to stretch the free tier much further.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const ALLOWED = [/^https:\/\/([a-z0-9-]+\.)?interrogate\.pages\.dev$/, /^http:\/\/localhost(:\d+)?$/];

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
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST" || !ok) return new Response("Not allowed", { status: 403, headers: cors });

    let body;
    try { body = await request.json(); } catch { return Response.json({ kind: "invalid", message: "Bad request." }, { status: 400, headers: cors }); }
    const question = String(body.question || "").slice(0, 200);
    const noun = String(body.noun || "country").slice(0, 40);
    const secret = String(body.secret || "").slice(0, 80);
    const facts = Array.isArray(body.facts) ? body.facts.slice(0, 80) : [];
    if (!question.trim()) return Response.json({ kind: "invalid", message: "Type a question first." }, { headers: cors });

    const factList = facts.map(f => `- ${String(f.k).slice(0, 20)}: ${String(f.t).slice(0, 80)}${f.hint ? ` (${String(f.hint).slice(0, 120)})` : ""}`).join("\n");
    const system = `You are the question reader for "Interrogate", a yes/no guessing game.
The player is trying to work out a secret ${noun}. The secret is ${secret}.
Read the player's question and reply with exactly one JSON object, nothing else.

Rules, in order:
1. If the question means the same as one of the known facts below (any wording), reply {"kind":"fact","key":"<key>","negated":<true|false>}.
   Use "negated":true when the question asks the opposite of the fact, e.g. "Does it have a coast?" is key ll (landlocked) negated; "Is it outside Europe?" is c_eu negated; "Is it smaller than a million km2?" is big negated.
2. If it asks whether the secret borders, neighbours or touches a specific named place, reply {"kind":"border","place":"<that place's name>","negated":<true|false>}.
3. If it names a single specific ${noun} as a guess (e.g. "Is it Peru?", "Japan?"), reply {"kind":"guess","place":"<name>"}.
4. If it's a clear yes/no question not covered above, answer it truthfully about ${secret} from your own knowledge: {"kind":"open","answer":"yes"} or {"kind":"open","answer":"no"}.
5. If you aren't sure what they mean and the answer would change depending on it, reply {"kind":"clarify","message":"<one short question back to the player>"}.
6. If it can't be answered with yes or no (e.g. "What is the capital?"), reply {"kind":"invalid","message":"<one short sentence asking for a yes or no question>"}.
Never say or hint at the secret's name in any message.

Known facts:
${factList}`;

    try {
      const out = await env.AI.run(MODEL, {
        messages: [{ role: "system", content: system }, { role: "user", content: question }],
        max_tokens: 120,
        temperature: 0,
      });
      const reply = typeof out.response === "string" ? out.response : JSON.stringify(out.response || {});
      const match = reply.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : null;
      const kinds = ["fact", "border", "guess", "open", "clarify", "invalid"];
      if (!parsed || !kinds.includes(parsed.kind)) throw new Error("unreadable");
      // Never let a message leak the answer.
      if (parsed.message && secret && parsed.message.toLowerCase().includes(secret.toLowerCase())) parsed.message = "Can you ask that more specifically?";
      return Response.json(parsed, { headers: cors });
    } catch (e) {
      return Response.json({ kind: "unavailable" }, { status: 200, headers: cors });
    }
  },
};
