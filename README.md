# OMA Labs — Portfolio Website

Personal portfolio and business profile website for **Li Hang Ping**, Professional Developer & IoT Architect at [OMA Labs](https://omalabs.cc).

## About

A single-page static website showcasing services, tech stack, and background. Built with plain HTML, CSS, and JavaScript — no frameworks or build tools required.

## Sections

- **Hero** — headline, role summary, and CTAs
- **About / My Journey** — background, education (B.Sc. Hons Game Development, KDU University College Glenmarie), and 7+ years of experience
- **Services** — Full-Stack Development, IoT & Hardware Design, System Architecture, AI & Automation, Technical Consultancy
- **Tech Stack** — Software (Flutter, Laravel, PHP, MySQL, JS), Hardware (Arduino, ESP32, Raspberry Pi, PCB), AI & Infra
- **FAQ** — visible answers about expertise, technologies and project scope
- **Contact CTA** — links to email and omalabs.cc — **dynamically loaded from `config.json`**

## Admin Panel

An admin panel at `/admin.html` lets **GitHub repo collaborators** edit the contact section live.

### Sign In (two methods)

**🔑 GitHub OAuth (recommended):**
1. Click **"Sign in with GitHub"** on the admin page
2. You'll be redirected to GitHub to authorize the **OMA Labs Admin** app
3. After authorizing, you're sent back to the admin page — you're in

**🔧 Personal Access Token (fallback):**
- Expand "Sign in with a Personal Access Token" and paste a classic token with `repo` scope

Both methods verify collaborator status before granting access. OAuth tokens are session-only by default. PAT credentials can be remembered for 7 days via `localStorage` if opted in.

### One-Time Setup (required for OAuth)

Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers):

| Field | Value |
|---|---|
| Application name | `OMA Labs Admin` |
| Homepage URL | `https://profile.omalabs.cc` |
| Authorization callback URL | `https://profile.omalabs.cc/admin.html` |

Then copy the **Client ID** and paste it into `admin.js` replacing `REPLACE_WITH_YOUR_CLIENT_ID`.

### How It Works

- On save, the admin panel commits `config.json` back to the repo via the GitHub API
- Changes go live on GitHub Pages within ~60 seconds
- The main page (`index.html`) fetches `config.json` and populates the contact section dynamically
- If `config.json` fails to load, the page falls back to the static content in the HTML

## Tech

- HTML5 / CSS3 / Vanilla JS
- Google Fonts — Space Grotesk + Inter
- No dependencies or build step

## Assets

| File | Description |
|------|-------------|
| `assets/logo.png` | OMA Labs geometric logo |
| `assets/bg.png` | Circuit board hero background |

## Hosting

Designed to be hosted on **GitHub Pages**. See [GitHub Pages docs](https://docs.github.com/en/pages) for setup instructions. Supports custom domain — configure `profile.omalabs.cc` for GitHub Pages (matching `CNAME`) and enable HTTPS in repo settings.

## Contact

- Email: omalabs.cc@gmail.com
- Website: https://omalabs.cc

## SEO and generative engine optimization (GEO)

The canonical profile URL is `https://profile.omalabs.cc/`. The initial HTML includes a descriptive title, meta description, Open Graph and Twitter previews, and a linked Schema.org graph for the profile page, person, organization, website and services. Visible introductory copy and FAQs help readers and search assistants identify the person and services without executing JavaScript.

- `robots.txt` allows public search and AI crawlers and links to `sitemap.xml`.
- `sitemap.xml` lists only the canonical public page. Section anchors are not separate pages. The admin page remains excluded through its existing `noindex` meta tag; do not block crawling of it in robots.txt, because crawlers need to read that directive.
- `llms.txt` provides a concise, linked profile for tools that choose to support it. It is an emerging convention, not a requirement for AI search, and does not guarantee citations or rankings.
- Keep profile facts, visible service copy, JSON-LD and `llms.txt` consistent when updating expertise. Do not add unverified reviews, clients, locations or credentials to structured data.
- The contact editor still updates `config.json`. Keep the static contact fallback in `index.html` in sync when contact details change so crawlers without JavaScript see current details. Mutable contact details are not duplicated in JSON-LD or `llms.txt`.
- If the domain changes, update `CNAME`, canonical/social URLs, JSON-LD IDs, `robots.txt`, `sitemap.xml` and `llms.txt` together.

After deployment, submit `https://profile.omalabs.cc/sitemap.xml` in Google Search Console and Bing Webmaster Tools, inspect the canonical URL, and validate the deployed structured data with Schema.org Validator and Google's Rich Results Test. These account-level submissions are separate from repository changes; search visibility depends on crawling and indexing. Profile and service markup does not promise a rich result.
