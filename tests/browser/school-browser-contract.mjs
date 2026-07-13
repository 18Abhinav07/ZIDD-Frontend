const NEXT_AUTH_COOKIE = /^(?:__Secure-|__Host-)?(?:next-auth|authjs)\.(?:session-token(?:\.\d+)?|csrf-token)$/;

export const SCHOOL_ACTION_LABELS = Object.freeze({
  complete_profile: 'Set up school prep',
  edit_profile: 'Edit school profile',
  start_placement: 'Start readiness check',
  resume_placement: 'Continue readiness check',
  finish_placement: 'Finish readiness check',
  view_placement_report: 'View readiness report',
  start_recap: 'Start recap path',
  resume_recap: 'Continue recap',
  revise_recap_path: 'Review recap path',
  start_curriculum: 'Start target class',
  resume_curriculum: 'Continue class',
  start_masterclass: 'Start masterclass',
  resume_masterclass: 'Continue masterclass',
  resume_support: 'Continue support',
  view_support_plan: 'Open support plan',
  view_report: 'View report',
  retry: 'Retry',
});

function isLocalhostAuthCookie(cookie) {
  return cookie.domain.replace(/^\./, '') === 'localhost'
    && NEXT_AUTH_COOKIE.test(cookie.name);
}

export async function createIsolatedSchoolContext(browser, baseUrl) {
  const parsedBaseUrl = new URL(baseUrl);
  if (parsedBaseUrl.hostname !== 'localhost' || parsedBaseUrl.port !== '3001') {
    throw new Error('school_browser_base_url_must_be_localhost_3001');
  }

  const defaultContext = browser.contexts()[0];
  if (!defaultContext) throw new Error('school_cdp_context_missing');
  const authCookies = (await defaultContext.cookies([baseUrl]))
    .filter(isLocalhostAuthCookie);
  const hasSessionCookie = authCookies.some((cookie) => (
    /^(?:__Secure-|__Host-)?(?:next-auth|authjs)\.session-token(?:\.\d+)?$/.test(cookie.name)
  ));
  if (!hasSessionCookie) throw new Error('school_cdp_session_cookie_missing');

  const context = await browser.newContext();
  try {
    await context.addCookies(authCookies);
    const page = await context.newPage();
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}
