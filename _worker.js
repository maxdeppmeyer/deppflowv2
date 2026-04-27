const DEFAULT_CONTACT_TTL_SECONDS = 60 * 60 * 24 * 90;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/contact') {
      return handleContactSubmission(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleContactSubmission(request, env) {
  if (!env.CONTACT_FORMS) {
    return json({ ok: false, message: 'Das Kontaktformular ist noch nicht vollständig eingerichtet.' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: 'Ungültige Anfrage.' }, 400);
  }

  const data = {
    gender: clean(payload.gender, 40),
    firstName: clean(payload.firstName, 80),
    name: clean(payload.name, 80),
    company: clean(payload.company, 120),
    email: clean(payload.email, 160).toLowerCase(),
    topic: clean(payload.topic, 140),
    message: cleanMultiline(payload.message, 4000),
    phone: clean(payload.phone, 80),
    callbackRequested: payload.callbackRequested === true,
    consent: payload.consent === true,
    assessment: cleanMultiline(payload.assessment, 1500),
    website: clean(payload.website, 200)
  };

  // Honeypot: echte Nutzer sehen dieses Feld nicht.
  if (data.website) {
    return json({ ok: true, message: 'Anfrage erfolgreich abgesendet.' }, 202);
  }

  const allowedGenderValues = ['', 'male', 'female', 'other', 'diverse'];
  if (!allowedGenderValues.includes(data.gender)) {
    return json({ ok: false, message: 'Bitte eine gültige Anrede auswählen.' }, 400);
  }

  if (!data.firstName) {
    return json({ ok: false, message: 'Bitte den Vornamen angeben.' }, 400);
  }

  if (!data.name) {
    return json({ ok: false, message: 'Bitte den Nachnamen angeben.' }, 400);
  }

  if (!isValidEmail(data.email)) {
    return json({ ok: false, message: 'Bitte eine gültige E-Mail-Adresse eingeben.' }, 400);
  }

  if (!data.topic) {
    return json({ ok: false, message: 'Bitte ein Thema auswählen.' }, 400);
  }

  if (!data.message || data.message.length < 20) {
    return json({ ok: false, message: 'Bitte den Ablauf kurz mit mindestens 20 Zeichen beschreiben.' }, 400);
  }

  if (data.callbackRequested && !isValidPhone(data.phone)) {
    return json({ ok: false, message: 'Bitte eine Telefonnummer für den Rückruf angeben.' }, 400);
  }

  if (!data.consent) {
    return json({ ok: false, message: 'Bitte die Datenschutzhinweise bestätigen.' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || '';
  const origin = request.headers.get('Origin') || '';
  const rateKey = `contact-rate:${ip}`;
  const lastSubmission = await env.CONTACT_FORMS.get(rateKey);

  if (lastSubmission && Date.now() - Number(lastSubmission) < 60000) {
    return json({ ok: false, message: 'Bitte warten Sie einen Moment, bevor Sie eine weitere Anfrage senden.' }, 429);
  }

  const submittedAt = new Date().toISOString();
  const entryId = `contact:${submittedAt}:${crypto.randomUUID()}`;
  const record = {
    id: entryId,
    submittedAt,
    ip,
    userAgent,
    origin,
    source: 'website-contact-form',
    ...data
  };

  await Promise.all([
    env.CONTACT_FORMS.put(entryId, JSON.stringify(record), { expirationTtl: getContactTtl(env) }),
    env.CONTACT_FORMS.put(rateKey, String(Date.now()), { expirationTtl: 120 })
  ]);

  const webhookUrl = env.N8N_WEBHOOK_URL || 'https://maxde.app.n8n.cloud/webhook/cloudflare-contact';

  try {
    await sendToN8N(record, webhookUrl, env.N8N_CONTACT_SECRET);
  } catch {
    return json(
      {
        ok: false,
        message: 'Anfrage wurde gespeichert, aber die Weiterleitung an den Workflow hat nicht funktioniert.'
      },
      502
    );
  }

  return json({ ok: true, message: 'Anfrage erfolgreich abgesendet.' }, 200);
}

async function sendToN8N(record, webhookUrl, secret) {
  if (!webhookUrl) {
    throw new Error('n8n webhook missing');
  }

  const headers = {
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (secret) {
    headers['X-Contact-Secret'] = secret;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`n8n error ${response.status}: ${text}`);
  }
}

function clean(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 4000) {
  return String(value || '').trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isValidPhone(value) {
  const normalized = String(value || '').trim().replace(/[^\d+]/g, '');
  return normalized.length >= 7;
}

function getContactTtl(env) {
  const parsed = Number(env.CONTACT_TTL_SECONDS || DEFAULT_CONTACT_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_CONTACT_TTL_SECONDS;
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
