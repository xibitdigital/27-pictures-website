#!/usr/bin/env node
/**
 * Load a content/toons/<id>/config.json into the editor D1 via POST /toons/import.
 *
 *   node scripts/import-toon-config.js --toon erin-the-revenge
 *   node scripts/import-toon-config.js --all
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
    coverKey: "card-art/erin-dark.jpg",
    hubUrl: "/toons/erin-and-the-goblins/",
    sort: 10,
  },
  jax: {
    key: "jax",
    title: "Jax",
    tagline: "Cyberpunk · a netrunner robbing the people who own minds",
    description:
      "In a neon city that sells minds by the megacorp, Jax is a netrunner dying by inches: a rare sickness eats his body while his code still cuts like a blade.",
    coverKey: "card-art/jax.jpg",
    hubUrl: "/toons/jax/",
    sort: 20,
  },
  nero: {
    key: "nero",
    title: "Nero",
    tagline: "Cyberpunk noir · a Scotland Yard case in the rain",
    description:
      "In a rain-soaked city of wetwork and wet labs, detective Nero — ex-military, one hand lost to a terrorist attack and rebuilt in steel — follows a trail of blood and crystal.",
    coverKey: "card-art/nero-page1.jpg",
    hubUrl: "/toons/nero/",
    sort: 30,
  },
  "red-smile": {
    key: "red-smile",
    title: "RED SMILE",
    tagline: "Horror · the anthology, as something you read",
    description:
      "Psychological horror drawn in heavy black-and-white gekiga ink. Elena is alone in the flat when the television finds a channel that should not exist.",
    coverKey: "card-art/redsmile-static.jpg",
    hubUrl: "/toons/red-smile/",
    sort: 40,
  },
};

const META = {
  erin: {
    slug: "erin",
    title: "The Missing Child",
    subtitle: "Between two worlds",
    description:
      "Erin is half human, half vampire — too much of each world to belong fully to either. She lives in a small town that is not really a town at all: a thin place, a passage between the goblin world and the human one.",
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
    subtitle: "The Revenge",
    description:
      "Erin tears a portal open and crosses into the goblin world. She wakes in a forest that is already watching her, and something winged and made of stone takes her out of it. What saves her is a stranger who can move the ground itself — and who is willing to teach. Erin came back to defeat the Goblin King.",
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
    subtitle: "Cyberpunk Chronicles",
    description:
      "In a neon city that sells minds by the megacorp, Jax is a netrunner dying by inches: a rare sickness eats his body while his code still cuts like a blade. He does not rob banks — he steals mind-control tech from the corporations that build it.",
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
    subtitle: "Scotland Yard case",
    description:
      "In a rain-soaked city of wetwork and wet labs, detective Nero — ex-military, one hand lost to a terrorist attack and rebuilt in steel — follows a trail of blood and crystal.",
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
    subtitle: "RED SMILE",
    description:
      "Elena is alone in the flat when the television finds a channel that should not exist. Psychological horror drawn in heavy black-and-white gekiga ink.",
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
    subtitle: "RED SMILE",
    description:
      "Marcus is CEO of NEXORA. He works until late. Halina cleans the tower, and nobody in it knows her name. A transmission starts on his laptop.",
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

async function main() {
  const toon = arg("toon");
  const all = flag("all");
  const ids = all ? Object.keys(META) : toon ? [toon] : [];
  if (!ids.length || ids.some((id) => !META[id])) {
    console.error("Usage: node scripts/import-toon-config.js --toon <slug> | --all");
    console.error("Known slugs:", Object.keys(META).join(", "));
    process.exit(1);
  }
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

  for (const id of ids) {
    await importOne(api, loginBody.token, id);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
