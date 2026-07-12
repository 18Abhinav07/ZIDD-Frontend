function cleanStrings(values) {
  return (Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueCaseInsensitive(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitAssessmentCaveats(report = {}) {
  const learner = cleanStrings(report.learner_assessment_caveats);
  const integrity = cleanStrings(report.simulator_integrity_notes);

  for (const caveat of cleanStrings(report.assessment_caveats)) {
    const simulatorPrefix = /^simulator (?:caveat|integrity):\s*/i;
    if (simulatorPrefix.test(caveat)) {
      integrity.push(caveat.replace(simulatorPrefix, '').trim());
    } else {
      learner.push(caveat);
    }
  }

  return {
    learner: uniqueCaseInsensitive(learner),
    integrity: uniqueCaseInsensitive(integrity),
  };
}

export function reportPresentationFor(report = {}) {
  const status = report.validity_status;
  const caveats = splitAssessmentCaveats(report);
  const hasIntegrityNotes = caveats.integrity.length > 0;
  const coverageCap = typeof report.score_breakdown?.coverage_cap === 'number';
  const validityCap = typeof report.score_breakdown?.validity_cap === 'number';
  const covered = report.coverage_map?.unique_covered;
  const required = report.coverage_map?.required_unique;
  const hasCoverageShortfall = (
    typeof covered === 'number' &&
    typeof required === 'number' &&
    required > 0 &&
    covered < required
  );
  const isNotScored = status === 'insufficient_evidence' || status === 'invalid_simulation';
  const isFinal = status === 'final';
  const isCapped = !isFinal && !isNotScored && (coverageCap || validityCap);

  if (status === 'insufficient_evidence') {
    return {
      title: 'Session Review',
      scoreLabel: 'Not scored',
      validityLabel: 'Insufficient Evidence',
      validityDetail: 'The session did not contain enough score-eligible answers or coverage for a fair assessment.',
      tone: 'danger',
      isNotScored,
      isFinal,
      isCapped,
      caveats,
    };
  }

  if (status === 'invalid_simulation') {
    return {
      title: 'Session Review',
      scoreLabel: 'Not scored',
      validityLabel: 'Invalid Simulation',
      validityDetail: 'Simulator behavior invalidated this run, so no learner score was applied.',
      tone: 'danger',
      isNotScored,
      isFinal,
      isCapped,
      caveats,
    };
  }

  if (status === 'partial') {
    let validityLabel = 'Provisional Assessment';
    let validityDetail = 'This scored report is provisional. Review the available evidence before using it as a complete assessment.';

    if (validityCap) {
      validityLabel = 'Integrity-Capped Assessment';
      validityDetail = 'Simulator integrity events capped this scored report. They are documented separately from learner weaknesses.';
    } else if (coverageCap) {
      validityLabel = 'Coverage-Capped Assessment';
      validityDetail = 'The available evidence did not cover enough distinct areas, so the scored report was capped.';
    } else if (hasIntegrityNotes) {
      validityLabel = 'Assessment with Integrity Notes';
      validityDetail = 'This scored report is provisional and includes simulator integrity notes that are separate from learner weaknesses.';
    } else if (hasCoverageShortfall) {
      validityDetail = 'The available evidence did not cover enough distinct areas, so this scored report remains provisional.';
    }

    return {
      title: 'Assessment Review',
      scoreLabel: isCapped ? 'Capped' : 'Provisional',
      validityLabel,
      validityDetail,
      tone: 'warning',
      isNotScored,
      isFinal,
      isCapped,
      caveats,
    };
  }

  if (isFinal) {
    return {
      title: 'Assessment Complete',
      scoreLabel: 'Final',
      validityLabel: hasIntegrityNotes
        ? 'Final Assessment with Integrity Notes'
        : 'Final Assessment',
      validityDetail: hasIntegrityNotes
        ? 'The assessment is final. Simulator integrity events are documented below and are not learner weaknesses.'
        : 'Enough score-eligible answers and coverage were available for a final assessment.',
      tone: 'success',
      isNotScored,
      isFinal,
      isCapped,
      caveats,
    };
  }

  return {
    title: 'Assessment Review',
    scoreLabel: 'Provisional',
    validityLabel: 'Assessment Status Unverified',
    validityDetail: 'The backend did not provide a verified final status. Treat this report as provisional.',
    tone: 'warning',
    isNotScored: false,
    isFinal: false,
    isCapped: false,
    caveats,
  };
}
