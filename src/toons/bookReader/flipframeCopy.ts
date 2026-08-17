/**
 * FlipFrame chrome (cover instructions, about, auto-read) and helpers to pick
 * the language the reader is actually showing.
 */
import { computed, type ComputedRef } from "vue";
import { DEFAULT_LOCALE, documentLocale, isLocale, SITE_LOCALE_KEY, type Locale } from "../../site/i18n";
import { useToonCaptions } from "./captions/useToonCaptions";

export type LocalizedString = string | Partial<Record<string, string>>;

export type FlipframeKey =
  | "howtoBook"
  | "howtoScroll"
  | "howtoLabel"
  | "storyLabel"
  | "storyTitle"
  | "experiment"
  | "aboutTitle"
  | "aboutAria"
  | "aboutLead"
  | "aboutCta"
  | "contact"
  | "close"
  | "soundOn"
  | "soundOff"
  | "soundNote"
  | "muteSound"
  | "enableSound"
  | "build"
  | "startReading"
  | "autoReadTitle"
  | "autoReadBody"
  | "autoReadOk"
  | "autoReadLater"
  | "fallbackStory";

export const FLIPFRAME: Record<Locale, Record<FlipframeKey, string>> = {
  en: {
    howtoBook: "Use the arrow keys, or click on a page, to turn",
    howtoScroll: "Scroll to read. Captions in view play themselves — tap any bubble to replay.",
    howtoLabel: "How to read",
    storyLabel: "Story",
    storyTitle: "Story",
    experiment: "Experiment",
    aboutTitle: "FlipFrame beta",
    aboutAria: "About FlipFrame",
    aboutLead: "FlipFrame is a beta product by",
    aboutCta: "If you'd like to integrate this reader on your site, get in touch via our contact form.",
    contact: "Contact us",
    close: "Close",
    soundOn: "Sound on",
    soundOff: "Sound",
    soundNote: "Hover (or tap) glowing captions on any page to hear them",
    muteSound: "Mute sound",
    enableSound: "Enable sound",
    build: "build",
    startReading: "Start reading",
    autoReadTitle: "Captions play themselves",
    autoReadBody:
      "Browsers need one click before any page can make sound. Tap OK and FlipFrame will read glowing captions automatically as you turn pages — no need to tap each bubble.",
    autoReadOk: "OK — play captions",
    autoReadLater: "Not now",
    fallbackStory:
      "An interactive FlipFrame experiment from twentyseven.pictures — turn the pages, tap the captions, follow the case.",
  },
  it: {
    howtoBook: "Usa le frecce della tastiera, o clicca sulla pagina, per sfogliare",
    howtoScroll:
      "Scorri per leggere. Le didascalie in vista si riproducono da sole — tocca una nuvoletta per riascoltarla.",
    howtoLabel: "Come si legge",
    storyLabel: "Storia",
    storyTitle: "Storia",
    experiment: "Esperimento",
    aboutTitle: "FlipFrame beta",
    aboutAria: "Informazioni su FlipFrame",
    aboutLead: "FlipFrame è un prodotto in beta di",
    aboutCta: "Se vuoi integrare questo lettore sul tuo sito, scrivici dal modulo di contatto.",
    contact: "Contattaci",
    close: "Chiudi",
    soundOn: "Audio attivo",
    soundOff: "Audio",
    soundNote: "Passa sopra (o tocca) le didascalie luminose su ogni pagina per ascoltarle",
    muteSound: "Disattiva audio",
    enableSound: "Attiva audio",
    build: "build",
    startReading: "Inizia a leggere",
    autoReadTitle: "Le didascalie si ascoltano da sole",
    autoReadBody:
      "I browser chiedono un clic prima di riprodurre suoni. Tocca OK e FlipFrame leggerà automaticamente le didascalie luminose mentre sfogli — senza toccare ogni nuvoletta.",
    autoReadOk: "OK — ascolta le didascalie",
    autoReadLater: "Non ora",
    fallbackStory:
      "Un esperimento FlipFrame interattivo di twentyseven.pictures — sfoglia le pagine, tocca le didascalie, segui il caso.",
  },
  de: {
    howtoBook: "Mit den Pfeiltasten oder einem Klick auf die Seite umblättern",
    howtoScroll:
      "Scrollen zum Lesen. Sichtbare Sprechblasen spielen von selbst — tippe eine Blase, um sie zu wiederholen.",
    howtoLabel: "So liest du",
    storyLabel: "Geschichte",
    storyTitle: "Geschichte",
    experiment: "Experiment",
    aboutTitle: "FlipFrame-Beta",
    aboutAria: "Über FlipFrame",
    aboutLead: "FlipFrame ist ein Beta-Produkt von",
    aboutCta: "Wenn du diesen Reader auf deiner Seite einbinden willst, schreib uns über das Kontaktformular.",
    contact: "Kontakt",
    close: "Schließen",
    soundOn: "Ton an",
    soundOff: "Ton",
    soundNote: "Leuchtende Sprechblasen auf jeder Seite berühren (oder antippen), um sie zu hören",
    muteSound: "Ton aus",
    enableSound: "Ton einschalten",
    build: "Build",
    startReading: "Lesen beginnen",
    autoReadTitle: "Sprechblasen spielen von selbst",
    autoReadBody:
      "Browser brauchen einen Klick, bevor eine Seite Ton machen darf. Tippe auf OK und FlipFrame liest leuchtende Sprechblasen automatisch beim Umblättern — ohne jede Blase anzutippen.",
    autoReadOk: "OK — Sprechblasen abspielen",
    autoReadLater: "Nicht jetzt",
    fallbackStory:
      "Ein interaktives FlipFrame-Experiment von twentyseven.pictures — Seiten umblättern, Sprechblasen antippen, dem Fall folgen.",
  },
  fr: {
    howtoBook: "Utilisez les flèches du clavier, ou cliquez sur une page, pour tourner",
    howtoScroll:
      "Faites défiler pour lire. Les bulles à l'écran se lisent toutes seules — touchez une bulle pour la réécouter.",
    howtoLabel: "Comment lire",
    storyLabel: "Histoire",
    storyTitle: "Histoire",
    experiment: "Expérience",
    aboutTitle: "FlipFrame bêta",
    aboutAria: "À propos de FlipFrame",
    aboutLead: "FlipFrame est un produit en bêta de",
    aboutCta: "Pour intégrer ce lecteur à votre site, écrivez-nous via le formulaire de contact.",
    contact: "Nous contacter",
    close: "Fermer",
    soundOn: "Son activé",
    soundOff: "Son",
    soundNote: "Survolez (ou touchez) les bulles lumineuses de chaque page pour les entendre",
    muteSound: "Couper le son",
    enableSound: "Activer le son",
    build: "build",
    startReading: "Commencer la lecture",
    autoReadTitle: "Les bulles se lisent toutes seules",
    autoReadBody:
      "Les navigateurs exigent un clic avant tout son. Touchez OK et FlipFrame lira automatiquement les bulles lumineuses à chaque page — sans tapoter chaque bulle.",
    autoReadOk: "OK — lire les bulles",
    autoReadLater: "Pas maintenant",
    fallbackStory:
      "Une expérience FlipFrame interactive de twentyseven.pictures — tournez les pages, touchez les bulles, suivez l'affaire.",
  },
};

export function pickLocalized(value: LocalizedString | null | undefined, lang: string, fallback: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value && typeof value === "object") {
    const hit = (value[lang] || value[DEFAULT_LOCALE] || "").trim();
    if (hit) return hit;
  }
  return fallback;
}

/** Caption language once the book is ready; otherwise the landing-page hint. */
export function resolveReaderLocale(captions?: { ready: { value: boolean }; lang: { value: string } } | null): Locale {
  if (captions?.ready.value && isLocale(captions.lang.value)) return captions.lang.value;
  try {
    const stored = localStorage.getItem(SITE_LOCALE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return documentLocale();
}

export function useReaderLocale(): ComputedRef<Locale> {
  const captions = useToonCaptions();
  return computed(() => resolveReaderLocale(captions));
}

export function useFlipframeCopy(): ComputedRef<Record<FlipframeKey, string>> {
  const locale = useReaderLocale();
  return computed(() => FLIPFRAME[locale.value]);
}
