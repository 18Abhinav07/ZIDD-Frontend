export const AUTH_COOKIE_BASE_NAMES = Object.freeze([
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.pkce.code_verifier',
  '__Secure-next-auth.pkce.code_verifier',
  'next-auth.state',
  '__Secure-next-auth.state',
  'next-auth.nonce',
  '__Secure-next-auth.nonce',
]);

const AUTH_SESSION_COOKIE_BASE_NAMES = Object.freeze([
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]);

function isCookieOrChunk(name, baseName) {
  return name === baseName || new RegExp(`^${baseName.replaceAll('.', '\\.') }\\.\\d+$`).test(name);
}

/** @param {Iterable<string>} cookieNames */
export function hasSessionAuthCookie(cookieNames) {
  return Array.from(cookieNames).some((name) =>
    AUTH_SESSION_COOKIE_BASE_NAMES.some((baseName) => isCookieOrChunk(name, baseName)),
  );
}

/** @param {Iterable<string>} [observedCookieNames] */
export function authCookieNamesToClear(observedCookieNames = []) {
  const names = new Set(AUTH_COOKIE_BASE_NAMES);
  for (const name of observedCookieNames) {
    if (AUTH_COOKIE_BASE_NAMES.some((baseName) => isCookieOrChunk(name, baseName))) {
      names.add(name);
    }
  }
  return Array.from(names);
}

export function deletionCookieOptions(name) {
  return {
    name,
    value: '',
    expires: new Date(0),
    path: '/',
    secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
  };
}
