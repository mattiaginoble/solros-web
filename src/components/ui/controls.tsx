"use client";
/** Controlli di base dell'interfaccia (pulsanti, campi numerici in cm, selettori). */
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-prussian text-white hover:bg-prussian-strong border border-prussian",
  secondary: "bg-panel text-graphite border border-line-strong hover:border-graphite-soft",
  ghost: "bg-transparent text-graphite border border-transparent hover:bg-panel-sunk",
  danger: "bg-panel text-danger border border-line-strong hover:border-danger hover:bg-danger-tint",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; icon?: ReactNode }
>(function Button({ variant = "secondary", size = "md", icon, className = "", children, ...rest }, ref) {
  const sz = size === "sm" ? "h-8 px-2.5 text-[13px] gap-1.5" : "h-10 px-3.5 text-sm gap-2";
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-[5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${sz} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  active,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-[5px] border transition-colors disabled:opacity-40 ${
        active
          ? "border-prussian bg-prussian-tint text-prussian"
          : "border-transparent text-graphite-soft hover:bg-panel-sunk hover:text-graphite"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(n: number, decimals = 1) {
  const r = Math.round(n * 10 ** decimals) / 10 ** decimals;
  return r.toLocaleString("it-IT", { maximumFractionDigits: decimals, useGrouping: false });
}

/**
 * Campo numerico con unità: accetta la virgola, conferma con Invio o all'uscita,
 * annulla con Esc. Freccia su/giù per incrementi (Maiusc ×10).
 */
export function NumberField({
  label,
  value,
  onChange,
  unit = "cm",
  min,
  max,
  step = 1,
  decimals = 1,
  disabled,
  className = "",
  width = "w-24",
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  disabled?: boolean;
  className?: string;
  width?: string;
  hint?: string;
}) {
  const id = useId();
  const [text, setText] = useState(formatNumber(value, decimals));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatNumber(value, decimals));
  }, [value, decimals]);

  const commit = (raw = text) => {
    const n = parseNumber(raw);
    if (n === null) {
      setError("Inserisci un numero");
      return false;
    }
    if (min !== undefined && n < min) {
      setError(`Minimo ${formatNumber(min, decimals)} ${unit}`);
      return false;
    }
    if (max !== undefined && n > max) {
      setError(`Massimo ${formatNumber(max, decimals)} ${unit}`);
      return false;
    }
    setError(null);
    if (Math.abs(n - value) > 1e-9) onChange(n);
    setText(formatNumber(n, decimals));
    return true;
  };

  return (
    <label htmlFor={id} className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      <span
        className={`flex h-9 items-center rounded-[5px] border bg-panel pr-2 focus-within:border-prussian ${
          error ? "border-danger" : "border-line-strong"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          value={text}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            if (!commit()) {
              setText(formatNumber(value, decimals));
              setError(null);
            }
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              if (commit()) (e.target as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              setText(formatNumber(value, decimals));
              setError(null);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              const cur = parseNumber(text) ?? value;
              const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
              let n = cur + d;
              if (min !== undefined) n = Math.max(min, n);
              if (max !== undefined) n = Math.min(max, n);
              setText(formatNumber(n, decimals));
              commit(String(n));
            }
          }}
          className={`h-full ${width} min-w-0 bg-transparent px-2 text-sm tabular-nums outline-none`}
        />
        <span className="text-xs text-muted">{unit}</span>
      </span>
      {(error || hint) && (
        <span id={`${id}-msg`} className={`text-[11px] ${error ? "text-danger" : "text-muted"}`}>
          {error ?? hint}
        </span>
      )}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }
  return (
    <label htmlFor={id} className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      <input
        id={id}
        value={text}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() && text !== value && onChange(text.trim())}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setText(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-9 rounded-[5px] border border-line-strong bg-panel px-2.5 text-sm outline-none focus:border-prussian"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-muted">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        onKeyDown={(e) => e.stopPropagation()}
        className="h-9 rounded-[5px] border border-line-strong bg-panel px-2 text-sm outline-none focus:border-prussian"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Controllo segmentato (es. Casa / Stanza, 2D / 3D). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[6px] border border-line-strong bg-panel-sunk p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-[4px] px-3 text-[13px] font-medium transition-colors disabled:opacity-40 ${
              active ? "bg-panel text-prussian shadow-[0_0_0_1px_var(--line-strong)]" : "text-graphite-soft hover:text-graphite"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/30 p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-[10px] border border-line-strong bg-panel shadow-[0_20px_60px_-20px_rgba(35,39,43,0.45)] sm:rounded-[8px]`}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <IconButton label="Chiudi" onClick={onClose} data-close>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line bg-panel-sunk px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
