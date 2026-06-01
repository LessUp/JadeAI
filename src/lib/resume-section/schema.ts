import { z } from 'zod/v4';

const idSchema = z.string().min(1);
const stringSchema = z.string();
const optionalStringSchema = z.string().optional();
const stringArraySchema = z.array(z.string());

const personalInfoSchema = z.object({
  fullName: stringSchema.optional(),
  jobTitle: stringSchema.optional(),
  age: optionalStringSchema,
  gender: optionalStringSchema,
  politicalStatus: optionalStringSchema,
  ethnicity: optionalStringSchema,
  hometown: optionalStringSchema,
  maritalStatus: optionalStringSchema,
  yearsOfExperience: optionalStringSchema,
  educationLevel: optionalStringSchema,
  email: stringSchema.optional(),
  phone: stringSchema.optional(),
  wechat: optionalStringSchema,
  location: stringSchema.optional(),
  website: optionalStringSchema,
  linkedin: optionalStringSchema,
  github: optionalStringSchema,
  avatar: optionalStringSchema,
  customLinks: z.array(z.object({ label: stringSchema, url: stringSchema })).optional(),
});

const summarySchema = z.object({
  text: stringSchema,
});

const workExperienceSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    company: stringSchema,
    position: stringSchema,
    location: optionalStringSchema,
    startDate: stringSchema,
    endDate: z.string().nullable(),
    current: z.boolean(),
    description: stringSchema,
    technologies: stringArraySchema.optional().default([]),
    highlights: stringArraySchema.optional().default([]),
  })),
});

const educationSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    institution: stringSchema,
    degree: stringSchema,
    field: stringSchema,
    location: optionalStringSchema,
    startDate: stringSchema,
    endDate: stringSchema,
    gpa: optionalStringSchema,
    highlights: stringArraySchema.optional().default([]),
  })),
});

const skillsSchema = z.object({
  categories: z.array(z.object({
    id: idSchema,
    name: stringSchema,
    skills: stringArraySchema,
  })),
});

const projectsSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    name: stringSchema,
    url: optionalStringSchema,
    startDate: optionalStringSchema,
    endDate: optionalStringSchema,
    description: stringSchema,
    technologies: stringArraySchema.optional().default([]),
    highlights: stringArraySchema.optional().default([]),
  })),
});

const certificationsSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    name: stringSchema,
    issuer: stringSchema,
    date: stringSchema,
    url: optionalStringSchema,
  })),
});

const languagesSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    language: stringSchema,
    proficiency: stringSchema,
    description: optionalStringSchema,
  })),
});

const githubSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    repoUrl: stringSchema,
    name: stringSchema,
    stars: z.number().int(),
    language: stringSchema,
    description: stringSchema,
  })),
});

const customSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    title: stringSchema,
    subtitle: optionalStringSchema,
    date: optionalStringSchema,
    description: stringSchema,
  })),
});

const qrCodesSchema = z.object({
  items: z.array(z.object({
    id: idSchema,
    label: stringSchema,
    url: stringSchema,
  })),
});

const schemaByType = {
  personal_info: personalInfoSchema,
  summary: summarySchema,
  work_experience: workExperienceSchema,
  education: educationSchema,
  skills: skillsSchema,
  projects: projectsSchema,
  certifications: certificationsSchema,
  languages: languagesSchema,
  github: githubSchema,
  custom: customSchema,
  qr_codes: qrCodesSchema,
} as const;

export type ResumeSectionType = keyof typeof schemaByType;

const sectionTypes = new Set<ResumeSectionType>(Object.keys(schemaByType) as ResumeSectionType[]);

export function isResumeSectionType(value: string): value is ResumeSectionType {
  return sectionTypes.has(value as ResumeSectionType);
}

export function normalizeResumeSectionContent(type: string, content: unknown): unknown {
  if (!isResumeSectionType(type)) return content;
  return schemaByType[type].parse(content);
}
