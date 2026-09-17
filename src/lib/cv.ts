import profileRaw from '../data/profile.yaml';
import experienceRaw from '../data/experience.yaml';
import skillsRaw from '../data/skills.yaml';
import certificationsRaw from '../data/certifications.yaml';
import educationRaw from '../data/education.yaml';
import interestsRaw from '../data/interests.yaml';
import communityRaw from '../data/community.yaml';

import {
  parseData,
  profileSchema,
  experienceSchema,
  skillsSchema,
  certificationsSchema,
  educationSchema,
  interestsSchema,
  communitySchema,
  type Role,
  type Contribution,
} from './schema';

export const profile = parseData(profileSchema, profileRaw, 'profile.yaml');
export const skills = parseData(skillsSchema, skillsRaw, 'skills.yaml');
export const certifications = parseData(
  certificationsSchema,
  certificationsRaw,
  'certifications.yaml',
);
export const { education, languages } = parseData(
  educationSchema,
  educationRaw,
  'education.yaml',
);
export const { interests } = parseData(interestsSchema, interestsRaw, 'interests.yaml');

const { contributions } = parseData(communitySchema, communityRaw, 'community.yaml');

const { roles } = parseData(experienceSchema, experienceRaw, 'experience.yaml');

/** Build-time "now". The site is rebuilt on every deploy, so this stays fresh. */
export const buildDate = new Date();

export function toDate(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1));
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatMonth(yearMonth: string): string {
  const date = toDate(yearMonth);
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatRange(start: string, end: string | null): string {
  return `${formatMonth(start)} — ${end ? formatMonth(end) : 'Present'}`;
}

export function monthsBetween(start: string, end: string | null): number {
  const from = toDate(start);
  const to = end
    ? toDate(end)
    : new Date(Date.UTC(buildDate.getUTCFullYear(), buildDate.getUTCMonth(), 1));
  return Math.max(
    0,
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      (to.getUTCMonth() - from.getUTCMonth()),
  );
}

export function formatDuration(start: string, end: string | null): string {
  const total = monthsBetween(start, end);
  const years = Math.floor(total / 12);
  const months = total % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (months) parts.push(`${months} mo`);
  return parts.length ? parts.join(' ') : '< 1 mo';
}

export function yearsSince(yearMonth: string): number {
  return Math.floor(monthsBetween(yearMonth, null) / 12);
}

const byStartDescending = (a: Role, b: Role) => (a.start < b.start ? 1 : -1);
const byStartAscending = (a: Role, b: Role) => (a.start > b.start ? 1 : -1);

/** Full-detail roles on the employed track, newest first. */
export const featuredRoles = roles
  .filter((role) => role.track === 'main' && role.featured)
  .sort(byStartDescending);

/** The independent practice, which runs alongside the employed track. */
export const parallelRoles = roles
  .filter((role) => role.track === 'parallel')
  .sort(byStartDescending);

/** Pre-IT and very short roles, rendered as compact single lines. */
export const earlierRoles = roles
  .filter((role) => !role.featured)
  .sort(byStartDescending);

/** Every role in one newest-first list, used for structured data. */
export const allRoles = [...roles].sort(byStartDescending);

const organisationCount = new Set(
  roles.filter((role) => role.featured).map((role) => role.orgShort),
).size;

/* -------------------------------------------------------------------------- */
/*  Certifications                                                             */
/* -------------------------------------------------------------------------- */

const todayKey = buildDate.toISOString().slice(0, 10);

export function formatYear(date: string): string {
  return date.slice(0, 4);
}

/**
 * Groups decorated with a verification link and an expiry state, so an expired
 * credential is shown as expired rather than silently listed as current.
 */
export const certificationGroups = certifications.groups.map((group) => ({
  ...group,
  items: group.items.map((item) => ({
    ...item,
    url: item.badge ? `https://www.credly.com/badges/${item.badge}` : null,
    expired: item.expires ? item.expires < todayKey : false,
  })),
}));

const activeCertificationCount = certificationGroups.reduce(
  (total, group) => total + group.items.filter((item) => !item.expired).length,
  0,
);

/* -------------------------------------------------------------------------- */
/*  Speaking and community                                                     */
/* -------------------------------------------------------------------------- */

export function formatContributionDate(date: string | null): string {
  if (!date) return 'Ongoing';
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${parsed.getUTCDate()} ${MONTH_NAMES[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
}

/** The bare host, used as a visible reference when the page is printed. */
export function linkHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

const CONTRIBUTION_GROUPS = [
  { type: 'talk', label: 'Talks & workshops', icon: 'mic' },
  { type: 'video', label: 'Podcasts & video', icon: 'play' },
  { type: 'writing', label: 'Writing', icon: 'pen' },
  { type: 'community', label: 'Open source & community', icon: 'box' },
] as const;

/** Newest first, with undated ongoing work sorted to the end of its group. */
const byDateDescending = (a: Contribution, b: Contribution) => {
  if (a.date === b.date) return 0;
  if (!a.date) return 1;
  if (!b.date) return -1;
  return a.date < b.date ? 1 : -1;
};

export const contributionGroups = CONTRIBUTION_GROUPS.map((group) => ({
  ...group,
  items: contributions.filter((item) => item.type === group.type).sort(byDateDescending),
})).filter((group) => group.items.length > 0);

/**
 * Rolling count of dated contributions from the last twelve months. Undated
 * ongoing work is excluded so the number stays defensible.
 */
const recentContributionCount = (() => {
  const cutoff = new Date(buildDate);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return contributions.filter((item) => item.date && item.date >= cutoffKey).length;
})();

export const stats = [
  {
    value: yearsSince(profile.careerStart),
    unit: 'yrs',
    label: 'in software & platform engineering',
  },
  {
    value: organisationCount,
    label: 'organisations, from game studios to enterprise energy',
  },
  {
    value: activeCertificationCount,
    label: 'current professional certifications',
  },
  {
    value: recentContributionCount,
    label: 'talks, articles & community contributions in the last year',
  },
  {
    value: yearsSince(profile.independentSince),
    unit: 'yrs',
    label: 'running an independent practice alongside',
  },
];

/* -------------------------------------------------------------------------- */
/*  Career elevation profile                                                   */
/* -------------------------------------------------------------------------- */

const VIEW = {
  width: 1000,
  /** Height of the mountain area itself. */
  height: 180,
  padTop: 34,
  padBottom: 18,
  /** Year labels sit between the mountain and the parallel lane. */
  axisY: 197,
  /** The independent-practice lane runs beneath the axis. */
  laneY: 208,
  laneHeight: 16,
  totalHeight: 228,
} as const;

const round = (value: number) => Math.round(value * 100) / 100;

const mainRolesAscending = roles
  .filter((role) => role.track === 'main')
  .sort(byStartAscending);

const timelineStart = toDate(mainRolesAscending[0]!.start).getTime();
const timelineEnd = Math.max(
  buildDate.getTime(),
  ...roles.map((role) => (role.end ? toDate(role.end).getTime() : buildDate.getTime())),
);

const toX = (time: number) =>
  round(((time - timelineStart) / (timelineEnd - timelineStart)) * VIEW.width);

const toY = (scope: number) => {
  const usable = VIEW.height - VIEW.padTop - VIEW.padBottom;
  return round(VIEW.height - VIEW.padBottom - ((scope - 1) / 9) * usable);
};

const roleMidpointX = (role: Role) => {
  const start = toDate(role.start).getTime();
  const end = role.end ? toDate(role.end).getTime() : buildDate.getTime();
  return toX((start + end) / 2);
};

export interface Waypoint {
  id: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  labelAbove: boolean;
  /** Null when the waypoint carries a milestone annotation instead. */
  label: string | null;
  milestone: string | null;
  orgShort: string;
  title: string;
  range: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Only featured roles get a marker; the rest still shape the ridge line. A role
 * with a milestone gets the milestone annotation instead of a company label, so
 * the turning point does not read as just another employer.
 */
let labelSlot = 0;
export const waypoints: Waypoint[] = mainRolesAscending
  .filter((role) => role.featured)
  .map((role) => {
    const x = roleMidpointX(role);
    const y = toY(role.scope);
    const milestone = role.milestone ?? null;
    const label = milestone ? null : (role.chartLabel ?? role.orgShort);

    let labelAbove = false;
    if (label !== null) {
      labelAbove = labelSlot % 2 === 0;
      labelSlot += 1;
    }

    return {
      id: role.id,
      x,
      y,
      labelX: clamp(x, 48, VIEW.width - 48),
      labelY: labelAbove ? y - 14 : y + 22,
      labelAbove,
      label,
      milestone,
      orgShort: role.orgShort,
      title: role.title,
      range: formatRange(role.start, role.end),
    };
  });

function smoothPath(points: { x: number; y: number }[], tension = 0.6): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = round(p1.x + ((p2.x - p0.x) / 6) * tension);
    const c1y = round(p1.y + ((p2.y - p0.y) / 6) * tension);
    const c2x = round(p2.x - ((p3.x - p1.x) / 6) * tension);
    const c2y = round(p2.y - ((p3.y - p1.y) / 6) * tension);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const ridgePoints = [
  { x: 0, y: toY(mainRolesAscending[0]!.scope) },
  ...mainRolesAscending.map((role) => ({ x: roleMidpointX(role), y: toY(role.scope) })),
  { x: VIEW.width, y: toY(mainRolesAscending.at(-1)!.scope) },
].filter((point, index, list) => index === 0 || point.x > list[index - 1]!.x);

const ridgeLine = smoothPath(ridgePoints);

const parallelRole = parallelRoles[0];

export const elevation = {
  view: VIEW,
  viewBox: `0 0 ${VIEW.width} ${VIEW.totalHeight}`,
  ridgeLine,
  ridgeArea: `${ridgeLine} L ${VIEW.width} ${VIEW.height} L 0 ${VIEW.height} Z`,
  waypoints,
  yearTicks: (() => {
    const firstYear = new Date(timelineStart).getUTCFullYear();
    const lastYear = new Date(timelineEnd).getUTCFullYear();
    const ticks: { year: number; x: number; labelX: number }[] = [];
    for (let year = Math.ceil(firstYear / 5) * 5; year <= lastYear; year += 5) {
      const x = toX(Date.UTC(year, 0, 1));
      ticks.push({ year, x, labelX: clamp(x, 22, VIEW.width - 22) });
    }
    return ticks;
  })(),
  parallel: parallelRole
    ? {
        id: parallelRole.id,
        label: `${parallelRole.orgShort} — ${parallelRole.title}, ${formatRange(
          parallelRole.start,
          parallelRole.end,
        )}`,
        x: toX(toDate(parallelRole.start).getTime()),
        width: round(VIEW.width - toX(toDate(parallelRole.start).getTime())),
        y: VIEW.laneY,
        height: VIEW.laneHeight,
      }
    : null,
};

export const siteMeta = {
  title: `${profile.name} — ${profile.headline}`,
  description: profile.tagline,
  locale: 'en',
};
