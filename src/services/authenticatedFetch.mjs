/**
 * Run one request with cached auth, then retry one unauthorized response with
 * a forced token refresh. The caller owns final 401 handling and sign-out.
 */
export async function fetchWithOneAuthRetry({ runFetch, invalidateAuth }) {
  let response = await runFetch(false);
  if (response.status === 401) {
    invalidateAuth();
    response = await runFetch(true);
  }
  return response;
}
