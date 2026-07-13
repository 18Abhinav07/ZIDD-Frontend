#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const hook = readFileSync('src/hooks/useZiddSession.ts', 'utf8');
const sseClient = readFileSync('src/services/sseClient.ts', 'utf8');
const sessionPage = readFileSync('src/app/session/[id]/page.tsx', 'utf8');
const mapPage = readFileSync('src/app/(gamified)/map/page.tsx', 'utf8');
const fillBlankCard = readFileSync('src/components/cards/FillInTheBlankCard.tsx', 'utf8');
const spokenAnswerCard = readFileSync('src/components/cards/SpokenAnswerCard.tsx', 'utf8');
const types = readFileSync('src/types/index.ts', 'utf8');

const failures = [];

if (!hook.includes('streamInFlightRef')) {
  failures.push('useZiddSession must use a synchronous streamInFlightRef latch.');
}

if (!hook.includes('if (streamInFlightRef.current)')) {
  failures.push('streamTurn must reject duplicate stream/opening starts before disconnecting the existing client.');
}

if (!hook.includes('useEffect(() => {') || !hook.includes('setNotFound(false)') || !hook.includes('setIsBootstrapping(true)')) {
  failures.push('useZiddSession must reset stale session state and bootstrapping/not-found flags when sessionId changes.');
}

if (!hook.includes('res.status === 410') || !hook.includes("err.code === 'session_expired'")) {
  failures.push('useZiddSession must treat backend 410/session_expired as a terminal not-found session.');
}

const notFoundBlock = hook.match(/if\s*\(res\.status === 404 \|\| res\.status === 410\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
if (!notFoundBlock.includes('setNotFound(true)') || !notFoundBlock.includes('setIsBootstrapping(false)') || !notFoundBlock.includes('return')) {
  failures.push('useZiddSession transcript bootstrap must return immediately on 404/410 instead of falling through to a generic restore error.');
}

if (!sessionPage.includes('handleStartNextSkill')) {
  failures.push('Session page must route Start Next Skill through a guarded handler.');
}

if (!types.includes('handoff_session_id?: string | null')) {
  failures.push('DoneFrame must carry handoff_session_id so consumed source sessions can redirect after reload.');
}

if (!sessionPage.includes('state?.handoff_session_id') || !sessionPage.includes('router.replace(`/session/${state.handoff_session_id}`)')) {
  failures.push('Session page must redirect consumed source sessions to their handoff session on reload.');
}

if (!sessionPage.includes('startSessionWithPaywall')) {
  failures.push('Start Next Skill must create a new session through startSessionWithPaywall.');
}

if (!sessionPage.includes('useAppSession') || !sessionPage.includes('const { loadBalance } = useAppSession();')) {
  failures.push('Session page must access AppSessionProvider balance refresh for metered starts.');
}

if (!sessionPage.includes('void loadBalance(true).catch(() => null)')) {
  failures.push('Successful Start Next Skill must force-refresh the visible credit balance.');
}

if (!sessionPage.includes('PaywallModal')) {
  failures.push('Session page must render PaywallModal for paid Start Next Skill transitions.');
}

if (!sessionPage.includes('isBootstrapping')) {
  failures.push('Session page must consume isBootstrapping from useZiddSession.');
}

if (!sessionPage.includes('}, [id]);')) {
  failures.push('Session page bootstrap effect must rerun when the dynamic session id changes.');
}

const startNextSkillBody = sessionPage.match(/const handleStartNextSkill = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
if (startNextSkillBody.includes('streamTurn(')) {
  failures.push('Start Next Skill must not stream the next opening inside the old session.');
}

if (startNextSkillBody.includes('confirm: true')) {
  failures.push('Start Next Skill first click must not silently confirm paid credit spend.');
}

if (!startNextSkillBody.includes('confirm: false')) {
  failures.push('Start Next Skill first click must request paywall state with confirm: false.');
}

if (!startNextSkillBody.includes('isBootstrapping')) {
  failures.push('Start Next Skill must be blocked while the session is bootstrapping.');
}

const confirmNextSkillBody = sessionPage.match(/const handleConfirmNextSkill = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
if (!confirmNextSkillBody.includes('confirm: true')) {
  failures.push('Paywall confirmation must retry Start Next Skill with confirm: true.');
}

if (!confirmNextSkillBody.includes('source_session_id: id') || !confirmNextSkillBody.includes('source_transition_id: transitionId')) {
  failures.push('Paywall confirmation must preserve source transition handoff ids.');
}

if (/catch \(err\)[\s\S]{0,120}setNextSkillPaywall\(null\)/.test(confirmNextSkillBody)) {
  failures.push('Paywall confirmation failures must keep the modal open so the same confirmed client_start_id can be retried idempotently.');
}

if (!sessionPage.includes('error={nextSkillError}')) {
  failures.push('PaywallModal must receive nextSkillError so confirm failures are visible inside the modal.');
}

if (!sessionPage.includes('onBalanceChange={() => void loadBalance(true).catch(() => null)}')) {
  failures.push('PaywallModal must refresh the visible credit balance after top-up callbacks.');
}

if (!/disabled=\{isStreaming \|\| isSubmitting/.test(sessionPage)) {
  failures.push('Start Next Skill button must disable while a stream/startup is in progress.');
}

if (sessionPage.includes('Path adjusted')) {
  failures.push('Skill transition card must not use internal path-adjustment language.');
}

if (!sessionPage.includes('Next Skill')) {
  failures.push('Skill transition card must use learner-facing next-skill copy.');
}

if (!sessionPage.includes('const visibleMastery = transitionActive')) {
  failures.push('Session shell must compute visibleMastery from transitionActive state.');
}

if (!/const visibleMastery = transitionActive[\s\S]{0,80}\?\s*1/.test(sessionPage)) {
  failures.push('Session shell must show 100% mastery while the Skill Mastered transition card is active.');
}

const handleSendBody = sessionPage.match(/const handleSend = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
if (!handleSendBody.includes("setInputValue('');")) {
  failures.push('Chat submit must clear the draft immediately after accepting the send action.');
}

if (!/setInputValue\(''\)[\s\S]{0,220}await streamTurn\(draft, clientTurnId\)/.test(handleSendBody)) {
  failures.push('Chat submit must clear the input before awaiting stream startup.');
}

if (!/if \(!result\.started\)[\s\S]{0,80}setInputValue\(draft\)/.test(handleSendBody)) {
  failures.push('Chat submit must restore the draft if stream startup is rejected.');
}

if (!/if \(!result\.started\)\s*\{[\s\S]{0,160}pendingClientTurnIdRef\.current = null[\s\S]{0,120}setInputValue\(draft\)/.test(handleSendBody)) {
  failures.push('Chat submit must clear the pending client_turn_id after a rejected turn startup so retries do not reuse a consumed id.');
}

const streamTurnBody = hook.match(/const streamTurn = useCallback\(async \([\s\S]*?\): Promise<StreamTurnResult> => \{[\s\S]*?\n  \}, \[/)?.[0] ?? '';
if (!/if \(userInput\)[\s\S]{0,260}setMessages\(prev => \[\s*\.\.\.prev,[\s\S]{0,120}content: userInput/.test(streamTurnBody)) {
  failures.push('streamTurn must append the learner answer optimistically before SSE startup.');
}

if (!/setMessages\(prev => \[[\s\S]{0,220}content: userInput[\s\S]{0,900}const headers = await getAuthHeaders\(\)/.test(streamTurnBody)) {
  failures.push('streamTurn must show the learner answer before awaiting auth headers or SSE open.');
}

if (hook.includes('fall through to the opening')) {
  failures.push('Transcript restore failures must not fall through to GET /opening.');
}

if (!hook.includes('Could not restore this session') || !hook.includes('shouldStreamOpening = false')) {
  failures.push('Transcript restore failures must set a restore error and suppress opening.');
}

if (!hook.includes('data.game_prompt') || !hook.includes('setGamePrompt(restoredGamePrompt)')) {
  failures.push('Transcript bootstrap must restore active game/card prompts from the backend.');
}

if (!hook.includes('cleanRestoredTranscriptContent')) {
  failures.push('Transcript bootstrap must normalize backend bridge prompt markers before rendering restored messages.');
}

if (!hook.includes("Bridge exercise: ")) {
  failures.push('Restored bridge/card prompt echoes must render as learner-safe Bridge exercise copy.');
}

if (!/filter\(\(m\) => \{[\s\S]{0,260}restoredGamePrompt\.sentence/.test(hook)) {
  failures.push('Transcript bootstrap must suppress the active game/card prompt echo when the visible card is restored.');
}

if (!/case 'message':[\s\S]{0,900}setGamePrompt\(null\)/.test(hook)) {
  failures.push('useZiddSession must clear a stale game/card prompt when the backend streams a plain assistant message.');
}

if (!hook.includes('gamePromptSeenThisStreamRef') || !/case 'done':[\s\S]{0,500}gamePromptSeenThisStreamRef\.current[\s\S]{0,180}setGamePrompt\(null\)/.test(hook)) {
  failures.push('useZiddSession must clear stale game/card prompts on done when the stream emitted no game_prompt frame.');
}

const restoredMessagesBlock = hook.match(/if\s*\(restoredMessages\.length > 0\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
if (restoredMessagesBlock.includes('shouldStreamOpening = false')) {
  failures.push('Restored transcript messages alone must not suppress GET /opening; only opening_streamed, terminal state, pending transition, or active game prompt may do that.');
}

if (!hook.includes('previousGamePrompt') || !hook.includes('setGamePrompt(previousGamePrompt)')) {
  failures.push('streamTurn must restore the active game/card prompt when startup fails before the stream opens.');
}

if (!hook.includes('pendingGamePromptFrameRef')) {
  failures.push('useZiddSession must stage new game/card prompts until the terminal done frame releases the stream lock.');
}

if (/case 'game_prompt':[\s\S]{0,180}setGamePrompt\(data as GamePromptFrame\)/.test(hook)) {
  failures.push('useZiddSession must not render a new game/card prompt directly from the game_prompt SSE frame while isStreaming is still true.');
}

if (!/case 'game_prompt':[\s\S]{0,420}pendingGamePromptFrameRef\.current = data as GamePromptFrame/.test(hook)) {
  failures.push('useZiddSession must store game_prompt frames in pendingGamePromptFrameRef before rendering them.');
}

if (!/case 'done':[\s\S]{0,520}setGamePrompt\(pendingGamePromptFrameRef\.current\)/.test(hook)) {
  failures.push('useZiddSession must render staged game/card prompts from the terminal done handler.');
}

if (!/onComplete: \(\{ doneSeen \}\)[\s\S]{0,1600}if \(!doneSeen\)[\s\S]{0,120}pendingGamePromptFrameRef\.current = null/.test(hook)) {
  failures.push('useZiddSession must discard staged game/card prompts when a stream closes without a done frame.');
}

if (!sseClient.includes('idleTimedOut')) {
  failures.push('ZiddSSEClient must distinguish idle timeout aborts from intentional manual disconnects.');
}

if (!sseClient.includes('startupTimedOut') || !sseClient.includes('DEFAULT_STARTUP_TIMEOUT_MS')) {
  failures.push('ZiddSSEClient must enforce a startup timeout before the backend has opened the SSE response.');
}

if (!/startupTimer = setTimeout[\s\S]{0,220}SSE stream startup timeout/.test(sseClient)) {
  failures.push('ZiddSSEClient must abort pre-open SSE requests that exceed the startup timeout.');
}

if (!/if \(startupTimedOut\)[\s\S]{0,140}this\.onError\(new Error\('SSE stream startup timeout'\)\)[\s\S]{0,120}this\.onComplete\(\{ doneSeen \}\)/.test(sseClient)) {
  failures.push('ZiddSSEClient startup timeout aborts must surface an error and call onComplete so UI streaming locks release.');
}

if (!/if \(idleTimedOut\)[\s\S]{0,140}this\.onError\(new Error\('SSE stream idle timeout'\)\)[\s\S]{0,120}this\.onComplete\(\{ doneSeen \}\)/.test(sseClient)) {
  failures.push('ZiddSSEClient idle timeout aborts must surface an error and call onComplete so UI streaming locks release.');
}

if (!hook.includes('The tutor took too long to start') || !hook.includes('The tutor is still working. Reopen this session in a moment if the answer does not appear.')) {
  failures.push('useZiddSession must map startup and slow-backend idle timeouts to learner-safe retry copy.');
}

if (!hook.includes('OPENING_RECOVERY_POLL_ATTEMPTS') || !hook.includes('recoverOpeningFromTranscript')) {
  failures.push('useZiddSession must poll transcript recovery when a duplicate opening stream is already in progress.');
}

if (!hook.includes("err.code === 'opening_in_progress'")) {
  failures.push('useZiddSession must classify opening_in_progress as a recoverable opening bootstrap state.');
}

if (!/const result = await streamTurn\(\)[\s\S]{0,260}recoverOpeningFromTranscript/.test(hook)) {
  failures.push('useZiddSession bootstrap must recover from a rejected duplicate opening by rehydrating the committed transcript.');
}

if (
  !sessionPage.includes('slowStream') ||
  !sessionPage.includes('Setting up your prompt...') ||
  !sessionPage.includes('Reviewing your answer...') ||
  !sessionPage.includes('aria-live="polite"')
) {
  failures.push('Session page must surface a delayed still-working state for long tutor streams.');
}

if (!hook.includes('state?.input_allowed === false') || !hook.includes('Boolean(state?.block_reason)')) {
  failures.push('streamTurn must reject learner answers when backend input_allowed is false or block_reason is set.');
}

if (!sessionPage.includes('state?.input_allowed === false') || !sessionPage.includes('Boolean(state?.block_reason)')) {
  failures.push('Session page must disable answer controls when backend input_allowed is false or block_reason is set.');
}

if (!sessionPage.includes('useId') || !sessionPage.includes('id={answerInputId}') || !sessionPage.includes('name="tutor-response"')) {
  failures.push('Session page tutor response input must have stable id/name attributes for reliable browser input handling.');
}

if (!fillBlankCard.includes('useId') || !fillBlankCard.includes('id={inputId}') || !fillBlankCard.includes('name="bridge-fill-blank-answer"')) {
  failures.push('FillInTheBlankCard input must have stable id/name attributes for browser and accessibility reliability.');
}

if (!spokenAnswerCard.includes('useId') || !spokenAnswerCard.includes('id={textareaId}') || !spokenAnswerCard.includes('name="bridge-spoken-answer"')) {
  failures.push('SpokenAnswerCard textarea must have stable id/name attributes for browser and accessibility reliability.');
}

if (!sessionPage.includes('onInput={e => setInputValue(e.currentTarget.value)}')) {
  failures.push('Session page tutor response input must listen to onInput as well as onChange.');
}

const inputBlockedBlock = sessionPage.match(/const inputBlocked = ([\s\S]*?);/)?.[1] ?? '';
for (const token of ['openingRetryActive', 'isBootstrapping', 'Boolean(pendingTransition)', 'state?.input_allowed === false', 'Boolean(state?.block_reason)']) {
  if (!inputBlockedBlock.includes(token)) {
    failures.push(`Session page inputBlocked must include ${token}.`);
  }
}

if (!sessionPage.includes('(isBootstrapping || isStreaming)')) {
  failures.push('Session page must show restore skeleton while bootstrapping.');
}

if (!sessionPage.includes("shellNodeTitle") || !sessionPage.includes("'Loading session'")) {
  failures.push('Session shell must render an honest loading title during bootstrap instead of Skill Module.');
}

if (!sessionPage.includes("shellPhase") || !sessionPage.includes("'Restoring your path'")) {
  failures.push('Session shell must render an honest loading phase during bootstrap instead of Learning Path.');
}

if (!types.includes('opening_streamed?: boolean')) {
  failures.push('DoneFrame must carry opening_streamed so the session page can block answers after an opening failure.');
}

if (!hook.includes('opening_streamed: data.opening_streamed ?? data.state.opening_streamed')) {
  failures.push('useZiddSession must copy transcript opening_streamed into state during bootstrap.');
}

for (const token of ['hasAssistantReplyAfterLatestUser', 'recoverTurnLockFromTranscript', "blockReason === 'turn_processing'", 'activeTurn: releaseStaleTurnLock ? null : activeTurn']) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession must release stale turn_processing locks after transcript recovery; missing ${token}.`);
  }
}

for (const token of ['dedupeAdjacentDuplicateMessages', 'dedupeAdjacentDuplicateMessages(finalizeOpen', "setError(prev => (prev === TRANSIENT_PROCESSING_MESSAGE ? null : prev))"]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession must prevent duplicate recovered assistant bubbles and stale processing banners; missing ${token}.`);
  }
}

if (!/if \(!doneSeen\)[\s\S]{0,260}if \(opened && expectedUserTurn\)[\s\S]{0,180}recovered = await restoreTranscriptSnapshot\(/.test(hook)) {
  failures.push('useZiddSession must only reconcile opened stream closes against the persisted transcript when the stream ended without a done frame.');
}

if (!/onEvent: \(eventName, data\) => \{[\s\S]{0,220}eventName !== 'accepted'[\s\S]{0,80}eventName !== 'heartbeat'[\s\S]{0,160}clearTimeout\(recoveryTimer\)/.test(hook)) {
  failures.push('useZiddSession must cancel transcript recovery polling as soon as real SSE content arrives.');
}

for (const token of [
  'activeStreamTokenRef',
  'const streamToken = crypto.randomUUID()',
  'const isActiveStream = () => activeStreamTokenRef.current === streamToken',
  'if (!isActiveStream()) return;',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession must invalidate recovered/disconnected SSE streams before late callbacks can duplicate transcript messages; missing ${token}.`);
  }
}

if (!/const res = await fetch\([\s\S]{0,180}if \(shouldApply && !shouldApply\(\)\)[\s\S]{0,180}if \(res\.status === 404 \|\| res\.status === 410\)/.test(hook)) {
  failures.push('useZiddSession transcript recovery must verify ownership before a stale 404/410 response can mutate not-found state.');
}

if (!/const recovered = await restoreTranscriptSnapshot\([\s\S]{0,520}activeStreamTokenRef\.current = null[\s\S]{0,180}streamInFlightRef\.current = false/.test(hook)) {
  failures.push('useZiddSession transcript recovery must invalidate the active stream token before releasing the stream lock.');
}

if (!/if \(expectedUserTurn\) \{[\s\S]{0,120}scheduleRecoveryPoll\(SESSION_STREAM_RECOVERY_FIRST_POLL_MS\)/.test(hook)) {
  failures.push('useZiddSession must only run in-stream transcript recovery polling for learner turns with an expected user turn, not opening streams.');
}

for (const token of [
  'SESSION_STREAM_MAX_DURATION_MS',
  'maxDurationTimer',
  'const scheduleMaxDurationBackstop',
  'restoreTranscriptSnapshot(',
  'The tutor is still working. Reopen this session in a moment if the answer does not appear.',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession learner turns need a heartbeat-independent max-duration backstop; missing ${token}.`);
  }
}

if (!/maxDurationTimer\s*=\s*setTimeout\([\s\S]{0,1200}clientRef\.current\?\.disconnect\(\)[\s\S]{0,260}streamInFlightRef\.current = false[\s\S]{0,220}setIsStreaming\(false\)/.test(hook)) {
  failures.push('useZiddSession max-duration backstop must disconnect the still-open SSE stream and release the Reviewing lock.');
}

if (!/recovered = await restoreTranscriptSnapshot\([\s\S]{0,620}if \(settled \|\| !isActiveStream\(\)\) return;[\s\S]{0,420}clientRef\.current\?\.disconnect\(\)/.test(hook)) {
  failures.push('useZiddSession max-duration backstop must re-check settled/isActiveStream after transcript recovery before disconnecting or setting an error.');
}

if (!/if \(opened && expectedUserTurn\) \{[\s\S]{0,180}recovered = await restoreTranscriptSnapshot\(/.test(hook)) {
  failures.push('useZiddSession onComplete must only restore transcript snapshots for no-done learner turns; opening streams must fall back to bootstrap opening recovery.');
}

if (!/onError: (?:async )?\(err\) => \{[\s\S]*?if \(!opened\) \{[\s\S]{0,140}activeStreamTokenRef\.current = null[\s\S]{0,180}settle\(\{ started: false, completed: false \}\)/.test(hook)) {
  failures.push('useZiddSession opened stream errors must leave the active stream token for onComplete to settle; only unopened errors may invalidate and settle immediately.');
}

if (/onError: (?:async )?\(err\) => \{[\s\S]{0,180}activeStreamTokenRef\.current = null[\s\S]{0,260}if \(!opened\)/.test(hook)) {
  failures.push('useZiddSession must not clear activeStreamTokenRef before onComplete can settle an opened timeout/error stream.');
}

for (const token of [
  'ExpectedUserTurn',
  'findCurrentUserTurnIndex',
  'assistantAfterCurrentUserTurn',
  'if (expectedUserTurn && currentUserTurnIndex < 0)',
  'return { foundExpectedTurn: false, completed: false }',
  'restoreTranscriptSnapshot(',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession transcript recovery must prove the current learner turn and assistant reply are persisted before replacing a live stream; missing ${token}.`);
  }
}

if (!hook.includes('hasCompletedTurnOutcomeAfterExpectedUser')) {
  failures.push('useZiddSession transcript recovery must accept completed non-text turn outcomes such as node_advance/pending_transition.');
}

if (!hook.includes('restoreTranscriptSnapshotOutcome')) {
  failures.push('useZiddSession must expose a transcript recovery outcome so rejected duplicate turn starts can distinguish completed vs still-processing turns.');
}

if (!/err\.code === 'turn_version_consumed'[\s\S]{0,360}restoreTranscriptSnapshotOutcome\(/.test(hook)) {
  failures.push('useZiddSession must reconcile turn_version_consumed startup rejections against the transcript before showing retry-loop copy.');
}

if (!/err\.code === 'turn_version_consumed' \|\| err\.code === 'turn_in_progress'/.test(hook)) {
  failures.push('useZiddSession must reconcile an exact-id turn_in_progress replay through the same persisted-transcript recovery path.');
}

if (!/restoreTranscriptSnapshotOutcome\([\s\S]{0,760}settle\(\{ started: true, completed: true \}\)/.test(hook)) {
  failures.push('useZiddSession must settle completed duplicate-turn recovery when the accepted turn already produced a visible outcome.');
}

if (!/if \(outcome\.foundExpectedTurn\)[\s\S]{0,520}scheduleRecoveryPoll\(SESSION_STREAM_RECOVERY_POLL_DELAY_MS\)[\s\S]{0,120}return;/.test(hook)) {
  failures.push('useZiddSession must keep polling a persisted duplicate learner turn until its tutor outcome appears.');
}

if (/if \(outcome\.foundExpectedTurn\)[\s\S]{0,520}settle\(\{ started: true, completed: false \}\)/.test(hook)) {
  failures.push('useZiddSession must not settle a still-processing duplicate turn before transcript recovery completes.');
}

if (!/onComplete: \(\{ doneSeen \}\)[\s\S]{0,520}restoreTranscriptSnapshot\([\s\S]{0,260}activeSessionIdRef\.current === sessionId[\s\S]{0,420}if \(!isActiveStream\(\) \|\| activeSessionIdRef\.current !== sessionId\) return;/.test(hook)) {
  failures.push('useZiddSession EOF recovery must prove the same session and active stream still own the hook before applying a transcript snapshot.');
}

if (!/restoreTranscriptSnapshotOutcome\([\s\S]{0,260}activeSessionIdRef\.current === sessionId[\s\S]{0,220}if \(!isActiveStream\(\) \|\| activeSessionIdRef\.current !== sessionId\) return;/.test(hook)) {
  failures.push('useZiddSession duplicate-turn recovery must not apply or act on a transcript snapshot after the hook navigates to another session.');
}

if (!/contentFallbackIndex[\s\S]{0,120}= \[\.\.\.messages\]\.reverse\(\)\.findIndex/.test(hook)) {
  failures.push('useZiddSession must recover duplicate starts whose retry generated a fresh client_turn_id by matching the latest same-content learner turn.');
}

if (hook.includes('if (expectedUserTurn && !assistantAfterCurrentUserTurn) return false;')) {
  failures.push('useZiddSession must not require an assistant bubble for completed prep advancement turns; node_advance/pending_transition can be the visible outcome.');
}

if (hook.includes('Boolean(data.game_prompt)')) {
  failures.push('useZiddSession must not treat an unscoped prior game card as proof that the current learner turn completed.');
}

for (const token of [
  'Boolean(pending)',
  'data.game_prompt?.turn_id === currentUserTurnId',
  'Boolean(data.state?.module_done)',
  'Boolean(data.state?.session_over)',
  "data.state?.status === 'ended'",
  'Boolean(data.state?.simulation_report)',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession completed-turn recovery must recognize ${token} as a terminal visible outcome.`);
  }
}

for (const token of [
  'streamEventRevisionRef',
  'const recoveryRevision = streamEventRevisionRef.current',
  'streamEventRevisionRef.current === recoveryRevision',
  'if (shouldApply && !shouldApply())',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession live transcript recovery must not overwrite newer SSE events; missing ${token}.`);
  }
}

if (!sessionPage.includes('openingRetryActive')) {
  failures.push('Session page must detect opening failure and render an explicit retry-opening state.');
}

if (!sessionPage.includes('handleRetryOpening') || !sessionPage.includes('await streamTurn()')) {
  failures.push('Session page must retry the opening stream without sending a learner answer.');
}

if (!sessionPage.includes('pendingGameTurnIdRef')) {
  failures.push('Game/card submissions must preserve a stable client_turn_id across startup failures.');
}

if (!sessionPage.includes('streamTurn(answer, clientTurnId)')) {
  failures.push('Game/card submissions must pass a stable client_turn_id into streamTurn.');
}

if (!sessionPage.includes('pendingGameTurnIdRef.current = null')) {
  failures.push('Game/card submissions must clear their stable client_turn_id after accepted startup.');
}

if (!mapPage.includes('failedStartRef')) {
  failures.push('Map page must keep a failed start retry ref so start timeouts can replay the same idempotent request.');
}

if (!mapPage.includes('retryFailedStart')) {
  failures.push('Map page Retry must retry the failed session start, not only reload progression.');
}

if (!mapPage.includes("onClick={error && error !== 'progression_unavailable' ? retryFailedStart")) {
  failures.push('Map page Retry button must route non-progression errors to retryFailedStart.');
}

const mapStartNodeBody = mapPage.match(/const startNode = async \([\s\S]*?\n  \};/)?.[0] ?? '';
if (!/if \(result\.ok\)[\s\S]{0,600}badgeRef\.current\?\.refresh\(\)/.test(mapStartNodeBody)) {
  failures.push('Map successful session starts must refresh the visible credit balance before routing.');
}

if (!hook.includes('throw new Error(`transcript_restore_failed:${res.status}`)')) {
  failures.push('Transcript bootstrap must treat non-OK transcript responses as restore failures.');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
