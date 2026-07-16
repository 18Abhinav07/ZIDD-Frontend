const SCHOOL_PATH_AVATARS = Object.freeze([
  '/avatars/trans_new_casual_male_1781021481311.png',
  '/avatars/trans_blue_sweater_avatar_1781009509043.png',
  '/avatars/trans_new_casual_female_1781021494716.png',
  '/avatars/trans_purple_hoodie_avatar_1781009463054.png',
  '/avatars/trans_black_tech_avatar_1781009485387.png',
]);

const SCHOOL_PATH_GEOMETRY = Object.freeze({
  chapters: Object.freeze({
    desktopStart: 84,
    desktopStep: 286,
    desktopTail: 330,
    mobileStart: 58,
    mobileStep: 248,
    mobileTail: 250,
    nodeAnchor: 205,
    amplitude: 155,
  }),
  levels: Object.freeze({
    desktopStart: 94,
    desktopStep: 350,
    desktopTail: 500,
    mobileStart: 68,
    mobileStep: 300,
    mobileTail: 410,
    nodeAnchor: 245,
    amplitude: 160,
  }),
});

function stableHash(value) {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getSchoolPathAvatar(seed) {
  return SCHOOL_PATH_AVATARS[stableHash(seed) % SCHOOL_PATH_AVATARS.length];
}

export function schoolPathMetrics(count, kind = 'chapters') {
  const geometry = SCHOOL_PATH_GEOMETRY[kind] ?? SCHOOL_PATH_GEOMETRY.chapters;
  const nodeCount = Math.max(1, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 1);
  const lastIndex = nodeCount - 1;

  return {
    desktopHeight: geometry.desktopStart + lastIndex * geometry.desktopStep + geometry.desktopTail,
    mobileHeight: geometry.mobileStart + lastIndex * geometry.mobileStep + geometry.mobileTail,
    desktopStart: geometry.desktopStart,
    mobileStart: geometry.mobileStart,
    desktopStep: geometry.desktopStep,
    mobileStep: geometry.mobileStep,
  };
}

export function buildSchoolWindingPath(count, kind = 'chapters') {
  const geometry = SCHOOL_PATH_GEOMETRY[kind] ?? SCHOOL_PATH_GEOMETRY.chapters;
  const metrics = schoolPathMetrics(count, kind);
  const nodeCount = Math.max(1, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 1);
  const centerX = 300;
  const points = Array.from({ length: nodeCount }, (_, index) => ({
    x: centerX + (index % 2 === 0 ? geometry.amplitude : -geometry.amplitude),
    y: geometry.desktopStart + index * geometry.desktopStep + geometry.nodeAnchor,
  }));
  points.push({ x: centerX, y: metrics.desktopHeight - 24 });

  let previous = { x: centerX, y: 20 };
  const commands = [`M ${previous.x} ${previous.y}`];
  for (const point of points) {
    const middleY = Math.round((previous.y + point.y) / 2);
    commands.push(`C ${previous.x} ${middleY} ${point.x} ${middleY} ${point.x} ${point.y}`);
    previous = point;
  }
  return commands.join(' ');
}

export function schoolPathSide(index) {
  return index % 2 === 0 ? 'right' : 'left';
}
