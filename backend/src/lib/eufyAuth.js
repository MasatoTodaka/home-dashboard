const API_BASE_URL = 'https://api.eufylife.com';
const CLIENT_ID = 'eufy-app';
const CLIENT_SECRET = '8FHf22gaTKu7MZXqz5zytw'; // eufy Lifeアプリに埋め込まれている公開値(非公式)

let session = null; // { accessToken, userId, customers, expiresAt }

async function login() {
  const email = process.env.EUFY_EMAIL;
  const password = process.env.EUFY_PASSWORD;
  if (!email || !password) {
    throw new Error('EUFY_EMAIL / EUFY_PASSWORD is not set');
  }

  const resp = await fetch(`${API_BASE_URL}/v1/user/v2/email/login`, {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'EufyLife-iOS-3.3.7',
      Category: 'Health',
      Language: 'en',
      Timezone: 'UTC',
      Country: 'US',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, email, password }),
  });
  const json = await resp.json();
  if (!resp.ok || json?.res_code !== 1 || !json?.access_token || !json?.user_id) {
    throw new Error(json?.message ?? `Eufy login failed (${resp.status})`);
  }

  const expiresInSec = json.expires_in ?? 2592000; // 未指定時はEufy側デフォルトの30日
  session = {
    accessToken: json.access_token,
    userId: json.user_id,
    customers: json.customers ?? [],
    expiresAt: Date.now() + expiresInSec * 1000,
  };
  return session;
}

// アクセストークンが5分以内に切れる場合は再ログインする
export async function getEufySession() {
  if (session && session.expiresAt - Date.now() > 5 * 60 * 1000) {
    return session;
  }
  return login();
}

export function invalidateEufySession() {
  session = null;
}
