const SKILL_LABELS: Record<string, string> = {
  GRAMMAR_PAST_TENSE: 'Past tense grammar',
  GRAMMAR_PRESENT_TENSE: 'Present tense grammar',
  GRAMMAR_TENSE_MIXED: 'Tense consistency',
  GRAMMAR_SUBJECT_VERB_AGREEMENT: 'Subject-verb agreement',
  GRAMMAR_ARTICLES: 'Articles',
  GRAMMAR_PLURALS: 'Plurals',
  GRAMMAR_PREPOSITIONS: 'Prepositions',
  VOCABULARY_RANGE: 'Vocabulary range',
  SENTENCE_STRUCTURE: 'Sentence structure',
  PHONICS_BLENDING: 'Blending sounds',
  PHONICS_LETTER_SOUNDS: 'Letter sounds',
  SPELLING: 'Spelling',
  PARAGRAPH_STRUCTURE: 'Paragraph structure',
  FLUENCY_HESITATION: 'Fluency and pauses',
  CLARITY_CONCISENESS: 'Clear, concise answers',
  PRONUNCIATION: 'Pronunciation',
  LANGUAGE_NOT_ENGLISH: 'Staying in English',
  STRUCTURE_STAR_METHOD: 'STAR answer structure',
  ANSWER_RELEVANCE: 'Answer relevance',
  SPECIFICITY_EXAMPLES: 'Specific examples',
  CONFIDENCE_TONE: 'Confident tone',
  GD_TURN_TAKING: 'Discussion turn-taking',
  GD_REBUTTAL: 'Rebuttals',
  GD_STANCE_CLARITY: 'Clear stance',
  GD_CONSENSUS_BUILDING: 'Consensus building',
  OTHER: 'General practice',
};

export function labelSkillId(skillId?: string | null): string {
  const raw = (skillId || '').trim();
  if (!raw) return 'General practice';
  if (SKILL_LABELS[raw]) return SKILL_LABELS[raw];
  return raw
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'General practice';
}
