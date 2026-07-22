import { AVATAR_PATHS } from './avatarRegistry';

export const LANDING_HERO_VIDEO = '/Zidd-hero.mp4';

const TOONHUB_SOURCE_PATHS = [
  AVATAR_PATHS.coach_pink,
  AVATAR_PATHS.coach_orange,
  AVATAR_PATHS.coach_green,
  AVATAR_PATHS.coach_blue,
  AVATAR_PATHS.casual_male,
  AVATAR_PATHS.student_female,
  AVATAR_PATHS.tech_black,
  AVATAR_PATHS.casual_blue,
  AVATAR_PATHS.casual_purple,
];

// The carousel shows these portraits at a constrained display size. Keeping
// dedicated 1080px PNGs prevents a first visit from downloading the 22 MB
// source-photo set just to fill the landing viewport.
const TOONHUB_LANDING_ASSETS: Record<string, string> = {
  [AVATAR_PATHS.coach_pink]: '/avatars/toonhub/coach_pink.png',
  [AVATAR_PATHS.coach_orange]: '/avatars/toonhub/coach_orange.png',
  [AVATAR_PATHS.coach_green]: '/avatars/toonhub/coach_green.png',
  [AVATAR_PATHS.coach_blue]: '/avatars/toonhub/coach_blue.png',
};

export function getToonHubAvatarPath(sourcePath: string): string {
  return TOONHUB_LANDING_ASSETS[sourcePath] ?? sourcePath;
}

// The carousel can surface any coach immediately, so preload the complete set
// instead of showing an unloaded slide after the opening transition.
export const TOONHUB_AVATAR_PATHS = TOONHUB_SOURCE_PATHS.map(getToonHubAvatarPath);
export const TOONHUB_INITIAL_AVATAR_PATH = getToonHubAvatarPath(AVATAR_PATHS.coach_pink);
