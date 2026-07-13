#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const hook = readFileSync('src/hooks/useZiddSession.ts', 'utf8');
const sseClient = readFileSync('src/services/sseClient.ts', 'utf8');
const sessionPage = readFileSync('src/app/session/[id]/page.tsx', 'utf8');
const sessionStreamPresentation = readFileSync('src/lib/sessionStreamPresentation.mjs', 'utf8');
const mapPage = readFileSync('src/app/(gamified)/map/page.tsx', 'utf8');
const fillBlankCard = readFileSync('src/components/cards/FillInTheBlankCard.tsx', 'utf8');
const spokenAnswerCard = readFileSync('src/components/cards/SpokenAnswerCard.tsx', 'utf8');
const types = readFileSync('src/types/index.ts', 'utf8');

const failures = [];
const bootstrapBody = hook.match(/const bootstrap = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? '';
const disconnectBody = hook.match(/const disconnect = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? '';
const sessionResetBody = hook.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*sessionId[^\]]*\]\);/)?.[0] ?? '';
const restoredProcessingRecoveryBody = hook.match(/const recoverRestoredProcessingTurn = async[\s\S]*?\n    \};/)?.[0] ?? '';
const openingRecoveryBody = hook.match(/const recoverOpeningFromTranscript = async[\s\S]*?\n    \};/)?.[0] ?? '';
const fetchTranscriptSnapshotBody = hook.match(/const fetchTranscriptSnapshot = async[\s\S]*?\n    \};/)?.[0] ?? '';
const restoreTranscriptOutcomeBody = hook.match(/const restoreTranscriptSnapshotOutcome = useCallback[\s\S]*?\n  \}, \[[^\]]*\]\);/)?.[0] ?? '';
const recoverTurnLockBody = hook.match(/function recoverTurnLockFromTranscript[\s\S]*?\n\}/)?.[0] ?? '';
const boundedTranscriptRequestBody = hook.match(/const runBoundedTranscriptRequest = useCallback[\s\S]*?\n  \}, \[\]\);/)?.[0] ?? '';

if (!hook.includes('streamInFlightRef')) {
  failures.push('useZiddSession must use a synchronous streamInFlightRef latch.');
}

if (!disconnectBody.includes('bootstrappedSessionRef.current = null')) {
  failures.push('disconnect must release the bootstrap ownership key so React StrictMode remount can restore a completed opening.');
}

if (!hook.includes('activeStreamSettleRef') || !disconnectBody.includes('activeStreamSettleRef.current?.({ started: false, completed: false })')) {
  failures.push('disconnect must settle the active stream promise so StrictMode cleanup cannot leave PREPARING stuck.');
}

if (!hook.includes('openingSnapshotComplete')) {
  failures.push('opening stream recovery must require durable opening evidence before releasing PREPARING.');
}

if (!hook.includes('durableTurnCompleted')) {
  failures.push('turn recovery must accept the backend authoritative completed client-turn id.');
}

if (!hook.includes('durableTurnSettled') || !/lastTurn\?\.client_turn_id === expectedClientTurnId/.test(hook)) {
  failures.push('restored turn recovery must settle only the exact observed client_turn_id.');
}

if (!/lastTurn\?\.status === 'completed'[\s\S]{0,120}lastTurn\?\.status === 'failed'/.test(hook)) {
  failures.push('restored turn recovery must stop polling when the matching turn completes or fails.');
}

if (!recoverTurnLockBody.includes('durableTurnSettled(data.state?.last_turn, activeTurn.client_turn_id)')) {
  failures.push('a stale turn_processing lock must not be released by a completed last_turn with a different client id.');
}

for (const token of [
  'const bootstrapGenerationRef = useRef(0)',
  'const bootstrapGeneration = ++bootstrapGenerationRef.current',
  'const ownsBootstrap = () =>',
]) {
  if (!hook.includes(token)) {
    failures.push(`session bootstrap needs generation-scoped ownership; missing ${token}.`);
  }
}

if (!sessionResetBody.includes('bootstrapGenerationRef.current += 1')) {
  failures.push('session changes must invalidate outstanding bootstrap and reload-recovery responses.');
}

if (!disconnectBody.includes('bootstrapGenerationRef.current += 1')) {
  failures.push('disconnect must invalidate outstanding bootstrap and reload-recovery responses.');
}

if (!sessionResetBody.includes('abortTranscriptRequests()')) {
  failures.push('session changes must abort outstanding bootstrap and transcript-recovery requests.');
}

if (!disconnectBody.includes('abortTranscriptRequests()')) {
  failures.push('disconnect cleanup must abort outstanding bootstrap and transcript-recovery requests.');
}

if (
  disconnectBody.indexOf('activeStreamTokenRef.current = null') < 0 ||
  disconnectBody.indexOf('activeStreamTokenRef.current = null') > disconnectBody.indexOf('if (clientRef.current)')
) {
  failures.push('disconnect must invalidate pending stream ownership even before an SSE client has been registered.');
}

for (const token of [
  'new AbortController()',
  'deadlineMs - Date.now()',
  'transcriptRequestControllersRef.current.add(controller)',
  'controller.abort(',
  'awaitWithAbort(request(controller.signal), controller.signal)',
  'transcriptRequestControllersRef.current.delete(controller)',
]) {
  if (!boundedTranscriptRequestBody.includes(token)) {
    failures.push(`transcript requests must enforce and clean up a real abortable deadline; missing ${token}.`);
  }
}

const boundedBootstrapIndex = fetchTranscriptSnapshotBody.indexOf('runBoundedTranscriptRequest(deadlineMs, async (signal)');
const bootstrapAuthIndex = fetchTranscriptSnapshotBody.indexOf('await getAuthHeaders()', boundedBootstrapIndex);
const bootstrapFetchIndex = fetchTranscriptSnapshotBody.indexOf('await fetch(', bootstrapAuthIndex);
const bootstrapBodyReadIndex = fetchTranscriptSnapshotBody.indexOf('await response.json()', bootstrapFetchIndex);
if (
  boundedBootstrapIndex < 0 ||
  bootstrapAuthIndex <= boundedBootstrapIndex ||
  bootstrapFetchIndex <= bootstrapAuthIndex ||
  !fetchTranscriptSnapshotBody.slice(bootstrapFetchIndex, bootstrapBodyReadIndex).includes('signal') ||
  bootstrapBodyReadIndex <= bootstrapFetchIndex
) {
  failures.push('bootstrap transcript auth, fetch, and body parsing must all run inside the same abortable request deadline.');
}

if (!/recoverOpeningFromTranscript = async \(recoveryDeadline: number\)[\s\S]{0,220}Date\.now\(\) < recoveryDeadline[\s\S]{0,300}Math\.min\(OPENING_RECOVERY_POLL_DELAY_MS, remainingMs\)[\s\S]{0,320}fetchTranscriptSnapshot\(recoveryDeadline\)/.test(openingRecoveryBody)) {
  failures.push('opening recovery must cap delays and each transcript request to its remaining outer deadline.');
}

if (!/restoreTranscriptSnapshotOutcome\([\s\S]{0,220}true,[\s\S]{0,80}requestDeadlineMs/.test(restoredProcessingRecoveryBody)) {
  failures.push('restored processing recovery must pass its remaining outer deadline into each transcript request.');
}

if (
  !fetchTranscriptSnapshotBody.includes('if (!ownsBootstrap()) throw abortError()') ||
  fetchTranscriptSnapshotBody.indexOf('if (!ownsBootstrap()) return null', boundedBootstrapIndex) < 0 ||
  fetchTranscriptSnapshotBody.indexOf('if (!ownsBootstrap()) return null', boundedBootstrapIndex) > fetchTranscriptSnapshotBody.indexOf('res.status === 404')
) {
  failures.push('bootstrap transcript fetches must verify generation ownership before stale responses mutate state.');
}

if (!/finally \{[\s\S]{0,100}if \(ownsBootstrap\(\)\) \{[\s\S]{0,80}setIsBootstrapping\(false\)/.test(bootstrapBody)) {
  failures.push('only the current bootstrap generation may release the bootstrapping state.');
}

for (const token of [
  'observedClientTurnId',
  'runLateTurnRecovery',
  'SESSION_STREAM_LATE_RECOVERY_POLL_DELAY_MS',
  'SESSION_STREAM_LATE_RECOVERY_MAX_POLLS',
  'SESSION_STREAM_LATE_RECOVERY_DURATION_MS',
  "restoreTranscriptSnapshotOutcome(\n            { clientTurnId: expectedClientTurnId, userInput: '' },\n            ownsRestoredRecovery,\n            true",
]) {
  if (!restoredProcessingRecoveryBody.includes(token)) {
    failures.push(`reload recovery must bounded-poll the observed processing turn through restoreTranscriptSnapshotOutcome; missing ${token}.`);
  }
}

if (!/requireDurableSettlement[\s\S]{0,120}!durableExpectedTurnCompleted[\s\S]{0,80}!durableExpectedTurnFailed[\s\S]{0,180}return \{ foundExpectedTurn:[\s\S]{0,100}completed: false, failed: false \}/.test(hook)) {
  failures.push('strict reload recovery must not apply or complete a snapshot until the observed client id is durably completed/failed.');
}

if (!/activeTurn\?\.status === 'processing'[\s\S]{0,180}blockReason === 'turn_processing'[\s\S]{0,180}activeTurn\.client_turn_id/.test(bootstrapBody)) {
  failures.push('bootstrap must capture the processing active_turn client id before starting reload recovery.');
}

if (!/const observedClientTurnId[\s\S]{0,260}!durableTurnSettled\(data\.state\?\.last_turn, activeTurn\.client_turn_id\)/.test(bootstrapBody)) {
  failures.push('bootstrap must not poll when the initial snapshot already settles the exact observed turn.');
}

if (!/if \(snapshot\.observedClientTurnId\) \{[\s\S]{0,100}void recoverRestoredProcessingTurn\(snapshot\.observedClientTurnId\);[\s\S]{0,40}return;/.test(bootstrapBody)) {
  failures.push('restored-turn polling must run in the background so bootstrap can release the loading screen immediately.');
}

if (!restoredProcessingRecoveryBody.includes('runLateTurnRecovery')) {
  failures.push('a processing learner turn restored after reload must use the bounded six-minute durable recovery loop.');
}
if (!restoredProcessingRecoveryBody.includes('SESSION_STREAM_LATE_RECOVERY_DURATION_MS') || !restoredProcessingRecoveryBody.includes('SESSION_STREAM_LATE_RECOVERY_MAX_POLLS')) {
  failures.push('reload recovery must use the same finite late-recovery duration and poll budget as an accepted live turn.');
}
if (!restoredProcessingRecoveryBody.includes('setIsRecoveringTurn(true)') || !restoredProcessingRecoveryBody.includes('setIsRecoveringTurn(false)')) {
  failures.push('reload recovery must visibly acquire and release the public recovery state.');
}

if (/await recoverRestoredProcessingTurn\(snapshot\.observedClientTurnId\)/.test(bootstrapBody)) {
  failures.push('bootstrap must not await the bounded restored-turn poll and deadlock the loading presentation.');
}

if (!/scheduleRecoveryPoll\(SESSION_STREAM_RECOVERY_FIRST_POLL_MS\)[\s\S]{0,120}scheduleMaxDurationBackstop\(\)/.test(hook)) {
  failures.push('opening and learner-turn streams must both schedule bounded transcript recovery.');
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
if (!types.includes('handoff_source_node?: string | null')) {
  failures.push('DoneFrame must carry the persisted handoff source node for authenticated transcript review.');
}

if (
  !sessionPage.includes("const requestedReviewMode = searchParams.get('review') === '1'")
  || !sessionPage.includes("const requestedReviewNode = searchParams.get('node') || ''")
  || !sessionPage.includes("const persistedReviewNode = state?.handoff_source_node || state?.competency_node || ''")
  || !sessionPage.includes("&& (state?.status === 'ended' || state?.session_over)")
  || !sessionPage.includes('&& requestedReviewNode === persistedReviewNode')
  || !sessionPage.includes('!reviewMode && state?.handoff_session_id')
  || !sessionPage.includes('router.replace(`/session/${state.handoff_session_id}`)')
) {
  failures.push('Session page must redirect consumed source sessions except when an explicit history review link is opened.');
}

for (const token of [
  "reviewMode && reviewNode ? labelSkillId(reviewNode) : shellNodeTitle",
  "phase={reviewMode ? 'Saved practice' : shellPhase}",
  "statusLabel={reviewMode ? 'Review' : tutorStatusLabel}",
  'showProgress={!reviewMode}',
]) {
  if (!sessionPage.includes(token)) {
    failures.push(`Historical transcript review must use a read-only presentation with ${token}.`);
  }
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

if (!sessionPage.includes('const checkpointReached = Boolean(nodeAdvance || pendingTransition)')) {
  failures.push('Session page must derive one authoritative checkpoint-complete presentation state.');
}

if (!/isStreaming && !checkpointReached/.test(sessionPage) || !/error && !checkpointReached/.test(sessionPage)) {
  failures.push('Checkpoint UI must suppress stale processing skeletons and transient turn errors.');
}

if (!sessionPage.includes('}, [id]);')) {
  failures.push('Session page bootstrap effect must rerun when the dynamic session id changes.');
}

const startNextSkillBody = sessionPage.match(/const handleStartNextSkill = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
const checkpointStartBody = sessionPage.match(/const startCheckpointAction = async \([\s\S]*?\n  \};/)?.[0] ?? '';
if (!sessionPage.includes('pageRequestGenerationRef')) {
  failures.push('checkpoint starts need page-generation ownership so stale async results cannot redirect a later session.');
}

if (
  !checkpointStartBody.includes('const checkpointRequestGeneration = pageRequestGenerationRef.current') ||
  !checkpointStartBody.includes('pageRequestGenerationRef.current === checkpointRequestGeneration')
) {
  failures.push('checkpoint starts must capture and verify the current page generation.');
}

if (!/await startSessionWithPaywall\([\s\S]{0,700}if \(!ownsCheckpointRequest\(\)\) return;/.test(checkpointStartBody)) {
  failures.push('checkpoint starts must reject stale successful results before navigation or state mutation.');
}

if (!/catch \(err\) \{[\s\S]{0,120}if \(!ownsCheckpointRequest\(\)\) return;/.test(checkpointStartBody)) {
  failures.push('checkpoint starts must reject stale errors before mutating the current page.');
}
if (startNextSkillBody.includes('streamTurn(')) {
  failures.push('Start Next Skill must not stream the next opening inside the old session.');
}

if (!startNextSkillBody.includes("startCheckpointAction('next', false)")) {
  failures.push('Start Next Skill first click must delegate to the unconfirmed checkpoint start action.');
}

if (checkpointStartBody.includes('confirm: true')) {
  failures.push('Start Next Skill first click must not silently confirm paid credit spend.');
}

if (!checkpointStartBody.includes('confirm,')) {
  failures.push('Start Next Skill first click must request paywall state with confirm: false.');
}

if (!checkpointStartBody.includes('isBootstrapping')) {
  failures.push('Start Next Skill must be blocked while the session is bootstrapping.');
}

const confirmNextSkillBody = sessionPage.match(/const handleConfirmNextSkill = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
if (
  !/startCheckpointAction\(\s*checkpointStartAction,\s*true,\s*checkpointReattemptConfirmed \|\| checkpointStartAction === 'practice',\s*\)/.test(confirmNextSkillBody)
) {
  failures.push('Paywall confirmation must retry Start Next Skill with confirm: true.');
}

if (!checkpointStartBody.includes('source_session_id: id') || !checkpointStartBody.includes('source_transition_id: transitionId')) {
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

if (!sessionPage.includes('const visibleProgress = isProfessional')) {
  failures.push('Session shell must choose the visible progress metric by learning mode.');
}

if (
  !sessionPage.includes('const transitionMastery = pendingTransition?.from_mastery ?? latestProgressMastery')
  || !sessionPage.includes(': (transitionActive ? transitionMastery : latestProgressMastery)')
) {
  failures.push('Gamified session progress must use persisted mastery instead of synthesizing readiness as mastery.');
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

if (!/if \(result\.started\)[\s\S]{0,100}pendingClientTurnIdRef\.current = null/.test(handleSendBody)) {
  failures.push('Chat submit must clear its client_turn_id as soon as the backend accepts it, including when late recovery resolves before completion.');
}

if (
  !handleSendBody.includes('const sendRequestGeneration = pageRequestGenerationRef.current') ||
  !handleSendBody.includes('pageRequestGenerationRef.current === sendRequestGeneration') ||
  !/await streamTurn\(draft, clientTurnId\)[\s\S]{0,100}if \(!ownsSendRequest\(\)\) return;/.test(handleSendBody)
) {
  failures.push('chat submission continuations must prove page-generation ownership before restoring drafts or mutating submission state.');
}

const handleGameSubmitBody = sessionPage.match(/const handleGameSubmit = async \(answer: string\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
if (!/if \(result\.started\)[\s\S]{0,100}pendingGameTurnIdRef\.current = null/.test(handleGameSubmitBody)) {
  failures.push('Game submit must clear its client_turn_id as soon as the backend accepts it, including when late recovery resolves before completion.');
}

if (
  !handleGameSubmitBody.includes('const gameRequestGeneration = pageRequestGenerationRef.current') ||
  !handleGameSubmitBody.includes('pageRequestGenerationRef.current === gameRequestGeneration') ||
  !/await streamTurn\(answer, clientTurnId\)[\s\S]{0,100}if \(!ownsGameRequest\(\)\) return false;/.test(handleGameSubmitBody)
) {
  failures.push('game submission continuations must prove page-generation ownership before mutating the current session.');
}

if (!/restoredGamePrompt\?\.turn_id[\s\S]{0,180}m\.turn_id === restoredGamePrompt\.turn_id/.test(hook)) {
  failures.push('active game-prompt echo filtering must match the exact turn_id so repeated historical prompts remain visible on reload.');
}

const streamTurnBody = hook.match(/const streamTurn = useCallback\(async \([\s\S]*?\): Promise<StreamTurnResult> => \{[\s\S]*?\n  \}, \[/)?.[0] ?? '';
if (!/if \(userInput\)[\s\S]{0,260}setMessages\(prev => \[\s*\.\.\.prev,[\s\S]{0,120}content: userInput/.test(streamTurnBody)) {
  failures.push('streamTurn must append the learner answer optimistically before SSE startup.');
}

if (!/setMessages\(prev => \[[\s\S]{0,220}content: userInput[\s\S]{0,900}const headers = await getAuthHeaders\(\)/.test(streamTurnBody)) {
  failures.push('streamTurn must show the learner answer before awaiting auth headers or SSE open.');
}

const authAwaitIndex = streamTurnBody.indexOf('const headers = await getAuthHeaders()');
const postAuthOwnershipIndex = streamTurnBody.indexOf(
  'if (!isActiveStream() || activeSessionIdRef.current !== sessionId)',
  authAwaitIndex
);
const settleRegistrationIndex = streamTurnBody.indexOf('const completion = new Promise<StreamTurnResult>', authAwaitIndex);
const clientRegistrationIndex = streamTurnBody.indexOf('const client = new ZiddSSEClient', authAwaitIndex);
if (
  authAwaitIndex < 0 ||
  postAuthOwnershipIndex <= authAwaitIndex ||
  !/if \(!isActiveStream\(\) \|\| activeSessionIdRef\.current !== sessionId\) \{\s*return \{ started: false, completed: false \};\s*\}/.test(
    streamTurnBody.slice(authAwaitIndex, settleRegistrationIndex)
  ) ||
  settleRegistrationIndex <= postAuthOwnershipIndex ||
  clientRegistrationIndex <= postAuthOwnershipIndex
) {
  failures.push('streamTurn must re-check stream-token and session ownership immediately after auth, before registering settle callbacks or an SSE client.');
}

if (hook.includes('fall through to the opening')) {
  failures.push('Transcript restore failures must not fall through to GET /opening.');
}

if (!hook.includes('Could not restore this session') || !/catch \{[\s\S]{0,180}Could not restore this session[\s\S]{0,180}finally \{/.test(bootstrapBody)) {
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

if (!/let opened = false[\s\S]{0,4000}opened = true;[\s\S]{0,80}this\.onOpen\(\)/.test(sseClient)) {
  failures.push('ZiddSSEClient must track whether the HTTP stream opened before handling reader failures.');
}

if (!/else if \(err\.name !== 'AbortError'\) \{[\s\S]{0,100}this\.onError\(err\);[\s\S]{0,100}if \(opened\) \{[\s\S]{0,80}this\.onComplete\(\{ doneSeen \}\)/.test(sseClient)) {
  failures.push('ZiddSSEClient generic post-open failures must call onComplete after onError without completing pre-open HTTP failures.');
}

if (!hook.includes('The tutor took too long to start') || !hook.includes('The tutor is still working. Reopen this session in a moment if the answer does not appear.')) {
  failures.push('useZiddSession must map startup and slow-backend idle timeouts to learner-safe retry copy.');
}

if (!hook.includes('OPENING_RECOVERY_POLL_ATTEMPTS') || !hook.includes('recoverOpeningFromTranscript')) {
  failures.push('useZiddSession must poll transcript recovery when a duplicate opening stream is already in progress.');
}

if (!/try \{[\s\S]{0,240}fetchTranscriptSnapshot\(recoveryDeadline\)[\s\S]{0,360}catch \{[\s\S]{0,80}continue;/.test(openingRecoveryBody)) {
  failures.push('opening transcript recovery must continue after an individual transient poll failure.');
}

if (!/finally \{[\s\S]{0,100}setIsBootstrapping\(false\)/.test(bootstrapBody)) {
  failures.push('session bootstrap must release PREPARING in a finally block on every exit path.');
}

if (!hook.includes("err.code === 'opening_in_progress'")) {
  failures.push('useZiddSession must classify opening_in_progress as a recoverable opening bootstrap state.');
}

if (!/const result = await streamTurn\(\)[\s\S]{0,260}recoverOpeningFromTranscript/.test(hook)) {
  failures.push('useZiddSession bootstrap must recover from a rejected duplicate opening by rehydrating the committed transcript.');
}

if (
  !sessionPage.includes('slowStream') ||
  !sessionStreamPresentation.includes('Setting up your prompt...') ||
  !sessionStreamPresentation.includes('Reviewing your answer...') ||
  !sessionPage.includes('aria-live="polite"')
) {
  failures.push('Session page must surface a delayed still-working state for long tutor streams.');
}

if (!hook.includes("'opening' | 'learner_turn' | null") || !sessionPage.includes('slowStreamCopyFor(activeStreamKind)')) {
  failures.push('Session stream presentation must use explicit opening/learner-turn ownership instead of transcript length heuristics.');
}

if (sessionPage.includes("messages.length === 0 && !state?.opening_streamed")) {
  failures.push('Session page must not infer opening stream ownership from message count because the first token changes that count.');
}

const directStreamingStops = hook.match(/setIsStreaming\(false\)/g) || [];
if (directStreamingStops.length !== 1 || !hook.includes('clearActiveStream')) {
  failures.push('useZiddSession must centralize stream shutdown so ownership clears with isStreaming on every terminal path.');
}

const directStreamingStarts = hook.match(/setIsStreaming\(true\)/g) || [];
if (directStreamingStarts.length !== 1 || !hook.includes("startActiveStream('learner_turn')")) {
  failures.push('useZiddSession must centralize stream activation so duplicate-turn recovery restores learner-turn ownership.');
}

for (const reason of ["'completed'", "'error'", "'disconnected'", "'session_changed'"]) {
  if (!hook.includes(`clearActiveStream(${reason})`)) {
    failures.push(`useZiddSession must clear active stream ownership for ${reason}.`);
  }
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
for (const token of ['openingRetryActive', 'isBootstrapping', 'isRecoveringTurn', 'Boolean(pendingTransition)', 'state?.input_allowed === false', 'Boolean(state?.block_reason)']) {
  if (!inputBlockedBlock.includes(token)) {
    failures.push(`Session page inputBlocked must include ${token}.`);
  }
}

if (!hook.includes('const [isRecoveringTurn, setIsRecoveringTurn] = useState(false)')) {
  failures.push('useZiddSession must expose a public late-turn recovery state instead of relying only on a private ref lock.');
}

if (!hook.includes('isRecoveringTurn: sessionIdChanged ? false : isRecoveringTurn')) {
  failures.push('useZiddSession must return the public late-turn recovery state to the session page.');
}

if (!sessionPage.includes('isRecoveringTurn,') || !sessionPage.includes('teachingStatusFor({')) {
  failures.push('Session page must consume late recovery state and show a non-spinner Reviewing status.');
}

if (!/let accepted = false/.test(hook) || !/eventName === 'accepted'[\s\S]{0,100}accepted = true/.test(hook)) {
  failures.push('late recovery must track the backend accepted event separately from HTTP stream open.');
}

if (!hook.includes('shouldStartLateTurnRecovery') || !/shouldStartLateTurnRecovery\(\{[\s\S]{0,240}accepted,[\s\S]{0,240}SESSION_STREAM_MAX_DURATION_MS/.test(hook)) {
  failures.push('late recovery must require an accepted learner turn and the full 150-second normal ownership budget.');
}

if (!/res\.status === 401 \|\| res\.status === 403/.test(hook)) {
  failures.push('terminal transcript authentication failures must cancel late recovery instead of being retried.');
}

for (const terminalStatusBlock of [
  restoreTranscriptOutcomeBody.match(/if \(res\.status === 401 \|\| res\.status === 403\) \{([\s\S]*?)\n    \}/)?.[1] ?? '',
  restoreTranscriptOutcomeBody.match(/if \(res\.status === 404 \|\| res\.status === 410\) \{([\s\S]*?)\n    \}/)?.[1] ?? '',
]) {
  if (!terminalStatusBlock.includes('activeStreamTokenRef.current = null')) {
    failures.push('terminal transcript responses must invalidate active stream ownership before old recovery timers can re-arm.');
  }
  if (!terminalStatusBlock.includes('activeStreamSettleRef.current?.({ started: Boolean(expectedUserTurn), completed: false })')) {
    failures.push('terminal transcript responses must settle the active stream promise so the page cannot remain submitting forever.');
  }
}

if (!/setIsRecoveringTurn\(false\)/.test(hook) || !/setIsRecoveringTurn\(true\)/.test(hook)) {
  failures.push('late recovery must visibly acquire and release recovery ownership.');
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

for (const token of ['durableTurnSettled', 'recoverTurnLockFromTranscript', "blockReason === 'turn_processing'", 'activeTurn: releaseStaleTurnLock ? null : activeTurn']) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession must release stale turn_processing locks after transcript recovery; missing ${token}.`);
  }
}

for (const token of ['dedupeAdjacentDuplicateMessages', 'dedupeAdjacentDuplicateMessages(finalizeOpen', "setError(prev => (prev === TRANSIENT_PROCESSING_MESSAGE ? null : prev))"]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession must prevent duplicate recovered assistant bubbles and stale processing banners; missing ${token}.`);
  }
}

if (!/if \(!doneSeen\)[\s\S]{0,260}if \(opened\)[\s\S]{0,180}recovered = await restoreTranscriptSnapshot\(/.test(hook)) {
  failures.push('useZiddSession must reconcile opened stream closes against durable transcript completion when the done frame is missing.');
}

if (!/onEvent: \(eventName, data\) => \{[\s\S]{0,220}eventName !== 'accepted'[\s\S]{0,80}eventName !== 'heartbeat'[\s\S]{0,160}clearTimeout\(recoveryTimer\)/.test(hook)) {
  failures.push('useZiddSession must cancel transcript recovery polling as soon as real SSE content arrives.');
}

if (!/eventName !== 'done'[\s\S]{0,160}recoveryPollCount = 0[\s\S]{0,160}scheduleRecoveryPoll\(SESSION_STREAM_RECOVERY_POLL_DELAY_MS\)/.test(hook)) {
  failures.push('non-terminal stream events must re-arm transcript recovery after the latest visible token becomes idle.');
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

const restoreRequestIndex = restoreTranscriptOutcomeBody.indexOf('runBoundedTranscriptRequest(requestDeadlineMs');
const restoreOwnershipIndex = restoreTranscriptOutcomeBody.indexOf('if (shouldApply && !shouldApply())', restoreRequestIndex);
const restoreNotFoundIndex = restoreTranscriptOutcomeBody.indexOf('if (res.status === 404 || res.status === 410)', restoreOwnershipIndex);
if (
  restoreRequestIndex < 0 ||
  restoreOwnershipIndex <= restoreRequestIndex ||
  restoreNotFoundIndex <= restoreOwnershipIndex
) {
  failures.push('useZiddSession transcript recovery must verify ownership before a stale 404/410 response can mutate not-found state.');
}

if (!/const recovered = await restoreTranscriptSnapshot\([\s\S]{0,520}activeStreamTokenRef\.current = null[\s\S]{0,180}streamInFlightRef\.current = false/.test(hook)) {
  failures.push('useZiddSession transcript recovery must invalidate the active stream token before releasing the stream lock.');
}

if (/if \(expectedUserTurn\) \{[\s\S]{0,120}scheduleRecoveryPoll\(SESSION_STREAM_RECOVERY_FIRST_POLL_MS\)/.test(hook)) {
  failures.push('useZiddSession must not exclude opening streams from bounded transcript recovery polling.');
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

if (!/maxDurationTimer\s*=\s*setTimeout\([\s\S]{0,1200}clientRef\.current\?\.disconnect\(\)[\s\S]{0,260}streamInFlightRef\.current = false[\s\S]{0,220}clearActiveStream\(/.test(hook)) {
  failures.push('useZiddSession max-duration backstop must disconnect the still-open SSE stream and release the Reviewing lock.');
}

if (!/recovered = await restoreTranscriptSnapshot\([\s\S]{0,620}if \(settled \|\| !isActiveStream\(\)\) return;[\s\S]{0,420}clientRef\.current\?\.disconnect\(\)/.test(hook)) {
  failures.push('useZiddSession max-duration backstop must re-check settled/isActiveStream after transcript recovery before disconnecting or setting an error.');
}

if (!/if \(opened\) \{[\s\S]{0,180}recovered = await restoreTranscriptSnapshot\(/.test(hook)) {
  failures.push('useZiddSession onComplete must restore durable outcomes for no-done opening and learner-turn streams.');
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
  'return { foundExpectedTurn: false, completed: false, failed: false }',
  'restoreTranscriptSnapshot(',
]) {
  if (!hook.includes(token)) {
    failures.push(`useZiddSession transcript recovery must prove the current learner turn and assistant reply are persisted before replacing a live stream; missing ${token}.`);
  }
}

if (!/expectedUserTurn &&[\s\S]{0,100}currentUserTurnIndex < 0 &&[\s\S]{0,100}!durableExpectedTurnCompleted &&[\s\S]{0,100}!durableExpectedTurnFailed/.test(hook)) {
  failures.push('useZiddSession transcript recovery must find the observed learner turn unless its exact durable completion/failure is present.');
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

if (/contentFallbackIndex|expectedContent/.test(hook)) {
  failures.push('useZiddSession recovery must fail closed when the exact client_turn_id is absent; identical historical answer text is not turn identity.');
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
