// POST /api/unlock — checks a password server-side and, if it matches, issues
// the cookie that full-auth.js accepts. This is what lets the in-page Brief/Full
// toggle work like it does in local preview while the protection stays real:
// the password is never in the page, and a wrong guess gets nothing back.
//
// Cookie value is `<expiry>.<hmac>`, signed with FULL_PASSWORD so it cannot be
// forged without knowing the password. HttpOnly, so page scripts can't read it.

const COOKIE = "full_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const sign = async (secret, value) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const matches = (a, b) => {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
};

export default async (request) => {
  if (request.method !== "POST") return json(405, { error: "POST only" });

  const expected = Netlify.env.get("FULL_PASSWORD");
  if (!expected) return json(503, { error: "not configured" });

  let supplied = "";
  try {
    supplied = String((await request.json()).password || "");
  } catch {
    return json(400, { error: "bad request" });
  }

  // same cost whether the password is right or wrong
  const ok = matches(supplied, expected);
  await new Promise((r) => setTimeout(r, 350)); // blunt the guessing rate
  if (!ok) return json(401, { error: "incorrect" });

  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const token = `${exp}.${await sign(expected, exp)}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
};

export const config = { path: "/api/unlock" };
