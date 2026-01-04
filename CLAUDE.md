# Claude Code Instructions

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
├── public/              # Static site files (deployed)
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── worker/              # Cloudflare Worker (contact form)
│   ├── src/index.js
│   ├── wrangler.toml
│   └── package.json
└── CLAUDE.md            # This file
```

## Contact Form

The contact form uses a Cloudflare Worker with MailChannels for email delivery.
- Worker URL must be configured in `public/index.html` form action
- CORS is configured for `https://twentyseven.pictures`

## Deployment

- **Website**: Cloudflare Pages (from `public/` directory)
- **Worker**: Deploy via `cd worker && npm run deploy`
