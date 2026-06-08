export const setToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('zidd_token', token);
  }
};

export const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('zidd_token');
  }
  return null;
};

export const clearToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('zidd_token');
  }
};

const getHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token missing / expired / invalid: clear it and bounce to login from ONE
    // place, instead of every caller rendering a stale-session error. A service
    // has no router, so a hard redirect is the portable choice.
    clearToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API Error: ${response.status}`);
  }

  return response.json();
}
