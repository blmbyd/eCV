import { z } from 'astro/zod';

/**
 * A `YYYY-MM` point in time. YAML parsers occasionally hand back a Date for
 * date-ish scalars, so both shapes are accepted and normalised to a string.
 */
const yearMonth = z
  .union([z.string(), z.date()])
  .transform((value) =>
    value instanceof Date
      ? `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
      : value.trim(),
  )
  .pipe(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected a YYYY-MM value'));

/** A full `YYYY-MM-DD` date, normalised the same way as {@link yearMonth}. */
const isoDate = z
  .union([z.string(), z.date()])
  .transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value.trim(),
  )
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD value'));

const linkSchema = z.object({
  label: z.string(),
  handle: z.string(),
  url: z.string().url(),
  icon: z.enum(['linkedin', 'github', 'globe', 'mail']),
});

export const profileSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  initials: z.string(),
  headline: z.string(),
  roles: z.array(z.string()).min(1),
  tagline: z.string(),
  location: z.object({
    city: z.string(),
    region: z.string(),
    country: z.string(),
    countryCode: z.string().length(2),
  }),
  email: z.string().email(),
  availability: z.string(),
  careerStart: yearMonth,
  independentSince: yearMonth,
  links: z.array(linkSchema).min(1),
  summary: z.array(z.string()).min(1),
  personalNote: z.string(),
});

const techGroupSchema = z.object({
  label: z.string(),
  items: z.array(z.string()).min(1),
});

export const roleSchema = z.object({
  id: z.string(),
  title: z.string(),
  org: z.string(),
  orgShort: z.string(),
  orgUrl: z.string().url().optional(),
  /** Short label for the elevation profile, where horizontal room is tight. */
  chartLabel: z.string().optional(),
  start: yearMonth,
  end: yearMonth.nullable(),
  location: z.string(),
  track: z.enum(['main', 'parallel']),
  scope: z.number().int().min(1).max(10),
  featured: z.boolean(),
  summary: z.string().optional(),
  groups: z
    .array(z.object({ label: z.string(), items: z.array(z.string()).min(1) }))
    .optional(),
  tech: z.array(techGroupSchema).optional(),
});

export const experienceSchema = z.object({ roles: z.array(roleSchema).min(1) });

export const skillsSchema = z.object({
  top: z.array(z.string()).min(1),
  groups: z
    .array(
      z.object({
        label: z.string(),
        note: z.string().optional(),
        items: z.array(z.string()).min(1),
      }),
    )
    .min(1),
});

export const certificationsSchema = z.object({
  groups: z
    .array(
      z.object({
        label: z.string(),
        items: z.array(z.object({ name: z.string() })).min(1),
      }),
    )
    .min(1),
  courses: z.array(z.string()).min(1),
});

export const educationSchema = z.object({
  education: z
    .array(
      z.object({
        id: z.string(),
        qualification: z.string(),
        field: z.string(),
        specialisation: z.string().optional(),
        institution: z.string(),
        institutionNote: z.string().optional(),
        location: z.string(),
        start: yearMonth,
        end: yearMonth,
        subjects: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  languages: z
    .array(
      z.object({
        name: z.string(),
        level: z.string(),
        cefr: z.string().nullable(),
      }),
    )
    .min(1),
});

export const interestsSchema = z.object({
  interests: z
    .array(
      z.object({
        id: z.string(),
        icon: z.enum(['bike', 'waves', 'tree', 'wrench']),
        title: z.string(),
        body: z.string(),
      }),
    )
    .min(1),
});

export const contributionSchema = z.object({
  id: z.string(),
  type: z.enum(['talk', 'video', 'writing', 'community']),
  /** Null for ongoing work, which is excluded from the rolling twelve-month count. */
  date: isoDate.nullable(),
  title: z.string(),
  /** BCP 47 tag for titles that are not in English. */
  lang: z.string().optional(),
  venue: z.string().optional(),
  url: z.string().url().nullable().default(null),
  summary: z.string(),
});

export const communitySchema = z.object({
  contributions: z.array(contributionSchema).min(1),
});

export type Profile = z.infer<typeof profileSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type Certifications = z.infer<typeof certificationsSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Interests = z.infer<typeof interestsSchema>;
export type Contribution = z.infer<typeof contributionSchema>;

/**
 * Parses a data file and fails the build with a readable message rather than a
 * stack trace full of Zod internals.
 */
export function parseData<T extends z.ZodTypeAny>(
  schema: T,
  raw: unknown,
  fileName: string,
): z.infer<T> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;

  const issues = result.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid CV data in src/data/${fileName}:\n${issues}`);
}
