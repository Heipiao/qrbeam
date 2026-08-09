import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, isLocale, locales } from "../i18n";
import { LocalizedHome } from "../page";

export const dynamicParams = false;
export function generateStaticParams() { return locales.map(locale => ({ locale })); }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: `QRBeam — ${copy[locale].home.h2}`, description: copy[locale].home.lede };
}

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LocalizedHome locale={locale} />;
}
