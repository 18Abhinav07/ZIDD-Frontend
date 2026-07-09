import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'src/components/tutor/TutorShell.tsx'), 'utf8');
const failures = [];

for (const token of [
  'useSession',
  'authSession?.user?.image',
  'AVATAR_PATHS.casual_male',
  'aria-label="Profile"',
  "router.push('/profile')",
  'alt="Profile"',
]) {
  if (!source.includes(token)) {
    failures.push(`TutorShell is missing ${token}`);
  }
}

if (!source.includes('src={profileImage}')) {
  failures.push('TutorShell profile button must render the resolved profileImage.');
}

if (failures.length) {
  console.error('TutorShell avatar check failed:');
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
