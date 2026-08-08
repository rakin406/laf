import { z } from "zod";

/** Timezone the whole application reasons about calendar days in. */
export const APP_TIMEZONE = "Asia/Dhaka";

export const AIUB_EMAIL_REGEX = /^[1-9]{2}-[0-9]{5}-[1-3]@student\.aiub\.edu$/;

export function isAiubStudentEmail(email: string): boolean {
  return AIUB_EMAIL_REGEX.test(email.trim().toLowerCase());
}

export const AIUB_EMAIL_MESSAGE =
  "Use your AIUB student email, e.g. 23-12345-1@student.aiub.edu";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .refine((value) => AIUB_EMAIL_REGEX.test(value), { message: AIUB_EMAIL_MESSAGE });

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters")
  .max(80, "Full name must be at most 80 characters");

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const postSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
  category: z.string().trim().min(1, "Choose a category"),
  lostDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
    .refine((value) => value <= todayInDhaka(), {
      message: "The lost date cannot be in the future",
    }),
});

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something before posting")
    .max(1000, "Comments are limited to 1000 characters"),
});

/** Today's calendar date in Asia/Dhaka as YYYY-MM-DD. */
export function todayInDhaka(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function tomorrowLabelInDhaka(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(tomorrow);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatRelative(value: string): string {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

/** Deterministic initials-based avatar fallback. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AI";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-twilight",
  "bg-aqua",
  "bg-peach",
  "bg-raspberry",
  "bg-indigo-soft",
] as const;

export type AvatarTone = (typeof AVATAR_COLORS)[number];

/** Deterministic colour tone derived from a stable key (user id or name). */
export function avatarTone(key: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG, PNG or WebP images are supported";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be smaller than 5 MB";
  }
  return null;
}

/** Human-readable message for a database/network error, safe to show a user. */
export function friendlyError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

  if (!raw) return fallback;
  if (raw.includes("DAILY_POST_LIMIT")) {
    return "You can create one lost-and-found post per day. You can post again tomorrow.";
  }
  if (raw.includes("photo of a post cannot be changed")) {
    return "The photo cannot be changed after a post is created.";
  }
  if (raw.includes("Account is banned") || raw.includes("banned")) {
    return "Your account has been suspended by a moderator.";
  }
  if (raw.includes("row-level security") || raw.includes("violates row-level")) {
    return "You are not allowed to perform this action.";
  }
  if (raw.includes("duplicate key") && raw.includes("bookmarks")) {
    return "This post is already saved.";
  }
  if (raw.includes("Lost date cannot be in the future")) {
    return "The lost date cannot be in the future.";
  }
  if (raw.includes("Invalid login credentials")) {
    return "Incorrect email or password.";
  }
  if (raw.includes("already registered") || raw.includes("User already registered")) {
    return "An account already exists for this student email. Try signing in instead.";
  }
  if (raw.includes("AIUB student emails")) {
    return AIUB_EMAIL_MESSAGE;
  }
  if (raw.toLowerCase().includes("failed to fetch") || raw.toLowerCase().includes("network")) {
    return "Network problem — check your connection and try again.";
  }
  return raw.length > 220 ? fallback : raw;
}
