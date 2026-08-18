/**
 * Site locales.
 *
 * English lives at the root, not under `/en/`: those URLs are indexed and moving
 * them to add a prefix would spend real ranking equity to buy symmetry. The
 * other locales are subdirectories — `/de/toons/`, `/it/toons/`, `/fr/toons/`.
 *
 * Only pages that actually have a translated HTML document are prefixed. Readers
 * stay on one English URL (captions are already multilingual); a `/de/toons/erin/`
 * with English fallback copy would be a language mismatch, and Google ignores
 * incomplete or dishonest hreflang clusters.
 *
 * The locale of a page is declared once, in its `<html lang>`, and read from
 * there by everything that needs it: the nav labels, the language selector, and
 * the landing page remembering a caption-language hint for the readers.
 */

export const LOCALES = ["en", "de", "it", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

/** The locale served from the root — has no path prefix. */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Paths that have a real translated document. Trailing slash is required; this
 * is `/toons/` the landing page, not `/toons/erin/` the reader.
 *
 * Keep in step with `LOCALE_PAGES` in `vite/plugins/localePages.ts` — that list
 * is what actually writes the HTML, and a path here without a page there sends
 * the language switcher to a 404.
 */
export const LOCALIZED_PATHS = [
  "/",
  "/watch/",
  "/cosplay/",
  "/horror-shorts/",
  "/horror-shorts/the-doll-moved-again/",
  "/horror-shorts/shes-not-running-away/",
  "/horror-shorts/she-asked-for-directions/",
  "/horror-shorts/something-is-wrong-with-my-reflection/",
  "/horror-shorts/he-streamed-the-challenge/",
  "/toons/",
  "/toons/erin-and-the-goblins/",
] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  de: "DE",
  it: "IT",
  fr: "FR",
};

/** Full names, for the selector's accessible labels. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  it: "Italiano",
  fr: "Français",
};

/** Shared hint the landing page writes so a reader can open in that language. */
export const SITE_LOCALE_KEY = "27p-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The locale this document is in. Reads `<html lang>`, falling back to English
 * — a page that forgets to declare one is English by construction, since that is
 * what the untranslated sources are.
 */
export function documentLocale(doc: Document = document): Locale {
  const raw = doc.documentElement.getAttribute("lang")?.slice(0, 2).toLowerCase();
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Splits a path into its locale prefix and the path within that locale. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const match = /^\/([a-z]{2})(\/|$)/.exec(pathname);
  if (match && isLocale(match[1]) && match[1] !== DEFAULT_LOCALE) {
    const rest = pathname.slice(match[1].length + 1);
    return { locale: match[1], path: rest.startsWith("/") ? rest : `/${rest}` };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/** True when this path has a translated HTML page (not just translated captions). */
export function isLocalizedPath(pathname: string): boolean {
  const { path } = splitLocale(pathname);
  return (LOCALIZED_PATHS as readonly string[]).includes(path);
}

/**
 * The same page in another locale. Untranslated pages stay on their English URL.
 * A query or fragment rides along: `/#contact` on a German page is
 * `/de/#contact`, which is the German homepage's contact section, not the
 * English one's.
 */
export function localePath(pathname: string, locale: Locale): string {
  const cut = pathname.search(/[?#]/);
  const bare = cut === -1 ? pathname : pathname.slice(0, cut);
  const rest = cut === -1 ? "" : pathname.slice(cut);
  const { path } = splitLocale(bare);
  if (!isLocalizedPath(path)) return `${path}${rest}`;
  return `${locale === DEFAULT_LOCALE ? path : `/${locale}${path}`}${rest}`;
}

/**
 * Every version of a page, for the hreflang cluster. Must include the page's own
 * locale and be reciprocal across all of them — an incomplete cluster is ignored
 * wholesale rather than partially honoured.
 */
export function localeAlternates(pathname: string): Array<{ locale: Locale | "x-default"; path: string }> {
  const alternates: Array<{ locale: Locale | "x-default"; path: string }> = LOCALES.map((locale) => ({
    locale,
    path: localePath(pathname, locale),
  }));
  alternates.push({ locale: "x-default", path: localePath(pathname, DEFAULT_LOCALE) });
  return alternates;
}

export function rememberDocumentLocale(doc: Document = document): Locale {
  const locale = documentLocale(doc);
  try {
    localStorage.setItem(SITE_LOCALE_KEY, locale);
    localStorage.setItem(`${SITE_LOCALE_KEY}-at`, String(Date.now()));
  } catch {
    /* ignore */
  }
  return locale;
}

/** Append `?lang=` so a reader opened from a locale landing starts in that language. */
export function withCaptionLang(href: string, locale: Locale = documentLocale()): string {
  if (locale === DEFAULT_LOCALE) return href;
  const hash = href.indexOf("#");
  const beforeHash = hash === -1 ? href : href.slice(0, hash);
  const afterHash = hash === -1 ? "" : href.slice(hash);
  const sep = beforeHash.includes("?") ? "&" : "?";
  if (/[?&]lang=/.test(beforeHash)) return href;
  return `${beforeHash}${sep}lang=${locale}${afterHash}`;
}

export function rememberedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(SITE_LOCALE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** UI strings for the site chrome. Page copy lives in the pages themselves. */
type NavKey =
  | "darkroom"
  | "watch"
  | "toons"
  | "cosplay"
  | "contact"
  | "language"
  | "home"
  | "pageOf"
  | "pagesCount"
  | "vote"
  | "votes"
  | "contactFormLabel"
  | "contactName"
  | "contactEmail"
  | "contactMessage"
  | "contactMessageLabel"
  | "contactSend"
  | "contactSending"
  | "contactVerifying"
  | "contactErrName"
  | "contactErrEmail"
  | "contactErrMessage"
  | "contactSent"
  | "contactFailed"
  | "contactError";

export const UI: Record<Locale, Record<NavKey, string>> = {
  en: {
    darkroom: "The Darkroom",
    watch: "Watch",
    toons: "Toons",
    cosplay: "Cosplay",
    contact: "Contact",
    language: "Language",
    home: "Home",
    pageOf: "Page {page} of {pages}",
    pagesCount: "{n} pages",
    vote: "vote",
    votes: "votes",
    contactFormLabel: "Contact form",
    contactName: "Your Name",
    contactEmail: "Your Email",
    contactMessage: "Tell us about your project...",
    contactMessageLabel: "Your Message",
    contactSend: "Send Message",
    contactSending: "Sending...",
    contactVerifying: "Verifying...",
    contactErrName: "Please enter your name",
    contactErrEmail: "Please enter a valid email address",
    contactErrMessage: "Please enter a message",
    contactSent: "Message sent successfully!",
    contactFailed: "Failed to send message. Please try again.",
    contactError: "An error occurred. Please try again.",
  },
  de: {
    // "The Darkroom" stays: it is the name of the anthology strand, not a word.
    darkroom: "The Darkroom",
    watch: "Filme",
    toons: "Toons",
    cosplay: "Cosplay",
    contact: "Kontakt",
    language: "Sprache",
    home: "Start",
    pageOf: "Seite {page} von {pages}",
    pagesCount: "{n} Seiten",
    vote: "Stimme",
    votes: "Stimmen",
    contactFormLabel: "Kontaktformular",
    contactName: "Ihr Name",
    contactEmail: "Ihre E-Mail",
    contactMessage: "Erzählen Sie uns von Ihrem Projekt...",
    contactMessageLabel: "Ihre Nachricht",
    contactSend: "Nachricht senden",
    contactSending: "Wird gesendet...",
    contactVerifying: "Wird geprüft...",
    contactErrName: "Bitte geben Sie Ihren Namen ein",
    contactErrEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein",
    contactErrMessage: "Bitte geben Sie eine Nachricht ein",
    contactSent: "Nachricht erfolgreich gesendet!",
    contactFailed: "Nachricht konnte nicht gesendet werden. Bitte erneut versuchen.",
    contactError: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
  },
  it: {
    darkroom: "The Darkroom",
    watch: "Film",
    toons: "Toons",
    cosplay: "Cosplay",
    contact: "Contatti",
    language: "Lingua",
    home: "Home",
    pageOf: "Pagina {page} di {pages}",
    pagesCount: "{n} pagine",
    vote: "voto",
    votes: "voti",
    contactFormLabel: "Modulo di contatto",
    contactName: "Il tuo nome",
    contactEmail: "La tua email",
    contactMessage: "Raccontaci del tuo progetto...",
    contactMessageLabel: "Il tuo messaggio",
    contactSend: "Invia messaggio",
    contactSending: "Invio in corso...",
    contactVerifying: "Verifica in corso...",
    contactErrName: "Inserisci il tuo nome",
    contactErrEmail: "Inserisci un indirizzo email valido",
    contactErrMessage: "Inserisci un messaggio",
    contactSent: "Messaggio inviato con successo!",
    contactFailed: "Invio del messaggio non riuscito. Riprova.",
    contactError: "Si è verificato un errore. Riprova.",
  },
  fr: {
    darkroom: "The Darkroom",
    watch: "Films",
    toons: "Toons",
    cosplay: "Cosplay",
    contact: "Contact",
    language: "Langue",
    home: "Accueil",
    pageOf: "Page {page} sur {pages}",
    pagesCount: "{n} pages",
    vote: "vote",
    votes: "votes",
    contactFormLabel: "Formulaire de contact",
    contactName: "Votre nom",
    contactEmail: "Votre e-mail",
    contactMessage: "Parlez-nous de votre projet...",
    contactMessageLabel: "Votre message",
    contactSend: "Envoyer le message",
    contactSending: "Envoi en cours...",
    contactVerifying: "Vérification en cours...",
    contactErrName: "Veuillez saisir votre nom",
    contactErrEmail: "Veuillez saisir une adresse e-mail valide",
    contactErrMessage: "Veuillez saisir un message",
    contactSent: "Message envoyé avec succès !",
    contactFailed: "Échec de l'envoi du message. Veuillez réessayer.",
    contactError: "Une erreur est survenue. Veuillez réessayer.",
  },
};
