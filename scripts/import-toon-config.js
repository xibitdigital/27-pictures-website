#!/usr/bin/env node
/**
 * Load a content/toons/<id>/config.json into the editor D1 via POST /toons/import.
 *
 *   node scripts/import-toon-config.js --toon erin-the-revenge
 *   node scripts/import-toon-config.js --all
 *   node scripts/import-toon-config.js --all --meta
 *
 * `--meta` PATCHes title/subtitle/descriptions from the current series pages
 * without rewriting pages or bubbles.
 *
 * Needs the Worker running and EDITOR_EMAIL / EDITOR_PASSWORD (or --email / --password).
 * API: VITE_EDITOR_API or --api (default http://127.0.0.1:8787).
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const SERIES = {
  erin: {
    key: "erin",
    title: "Erin & the Goblins",
    tagline: "Dark fantasy · a town that is really a door",
    description:
      "Half human, half vampire — she lives in a small town that is the passage between the goblin world and the human one.",
    descriptions: {
      en: "Half human, half vampire — she lives in a small town that is the passage between the goblin world and the human one.",
      it: "Metà umana, metà vampira — vive in una cittadina che è il passaggio tra il mondo dei goblin e quello umano.",
      de: "Halb Mensch, halb Vampir — sie lebt in einer Kleinstadt, die der Durchgang zwischen der Goblinwelt und der menschlichen ist.",
      fr: "Mi-humaine, mi-vampire — elle vit dans une petite ville qui est le passage entre le monde des gobelins et celui des humains.",
    },
    coverKey: "card-art/erin-dark.jpg",
    hubUrl: "/toons/erin-and-the-goblins/",
    sort: 10,
  },
  jax: {
    key: "jax",
    title: "Jax",
    tagline: "Cyberpunk · a netrunner robbing the people who own minds",
    description:
      "A netrunner with a rare sickness who steals corporate mind-control tech — a future Robin Hood in chrome.",
    descriptions: {
      en: "A netrunner with a rare sickness who steals corporate mind-control tech — a future Robin Hood in chrome.",
      it: "Un netrunner con una malattia rara che ruba alle corporazioni la tecnologia per il controllo mentale — un Robin Hood del futuro, in cromo.",
      de: "Ein Netrunner mit einer seltenen Krankheit, der Konzernen Gedankenkontrolltechnik stiehlt — ein Robin Hood der Zukunft, in Chrom.",
      fr: "Un netrunner atteint d'une maladie rare qui vole aux entreprises leur technologie de contrôle mental — un Robin des Bois du futur, en chrome.",
    },
    coverKey: "card-art/jax.jpg",
    hubUrl: "/toons/jax/",
    sort: 20,
  },
  nero: {
    key: "nero",
    title: "Nero",
    tagline: "Cyberpunk noir · a Scotland Yard case in the rain",
    description:
      "Detective Nero and forensic Eve hunt a sicario called The Dog — crystal tech, AI glasses, and who hired the bullet.",
    descriptions: {
      en: "Detective Nero and forensic Eve hunt a sicario called The Dog — crystal tech, AI glasses, and who hired the bullet.",
      it: "Il detective Nero e la forense Eve inseguono un sicario chiamato The Dog — tecnologia a cristalli, occhiali IA e chi ha pagato il proiettile.",
      de: "Detective Nero und Forensikerin Eve jagen einen Killer namens The Dog — Kristalltechnik, KI-Brillen und die Frage, wer die Kugel bezahlt hat.",
      fr: "Le détective Nero et la légiste Eve traquent un sicaire appelé The Dog — technologie de cristal, lunettes IA et qui a payé la balle.",
    },
    coverKey: "card-art/nero-page1.jpg",
    hubUrl: "/toons/nero/",
    sort: 30,
  },
  "red-smile": {
    key: "red-smile",
    title: "RED SMILE",
    tagline: "Horror · the anthology, as something you read",
    description:
      "Psychological horror in heavy black-and-white gekiga ink. Elena is alone in the flat when the television finds a channel that should not exist.",
    descriptions: {
      en: "Psychological horror in heavy black-and-white gekiga ink. Elena is alone in the flat when the television finds a channel that should not exist.",
      it: "Episodio 1 della serie RED SMILE. Horror psicologico a china gekiga, bianco e nero pesante — Elena è sola in casa quando la televisione trova un canale che non dovrebbe esistere.",
      de: "Episode 1 der Reihe RED SMILE. Psychologischer Horror in schwerer Schwarzweiß-Gekiga-Tusche — Elena ist allein in der Wohnung, als der Fernseher einen Kanal findet, den es nicht geben dürfte.",
      fr: "Épisode 1 de la série RED SMILE. Horreur psychologique à l'encre gekiga, noir et blanc dense — Elena est seule chez elle quand la télévision trouve une chaîne qui ne devrait pas exister.",
    },
    coverKey: "card-art/redsmile-static.jpg",
    hubUrl: "/toons/redsmile/",
    sort: 40,
  },
};

const META = {
  erin: {
    slug: "erin",
    title: "The Missing Child",
    titles: {
      en: "The Missing Child",
      it: "Il bambino scomparso",
      de: "Das vermisste Kind",
      fr: "L'enfant disparu",
    },
    subtitle: "Between two worlds",
    description:
      "A child goes missing from the alleys and Erin goes after her, through a door that should not be there.",
    descriptions: {
      en: "A child goes missing from the alleys and Erin goes after her, through a door that should not be there.",
      it: "Una bambina scompare dai vicoli e Erin le va dietro, attraverso una porta che non dovrebbe esserci.",
      de: "Ein Kind verschwindet aus den Gassen und Erin folgt ihm durch eine Tür, die es nicht geben dürfte.",
      fr: "Un enfant disparaît des ruelles et Erin part derrière elle, à travers une porte qui ne devrait pas être là.",
    },
    coverKey: "card-art/erin-dark.jpg",
    assetPageDir: "/toons/erin/",
    readerUrl: "/toons/erin/",
    designWidth: 1152,
    designHeight: 1728,
    status: "published",
    seriesKey: "erin",
    episodeN: 1,
    series: SERIES.erin,
  },
  "erin-the-revenge": {
    slug: "erin-the-revenge",
    title: "The Revenge",
    titles: {
      en: "The Revenge",
      it: "La vendetta",
      de: "Die Rache",
      fr: "La vengeance",
    },
    subtitle: "The Revenge",
    description: "She tears a portal open and goes back to defeat the Goblin King.",
    descriptions: {
      en: "She tears a portal open and goes back to defeat the Goblin King.",
      it: "Squarcia un portale e torna per sconfiggere il Re Goblin.",
      de: "Sie reißt ein Portal auf und kehrt zurück, um den Goblinkönig zu besiegen.",
      fr: "Elle déchire un portail et revient pour vaincre le Roi Gobelin.",
    },
    coverKey: "card-art/erin-the-revenge-intro.jpg",
    assetPageDir: "/toons/erin-the-revenge/",
    readerUrl: "/toons/erin-the-revenge/",
    designWidth: 1152,
    designHeight: 1728,
    status: "published",
    seriesKey: "erin",
    episodeN: 2,
    series: SERIES.erin,
  },
  jax: {
    slug: "jax",
    title: "The Chip",
    titles: {
      en: "The Chip",
      it: "Il Chip",
      de: "Der Chip",
      fr: "La Puce",
    },
    subtitle: "Cyberpunk Chronicles",
    description:
      "A netrunner with a rare sickness who steals corporate mind-control tech — a future Robin Hood in chrome.",
    descriptions: {
      en: "A netrunner with a rare sickness who steals corporate mind-control tech — a future Robin Hood in chrome.",
      it: "Un netrunner con una malattia rara che ruba alle corporazioni la tecnologia per il controllo mentale — un Robin Hood del futuro in cromo.",
      de: "Ein Netrunner mit einer seltenen Krankheit, der Konzernen die Technik zur Gedankenkontrolle stiehlt — ein Robin Hood der Zukunft in Chrom.",
      fr: "Un netrunner atteint d'une maladie rare qui vole aux entreprises leur techno de contrôle mental — un Robin des Bois du futur, en chrome.",
    },
    coverKey: "card-art/jax.jpg",
    assetPageDir: "/toons/jax/",
    readerUrl: "/toons/jax-the-chip/",
    designWidth: 1008,
    designHeight: 1792,
    status: "published",
    seriesKey: "jax",
    episodeN: 1,
    series: SERIES.jax,
  },
  nero: {
    slug: "nero",
    title: "The Dog",
    titles: {
      en: "The Dog",
      it: "Il Cane",
      de: "Der Hund",
      fr: "Le Chien",
    },
    subtitle: "Scotland Yard case",
    description:
      "Detective Nero and forensic Eve hunt a sicario called The Dog — crystal tech, AI glasses, and who hired the bullet.",
    descriptions: {
      en: "Detective Nero and forensic Eve hunt a sicario called The Dog — crystal tech, AI glasses, and who hired the bullet.",
      it: "Il detective Nero e la forense Eve danno la caccia a un sicario chiamato The Dog — tecnologia a cristalli, occhiali con IA, e chi ha pagato il proiettile.",
      de: "Detective Nero und die Forensikerin Eve jagen einen Sicario namens The Dog — Kristalltechnik, KI-Brille, und wer die Kugel bezahlt hat.",
      fr: "Le détective Nero et la légiste Eve traquent un sicaire appelé The Dog — techno de cristal, lunettes dopées à l'IA, et qui a payé la balle.",
    },
    coverKey: "card-art/nero-page1.jpg",
    assetPageDir: "/toons/nero/",
    readerUrl: "/toons/nero-the-dog/",
    designWidth: 800,
    designHeight: 1424,
    status: "published",
    seriesKey: "nero",
    episodeN: 1,
    series: SERIES.nero,
  },
  "redsmile-static": {
    slug: "redsmile-static",
    title: "static",
    titles: { en: "static", it: "static", de: "static", fr: "static" },
    subtitle: "RED SMILE",
    description: "Elena is alone in the flat when the television finds a channel that should not exist.",
    descriptions: {
      en: "Elena is alone in the flat when the television finds a channel that should not exist.",
      it: "Elena è sola in casa quando la televisione trova un canale che non dovrebbe esistere.",
      de: "Elena ist allein in der Wohnung, als der Fernseher einen Kanal findet, den es nicht geben dürfte.",
      fr: "Elena est seule chez elle quand la télévision trouve une chaîne qui ne devrait pas exister.",
    },
    coverKey: "card-art/redsmile-static.jpg",
    assetPageDir: "/toons/redsmile-static/",
    readerUrl: "/toons/redsmile-static/",
    designWidth: 800,
    designHeight: 1424,
    status: "published",
    seriesKey: "red-smile",
    episodeN: 1,
    series: SERIES["red-smile"],
  },
  "redsmile-marcus": {
    slug: "redsmile-marcus",
    title: "Marcus",
    titles: { en: "Marcus", it: "Marcus", de: "Marcus", fr: "Marcus" },
    subtitle: "RED SMILE",
    description: "Marcus works late at NEXORA. Halina cleans the tower. A transmission starts on his laptop.",
    descriptions: {
      en: "Marcus works late at NEXORA. Halina cleans the tower. A transmission starts on his laptop.",
      it: "Marcus lavora fino a tardi da NEXORA. Halina pulisce la torre. Sul suo laptop parte una trasmissione.",
      de: "Marcus arbeitet bis spät bei NEXORA. Halina putzt den Turm. Auf seinem Laptop beginnt eine Übertragung.",
      fr: "Marcus travaille tard chez NEXORA. Halina nettoie la tour. Une transmission démarre sur son ordinateur.",
    },
    coverKey: "card-art/redsmile-marcus.jpg",
    assetPageDir: "/toons/redsmile-marcus/",
    readerUrl: "/toons/redsmile-marcus/",
    designWidth: 800,
    designHeight: 1424,
    status: "draft",
    seriesKey: "red-smile",
    episodeN: 2,
    series: SERIES["red-smile"],
  },
};

function flag(name) {
  return process.argv.includes(`--${name}`);
}

async function importOne(api, token, toon) {
  const meta = META[toon];
  const configPath = path.join(ROOT, "content/toons", toon, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const res = await fetch(`${api}/toons/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...meta, config }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`import ${toon} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  console.log(
    `imported ${body.slug} id=${body.id} pages=${body.pages?.length ?? "?"} status=${body.status || meta.status}`
  );
}

async function patchMeta(api, token, toon) {
  const meta = META[toon];
  const list = await fetch(`${api}/toons`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = await list.json().catch(() => []);
  if (!list.ok || !Array.isArray(rows)) {
    throw new Error(`list toons failed: ${list.status} ${JSON.stringify(rows)}`);
  }
  const row = rows.find((item) => item.slug === meta.slug);
  if (!row) {
    throw new Error(`no toon ${meta.slug} in D1 — run a full import first`);
  }
  const res = await fetch(`${api}/toons/${row.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: meta.title,
      titles: meta.titles,
      subtitle: meta.subtitle,
      description: meta.description,
      descriptions: meta.descriptions,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`patch ${toon} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const langs = Object.entries(body.descriptions || {})
    .filter(([, text]) => String(text || "").trim())
    .map(([lang]) => lang)
    .join(",");
  console.log(`patched ${body.slug} id=${body.id} descriptions=${langs || "none"}`);
}

async function putSeries(api, token, series) {
  const res = await fetch(`${api}/series`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(series),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`put series ${series.key} failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const langs = Object.entries(body.descriptions || {})
    .filter(([, text]) => String(text || "").trim())
    .map(([lang]) => lang)
    .join(",");
  console.log(`series ${body.key} descriptions=${langs || "none"}`);
}

async function main() {
  const toon = arg("toon");
  const all = flag("all");
  const ids = all ? Object.keys(META) : toon ? [toon] : [];
  if (!ids.length || ids.some((id) => !META[id])) {
    console.error("Usage: node scripts/import-toon-config.js --toon <slug> | --all [--meta]");
    console.error("Known slugs:", Object.keys(META).join(", "));
    process.exit(1);
  }
  const metaOnly = flag("meta");
  const api = (arg("api") || process.env.VITE_EDITOR_API || "http://127.0.0.1:8787").replace(/\/$/, "");
  const email = arg("email") || process.env.EDITOR_EMAIL;
  const password = arg("password") || process.env.EDITOR_PASSWORD;
  if (!email || !password) {
    console.error("Set EDITOR_EMAIL and EDITOR_PASSWORD (or --email / --password) to sign in to the Worker.");
    process.exit(1);
  }

  const login = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await login.json().catch(() => ({}));
  if (!login.ok) {
    console.error("login failed:", login.status, loginBody);
    process.exit(1);
  }

  const seriesDone = new Set();
  for (const id of ids) {
    if (metaOnly) await patchMeta(api, loginBody.token, id);
    else await importOne(api, loginBody.token, id);
    const series = META[id].series;
    if (metaOnly && series && !seriesDone.has(series.key)) {
      seriesDone.add(series.key);
      await putSeries(api, loginBody.token, series);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
