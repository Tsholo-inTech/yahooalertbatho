declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const MAX_EMERGENCY_CONTACTS = 5;
const ALLOWED_EMERGENCY_TYPES = new Set([
  'medical_emergency',
  'accident_or_injury',
  'crime_assault_or_robbery',
  'fire_or_explosion',
  'dangerous_person_or_threat',
  'missing_or_trapped_person',
  'natural_disaster_or_severe_weather',
  'unsafe_situation_other',
]);
const E164_PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatPhoneNumber(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[\s().-]/g, '');
  return E164_PHONE_NUMBER.test(normalized) ? normalized : null;
}

function getSupabaseApiKey() {
  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (publishableKeys) {
    try {
      const keys: unknown = JSON.parse(publishableKeys);
      if (isRecord(keys) && typeof keys.default === 'string') return keys.default;
    } catch {
      return null;
    }
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? null;
}

function getSupabaseSecretKey() {
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeys) {
    try {
      const keys: unknown = JSON.parse(secretKeys);
      if (isRecord(keys) && typeof keys.default === 'string') return keys.default;
      console.error('SUPABASE_SECRET_KEYS does not contain a default key.');
      return undefined;
    } catch (error) {
      console.error('SUPABASE_SECRET_KEYS could not be parsed:', error);
      return undefined;
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

async function createReceivedAlertEntries(input: {
  supabaseUrl: string;
  serviceRoleKey: string | undefined;
  reportId: string;
  senderUserId: string;
  senderName: string;
  incidentType: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  deliveredPhones: string[];
}) {
  if (input.deliveredPhones.length === 0) return null;
  if (!input.serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required to create received emergency alerts.');
    return 'Emergency SMS was sent, but the recipient inbox is not configured.';
  }

  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
  let recipients: unknown;
  try {
    const lookupResponse = await fetch(
      `${input.supabaseUrl}/rest/v1/rpc/find_verified_emergency_alert_recipients`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ target_phones: input.deliveredPhones }),
      },
    );
    if (!lookupResponse.ok) {
      console.error('Could not match delivered emergency SMS to verified accounts:', lookupResponse.status);
      return 'Emergency SMS was sent, but the recipient inbox could not be updated.';
    }
    recipients = await lookupResponse.json();
  } catch (error) {
    console.error('Could not look up verified emergency alert recipients:', error);
    return 'Emergency SMS was sent, but the recipient inbox could not be updated.';
  }

  if (!Array.isArray(recipients)) {
    console.error('Verified emergency alert recipient lookup returned invalid data.');
    return 'Emergency SMS was sent, but the recipient inbox could not be updated.';
  }

  const deliveredPhones = new Set(input.deliveredPhones);
  const alertEntries = recipients.flatMap((recipient) => {
    if (
      !isRecord(recipient) ||
      typeof recipient.phone !== 'string' ||
      typeof recipient.user_id !== 'string' ||
      !deliveredPhones.has(recipient.phone) ||
      recipient.user_id === input.senderUserId
    ) {
      return [];
    }

    return [{
      report_id: input.reportId,
      sender_user_id: input.senderUserId,
      recipient_user_id: recipient.user_id,
      sender_name: input.senderName,
      incident_type: input.incidentType,
      description: input.description,
      latitude: input.latitude,
      longitude: input.longitude,
    }];
  });
  if (alertEntries.length === 0) return null;

  try {
    const insertUrl = new URL(`${input.supabaseUrl}/rest/v1/received_emergency_alerts`);
    insertUrl.searchParams.set('on_conflict', 'report_id,recipient_user_id');
    const insertResponse = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(alertEntries),
    });
    if (insertResponse.ok) return null;

    console.error('Could not save received emergency alerts:', insertResponse.status);
    return 'Emergency SMS was sent, but the recipient inbox could not be updated.';
  } catch (error) {
    console.error('Could not save received emergency alerts:', error);
    return 'Emergency SMS was sent, but the recipient inbox could not be updated.';
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseApiKey = getSupabaseApiKey();
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !supabaseApiKey) {
    console.error('Supabase URL or publishable API key is not configured.');
    return jsonResponse({ error: 'SMS delivery is not configured.' }, 503);
  }
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication is required.' }, 401);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseApiKey,
        Authorization: authorization,
      },
    });
    if (!authResponse.ok) {
      return jsonResponse({ error: 'Authentication is required.' }, 401);
    }

    const user = await authResponse.json();
    if (!isRecord(user) || typeof user.id !== 'string') {
      return jsonResponse({ error: 'Authentication is required.' }, 401);
    }
    const userMetadata = isRecord(user.user_metadata) ? user.user_metadata : {};
    const firstName = typeof userMetadata.first_name === 'string' && userMetadata.first_name.trim()
      ? userMetadata.first_name.trim()
      : 'A user';
    const lastName = typeof userMetadata.last_name === 'string' ? userMetadata.last_name.trim() : '';
    const senderName = [firstName, lastName].filter(Boolean).join(' ');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }
    if (
      !isRecord(body) ||
      typeof body.reportId !== 'string' ||
      typeof body.type !== 'string' ||
      !ALLOWED_EMERGENCY_TYPES.has(body.type) ||
      typeof body.description !== 'string' ||
      body.description.length > 4000
    ) {
      return jsonResponse({ error: 'Emergency details are invalid.' }, 400);
    }

    const reportUrl = new URL(`${supabaseUrl}/rest/v1/emergency_reports`);
    reportUrl.searchParams.set('select', 'id');
    reportUrl.searchParams.set('id', `eq.${body.reportId}`);
    reportUrl.searchParams.set('user_id', `eq.${user.id}`);

    const reportResponse = await fetch(reportUrl, {
      headers: {
        apikey: supabaseApiKey,
        Authorization: authorization,
      },
    });
    if (!reportResponse.ok) {
      console.error('Failed to verify the authenticated emergency report:', reportResponse.status);
      return jsonResponse({ error: 'Emergency report could not be verified.' }, 500);
    }
    const ownedReports: unknown = await reportResponse.json();
    if (!Array.isArray(ownedReports) || ownedReports.length !== 1) {
      return jsonResponse({ error: 'Emergency report was not found for this account.' }, 404);
    }

    const latitude = body.latitude;
    const longitude = body.longitude;
    const hasValidLocation =
      (latitude === null && longitude === null) ||
      (typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180);
    if (!hasValidLocation) {
      return jsonResponse({ error: 'Emergency location is invalid.' }, 400);
    }

    const contactsUrl = new URL(`${supabaseUrl}/rest/v1/emergency_contacts`);
    contactsUrl.searchParams.set('select', 'contact_name,contact_phone');
    contactsUrl.searchParams.set('user_id', `eq.${user.id}`);
    contactsUrl.searchParams.set('order', 'created_at.asc');

    const contactsResponse = await fetch(contactsUrl, {
      headers: {
        apikey: supabaseApiKey,
        Authorization: authorization,
      },
    });
    if (!contactsResponse.ok) {
      console.error('Failed to load authenticated emergency contacts:', contactsResponse.status);
      return jsonResponse({ error: 'Emergency contacts could not be loaded.' }, 500);
    }

    const storedContacts: unknown = await contactsResponse.json();
    if (!Array.isArray(storedContacts)) {
      return jsonResponse({ error: 'Emergency contacts could not be loaded.' }, 500);
    }
    if (storedContacts.length === 0) {
      return jsonResponse({ sentCount: 0, totalCount: 0, failedRecipients: [] });
    }
    if (storedContacts.length > MAX_EMERGENCY_CONTACTS) {
      return jsonResponse({
        error: `Remove contacts until you have no more than ${MAX_EMERGENCY_CONTACTS}.`,
      }, 400);
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = formatPhoneNumber(Deno.env.get('TWILIO_FROM_NUMBER'));
    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error('Twilio SMS secrets are missing or invalid.');
      return jsonResponse({ error: 'SMS delivery is not configured.' }, 503);
    }

    const emergencyType = body.type.replaceAll('_', ' ');
    const messageLines = [`EMERGENCY ALERT: ${senderName} has triggered an emergency. Type: ${emergencyType}.`];
    const description = body.description.trim();
    if (description) messageLines.push(`Details: ${description}`);
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      messageLines.push(`Location: https://maps.google.com/?q=${latitude},${longitude}`);
    }
    const message = messageLines.join('\n');
    const authorizationHeader = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

    const results = await Promise.all(
      storedContacts.map(async (value) => {
        if (!isRecord(value)) {
          return { sent: false, name: 'A contact', phone: null as string | null };
        }
        const name = typeof value.contact_name === 'string' ? value.contact_name : 'A contact';
        const recipientPhone = typeof value.contact_phone === 'string' ? value.contact_phone : null;
        const toPhoneNumber = formatPhoneNumber(recipientPhone);
        if (!toPhoneNumber) return { sent: false, name, phone: recipientPhone };

        try {
          const smsResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: authorizationHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                To: toPhoneNumber,
                From: fromPhoneNumber,
                Body: message,
              }),
            },
          );
          if (!smsResponse.ok) {
            console.error('Twilio rejected an emergency SMS:', smsResponse.status);
            return { sent: false, name, phone: recipientPhone };
          }
          return { sent: true, name, phone: toPhoneNumber };
        } catch (error) {
          console.error('Twilio SMS request failed:', error);
          return { sent: false, name, phone: recipientPhone };
        }
      }),
    );

    const inboxWarning = await createReceivedAlertEntries({
      supabaseUrl,
      serviceRoleKey: getSupabaseSecretKey(),
      reportId: body.reportId,
      senderUserId: user.id,
      senderName,
      incidentType: body.type,
      description: body.description.trim(),
      latitude: typeof latitude === 'number' ? latitude : null,
      longitude: typeof longitude === 'number' ? longitude : null,
      deliveredPhones: results.flatMap((result) =>
        result.sent && result.phone ? [result.phone] : [],
      ),
    });

    const alertLogs = results
      .filter((result): result is typeof result & { phone: string } => result.phone !== null)
      .map((result) => ({
        report_id: body.reportId,
        recipient_phone: result.phone,
        status: result.sent ? 'Accepted by Twilio' : 'Failed via Twilio',
      }));

    if (alertLogs.length > 0) {
      const logsResponse = await fetch(`${supabaseUrl}/rest/v1/alerts_log`, {
        method: 'POST',
        headers: {
          apikey: supabaseApiKey,
          Authorization: authorization,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(alertLogs),
      });
      if (!logsResponse.ok) {
        console.error('SMS attempts completed, but recipient delivery logs could not be saved:', logsResponse.status);
      }
    }

    const failedRecipients = results
      .filter((result) => !result.sent)
      .map((result) => result.name);
    return jsonResponse({
      sentCount: results.filter((result) => result.sent).length,
      totalCount: results.length,
      failedRecipients,
      ...(inboxWarning ? { inboxWarning } : {}),
    });
  } catch (error) {
    console.error('Emergency SMS function failed:', error);
    return jsonResponse({ error: 'Emergency SMS alerts could not be sent.' }, 500);
  }
});
