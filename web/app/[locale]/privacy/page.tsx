import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { copy, isLocale, locales } from "../../i18n";
import { LocalizedPrivacy } from "../../privacy/page";

export const dynamicParams = false;
export function generateStaticParams() { return locales.map(locale => ({ locale })); }
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { const { locale } = await params; return isLocale(locale) ? { title: `${copy[locale].common.privacyPolicy} — QRBeam`, description: copy[locale].privacy.description } : {}; }
export default async function LocalePrivacy({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); return <LocalizedPrivacy locale={locale} />; }
