export async function apiFetch(getToken, path, init = {}) {
  const token = await getToken();
  const headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };

  const res = await fetch(path, { ...init, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }
  return json;
}