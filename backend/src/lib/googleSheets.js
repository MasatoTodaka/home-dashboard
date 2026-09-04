import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

let tokenCache = null; // { accessToken, expiresAt }

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt - Date.now() > 60 * 1000) {
    return tokenCache.accessToken;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = base64url(crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claim}`), privateKey));
  const jwt = `${header}.${claim}.${signature}`;

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(json?.error_description ?? `Google token error (${resp.status})`);
  }

  tokenCache = { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return tokenCache.accessToken;
}

async function sheetsFetch(path, options = {}) {
  const accessToken = await getAccessToken();
  const resp = await fetch(`${SHEETS_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error?.message ?? `Google Sheets API error (${resp.status})`);
  }
  return json;
}

// 既にシートに書き込み済みの "customerId:updatedAt" の組を返す(重複追記の防止用)
// シート列: A=updatedAt(ISO文字列), B=customerId, ...
export async function getExistingKeys(spreadsheetId, sheetName) {
  const json = await sheetsFetch(`/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A2:B`)}`);
  const rows = json.values ?? [];
  return new Set(rows.map(([updatedAt, customerId]) => `${customerId}:${updatedAt}`));
}

export async function appendRows(spreadsheetId, sheetName, rows) {
  if (rows.length === 0) return;
  await sheetsFetch(
    `/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    }
  );
}
