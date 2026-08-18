/**
 * Contact form -> Resend.
 *
 * The allowed origins are configuration, not a constant: staging is a real
 * origin on a different host, and a single hardcoded apex meant every non-production
 * build got its response discarded by the browser and reported to the visitor as
 * "An error occurred" — indistinguishable from the mail actually failing.
 */

function corsHeaders(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // The response body is identical per origin, but the ACAO header is not.
    // Without this a cache could hand the staging origin's header to the apex.
    Vary: "Origin",
  };
  if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    // A browser sends Origin on every cross-origin POST, so an unlisted one is
    // a request we do not serve. An absent Origin is a same-origin or non-browser
    // caller (curl, a health check) and is left alone — CORS was never its gate.
    if (request.headers.get("Origin") && !cors["Access-Control-Allow-Origin"]) {
      return new Response("Forbidden origin", { status: 403, headers: cors });
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    try {
      const formData = await request.formData();
      const name = formData.get("name")?.trim();
      const email = formData.get("email")?.trim();
      const message = formData.get("message")?.trim();
      const turnstileToken = formData.get("cf-turnstile-response");

      // Validation
      if (!name || !email || !message) {
        return new Response("All fields are required", { status: 400, headers: cors });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response("Invalid email address", { status: 400, headers: cors });
      }

      // Verify Turnstile token
      if (!turnstileToken) {
        return new Response("Please complete the verification", { status: 400, headers: cors });
      }

      const turnstileResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
          remoteip: request.headers.get("CF-Connecting-IP"),
        }),
      });

      const turnstileResult = await turnstileResponse.json();
      if (!turnstileResult.success) {
        console.error("Turnstile verification failed:", JSON.stringify(turnstileResult));
        return new Response("Verification failed. Please try again.", { status: 400, headers: cors });
      }

      // Send email via Resend
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${env.FROM_NAME} <${env.FROM_EMAIL}>`,
          to: [env.TO_EMAIL],
          reply_to: email,
          subject: `New Contact Form Submission from ${name}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <h3>Message:</h3>
            <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
          `,
        }),
      });

      if (resendResponse.ok) {
        return new Response("Message sent successfully!", { status: 200, headers: cors });
      } else {
        const errorData = await resendResponse.json();
        console.error("Resend error:", JSON.stringify(errorData));
        return new Response(`Error: ${errorData.message || "Failed to send message"}`, {
          status: 500,
          headers: cors,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      return new Response("An error occurred. Please try again.", { status: 500, headers: cors });
    }
  },
};

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
