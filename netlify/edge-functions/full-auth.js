// HTTP Basic Auth for the Full case-study build under /full/*.
//
// Everything under /full/ is the un-gated case study: the complete prose plus
// the Full-only images that the public build prunes. This runs at the edge, so
// the protection is server-side — unlike the in-page gate, the content never
// reaches the browser unless the password checks out.
//
// The password lives in the FULL_PASSWORD environment variable (Netlify UI →
// Site configuration → Environment variables). Any username is accepted.
//
// Fails CLOSED: if FULL_PASSWORD is unset, every request is denied rather than
// silently serving the protected build to the public.

const REALM = "Full case study";

// `challenge` controls the browser's own sign-in dialog. Only offer it to a
// request that already tried Basic Auth — otherwise every protected image on
// the page would pop a password prompt, which is what the in-page gate exists
// to avoid.
const deny = (message, challenge = false) => {
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  };
  if (challenge) {
    headers["WWW-Authenticate"] = `Basic realm="${REALM}", charset="UTF-8"`;
  }
  return new Response(message, { status: 401, headers });
};

// Constant-time-ish compare so a timing signal doesn't leak the password.
const matches = (a, b) => {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
};

// Cookie issued by /api/unlock: `<expiry>.<hmac>`, signed with the password.
const cookieValid = async (request, secret) => {
  const raw = request.headers.get("cookie") || "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith("full_auth="));
  if (!hit) return false;
  const [exp, mac] = hit.slice("full_auth=".length).split(".");
  if (!exp || !mac) return false;
  if (Number(exp) * 1000 < Date.now()) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(exp)
  );
  const want = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return matches(mac, want);
};

export default async (request, context) => {
  const expected = Netlify.env.get("FULL_PASSWORD");
  if (!expected) return deny("Full case study is not configured.");

  // the in-page toggle unlocks with a cookie; Basic Auth still works for
  // direct links and for anyone who prefers the browser dialog
  if (await cookieValid(request, expected)) {
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    out.headers.set("Cache-Control", "private, no-store");
    return out;
  }

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (!encoded || String(scheme).toLowerCase() !== "basic") {
    // No credentials at all. A page request goes back to the public case study
    // with its unlock box open — the styled toggle, not the browser dialog.
    // Sub-resources just fail quietly; assets must never trigger a prompt.
    const url = new URL(request.url);
    const wantsPage =
      request.method === "GET" &&
      (request.headers.get("sec-fetch-mode") === "navigate" ||
        /\.html?$/.test(url.pathname) ||
        url.pathname.endsWith("/"));
    if (wantsPage) {
      const target = url.pathname.replace(/^\/full/, "") || "/";
      const back = new URL(target, url.origin);
      back.searchParams.set("unlock", "1");
      back.searchParams.set("next", url.pathname);
      return new Response(null, {
        status: 302,
        headers: {
          Location: back.pathname + back.search,
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow, noarchive",
        },
      });
    }
    return deny("Password required.");
  }

  let supplied = "";
  try {
    // "user:password" — the username is ignored, only the password matters
    supplied = atob(encoded).split(":").slice(1).join(":");
  } catch {
    return deny("Password required.", true);
  }

  if (!matches(supplied, expected)) return deny("Password required.", true);

  const response = await context.next();
  const out = new Response(response.body, response);
  // never let the protected build into a search index or a shared cache
  out.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  out.headers.set("Cache-Control", "private, no-store");
  return out;
};

export const config = { path: "/full/*" };
