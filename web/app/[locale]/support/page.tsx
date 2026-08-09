import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, isLocale, locales } from "../../i18n";
import { LocalizedSupport } from "../../support/page";

export const dynamicParams = false;
export function generateStaticParams() { return locales.map(locale => ({ locale })); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; return isLocale(locale) ? { title: `${copy[locale].common.techSupport} — QRBeam`, description: copy[locale].support.description } : {}; }
export default async function LocaleSupport({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); return <LocalizedSupport locale={locale} />; }
