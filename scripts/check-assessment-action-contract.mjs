#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const hook = readFileSync('src/hooks/useZiddSession.ts', 'utf8');
const gdPage = readFileSync('src/app/(professional)/simulator/gd/page.tsx', 'utf8');
const interviewPage = readFileSync('src/app/(professional)/simulator/interview/page.tsx', 'utf8');
const simulatorShell = readFileSync('src/components/simulator/SimulatorShell.tsx', 'utf8');
const scenarioPicker = readFileSync('src/components/shared/ScenarioPicker.tsx', 'utf8');

const failures = [];

if (!hook.includes('assessment_action')) {
  failures.push('useZiddSession.streamTurn must send typed assessment_action metadata to /api/session/turn.');
}

if (!hook.includes('normalizeTranscriptMessages')) {
  failures.push('useZiddSession must normalize and de-duplicate restored transcript messages before rendering.');
}

if (!hook.includes('hasOpeningTranscriptMessage(restoredMessages)')) {
  failures.push('useZiddSession bootstrap must treat an existing restored opening message as openingAvailable.');
}

if (!hook.includes('AssessmentClientAction')) {
  failures.push('useZiddSession must type the assessment action payload instead of passing unstructured strings only.');
}

if (!simulatorShell.includes('action?: AssessmentClientAction')) {
  failures.push('SimulatorShell QuickAction must carry typed action metadata for backend routing/control.');
}

if (!simulatorShell.includes('onQuickAction')) {
  failures.push('SimulatorShell must expose a quick-action callback so pages can track the selected action.');
}

if (simulatorShell.includes('setInputValue(action.value)')) {
  failures.push('SimulatorShell quick-action buttons must not overwrite an existing learner draft before the page can decide how to handle the action.');
}

if (gdPage.includes("speaker_id: 'aggressive_challenger'") && gdPage.includes('rawPersonas')) {
  failures.push('GD simulator must not invent Aggressive Challenger in fallback personas; persona quick actions must come only from backend state.personas.');
}

if (!gdPage.includes('activeDebaters.map((persona)') || !gdPage.includes('backendPersonas.filter((p) => !isModeratorPersona(p))')) {
  failures.push('GD Ask Panelist buttons must be generated only from backend-provided active debaters.');
}

if (!gdPage.includes("kind: 'ask_panelist'")) {
  failures.push('GD Ask Panelist controls must send kind=ask_panelist with speaker_id metadata.');
}

if (!gdPage.includes("kind: 'new_angle'")) {
  failures.push('GD New Angle control must send kind=new_angle metadata.');
}

if (!gdPage.includes("label: 'Moderator Pivot'")) {
  failures.push('GD topic-pivot control must be visibly labeled Moderator Pivot because the backend routes it through the Moderator.');
}

if (gdPage.includes("label: 'New Angle'")) {
  failures.push('GD topic-pivot control must not be labeled New Angle; that hides the moderator-owned behavior.');
}

if (!gdPage.includes("kind: 'clarify'")) {
  failures.push('GD Clarify control must send kind=clarify metadata.');
}

if (!interviewPage.includes("kind: 'move_on'")) {
  failures.push('Interview Move On control must send kind=move_on metadata.');
}

if (!interviewPage.includes("kind: 'clarify'")) {
  failures.push('Interview Clarify control must send kind=clarify metadata.');
}

if (!gdPage.includes('EndSessionConfirmModal') || !interviewPage.includes('EndSessionConfirmModal')) {
  failures.push('Both GD and Interview test pages must show an end/report confirmation modal before ending.');
}

if (!scenarioPicker.includes('defaultInterviewTypeForNode')) {
  failures.push('ScenarioPicker must choose an interview-type default from the selected scenario instead of using one global default.');
}

if (scenarioPicker.includes("useState<SimulationScenarioConfig['interview_type']>('technical_project')")) {
  failures.push('ScenarioPicker must not default every interview assessment to technical_project; this breaks HR/behavioral scenarios.');
}

for (const [name, source] of [
  ['GD simulator', gdPage],
  ['Interview simulator', interviewPage],
]) {
  if (!source.includes('const submitDraft = async')) {
    failures.push(`${name} must centralize sending so typed quick actions and manual sends use the same guarded payload path.`);
  }
  if (!source.includes('setPendingAssessmentAction(actionForTurn)')) {
    failures.push(`${name} must restore typed quick-action metadata if a direct control submission cannot start.`);
  }
  if (!source.includes('void submitDraft(action.value.trim(), actionForTurn)')) {
    failures.push(`${name} quick actions must execute their explicit typed control through the guarded submit path.`);
  }
  if (!/const handleQuickAction[\s\S]{0,220}inputDisabled\s*\|\|\s*inputValue\.trim\(\)/.test(source)) {
    failures.push(`${name} quick actions must remain inert while recovery owns the turn or the learner has a draft.`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
