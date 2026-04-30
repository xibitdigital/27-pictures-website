# 27 Pictures — Website

Production website for [27 Pictures](https://twentyseven.pictures/) — a horror film production studio specializing in psychological horror short films and AI-enhanced cosplay cinematography.

## Stack

- **Hosting:** Cloudflare Pages (static)
- **Contact form:** Cloudflare Worker + Resend API
- **Fonts:** Google Fonts (Playfair Display, Inter)
- **Smooth scroll:** Lenis
- **Spam protection:** Cloudflare Turnstile

## Project Structure

```
27-pictures-website/
├── public/                  # Static site (deployed to Cloudflare Pages)
│   ├── index.html           # Main single-page site
│   ├── qr.html              # Mobile QR code landing page (noindex)
│   ├── privacy.html         # Privacy policy (noindex)
│   ├── styles.css
│   ├── script.js
│   ├── logo.png
│   ├── the-red-smile.jpg
│   ├── sitemap.xml
│   ├── robots.txt
│   ├── llms.txt             # AI crawler guidance (GEO)
│   └── _headers             # Cloudflare Pages security + cache headers
├── scripts/
│   └── generate-qr.js       # Generates branded QR code PDF → ~/Downloads/
├── worker/                  # Cloudflare Worker (contact form API)
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
├── package.json
├── CLAUDE.md
└── .gitignore
```

## Deploy

### Website

```bash
npx wrangler pages deploy public --project-name=twentyseven-pictures --commit-dirty=true
```

**Live URL:** https://twentyseven.pictures/

### Contact Form Worker

```bash
cd worker && npm install && npx wrangler deploy
```

**Worker URL:** `https://contact-form.sangalli-marco.workers.dev`

## Local Development

No build step required. Edit files in `public/` directly and deploy.

```bash
# Generate QR code PDF
npm run generate-qr
# Output: ~/Downloads/27pictures-qr.pdf
```

## Contact Form

- Frontend AJAX → Cloudflare Worker → Resend API
- CORS locked to `https://twentyseven.pictures`
- Resend API key stored as Wrangler secret: `npx wrangler secret put RESEND_API_KEY`
- Domain verified at resend.com/domains

## SEO

- Schema: Organization, WebSite, WebPage, CreativeWorkSeries, VideoObject ×5, Service ×2
- Sitemap: `https://twentyseven.pictures/sitemap.xml`
- AI crawler guidance: `https://twentyseven.pictures/llms.txt`
- Security headers: `public/_headers`

### Pending manual SEO tasks

- [ ] Cloudflare dashboard → disable AI bot blocks (GPTBot, ClaudeBot) to enable AI search indexing
- [ ] Update VideoObject `uploadDate` and `duration` in `index.html` JSON-LD with real YouTube values
- [ ] Add founder/director name, bio, and Person schema node to `index.html`
- [ ] Add studio location (city/country) to footer text and Organization schema
- [ ] Generate IndexNow key at https://www.bing.com/indexnow and add key file to `public/`
- [ ] Submit sitemap to Google Search Console: https://search.google.com/search-console
- [ ] Submit sitemap to Bing Webmaster Tools: https://www.bing.com/webmasters

## Git

- **Branch:** `main`
- **Remote:** `git@github.com:xibitdigital/27-pictures-website.git`
