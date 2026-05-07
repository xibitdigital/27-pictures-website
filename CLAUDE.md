# Claude Code Instructions

## Code Formatting

**Always format files with Prettier** after making changes:

```bash
npx prettier --write public/styles.css public/index.html public/script.js public/qr.html
```

## CSS Guidelines

**Never hardcode colors.** Always use CSS custom properties defined in `:root`.

### Available CSS Variables

```css
:root {
    /* Backgrounds */
    --bg: #030303;           /* Main background */
    --bg-dark: #000;         /* Pure black sections */
    --bg-card: #111;         /* Card/frame backgrounds */
    --bg-assembly: #050505;  /* Assembly section */

    /* Text */
    --text: #fff;            /* Primary text */
    --text-muted: #ccc;      /* Secondary/muted text */
    --silver: #888;          /* Tertiary text */

    /* Accent Colors */
    --red-smile: #b30000;    /* Primary accent (brand red) */
    --success: #4caf50;      /* Success states */

    /* Borders */
    --border: #222;          /* Dark borders */
    --border-light: #333;    /* Light borders (forms) */

    /* Animation */
    --transition: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### Usage Examples

```css
/* Good */
.element { color: var(--text); background: var(--bg-card); }

/* Bad - never do this */
.element { color: #fff; background: #111; }
```

## Project Structure

```
27-pictures-website/
├── public/                  # Static site files (deployed to Cloudflare Pages)
│   ├── index.html
│   ├── qr.html              # Mobile landing page for QR code (noindex)
│   ├── styles.css
│   ├── script.js
│   ├── logo.png
│   ├── the-red-smile.jpg
│   ├── sitemap.xml
│   ├── robots.txt
│   └── bdd5e80e21a8430d9316de0deacdb208.txt  # IndexNow key file
├── scripts/
│   └── generate-qr.js       # Generates branded QR code PDF → ~/Downloads/
├── worker/                  # Cloudflare Worker (contact form API)
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
├── package.json             # Root package (qrcode + pdfkit for QR generator)
├── .github/workflows/       # GitHub Actions (legacy GitHub Pages)
│   └── deploy.yml
├── CLAUDE.md                # This file
└── .gitignore
```

## Deployment

### Website (Cloudflare Pages)

Deploy the `public/` folder:

```bash
npx wrangler pages deploy public --project-name=twentyseven-pictures --commit-dirty=true
```

**Custom domain:** `twentyseven.pictures` (configured once in Cloudflare dashboard)

### Contact Form Worker

Deploy the Cloudflare Worker:

```bash
cd worker
npm install
npx wrangler deploy
```

**Worker URL:** `https://contact-form.sangalli-marco.workers.dev`

## Contact Form

### Architecture

- **Frontend:** AJAX form submission (stays on page)
- **Backend:** Cloudflare Worker
- **Email Service:** Resend API
- **CORS:** Only allows `https://twentyseven.pictures`

### Worker Configuration

Environment variables in `worker/wrangler.toml`:

```toml
[vars]
TO_EMAIL = "sangalli.marco@gmail.com"
FROM_EMAIL = "noreply@twentyseven.pictures"
FROM_NAME = "27 Pictures Contact Form"
```

### Secrets

The Resend API key is stored as a secret:

```bash
npx wrangler secret put RESEND_API_KEY
```

### Resend Setup

1. Domain `twentyseven.pictures` verified at https://resend.com/domains
2. API key created at https://resend.com/api-keys

## Email Routing

To receive emails at `info@twentyseven.pictures`:

1. Cloudflare Dashboard → Email → Email Routing
2. Add route: `info` → forward to personal email
3. Add MX records if prompted

## QR Code Landing Page

- **URL:** `https://twentyseven.pictures/qr.html`
- **Purpose:** Mobile contact/inquiry page linked from a printed QR code
- **SEO:** `noindex, nofollow` — also blocked in `robots.txt`
- **Content:** Contact form (Turnstile + Resend), Instagram and YouTube links

### Generate printable QR code PDF

```bash
npm run generate-qr
# Output: ~/Downloads/27pictures-qr.pdf
```

## SEO State

### Completed
- Page title: `27 Pictures | AI Horror Shorts & Cinematic Cosplay Production`
- Meta description updated (matches YouTube channel description)
- JSON-LD schema: Organization, WebSite, WebPage, CreativeWorkSeries, 6× VideoObject, 2× Service
- Organization location: Switzerland & United Kingdom
- IndexNow key deployed + submitted (`bdd5e80e21a8430d9316de0deacdb208`)
- All VideoObject uploadDates and durations use real YouTube values

### Video ID → Title Map (as of 2026-05)
| YouTube ID | Title | Duration | Upload |
|---|---|---|---|
| `J-iZl-XkVxg` | The Doll Moved Again. No One Was Home. | PT1M20S | 2026-04-27 |
| `qjBL4zRIFbg` | She's Not Running Away. She's Hunting. | PT1M7S | 2026-04-23 |
| `BOtFWCENtTc` | She Asked for Directions. She Should've Run. | PT1M25S | 2026-04-15 |
| `VEmf9eq62zo` | Something Is Wrong With My Reflection | PT2M19S | 2026-04-26 |
| `QMRlBqAdNGg` | He Streamed the Challenge. The Monster Streamed Back. | PT39S | 2026-04-30 |
| `nuMPi_Rnxg0` | Cosplay showcase (unlisted) | — | — |

### Remaining TODOs
- **Person schema** — add founder/director name + 2-3 sentence bio (highest E-E-A-T leverage)
- Update VideoObject entries when new Shorts are published
- Submit new URLs to IndexNow after each deploy:
  ```bash
  curl -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json" \
    -d '{"host":"twentyseven.pictures","key":"bdd5e80e21a8430d9316de0deacdb208","keyLocation":"https://twentyseven.pictures/bdd5e80e21a8430d9316de0deacdb208.txt","urlList":["https://twentyseven.pictures/"]}'
  ```

## Git Workflow

- **Main branch:** `main`
- **Remote:** `git@github.com:xibitdigital/27-pictures-website.git`
- **Contributors:**
  - Marco Sangalli (sangalli.marco@gmail.com)
  - Daniele Sangalli (daniele@xibitdigital.com)
