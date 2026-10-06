# Buona Vista Youth Network website: handover

Last updated: 6 Oct 2026

This note is for whoever maintains the website next. It covers how the site is built, how events are managed through Google Sheets, the decisions we made and why, and the usual tasks.

---

## 1. At a glance

| | |
|---|---|
| Live site | https://bvyouths.com (GitHub Pages, served from `main`; set by the `CNAME` file). `bvyouths.github.io` redirects there. |
| Testing access | While in testing, `bvyouths.com` and `www` are behind **Cloudflare Access** (Zero Trust → Access → Applications). Remove that application to launch publicly. |
| Repository | https://github.com/bvyouths/bvyouths.github.io |
| Tech | Plain HTML, CSS and JavaScript. No build step, framework or npm packages. |
| Events data | A Google Sheet, published as JSON by a Google Apps Script web app (`code.gs`) |
| Working branch | `staging`. Changes go to `main` through a pull request. |

---

## 2. File structure

```
/
├── index.html            Home: hero photo, About teaser + 3 pillars, event poster cards, Instagram feed
├── about.html            About us
├── events.html           Events: poster carousel, upcoming list, past events
├── collaborate.html      Collaborate: ways to work together, #join form, #contact
├── committee.html        Hidden page (/committee): committee photos, names, roles. Not in the menu, noindex
├── 404.html              "Page not found" page (GitHub Pages shows it automatically)
├── CNAME                 Custom domain for GitHub Pages (bvyouths.com). Don't delete
├── code.gs               Google Apps Script source for the events API (copy of what runs in Google)
├── partials/
│   ├── header.html       Shared header / navigation for every page
│   ├── footer.html       Shared footer for every page
│   └── committee.html    The committee member cards shown on /committee
├── static/
│   ├── styles/styles.css     All styles (one file)
│   ├── scripts/script.js     Loads header/footer, menu, highlights the current page, smooth scroll, footer year
│   ├── scripts/events.js     Fetches events from the API and builds the list, posters and past events
│   └── images/               logo.png, favicon.png
│       ├── photos/           Photos used on Home, About and Collaborate
│       └── committee/        Committee member photos (placeholder.jpg is filler for now)
├── HANDOVER.md           This document
└── .gitignore            Ignores .DS_Store files
```

### Shared header and footer
- Each page has placeholders like `<div data-include="partials/header.html"></div>`. At load time, `script.js` fetches the partial and swaps it in.
- **To change the navigation or footer, edit `partials/header.html` or `partials/footer.html` only.** Every page updates.
- The header is **sticky** (stays at the top while scrolling). On phones the menu is a ☰ icon that turns into ✕. `scroll-padding-top` on `html` in `styles.css` keeps `#section` links from hiding under it.
- Because the partials are fetched, the site **must be viewed through a web server**. Opening the `.html` file directly (`file://`) won't show the header and footer (see §7).

### Brand colours
Defined as CSS variables at the top of `static/styles/styles.css`: `--purple #2c008d`, `--gold #f2af24`, `--orange #e34728`, `--cream #fbf6ec` (page background), `--sand #f4ebda` (alternate section background). Fonts are **Manrope** (text) and **DM Mono** (labels), from Google Fonts.

---

## 3. URLs and links

- **Internal links don't use `.html`:** `/about`, `/events`, `/collaborate`, and `/` for home. The `#join` and `#contact` sections are linked as `/collaborate#join` and `/collaborate#contact`. GitHub Pages maps `/about` to `about.html` automatically.
- `script.js` → `markCurrentPage()` highlights the current menu item. It treats `/events`, `/events.html` and `/events/` as the same page.
- **Paths in `404.html` start with `/`** (`/static/...`, `/partials/...`). The 404 page can appear at any depth (e.g. `/events/old-link`), where relative paths would break. Keep it that way if you edit it.

---

## 4. Events system (Google Sheets → site)

### How it works
1. The committee edits the Google Sheet.
2. The Apps Script web app (`code.gs`, bound to that sheet) reads it and returns JSON.
3. `static/scripts/events.js` fetches that JSON in the browser and builds the event sections.

### API endpoint
Set in `static/scripts/events.js` as `EVENTS_API_URL`. Current value:

```
https://script.google.com/macros/s/AKfycbyZ_Sp_VuXyBVqNtekwKcshiGuwXohG6PH-J7k9gnOFOteFzzNzm_lpIbJFLZr7Hyd3/exec
```

| Request | Returns |
|---|---|
| `…/exec` | Upcoming events |
| `…/exec?type=past` | Past events |
| add `nocache=1` | Reads the sheet fresh and refreshes the cache (see below) |

### Sheet tabs and columns
Row 1 must hold the headers. They can be in any order, and capitals and extra spaces are ignored. **If a tab or column is missing, the script creates it automatically** the next time it runs, or you can run `setUpSheets()` from the Apps Script editor. It never deletes data. Missing columns are added after the last existing one.

**`Upcoming events`**: `Date | Time | Location | Price | Event Name | Description | Link | Poster`
- **Time** and **Price** are plain text, shown exactly as typed on one line: `Time · Location · Price` (e.g. `6.30pm to 9.30pm · Leng Kee CC · $5/pax`). New columns are created as plain-text cells so Sheets doesn't convert them.
- **Type** was removed (Review 1). A leftover `Type` column is ignored and can be deleted.
- Events whose date has passed are hidden automatically. They are sorted soonest first.
- **Date** accepts `18 Oct 2026`, `18 October 2026`, `Sat, 18th Oct 2026`, `Oct 18, 2026`, `18/10/2026` (day first), `2026-10-18`, and `18 Oct` (year assumed). Dates it can't read still show, at the end, as the raw text.
- **Link** is the sign-up link. It can be a plain URL, a link behind text, `=HYPERLINK(...)`, or an email.
- **Poster** is an image link (see Images below). Events without a poster don't appear in the poster carousel, but still appear in the list.

**`Past events`**: `Hero Image | Event Name | Event Date | Event Type | Event Description`
- Only what's in this tab is shown. Upcoming events **do not** move here automatically once they pass (a deliberate choice, so the committee can pick a proper photo and write-up).
- Sorted most recent first. Dates the script can't read (e.g. `July 2026`, with no day) show as typed but sort to the bottom.

### Images (Poster / Hero Image)
- Paste a link to the image. Google Drive links (`drive.google.com/file/d/…/view`, `open?id=…`) are converted automatically. **The file must be shared as "Anyone with the link".** `=IMAGE("url")` and links behind text also work.
- Images **inserted into or over cells** (Insert → Image) are **not** picked up. Use a link.
- **Posters:** A4 portrait, e.g. **1240 × 1754 px**.
- **Past event hero images:** 4:3 landscape, **1600 × 1200 px** (1200 × 900 also works). They're cropped to fill a 4:3 box, so keep faces and text away from the edges. JPG, ideally under about 500 KB.

### Caching (why sheet edits don't show instantly)
- The script caches each response for **5 minutes** (`CACHE_SECONDS` in `code.gs`). Upcoming and past events are cached separately.
- To show changes immediately, open these (they rebuild and refresh the cache):
  - Upcoming: `…/exec?nocache=1`
  - Past: `…/exec?type=past&nocache=1`
- After changing `code.gs` itself, bump `CACHE_KEY` (currently `events_v4`; e.g. → `events_v5`) so old cached data is dropped.

### Updating the Apps Script (important)
`code.gs` in this repo is only a **copy**. The version that actually runs lives in the Google Sheet's Apps Script project (Extensions → Apps Script).
1. Paste the updated `code.gs` into the Apps Script editor and save.
2. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
   This **keeps the same URL**. Choosing "New deployment" instead creates a new URL, and you would then need to update `EVENTS_API_URL` in `events.js`. That happened once already, which is why the URL in `events.js` has changed before.
3. Open the `?nocache=1` links to confirm the JSON looks right.

---

## 5. Events page layout (`events.html`)

In order:
1. **Poster carousel** (`data-event-posters`): upcoming events that have a Poster.
   - 3 across on desktop, 2 on tablet (≤960px), 1 on phone (≤700px).
   - When there are fewer posters than fit, they are centred. When there are more, **‹ ›** arrows appear (you can also swipe on phones).
   - **Hover** shows date, time · location · price, name, description and a *Sign up* button. On touch screens, **tap** to show the details.
2. **Upcoming events list** (`data-events`): all upcoming events, poster or not.
3. **Past events** (`data-past-section`, `data-past-events`): image and text swap sides on each row (image left, then image right…). On phones the image sits on top. Hidden entirely while the tab is empty. Events without an image get a logo placeholder so the zigzag stays even.

The **homepage** (`index.html`) shows **all** upcoming events as **poster cards** (no list). Its carousel has `data-placeholder`, so an event without a poster, or whose poster fails to load, gets a branded purple card with the logo, date and name. The Events page carousel has no `data-placeholder`, so only events with posters appear there (the list below covers the rest).

The first event in the list used to be highlighted in yellow ("featured"). **That was removed on request.** All event cards now look the same.

---

## 6. Git workflow

- **Branches:**
  - `main` is live. GitHub Pages deploys from it automatically.
  - `staging` is where all work happens.
  - `kenneth` is an older feature branch, already merged. It can be deleted.
- **Flow:**
  1. On `staging`, pull the latest `main` first.
  2. Commit and push to `staging`.
  3. Open a pull request `staging → main` on GitHub and merge.
  4. The site updates within a minute or two.
- The GitHub CLI (`gh`) is not installed on the current machine, so PRs have been opened on github.com. To use the CLI instead: `brew install gh`, then `gh auth login`.

---

## 7. Running the site locally

The header/footer partials and the extensionless links both need a web server that behaves like GitHub Pages:

```bash
npx serve
```

Then open the address it prints (usually http://localhost:3000). `serve` maps `/events` to `events.html` and shows `404.html` for missing pages.

`python3 -m http.server` **can** serve the files, but `/events`-style links return 404 there because it doesn't map them to `.html`. That's a local-server limitation, not a site bug.

---

## 8. Common tasks

| Task | Where |
|---|---|
| Add / edit / remove an upcoming event | Google Sheet → `Upcoming events` tab. Then open the `?nocache=1` link. |
| Add a past event | Google Sheet → `Past events` tab. Then open the `?type=past&nocache=1` link. |
| Change nav or footer links | `partials/header.html`, `partials/footer.html` |
| Change colours / fonts / spacing | `static/styles/styles.css` (variables at the top) |
| Change the interest / sign-up form link | `collaborate.html` (`#join` section), currently `go.gov.sg/bvyn-interest-form` |
| Change contact email / socials | `collaborate.html` (`#contact`) and `partials/footer.html` |
| Change a site photo | Replace the file in `static/images/photos/` (same name), or change the `<img src>` in the page. Keep files under ~300 KB (about 1600 px wide). |
| Add / edit committee members | `partials/committee.html` (one `<article>` per person). Photos go in `static/images/committee/`, square, ~600×600 px. |
| Change the favicon | Replace `static/images/favicon.png` (square PNG, currently 256×256, logo on white) |
| Change cache time | `CACHE_SECONDS` in `code.gs`, then redeploy (see §4) |
| Change the events API URL | `EVENTS_API_URL` in `static/scripts/events.js` |

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| New sheet row doesn't appear | 5-minute cache. Open the `?nocache=1` link. Also check the date isn't in the past. |
| Poster doesn't show | Poster cell empty in the JSON: check the header is exactly `Poster` and that there's no **second** empty "Poster" column at the far right (the script adds one if it can't find the header). Check the link is on the same row as the event and the Drive file is shared "Anyone with the link". Images inserted into cells don't work. Use a link. |
| "We couldn't load events right now" | The API returned an error or the URL is wrong. Open the `/exec` URL directly and read the `error` message in the JSON. Common causes: a tab renamed, the `Date` or `Event Name` header missing, or a new deployment URL not copied into `events.js`. |
| Header/footer missing locally | The file was opened directly. Use `npx serve` (§7). |
| Old favicon still showing | Browsers cache favicons. Hard refresh (Cmd+Shift+R) or use a private window. |

---

## 10. Decisions log

| Decision | Reason |
|---|---|
| Header/footer moved into `partials/` | Edit once instead of on every page |
| Links without `.html` (`/events`) | Cleaner URLs. GitHub Pages supports them natively. |
| Homepage shows all upcoming events as poster cards | Requested (Review 1). Branded card when there's no poster. |
| Sticky header, no separate top-right button | Requested (Review 1). Menu: About us · Events · Collaborate · Join us. No Gallery page: photos go on existing pages instead. |
| Upcoming events: Time and Price instead of Type | Requested (Review 1). Shown as Time · Location · Price. |
| Committee page hidden at `/committee` | The committee previously had concerns about faces being public. Built with filler first; may move to `/about` later. |
| No yellow "featured" first event | Requested. All event cards styled the same. |
| Posters above the list (not replacing it) | Keeps a text list of every event, including ones without posters |
| Events without a poster are hidden from the carousel | Keeps the carousel visual. They're still in the list. |
| Past events come only from the `Past events` tab | The committee chooses the photo and write-up. Nothing moves automatically. |
| 404 page uses root-relative paths | So it works at any URL depth |
| Tabs and columns auto-created by `code.gs` | Setting up a fresh sheet needs no manual steps |
| All work on `staging`, merged to `main` by PR | `main` is the live site |

---

## 11. Open items / ideas

- Past event dates with only month and year (e.g. `July 2026`) sort to the bottom. `parseDate_()` in `code.gs` could be extended to handle them.
- The old `kenneth` branch can be deleted.
- Photo consent: the Home and About photos show committee members; the Collaborate photo shows children. Confirm consent before launch (asked in Website Review 2).
- Committee page: replace the 20 filler cards with real names, roles and photos (list requested in Website Review 2).
- There's no README. This file serves as the main documentation.
- This file is public: the repository is public, and GitHub Pages may also serve it at `/HANDOVER`. Don't add passwords or private details here.
