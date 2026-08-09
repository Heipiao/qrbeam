"use client";

import { useEffect } from "react";
import { copy, languageInfo, localeHref, locales, type Locale } from "./i18n";

const STORAGE_KEY = "qrbeam.locale";
const defaultPaths = new Set(["/", "/install", "/privacy", "/support"]);

function isLocale(value: string | null): value is Locale {
  return value !== null && locales.includes(value as Locale);
}

function browserLocale(): Locale {
  for (const language of navigator.languages.length ? navigator.languages : [navigator.language]) {
    const locale = language.toLowerCase().split("-")[0];
    if (isLocale(locale)) return locale;
  }
  return "zh";
}

function savedLocale(): Locale | null {
  try {
    const locale = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(locale) ? locale : null;
  } catch {
    return null;
  }
}

function saveLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Language switching still works when browser storage is unavailable.
  }
}

export function LanguageRedirect() {
  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (!defaultPaths.has(pathname)) return;

    const locale = savedLocale() ?? browserLocale();
    if (locale === "zh") return;

    const target = `/${locale}${pathname === "/" ? "" : pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);

  return null;
}

export function LanguageMenu({ locale, page }: { locale: Locale; page: string }) {
  const t = copy[locale].common;

  return (
    <details className="language-menu">
      <summary aria-label={t.language}>文 <span>⌄</span></summary>
      <div>
        {locales.map(item => (
          <a
            className={item === locale ? "active" : ""}
            href={localeHref(item, page)}
            hrefLang={languageInfo[item].htmlLang}
            aria-current={item === locale ? "page" : undefined}
            onClick={() => saveLocale(item)}
            key={item}
          >
            {languageInfo[item].label}
          </a>
        ))}
      </div>
    </details>
  );
}
