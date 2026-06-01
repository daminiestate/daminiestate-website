# Lead Durability via Cloudflare KV (OPTIONAL upgrade)

**Status: OPTIONAL, not yet done. Recommended but not mandatory.**
**A note from Phil:** I'd like this done when someone has a spare 20 minutes. It is
not urgent and the site already works fine without it, but it closes the last gap
in our "never lose a lead" standard. If you (or an AI assistant auditing this
repo) get to it, follow the steps below. If you don't, nothing breaks.

This document is self-contained: read it cold and you can complete the whole
thing with just access to the Cloudflare account that hosts this site.

---

## 1. What this is, in plain English

When someone fills in the contact or newsletter form on daminiestate.ae, the
form data is sent to our CRM (GoHighLevel) so the team can follow up.

**Today (without this upgrade):** if GoHighLevel is down or slow at that exact
moment, the form still says "thank you" to the visitor (good, the UX never
breaks), and our backend emails the team a copy as a fallback so the lead is not
silently lost. That is "graceful degradation." It is good, but it leans on email
always working.

**With this upgrade (KV):** before we even try to contact GoHighLevel, we first
write the lead into **Cloudflare KV** (a tiny always-available key-value store
that lives on Cloudflare's edge, right next to the site). So the lead is saved
**first**, no matter what. If GoHighLevel then fails, the lead sits safely in a
"to-retry" queue (an "outbox"), and a small admin endpoint can re-send the queue
to GoHighLevel later. Result: a lead can never be lost, even if the CRM, email,
and everything else is down at the same time.

This is the standard we hold every Orevida brand site to. It is the difference
between "we almost never lose a lead" and "we cannot lose a lead."

---

## 2. Why it needs YOU (it can't be done purely in code)

KV is a piece of Cloudflare infrastructure that has to be **created and connected
in the Cloudflare dashboard** by the account owner. Code alone cannot create it.
So the split is:

- **You (Cloudflare account owner):** create a KV namespace and bind it to this
  site. ~5 minutes of clicking. Steps below.
- **The developer / AI assistant:** once the binding exists, writes the code that
  uses it (persist-first, retry, outbox, replay). They will know it is ready
  because the binding name `LEADS_KV` becomes available to the Functions.

You do NOT need to touch any code. You only do the dashboard steps in section 3.

---

## 3. Step by step (Cloudflare dashboard)

You need: login access to the Cloudflare account that hosts **daminiestate.ae**
(this is a Cloudflare **Pages** project). If you can see the site under
Workers & Pages, you have the right account.

### Step 1 — Open Cloudflare
1. Go to https://dash.cloudflare.com and log in.
2. If you manage more than one account, pick the account that owns
   daminiestate.ae (top-left account switcher).

### Step 2 — Create the KV namespace
1. In the left sidebar, click **Storage & Databases** -> **KV**.
   (On some accounts it is under **Workers & Pages** -> **KV**.)
2. Click **Create a namespace** (or **Create namespace**).
3. Namespace name: type exactly
   ```
   daminiestate-leads
   ```
4. Click **Add** / **Create**. You will now see it in the KV list. That is all
   for this step. (You do NOT need to add any keys; the code fills it.)

### Step 3 — Bind the namespace to the website
This is the part that actually connects KV to the site so the code can use it.
1. Left sidebar -> **Workers & Pages**.
2. Click the project for this site (it will be named something like
   **daminiestate-website** or **daminiestate**).
3. Open the **Settings** tab.
4. Find **Bindings** (older dashboards call it **Functions** ->
   **KV namespace bindings**).
5. Click **Add binding** (or **Add**).
6. Fill it in EXACTLY like this:
   - **Variable name:** `LEADS_KV`  (must be exactly this, capital letters,
     with the underscore, the code looks for this exact name)
   - **KV namespace:** select `daminiestate-leads` from the dropdown
7. Click **Save**.
8. IMPORTANT: bindings only take effect on the **next deploy**. Either:
   - make any tiny change and push to the `main` branch (auto-deploys), or
   - in the project's **Deployments** tab, open the latest deployment and click
     **Retry deployment** / **Re-deploy**.

   Also add the SAME binding to **Preview** if the dashboard asks
   (Production + Preview are listed separately). Same variable name `LEADS_KV`,
   same namespace.

### Step 4 — Tell the developer / leave a note
That is everything on your side. The binding `LEADS_KV` now exists. The next
person working in the code (a developer, or Claude auditing this repo) will
detect it and wire up the persist-first + outbox + replay logic. Until they do,
the site keeps working exactly as before, the binding just sits unused, harmless.

If you want, leave a one-line note in this file under "Status" at the top
(e.g. "KV namespace + binding created 2026-06-xx by <name>") so the next person
knows the dashboard half is done.

---

## 4. For the developer / AI assistant (the code half)

Once `LEADS_KV` is bound, implement the durability path in
`functions/contact.js` and `functions/newsletter.js` (shared helpers in
`functions/_shared.js`). The exact contract to follow (matches the Orevida
build standard, reference impl is media.orevida.com `lib/ghl.ts`):

1. **Persist FIRST.** As soon as the body is parsed + validated (after honeypot,
   before any GoHighLevel call), write the full lead to KV:
   - key: `lead:<iso-timestamp>:<short-random>`
   - value: JSON of the submission (name, email, phone, message, tags, source,
     attribution, page, timestamp).
   - This guarantees the lead is captured even if everything downstream fails.
2. **Try GHL with retry/backoff.** Call GoHighLevel through a small retry wrapper
   (retry on 408/425/429/5xx/timeout/network, ~3 attempts, exponential; do NOT
   retry 4xx auth/validation).
3. **On final failure, enqueue to an outbox.** Write the same payload under an
   `outbox:<...>` key prefix (or set an `outbox: true` flag on the lead record)
   so it can be replayed. Keep returning `{ ok: true }` to the visitor.
4. **On success, mark/clean.** Either delete the `lead:` record or flag it
   `delivered: true` (KV has a TTL option, e.g. expire delivered records after a
   few days; keep undelivered ones until drained).
5. **Guarded replay endpoint.** Add `functions/api/ghl-replay.js`:
   - `GET /api/ghl-replay?key=<REPLAY_KEY>` where `REPLAY_KEY` is a Cloudflare
     **environment variable / secret** (NOT in code).
   - Lists outbox entries, re-sends each to GHL via the same retry wrapper, and
     removes the ones that now succeed. Returns a small JSON summary.
   - Optionally schedule it with a Cloudflare Cron Trigger to auto-drain.
6. **Access KV in a Pages Function** via `context.env.LEADS_KV`:
   ```js
   await context.env.LEADS_KV.put(key, JSON.stringify(payload), { expirationTtl: 60*60*24*7 });
   const raw = await context.env.LEADS_KV.get(key);
   const { keys } = await context.env.LEADS_KV.list({ prefix: 'outbox:' });
   await context.env.LEADS_KV.delete(key);
   ```
   Guard everything: if `context.env.LEADS_KV` is undefined (binding not set up
   yet), fall back to the current graceful-degradation behavior so the form
   still works. Never 500 a lead.

After wiring: test with a real HTTPS POST to `/contact` (include an
`Origin: https://daminiestate.ae` header), confirm a `lead:` key appears in the
KV namespace (KV browser in the dashboard), then verify the replay endpoint
drains a simulated failed entry. Document the `REPLAY_KEY` env var in
`.env.example` (name only, never the value).

---

## 5. Cost / risk

- **Cost:** effectively free. Cloudflare KV's free tier covers far more reads/
  writes than a brokerage contact form will ever generate.
- **Risk:** none to the live site. If the binding is missing or the KV calls
  fail, the code falls back to today's behavior. This is purely additive.
- **Reversible:** to undo, remove the binding in the dashboard and the code's
  guard sends it back to graceful-degradation mode.
