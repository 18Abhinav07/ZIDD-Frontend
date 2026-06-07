// Avatar type catalogue — mirrors what's on disk in /public/avatars/
export type AvatarType =
  | 'coach_pink'    // female, pink hoodie
  | 'coach_blue'    // male, blue street-wear  
  | 'coach_green'   // male, green fit
  | 'coach_orange'  // female, orange hoodie
  | 'casual_male'   // male, beige/amber hoodie
  | 'casual_female' // female, casual
  | 'tech_black'    // male, dark tech look
  | 'casual_blue'   // male, blue sweater
  | 'casual_purple' // female, purple hoodie
  // legacy aliases kept for back-compat
  | 'gd_female'
  | 'gd_male'
  | 'student_female'
  | 'interviewer_suit';

export const AVATAR_PATHS: Record<AvatarType, string> = {
  // actual files
  coach_pink:    '/avatars/coach_pink.png',
  coach_blue:    '/avatars/coach_blue.png',
  coach_green:   '/avatars/coach_green.png',
  coach_orange:  '/avatars/coach_orange.png',
  casual_male:   '/avatars/trans_new_casual_male_1781021481311.png',
  casual_female: '/avatars/trans_new_casual_female_1781021494716.png',
  tech_black:    '/avatars/trans_black_tech_avatar_1781009485387.png',
  casual_blue:   '/avatars/trans_blue_sweater_avatar_1781009509043.png',
  casual_purple: '/avatars/trans_purple_hoodie_avatar_1781009463054.png',
  // legacy aliases
  gd_female:       '/avatars/coach_pink.png',
  gd_male:         '/avatars/coach_green.png',
  student_female:  '/avatars/trans_new_casual_female_1781021494716.png',
  interviewer_suit:'/avatars/coach_orange.png', // female orange hoodie — not the blue boy
};

// ─── Avatar card background colors ──────────────────────────────────────────
// Must match the dominant clothing/background color of each avatar asset so
// the card looks cohesive. Verified against the actual PNG files.
export const AVATAR_BG: Record<string, string> = {
  [AVATAR_PATHS.coach_pink]:    '#DB2777', // pink hoodie → hot pink
  [AVATAR_PATHS.coach_blue]:    '#2563EB', // blue hoodie → indigo blue
  [AVATAR_PATHS.coach_green]:   '#16A34A', // green fit → rich green
  [AVATAR_PATHS.coach_orange]:  '#EA580C', // orange hoodie → burnt orange
  [AVATAR_PATHS.casual_male]:   '#B45309', // amber hoodie → deep amber
  [AVATAR_PATHS.casual_female]: '#CA8A04', // yellow-ish → warm gold
  [AVATAR_PATHS.tech_black]:    '#1E293B', // dark look → slate 800
  [AVATAR_PATHS.casual_blue]:   '#1D4ED8', // blue sweater → blue 700
  [AVATAR_PATHS.casual_purple]: '#7C3AED', // purple hoodie → violet
};

// ─── Name → Avatar mapping ───────────────────────────────────────────────────
// Canonical mapping for known GD & interview characters.
// key = lowercase name substring, value = avatar type
const NAME_MAP: Array<[string, AvatarType]> = [
  // ── Female names → female avatars ──────────────────────────────────────
  ['meera',    'coach_pink'],
  ['priya',    'casual_female'],
  ['aisha',    'casual_female'],
  ['neha',     'casual_purple'],
  ['sarah',    'coach_orange'],   // female interviewer → orange hoodie (female)
  ['anjali',   'casual_female'],
  ['kiara',    'casual_purple'],
  ['bella',    'coach_pink'],
  ['rhea',     'casual_purple'],
  ['sneha',    'casual_female'],
  // ── Male names → male avatars ───────────────────────────────────────────
  ['aarav',    'coach_blue'],     // was coach_green — blue boy matches the vibe
  ['kabir',    'casual_male'],
  ['rohan',    'casual_male'],
  ['sam',      'coach_orange'],
  ['finn',     'coach_green'],
  ['rahul',    'tech_black'],
  ['karan',    'casual_blue'],
  ['aryan',    'coach_blue'],
  ['vihaan',   'casual_blue'],
  ['dev',      'tech_black'],
  ['sharma',   'coach_green'],
  // ── Role-based ──────────────────────────────────────────────────────────
  ['moderator',   'coach_orange'], // distinct from Aarav (blue)
  ['interviewer', 'coach_orange'], // female interviewer
  ['dr.',         'coach_orange'], // Dr. titles → female interviewer avatar
  ['mr.',         'coach_green'],
];

export function getAvatarForCharacter(name: string | undefined): string {
  if (!name) return AVATAR_PATHS.coach_orange;
  const lc = name.toLowerCase();

  for (const [key, type] of NAME_MAP) {
    if (lc.includes(key)) return AVATAR_PATHS[type];
  }

  // Gender-heuristic fallback
  const femalePat = /a$|ia$|ya$|eera|na$|ella|isha|ora|ira/;
  const isFemale = femalePat.test(lc);

  const femaleFallback = [AVATAR_PATHS.casual_female, AVATAR_PATHS.casual_purple, AVATAR_PATHS.coach_pink];
  const maleFallback   = [AVATAR_PATHS.coach_green,   AVATAR_PATHS.casual_blue,   AVATAR_PATHS.casual_male];

  const pick = (pool: string[]) => pool[lc.length % pool.length];
  return isFemale ? pick(femaleFallback) : pick(maleFallback);
}

export function getBgColorForAvatar(avatarUrl: string): string {
  return AVATAR_BG[avatarUrl] ?? '#94A3B8';
}

export function getAvatarForModule(moduleId: string): string {
  const lower = moduleId.toLowerCase();
  if (lower.includes('interview'))  return AVATAR_PATHS.coach_orange;  // female
  if (lower.includes('discussion')) return AVATAR_PATHS.coach_blue;    // male Aarav
  if (lower.includes('grade'))      return AVATAR_PATHS.casual_blue;
  if (lower.includes('foundation')) return AVATAR_PATHS.casual_female;

  const POOL = [
    AVATAR_PATHS.casual_male, AVATAR_PATHS.casual_female, AVATAR_PATHS.tech_black,
    AVATAR_PATHS.coach_pink,  AVATAR_PATHS.coach_orange,  AVATAR_PATHS.coach_green,
    AVATAR_PATHS.coach_blue,  AVATAR_PATHS.casual_blue,   AVATAR_PATHS.casual_purple,
  ];
  let hash = 0;
  for (let i = 0; i < moduleId.length; i++) hash = moduleId.charCodeAt(i) + ((hash << 5) - hash);
  return POOL[Math.abs(hash) % POOL.length];
}

export function getModuleThemeColor(moduleId: string): { bg: string; text: string; shadow: string } {
  const lower = moduleId.toLowerCase();
  // Synced to getAvatarForModule + AVATAR_BG
  if (lower.includes('interview'))  return { bg: 'bg-[#EA580C]', text: 'text-[#EA580C]', shadow: 'shadow-[0_20px_40px_rgba(234,88,12,0.3)]'   }; // orange
  if (lower.includes('discussion')) return { bg: 'bg-[#2563EB]', text: 'text-[#2563EB]', shadow: 'shadow-[0_20px_40px_rgba(37,99,235,0.3)]'    }; // blue
  if (lower.includes('grade'))      return { bg: 'bg-[#1D4ED8]', text: 'text-[#1D4ED8]', shadow: 'shadow-[0_20px_40px_rgba(29,78,216,0.3)]'     }; // blue 700
  if (lower.includes('foundation')) return { bg: 'bg-[#CA8A04]', text: 'text-[#CA8A04]', shadow: 'shadow-[0_20px_40px_rgba(202,138,4,0.3)]'     }; // gold
  return                                   { bg: 'bg-indigo-500', text: 'text-indigo-500', shadow: 'shadow-[0_20px_40px_rgba(99,102,241,0.3)]'  };
}

// Assets from Gemini-gen have transparent padding; these need a scale boost
// to fill the card the same as tight Figma exports.
const PADDED_ASSETS = new Set([
  AVATAR_PATHS.casual_male,
  AVATAR_PATHS.casual_female,
  AVATAR_PATHS.tech_black,
  AVATAR_PATHS.casual_blue,
  AVATAR_PATHS.casual_purple,
]);

export function needsPaddingCompensation(avatarUrl: string): boolean {
  return PADDED_ASSETS.has(avatarUrl);
}

export function getAvatarScaleClass(avatarUrl: string, baseScale = 'scale-100'): string {
  return needsPaddingCompensation(avatarUrl)
    ? 'scale-[1.35] origin-bottom'
    : `${baseScale} origin-bottom`;
}
