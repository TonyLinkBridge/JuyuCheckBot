"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";

const options = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const;

function applyTheme(preference: ThemePreference) {
  const resolved = preference === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("juyu-theme");
    const preference: ThemePreference = stored === "light" || stored === "system" ? stored : "dark";
    setTheme(preference);
    applyTheme(preference);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => theme === "system" && applyTheme("system");
    media.addEventListener("change", syncSystemTheme);
    return () => media.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  function selectTheme(preference: ThemePreference) {
    setTheme(preference);
    window.localStorage.setItem("juyu-theme", preference);
    applyTheme(preference);
  }

  return (
    <div className="theme-switch" role="group" aria-label="界面主题">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className={cn(theme === value && "selected")}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          onClick={() => selectTheme(value)}
        >
          <Icon size={14} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
