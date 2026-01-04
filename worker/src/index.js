export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://twentyseven.pictures",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const formData = await request.formData();
      const name = formData.get("name")?.trim();
      const email = formData.get("email")?.trim();
      const message = formData.get("message")?.trim();

      // Validation
      if (!name || !email || !message) {
        return new Response("All fields are required", { status: 400, headers: corsHeaders });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response("Invalid email address", { status: 400, headers: corsHeaders });
      }

      // Send email via Resend
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
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
        return new Response("Message sent successfully!", { status: 200, headers: corsHeaders });
      } else {
        const errorData = await resendResponse.json();
        console.error("Resend error:", JSON.stringify(errorData));
        return new Response(`Error: ${errorData.message || "Failed to send message"}`, { status: 500, headers: corsHeaders });
      }
    } catch (error) {
      console.error("Error:", error);
      return new Response("An error occurred. Please try again.", { status: 500, headers: corsHeaders });
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
