const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export function buildGoogleAuthUrl(authConfig, state) {
  const params = new URLSearchParams({
    client_id: authConfig.clientId,
    redirect_uri: `${authConfig.appBaseUrl}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(authConfig, code) {
  const body = new URLSearchParams({
    code,
    client_id: authConfig.clientId,
    client_secret: authConfig.clientSecret,
    redirect_uri: `${authConfig.appBaseUrl}/auth/google/callback`,
    grant_type: 'authorization_code'
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || 'Google token exchange failed');
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error_description || data.error || 'Google userinfo failed');
    error.status = response.status;
    throw error;
  }

  if (!data.email) {
    throw new Error('Google account did not return an email address');
  }
  if (!data.sub) {
    throw new Error('Google account did not return a subject id');
  }

  return {
    sub: String(data.sub),
    email: String(data.email).toLowerCase(),
    name: data.name || data.email,
    picture: data.picture || null
  };
}
