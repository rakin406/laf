import { cn } from "@/lib/utils";
import { avatarTone, initialsOf } from "@/lib/domain";

const toneClasses: Record<string, string> = {
  "bg-twilight": "bg-[var(--color-twilight-indigo-500)] text-white",
  "bg-aqua": "bg-[var(--color-pearl-aqua-600)] text-white",
  "bg-peach": "bg-[var(--color-peach-glow-500)] text-[var(--color-peach-glow-950)]",
  "bg-raspberry": "bg-[var(--color-raspberry-500)] text-white",
  "bg-indigo-soft": "bg-[var(--color-twilight-indigo-300)] text-[var(--color-twilight-indigo-900)]",
};

type Props = {
  name: string;
  avatarUrl?: string | null | undefined;
  seed?: string | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  className?: string | undefined;
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
};

/** Avatar with a deterministic initials fallback when no picture exists. */
export function UserAvatar({ name, avatarUrl, seed, size = "md", className }: Props) {
  const tone = toneClasses[avatarTone(seed ?? name)] ?? toneClasses["bg-twilight"]!;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name}'s profile picture`}
        loading="lazy"
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        sizes[size],
        tone,
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
