# OMA Labs — Portfolio Website

Personal portfolio and business profile website for **Li Hang Ping**, Professional Developer & IoT Architect at [OMA Labs](https://omalabs.cc).

## About

A single-page static website showcasing services, tech stack, and background. Built with plain HTML, CSS, and JavaScript — no frameworks or build tools required.

## Sections

- **Hero** — headline, role summary, and CTAs
- **About / My Journey** — background, education (B.Sc. Hons Game Development, KDU University College Glenmarie), and 7+ years of experience
- **Services** — Full-Stack Development, IoT & Hardware Design, System Architecture, AI & Automation, Technical Consultancy
- **Tech Stack** — Software (Flutter, Laravel, PHP, MySQL, JS), Hardware (Arduino, ESP32, Raspberry Pi, PCB), AI & Infra
- **Contact CTA** — links to email and omalabs.cc — **dynamically loaded from `config.json`**

## Admin Panel

An admin panel at `/admin.html` lets **GitHub repo collaborators** edit the contact section live.

### Sign In (two methods)

**🔑 GitHub Device Flow (recommended):**
1. Click **"Sign in with GitHub"** on the admin page
2. A code appears — visit [github.com/login/device](https://github.com/login/device) and enter it
3. Authorize **OMA Labs Admin** — you're in

**🔧 Personal Access Token (fallback):**
- Expand "Sign in with a Personal Access Token" and paste a classic token with `repo` scope

Both methods verify collaborator status before granting access. Credentials are held in `sessionStorage` only — cleared when the browser tab closes.

### One-Time Setup (required for Device Flow)

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

Designed to be hosted on **GitHub Pages**. See [GitHub Pages docs](https://docs.github.com/en/pages) for setup instructions. Supports custom domain — point `omalabs.cc` A records to GitHub's IPs and enable HTTPS in repo settings.

## Contact

- Email: omalabs.cc@gmail.com
- Website: https://omalabs.cc
