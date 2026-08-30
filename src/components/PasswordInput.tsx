"use client";

import { useState } from "react";

export default function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  required = true,
  value,
  onChange,
}: {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visivel ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-lg bg-allied-panel border border-allied-border px-4 py-3 pr-11 text-sm text-allied-silver placeholder:text-allied-silver/40 outline-none focus:border-allied-accent2 focus:ring-1 focus:ring-allied-accent2 transition"
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-allied-silver/60 hover:text-allied-accent2 transition"
        tabIndex={-1}
      >
        {visivel ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-7 .84-1.9 2.14-3.53 3.74-4.76M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 7-.53 1.2-1.26 2.31-2.16 3.27M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
