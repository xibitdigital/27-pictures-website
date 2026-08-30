/**
 * Shared series-hub chrome. Title, lead and episode cards come from D1;
 * this is the furniture that used to be copied into four HTML files.
 */
import { localePath, type Locale } from "./i18n";

export interface HubCopy {
  breadcrumbLabel: string;
  sectionTag: string;
  episodesLabel: string;
  howLabel: string;
  howTitle: string;
  how1: string;
  how2: string;
  footer: string;
  footerNav: string;
  footerToons: string;
  footerDarkroom: string;
  footerWatch: string;
  footerContact: string;
  filmsLabel: string;
  filmsTitle: string;
  films1: string;
}

const HOW1_EN =
  "Each episode opens as a book: a cover you turn, plates that fill the screen, and word balloons that appear where the sound is coming from. Captions are written in <strong>English, Italian, German and French</strong>, and every line is voiced — tap a balloon and you hear it. Sound effects are placed per panel rather than layered over the whole page.";

export const HUB_COPY: Record<Locale, HubCopy> = {
  en: {
    breadcrumbLabel: "Breadcrumb",
    sectionTag: "Interactive toons",
    episodesLabel: "Episodes",
    howLabel: "How it reads",
    howTitle: "A book, not a scrolling feed",
    how1: HOW1_EN,
    how2: 'The plates are hand-inked black and white: no colour, no screentone shortcuts, deep blacks that hold detail on a phone. Reading position is remembered on your own device, so <a href="/toons/">the toons index</a> can put you back where you stopped.',
    footer:
      "27 Pictures is a horror film and cinematic cosplay production studio working across Switzerland and the United Kingdom.",
    footerNav: "Related links",
    footerToons: "All toons",
    footerDarkroom: "The Darkroom",
    footerWatch: "Watch",
    footerContact: "Contact",
    filmsLabel: "Also on film",
    filmsTitle: "The same name, in two forms",
    films1:
      'RED SMILE is also the horror anthology 27 Pictures shoots as short films — <a href="/horror-shorts/">The Red Smile</a> collects them. The toons are the read version of the same appetite: ordinary rooms, a slow wrongness, no jump to hide behind.',
  },
  de: {
    breadcrumbLabel: "Brotkrumen",
    sectionTag: "Interaktive Toons",
    episodesLabel: "Episoden",
    howLabel: "So liest du",
    howTitle: "Ein Buch, kein Feed",
    how1: "Jede Episode öffnet sich wie ein Buch: ein Cover zum Umblättern, Tafeln, die den Bildschirm füllen, und Sprechblasen dort, wo der Ton herkommt. Die Texte sind auf <strong>Englisch, Italienisch, Deutsch und Französisch</strong>, und jede Zeile ist gesprochen — tippe eine Blase und du hörst sie. Geräusche sitzen pro Panel, nicht über die ganze Seite gelegt.",
    how2: 'Die Tafeln sind handgetuscht, schwarzweiß: keine Farbe, keine Raster-Abkürzungen, tiefe Schwarztöne, die auf dem Handy Detail halten. Die Leseposition bleibt auf diesem Gerät, damit <a href="/toons/">die Toon-Übersicht</a> dich dort wieder einsetzen kann, wo du aufgehört hast.',
    footer:
      "27 Pictures ist ein Studio für Horrorfilm und cineastisches Cosplay in der Schweiz und im Vereinigten Königreich.",
    footerNav: "Verwandte Links",
    footerToons: "Alle Toons",
    footerDarkroom: "The Darkroom",
    footerWatch: "Filme",
    footerContact: "Kontakt",
    filmsLabel: "Auch als Film",
    filmsTitle: "Derselbe Name, zwei Formen",
    films1:
      'RED SMILE ist auch die Horror-Anthologie, die 27 Pictures als Kurzfilme dreht — <a href="/horror-shorts/">The Red Smile</a> sammelt sie. Die Toons sind die gelesene Form desselben Appetits: gewöhnliche Räume, eine langsame Verkehrtheit, kein Schock zum Verstecken.',
  },
  it: {
    breadcrumbLabel: "Percorso di navigazione",
    sectionTag: "Toon interattivi",
    episodesLabel: "Episodi",
    howLabel: "Come si legge",
    howTitle: "Un libro, non un feed",
    how1: "Ogni episodio si apre come un libro: una copertina da sfogliare, tavole a schermo intero e nuvolette dove arriva il suono. I testi sono in <strong>inglese, italiano, tedesco e francese</strong>, e ogni riga è doppiata — tocca una nuvoletta e la senti. Gli effetti sono per vignetta, non stesi su tutta la pagina.",
    how2: 'Le tavole sono inchiostrate a mano in bianco e nero: niente colore, niente retini facili, neri profondi che tengono il dettaglio sul telefono. La posizione di lettura resta su questo dispositivo, così <a href="/toons/">l\'indice dei toon</a> ti riporta dove hai smesso.',
    footer: "27 Pictures è uno studio di film horror e cosplay cinematografico tra Svizzera e Regno Unito.",
    footerNav: "Link correlati",
    footerToons: "Tutti i toon",
    footerDarkroom: "The Darkroom",
    footerWatch: "Guarda",
    footerContact: "Contatti",
    filmsLabel: "Anche in film",
    filmsTitle: "Lo stesso nome, due forme",
    films1:
      'RED SMILE è anche l\'antologia horror che 27 Pictures gira come corti — <a href="/horror-shorts/">The Red Smile</a> li raccoglie. I toon sono la versione da leggere dello stesso appetito: stanze ordinarie, un torto lento, nessuno jump scare dietro cui nascondersi.',
  },
  fr: {
    breadcrumbLabel: "Fil d'Ariane",
    sectionTag: "Toons interactifs",
    episodesLabel: "Épisodes",
    howLabel: "Comment ça se lit",
    howTitle: "Un livre, pas un fil",
    how1: "Chaque épisode s'ouvre comme un livre : une couverture à tourner, des planches plein écran, et des bulles là d'où vient le son. Les textes sont en <strong>anglais, italien, allemand et français</strong>, et chaque ligne est dite — tapez une bulle et vous l'entendez. Les bruits sont par case, pas posés sur toute la page.",
    how2: 'Les planches sont encrées à la main en noir et blanc : pas de couleur, pas de trames de facilité, des noirs profonds qui tiennent le détail sur un téléphone. La position de lecture reste sur cet appareil, pour que <a href="/toons/">l\'index des toons</a> vous remette où vous vous êtes arrêté.',
    footer: "27 Pictures est un studio de films d'horreur et de cosplay cinématographique en Suisse et au Royaume-Uni.",
    footerNav: "Liens associés",
    footerToons: "Tous les toons",
    footerDarkroom: "The Darkroom",
    footerWatch: "Voir",
    footerContact: "Contact",
    filmsLabel: "Aussi en film",
    filmsTitle: "Le même nom, deux formes",
    films1:
      "RED SMILE est aussi l'anthologie d'horreur que 27 Pictures tourne en courts — <a href=\"/horror-shorts/\">The Red Smile</a> les rassemble. Les toons sont la version lue du même appétit : des pièces ordinaires, un tort lent, pas de jump scare derrière lequel se cacher.",
  },
};

export function localizeHubCopy(copy: HubCopy, locale: Locale): HubCopy {
  const rewrite = (html: string) =>
    html.replace(/href="(\/[^"]*)"/g, (_, href: string) => `href="${localePath(href, locale)}"`);
  return {
    ...copy,
    how2: rewrite(copy.how2),
    films1: rewrite(copy.films1),
  };
}
