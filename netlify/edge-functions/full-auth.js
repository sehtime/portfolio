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

const deny = (message) =>
  new Response(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });

// Constant-time-ish compare so a timing signal doesn't leak the password.
const matches = (a, b) => {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
};

export default async (request, context) => {
  const expected = Netlify.env.get("FULL_PASSWORD");
  if (!expected) return deny("Full case study is not configured.");

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (!encoded || String(scheme).toLowerCase() !== "basic") {
    return deny("Password required.");
  }

  let supplied = "";
  try {
    // "user:password" — the username is ignored, only the password matters
    supplied = atob(encoded).split(":").slice(1).join(":");
  } catch {
    return deny("Password required.");
  }

  if (!matches(supplied, expected)) return deny("Password required.");

  const response = await context.next();
  const out = new Response(response.body, response);
  // never let the protected build into a search index or a shared cache
  out.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  out.headers.set("Cache-Control", "private, no-store");
  return out;
};

export const config = { path: "/full/*" };
