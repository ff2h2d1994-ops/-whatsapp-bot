/**
 * WhatsApp Cloud API webhook for Cloudflare Workers
 * Pure fetch handler - no Express, no Node.js server
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
    },
  });

/**
 * Send message via WhatsApp Cloud API
 */
async function sendWhatsAppMessage(to, text, env) {
  const phoneNumberId = env.PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_TOKEN;
  const apiVersion = env.WHATSAPP_API_VERSION || "v20.0";

  if (!phoneNumberId || !accessToken) {
    throw new Error("PHONE_NUMBER_ID and WHATSAPP_TOKEN are required");
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API ${response.status}: ${error}`);
  }

  return response.json();
}

/**
 * Append to Google Sheets via REST API
 * No googleapis dependency - pure fetch
 */
async function appendToGoogleSheets(data, env) {
  const spreadsheetId = env.GOOGLE_SHEETS_ID;
  const accessToken = env.GOOGLE_ACCESS_TOKEN;
  const range = env.GOOGLE_SHEETS_RANGE || "Leads!A:D";

  if (!spreadsheetId || !accessToken) {
    console.log("Google Sheets not configured, skipping");
    return null;
  }

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}:append`
  );
  url.searchParams.set("valueInputOption", "USER_ENTERED");
  url.searchParams.set("insertDataOption", "INSERT_ROWS");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      values: [[data.phone, data.message, data.timestamp, new Date().toLocaleString("ar-SA")]],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets ${response.status}: ${error}`);
  }

  return response.json();
}

/**
 * Process WhatsApp webhook payload asynchronously
 */
async function processWhatsAppPayload(payload, env) {
  const messages =
    payload?.entry?.flatMap((entry) =>
      entry.changes?.flatMap((change) => change.value?.messages || []) || []
    ) || [];

  for (const message of messages) {
    if (!message.from) continue;

    const messageText = message.text?.body || "";
    const timestamp = new Date().toISOString();

    try {
      await appendToGoogleSheets(
        { phone: message.from, message: messageText, timestamp },
        env
      );
    } catch (error) {
      console.error("Google Sheets error:", error);
    }

    try {
      await sendWhatsAppMessage(
        message.from,
        "شكراً لتواصلك معنا! سنرد عليك قريباً. 👋",
        env
      );
    } catch (error) {
      console.error("WhatsApp error:", error);
    }
  }
}

/**
 * Cloudflare Workers fetch handler
 * No Express, no app.listen() - just pure Web APIs
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    try {
      // GET /
      if (pathname === "/" && method === "GET") {
        return new Response("WhatsApp Bot is running ✅", {
          status: 200,
          headers: { "content-type": "text/plain; charset=UTF-8" },
        });
      }

      // GET /webhook - Webhook verification from Meta
      if (pathname === "/webhook" && method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const verifyToken = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        if (
          mode === "subscribe" &&
          verifyToken &&
          verifyToken === env.VERIFY_TOKEN &&
          challenge
        ) {
          console.log("✅ Webhook verified");
          return new Response(challenge, { status: 200 });
        }

        console.warn("❌ Webhook verification failed");
        return new Response("Forbidden", { status: 403 });
      }

      // POST /webhook - Receive WhatsApp messages
      if (pathname === "/webhook" && method === "POST") {
        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        console.log("Received webhook payload:", JSON.stringify(payload, null, 2));

        // Process asynchronously without blocking response
        ctx.waitUntil(processWhatsAppPayload(payload, env));

        // Acknowledge immediately to Meta
        return json({ status: "received" }, 200);
      }

      // 404 Not Found
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Error:", error);
      return json({ error: error.message }, 500);
    }
  },
};
