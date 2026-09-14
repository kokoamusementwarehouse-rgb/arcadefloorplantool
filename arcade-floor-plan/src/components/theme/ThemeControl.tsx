"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

type ThemePreference = "light" | "dark" | "system";

const storageKey = "arcade-floor-plan-theme-preference";
const options: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Desktop },
];

const isPreference = (value: string | null): value is ThemePreference => value === "light" || value === "dark" || value === "system";
const resolveTheme = (preference: ThemePreference) => preference === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : preference;

/** UI-only preference. It never reaches Supabase or any business store. */
export function ThemeControl() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find((option) => option.value === preference) ?? options[2];
  const ActiveIcon = active.Icon;

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const initial = isPreference(stored) ? stored : "system";
    setPreference(initial);
    const apply = (value: ThemePreference) => {
      document.documentElement.dataset.theme = resolveTheme(value);
      document.documentElement.dataset.themePreference = value;
    };
    apply(initial);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => { if ((localStorage.getItem(storageKey) ?? "system") === "system") apply("system"); };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const choose = (value: ThemePreference) => {
    localStorage.setItem(storageKey, value);
    document.documentElement.dataset.theme = resolveTheme(value);
    document.documentElement.dataset.themePreference = value;
    setPreference(value);
    setOpen(false);
  };

  return <div className="theme-control" ref={rootRef}>
    <button className="theme-trigger" type="button" onClick={() => setOpen((value) => !value)} aria-label={`Theme: ${active.label}`} aria-expanded={open} title={`Theme: ${active.label}`}><ActiveIcon size={16} weight="bold" /></button>
    {open ? <div className="theme-menu" role="menu" aria-label="Colour theme">{options.map(({ value, label, Icon }) => <button key={value} type="button" role="menuitemradio" aria-checked={preference === value} className={preference === value ? "theme-option theme-option--active" : "theme-option"} onClick={() => choose(value)}><Icon size={15} weight={preference === value ? "fill" : "regular"} /><span>{label}</span></button>)}</div> : null}
  </div>;
}
