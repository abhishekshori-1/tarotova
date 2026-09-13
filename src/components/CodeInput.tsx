"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * One accessible text input styled as six cells (PLAN.md section 3):
 * supports paste, `autocomplete="one-time-code"`, and preserves leading
 * zeros because the value is handled as a string throughout, never parsed
 * as a number.
 */
export function CodeInput({ value, onChange, disabled }: Props) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      aria-label="6-digit verification code"
      className="min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white/60 py-3 text-center font-mono text-2xl tracking-[0.6em] outline-none disabled:opacity-60"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, transparent 0, transparent calc(100%/6 - 1px), var(--color-border) calc(100%/6 - 1px), var(--color-border) calc(100%/6))",
        backgroundSize: "100% 1px",
        backgroundPosition: "bottom",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
