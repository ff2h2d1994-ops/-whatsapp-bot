# WhatsApp Leads Bot - Cloudflare Workers Edition

بوت WhatsApp يعمل على Cloudflare Workers بدون Express، بدون Render، بدون ngrok.

## المميزات
- GET /
- GET /webhook
- POST /webhook
- إرسال الرسائل عبر WhatsApp Cloud API
- Google Sheets REST API
- لا يوجد app.listen()
- لا يوجد Express
- لا توجد Secrets في GitHub

## المتغيرات المطلوبة
أضفها في Cloudflare Dashboard → Workers → Settings → Environment Variables

- PHONE_NUMBER_ID
- WHATSAPP_ACCESS_TOKEN
- VERIFY_TOKEN
- GOOGLE_SHEETS_ID
- GOOGLE_ACCESS_TOKEN
- GOOGLE_SHEETS_RANGE

## التشغيل المحلي

```bash
npm install
npm start
```

## النشر

```bash
npm run deploy
```

## Webhook verification

```bash
curl "https://your-worker-url.workers.dev/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=CHALLENGE"
```

## ملاحظات الأمان
- لا تضع Secret أو token حقيقي داخل GitHub
- استخدم Cloudflare Dashboard لإدارة المتغيرات
- لا تستخدم googleapis لأنّه غير مناسب لـ Cloudflare Workers في هذا السيناريو
