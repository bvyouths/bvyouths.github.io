# Buona Vista Youth Network website: handover

Last updated: 16 Nov 2026

> **Current status (read first)**
> - **`main` is an older copy.** It hasn't had the latest work merged in yet.
> - **All edits are on `staging`.** Make new changes there; GitHub Pages is currently serving `staging` for testing.
> - **Website Review 3 is applied on `staging`** (16 Nov 2026): member profiles removed, scrolling banner removed, "Get involved" menu link, Committee under "About us", home page slideshow, two sign-up buttons per event, new fonts, wording changes. See §11 for what was decided.
> - **The Apps Script must be redeployed** with the current `code.gs` (see §4) for the slideshow, the Volunteer button and the Appointments bubbles to work. Until then the site still works, just without those three.
> - **Still open from Review 3:** who appears on the Committee page (office bearers only, or every member). The site shows whoever is listed in the Committee tab with Show ticked, so this is a content decision, not a code change.

This note is for whoever maintains the website next. It covers how the site is built, how events, the gallery and the committee are managed through Google Sheets, the decisions we made and why, and the usual tasks.

---

## 1. At a glance

| | |
|---|---|
| Live site | https://bvyouths.com (GitHub Pages, served from `main`; set by the `CNAME` file). `bvyouths.github.io` redirects there. |
| Testing access | While in testing, `bvyouths.com` and `www` are behind **Cloudflare Access** (Zero Trust → Access → Applications). Remove that application to launch publicly. |
| Repository | https://github.com/bvyouths/bvyouths.github.io |
| Tech | Plain HTML, CSS and JavaScript. No build step, framework or npm packages. |
| Site data | One Google Sheet, published as JSON by a Google Apps Script web app (`code.gs`): events, past events, projects, gallery, committee |
| Working branch | `staging`. Changes go to `main` through a pull request. |

---

## 2. File structure

```
/
├── index.html            Home: hero slideshow, About teaser + 3 pillars, event poster cards, Instagram feed
├── about.html            About us
├── events.html           Events: poster carousel, upcoming list, past events
├── collaborate.html      Collaborate: ways to work together, #join form, #contact
├── gallery.html          /gallery: photo gallery from the sheet. In the menu and footer; noindex
├── committee.html        /committee: committee grid from the sheet. Under "About us" in the menu, in the footer; noindex
├── 404.html              "Page not found" page (GitHub Pages shows it automatically)
├── CNAME                 Custom domain for GitHub Pages (bvyouths.com). Don't delete
├── code.gs               Google Apps Script source for the API (copy of what runs in Google)
├── partials/
│   ├── header.html       Shared header / navigation for every page
│   ├── footer.html       Shared footer for every page
│   ├── gallery.html      Gallery container (can be dropped into another page, e.g. /events later)
│   └── committee.html    Committee grid container (can be dropped into another page, e.g. /about later)
├── static/
│   ├── styles/styles.css      All styles (one file)
│   ├── scripts/script.js      Loads partials, menu, highlights the current page, smooth scroll, footer year
│   ├── scripts/api.js         Shared: the API address, fetching (+ remembering the last answer), image sizes,
│   │                          ‹ › sliders, past-event rows, initials avatars
│   ├── scripts/events.js      Upcoming list, poster cards, past events
│   ├── scripts/gallery.js     Gallery masonry, hover details, enlarge on laptop, tap on phone
│   ├── scripts/committee.js   Committee grid cards
│   ├── scripts/slideshow.js   Home page slideshow (Gallery photos ticked "Homepage Header")
│   ├── scripts/page-photo.js  About / Get involved banner photos chosen in the Gallery tab (Page Photo)
│   └── images/                logo.png, favicon.png
│       └── photos/            Photos used on Home, About and Collaborate
├── HANDOVER.md           This document
└── .gitignore            Ignores .DS_Store files
```

### Partials
- Each page has placeholders like `<div data-include="partials/header.html"></div>`. At load time, `script.js` fetches the partial and swaps it in. Other scripts wait for this with `window.includesReady` (via `BVYN.ready()` in `api.js`).
- **To change the navigation or footer, edit `partials/header.html` or `partials/footer.html` only.** Every page updates.
- The header is **sticky** (stays at the top while scrolling) and the same purple as the top section of each page. "About us" has a small drop-down (Committee) that opens on hover or keyboard focus. On phones the menu is a ☰ icon that turns into ✕, and Committee sits indented under About us. `scroll-padding-top` on `html` in `styles.css` keeps `#section` links from hiding under it.
- To show the gallery or committee grid on another page: add `<div data-include="/partials/gallery.html"></div>` (or `committee.html`) and load `api.js` then `gallery.js` (or `committee.js`) after `script.js`.
- Because the partials are fetched, the site **must be viewed through a web server**. Opening the `.html` file directly (`file://`) won't work (see §8).

### Brand colours
Defined as CSS variables at the top of `static/styles/styles.css`: `--purple #2c008d`, `--gold #f2af24`, `--orange #e34728`, `--cream #fbf6ec` (page background), `--sand #f4ebda` (alternate section background). Fonts, from Google Fonts, are set as variables in the same place: **Roboto** for headings and big numbers (`--font-head`), **Montserrat** for everything else (`--font-body`), **DM Mono** for small labels, dates and tags. To change a font, change the variable and the `<link href="https://fonts.googleapis.com/…">` line in every page's `<head>`.

---

## 3. URLs and links

- **Internal links don't use `.html`:** `/about`, `/events`, `/collaborate`, and `/` for home. The `#join` and `#contact` sections are linked as `/collaborate#join` and `/collaborate#contact`. GitHub Pages maps `/about` to `about.html` automatically.
- **Menu:** About us (▾ Committee) · Events · Gallery · Get involved. **Footer:** About us · Committee · Events · Gallery · Get involved. "Get involved" opens the Collaborate page (`/collaborate`), which includes the Join section.
- **`noindex`:** `/gallery` and `/committee` ask Google not to list them (kept on request while the committee decides about going public).
- **Past event addresses:** each past event with a Project Ref gets that ref as its id, so `/events#2026-hlw` scrolls to it (after the events load). Nothing on the site links this way at the moment.
- `script.js` → `markCurrentPage()` highlights the current menu item. It treats `/events`, `/events.html` and `/events/` as the same page.
- **Paths in `404.html` start with `/`** (`/static/...`, `/partials/...`) so it works at any depth.

---

## 4. Sheet → website (the API)

### How it works
1. The committee edits the Google Sheet.
2. The Apps Script web app (`code.gs`, bound to that sheet) reads it and returns JSON.
3. The page scripts fetch that JSON in the browser and build the sections.

### API endpoint
Set in `static/scripts/api.js` as `API_URL`. Current value:

```
https://script.google.com/macros/s/AKfycbyZ_Sp_VuXyBVqNtekwKcshiGuwXohG6PH-J7k9gnOFOteFzzNzm_lpIbJFLZr7Hyd3/exec
```

| Request | Returns |
|---|---|
| `…/exec` | Upcoming events |
| `…/exec?type=past` | Past events, newest first, with `projectRef` |
| `…/exec?type=gallery` | Gallery photos, newest first; `homepage: true` marks the slideshow photos; `pages` lists pages that use the photo (e.g. `["/about"]`) |
| `…/exec?type=committee` | Shown members only: name, position, image, appointments |
| add `nocache=1` | Reads the sheet fresh and refreshes the cache (see below) |

### Sheet tabs and columns
Row 1 must hold the headers. They can be in any order, and capitals and extra spaces are ignored. **If a tab or column is missing, the script creates it automatically** the next time it runs, or you can run `setUpSheets()` from the Apps Script editor. It never deletes data. Missing columns are added after the last existing one: as plain-text cells, except **Show** and **Homepage Header**, which get checkboxes.

**`Upcoming events`**: `Date | Time | Location | Price | Event Name | Description | Link | Volunteer Link | Poster | Type`
- **Time** and **Price** are plain text, shown exactly as typed on one line: `Time · Location · Price` (e.g. `6.30pm to 9.30pm · Leng Kee CC · $5/pax`).
- **Type** isn't displayed. If it's `Volunteering Opportunity` (any capitals/spacing), the event's poster card (or brand card) gets an orange **Volunteering Opportunity** tag in the top-right corner, which stays visible while the details show, and the list row gets the same tag beside the name.
- **Line breaks:** a new line typed inside a cell (Ctrl/Cmd+Enter) shows as a new line on the site in Description, Event Description and Gallery Description.
- Events whose date has passed are hidden automatically. They are sorted soonest first.
- **Date** accepts `18 Oct 2026`, `18 October 2026`, `Sat, 18th Oct 2026`, `Oct 18, 2026`, `18/10/2026` (day first), `2026-10-18`, and `18 Oct` (year assumed). Dates it can't read still show, at the end, as the raw text.
- **Link** is the link to sign up to **take part** ("Sign up ↗" button). **Volunteer Link** is the link to sign up to **volunteer** ("Volunteer ↗" button). An event can have either, both or neither. Each can be a plain URL, a link behind text, `=HYPERLINK(...)`, or an email.
- **Poster** is an image link (see Images below).

**`Past events`**: `Hero Image | Event Name | Event Date | Event Type | Event Description | Project Ref`
- Only what's in this tab is shown. Upcoming events **do not** move here automatically once they pass (the committee picks a proper photo and write-up).
- **Shown newest first = bottom row first.** Event Date is free text (e.g. `Quarterly`, `Mar – Jul 2026`), so it's **never used for sorting**. Add new past events at the bottom.
- **Project Ref** (dropdown from `Projects`) is optional. It gives the event its own address (`/events#2026-hlw`). Kept for future use; refs should be unique.

**`Projects`**: `Project Ref | Project Name`
- The list of projects that the Project Ref dropdowns pull from. Project Ref: lower case, no spaces (e.g. `2026-hlw`). The website doesn't read this tab; it's kept for future use.

**`Gallery`**: `Image | Event Name | Description | Label | Homepage Header | Page Photo | Project Ref`
- Rows without an image are skipped. Name, description and label are each optional (shown on hover/tap). Label is free text, e.g. the date.
- **Shown newest first = bottom row first.** Add new photos at the bottom.
- **Homepage Header** checkbox: ticked photos make up the **home page slideshow** (newest first, changing every 5 seconds). Landscape photos work best: the frame is 4:3 and crops to fill. If nothing is ticked, the home page keeps its built-in committee photo.
- **Page Photo**: puts a photo on another page in place of its built-in photo. `/about` = the wide photo under "A network of passionate leaders" on About; `/collaborate` = the wide photo on Get involved. Comma-separate for both (`/about, /collaborate`). If several photos name the same page, the **newest (bottom row)** is used. The photo is cropped to the banner's wide shape (about 2.7:1 on About, 2.2:1 on Get involved), so wide landscape photos work best. If none is chosen, or the chosen one can't load, the built-in photo stays. Tip: make the column a dropdown (Data → Data validation → Dropdown, items `/about` and `/collaborate`, tick Allow multiple selections).
- **Project Ref**: dropdown from `Projects`. Stored for future use; not displayed yet.

**`Committee`**: `Name | Position | Image | Appointments | Show`
- **Name** is required. List whoever should be displayed, in the order they should appear.
- **Show** checkbox: **unticked = hidden**. Hidden members are filtered out by the script, so their details never reach the website.
- **Image**: square photo link. Blank (or broken) → purple square with their initials.
- **Appointments** (optional): comma-separated items, e.g. `Membership, BV Social`. Each shows as a small rounded bubble under the name. Leave blank for no bubbles (the current plan is to show the role only).

**Columns the website no longer reads** (left over from the member profile pages, removed after Review 3): Committee `Username`, `Bio`, `Projects`, `Featured`; Gallery `Persons`. They're ignored and can be deleted from the sheet.

### Setting up the dropdowns (one-off, in the Google Sheet)
Select the column's cells (e.g. Past events → Project Ref, row 2 down) → **Data → Data validation → Add rule** → *Criteria: Dropdown (from a range)* → choose the range → Done.

| Column | Range |
|---|---|
| Past events → Project Ref | `Projects!A2:A` (the Project Ref column) |
| Gallery → Project Ref | `Projects!A2:A` |

(Adjust the column letters if your columns are in a different order.)

### Images
- Paste a link to the image. Google Drive links (`drive.google.com/file/d/…/view`, `open?id=…`) are converted automatically. **The file must be shared as "Anyone with the link".** `=IMAGE("url")` and links behind text also work.
- Images **inserted into or over cells** (Insert → Image) are **not** picked up. Use a link.
- **Posters:** A4 portrait, e.g. **1240 × 1754 px**.
- **Past event hero images:** 4:3 landscape, **1600 × 1200 px**. Cropped to fill, so keep faces and text away from the edges.
- **Committee photos:** square, at least **600 × 600 px**.
- **Gallery:** any shape (the gallery keeps each photo's shape), about 1600 px on the long side. Slideshow photos: landscape.
- **Sizes are requested automatically.** For Google Drive links the site asks for a copy close to the size shown (gallery grid 800 px, posters 900 px, committee 600 px, slideshow and past events 1200 px; the full 1600 px only when a gallery photo is enlarged). This is `BVYN.sized()` in `api.js` and is the main reason pages load quickly. Other image links are used as they are, so keep those files reasonably small.

### Caching (why sheet edits don't show instantly)
- The script caches each response for **5 minutes** (`CACHE_SECONDS` in `code.gs`). Each request type is cached separately.
- To show changes immediately, add `nocache=1` to the matching request, e.g.:
  - Upcoming: `…/exec?nocache=1`
  - Past: `…/exec?type=past&nocache=1`
  - Gallery: `…/exec?type=gallery&nocache=1`
  - Committee grid: `…/exec?type=committee&nocache=1`
- After changing `code.gs` itself, bump `CACHE_KEY` (currently `site_v8`; e.g. → `site_v9`) so old cached data is dropped.
- **The browser also remembers the gallery list** (`localStorage`, key `bvyn:type=gallery`), so the gallery and slideshow appear straight away on repeat visits and then update if the sheet has changed. A visitor may briefly see the previous list before it refreshes.

### Updating the Apps Script (important)
`code.gs` in this repo is only a **copy**. The version that actually runs lives in the Google Sheet's Apps Script project (Extensions → Apps Script).
1. Paste the updated `code.gs` into the Apps Script editor and save.
2. Optional: run `setUpSheets` once (function dropdown → Run) to create new tabs and columns straight away.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
   This **keeps the same URL**. Choosing "New deployment" instead creates a new URL, and you would then need to update `API_URL` in `api.js`.
4. Open the `?nocache=1` links to confirm the JSON looks right.

### Testing code.gs without the sheet
`code.gs` has no external dependencies besides Google's services, so it can be run in Node with small stand-ins for `SpreadsheetApp`, `CacheService` etc. to check the JSON output (this was done for the Review 1 v2 and Review 3 changes).

---

## 5. Page layouts

### Events page (`events.html`)
1. **Poster carousel** (`data-event-posters data-placeholder`): every upcoming event; a branded purple card (logo, date, name) when there's no poster or it fails to load.
   - 3 across on desktop, 2 on tablet (≤960px), 1 on phone (≤700px).
   - When there are fewer posters than fit, they are centred. When there are more, **‹ ›** arrows appear (you can also swipe on phones).
   - **Hover** shows date, time · location · price, name, description and the *Sign up* and/or *Volunteer* buttons. On touch screens, **tap** to show the details.
2. **Upcoming events list** (`data-events`): all upcoming events, poster or not, each with its buttons.
3. **Past events** (`data-past-section`, `data-past-events`): newest first; image and text swap sides on each row. On phones the image sits on top. Hidden entirely while the tab is empty. Events without an image get a logo placeholder.

The **homepage** (`index.html`) shows the same poster cards (no list). Remove `data-placeholder` from a carousel to show only events that have posters.

### Home page slideshow
- The framed photo in the top section (`data-hero-slideshow`, `slideshow.js`) cross-fades through the Gallery photos ticked **Homepage Header**, every 5 seconds (`INTERVAL` in `slideshow.js`). It doesn't auto-change for visitors who have asked their device to reduce motion.
- The committee photo in `index.html` shows first and stays if nothing is ticked or the sheet can't be reached.

### Gallery (`/gallery`)
- Masonry: 3 columns on laptop, 2 on tablet, 1 on phone. Photos keep their own shape and are dealt left to right, so the newest are along the top.
- Laptop: hover shows label, name and description; **click enlarges** (Esc or click to close). Phone/tablet: **tap** shows the details.
- To appear quickly: small copies in the grid, the first 6 load immediately (`EAGER` in `gallery.js`), and the last list is remembered in the browser.

### Committee (`/committee`)
- Grid of shown members (4 / 3 / 2 per row): photo or initials, name, position, and appointment bubbles if that column is filled in. Cards aren't links.

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

## 7. Test copy on GitHub Pages

To try `staging` on a real GitHub Pages site before merging, use a separate repo served at its own subdomain (e.g. `test.bvyouths.com`). It must be served at the **root** of a domain, because the site's links and paths start with `/`. A plain `bvyouths.github.io/<repo-name>/` address would break them. The test copy needs its own `CNAME` file: two repos can't share `bvyouths.com`.

---

## 8. Running the site locally

The partials and the extensionless links both need a web server that behaves like GitHub Pages:

```bash
npx serve -l 4000
```

Then open http://localhost:4000. `serve` maps `/events` to `events.html` and shows `404.html` for missing pages. (Use a fixed port: if 3000 is taken by another project, `serve` quietly picks a different one.)

`python3 -m http.server` **can** serve the files, but `/events`-style links return 404 there because it doesn't map them to `.html`.

---

## 9. Common tasks

| Task | Where |
|---|---|
| Add / edit / remove an upcoming event | Google Sheet → `Upcoming events`. Then open the `?nocache=1` link. |
| Mark an event as a volunteering opportunity | `Upcoming events` → Type = `Volunteering Opportunity` |
| Give an event a "Volunteer" button | `Upcoming events` → paste the volunteer sign-up link in Volunteer Link |
| Add a past event | `Past events` (at the **bottom**) |
| Add a gallery photo | `Gallery` (at the **bottom**) |
| Change the home page slideshow | `Gallery` → tick or untick Homepage Header |
| Change the photo on About or Get involved | `Gallery` → put `/about` or `/collaborate` in that photo's Page Photo cell |
| Add / edit / hide a committee member | `Committee`. Tick Show to make them visible. |
| Show appointment bubbles on a committee card | `Committee` → Appointments, comma-separated |
| Change nav or footer links | `partials/header.html`, `partials/footer.html` |
| Change colours / fonts / spacing | `static/styles/styles.css` (variables at the top); for fonts also the Google Fonts line in each page's `<head>` |
| Change the interest / sign-up form link | `collaborate.html` (`#join` section), currently `go.gov.sg/bvyn-interest-form` |
| Change contact email / socials | `collaborate.html` (`#contact`) and `partials/footer.html` |
| Change a built-in site photo (the fallback) | Replace the file in `static/images/photos/` (same name), or change the `<img src>` in the page. Keep files under ~300 KB (about 1600 px wide). |
| Change the favicon | Replace `static/images/favicon.png` (square PNG, currently 256×256, logo on white) |
| Change cache time | `CACHE_SECONDS` in `code.gs`, then redeploy (see §4) |
| Change the API URL | `API_URL` in `static/scripts/api.js` |

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| New sheet row doesn't appear | 5-minute cache. Open the matching `nocache=1` link. For upcoming events, also check the date isn't in the past. |
| Image doesn't show | Check the link is on the right row and the Drive file is shared "Anyone with the link". Images inserted into cells don't work: use a link. Check there's no **second** empty column with the same header at the far right (the script adds one if it can't find the header). |
| Member missing from /committee | Show isn't ticked, or Name is blank. |
| Home page slideshow shows only the committee photo | No Gallery photo has Homepage Header ticked, the ticked photos' Drive files aren't shared, or the Apps Script hasn't been redeployed since the column was added. |
| About / Get involved shows the built-in photo, not the chosen one | Page Photo isn't exactly `/about` / `/collaborate` (capitals and slashes don't matter), the Drive file isn't shared, or the Apps Script hasn't been redeployed since the column was added. |
| No "Volunteer" button | Volunteer Link is empty or isn't a link, or the Apps Script hasn't been redeployed since the column was added. |
| Gallery shows an old list for a moment | The browser shows its remembered list first, then updates. The sheet's 5-minute cache also applies. |
| "We couldn't load …" | The API returned an error or the URL is wrong. Open the `/exec` URL directly and read the `error` message in the JSON. Common causes: a tab renamed, a required header missing, or a new deployment URL not copied into `api.js`. |
| Header/footer missing locally | The file was opened directly. Use `npx serve` (§8). |
| Old favicon still showing | Browsers cache favicons. Hard refresh (Cmd+Shift+R) or use a private window. |

---

## 11. Decisions log

| Decision | Reason |
|---|---|
| Header/footer moved into `partials/` | Edit once instead of on every page |
| Links without `.html` (`/events`) | Cleaner URLs. GitHub Pages supports them natively. |
| Homepage shows all upcoming events as poster cards | Requested (Review 1). Branded card when there's no poster. |
| Sticky header, no separate top-right button | Requested (Review 1). |
| Menu: About us (▾ Committee) · Events · Gallery · Get involved | Review 3: Collaborate and Join us combined; Committee as a drop-down under About us. Menu bar kept the same colour as the header (a darker bar was suggested, then dropped). |
| Scrolling banner removed | Review 3: it was glitchy. |
| Member profile pages removed | Review 3: not needed. Committee cards show photo, name and position only. |
| Appointments column kept but optional | Review 3: role only for now; bubbles appear if the column is filled in later. |
| Home page slideshow from the Gallery tab (Homepage Header checkbox) | Review 3: a rolling slideshow instead of one committee selfie. |
| Two buttons per event: Sign up, Volunteer | Review 3: some events take participants, some volunteers, some both. |
| Fonts: Roboto headings, Montserrat text | Review 3 (Caleb). DM Mono kept for small labels. |
| About and Get involved photos chosen from the Gallery tab (Page Photo) | Requested after Review 3. Newest wins; cropped to the banner shape; built-in photo as fallback. |
| Gallery kept; smaller images and a remembered list | Review 3: "must-have, but can the photos appear faster?" |
| Home sections 02 and 03 kept separate; 03 renamed "Throwback" | Review 3. No Instagram feed on the Events page (home page is enough). |
| Upcoming events: Time and Price; Type only drives the volunteering tag | Requested (Review 1, Review 1 v2) |
| Gallery and committee from the sheet | Review 1 v2. Both pages stay `noindex` while the committee decides about going public. |
| Show checkbox, filtered in `code.gs` | Hidden members' details never leave the sheet |
| Past events and gallery: bottom row first, no date sorting | Dates are free text (e.g. "Quarterly") |
| No yellow "featured" first event | Requested. All event cards styled the same. |
| Posters above the list on the Events page | Keeps a text list of every event, including ones without posters |
| Past events come only from the `Past events` tab | The committee chooses the photo and write-up. Nothing moves automatically. |
| 404 page uses root-relative paths | So it works at any URL depth |
| Tabs and columns auto-created by `code.gs` | Setting up a fresh sheet needs no manual steps (except dropdowns) |
| All work on `staging`, merged to `main` by PR | `main` is the live site |

---

## 12. Open items / ideas

- Gallery may move onto `/events` later (drop in `partials/gallery.html`); committee may move onto `/about`.
- **Committee page: office bearers only, or every member?** Still being discussed (Review 3). Points raised: members change more often than office bearers; people could opt out with the Show checkbox; first name plus appointment was suggested (e.g. "Fan Shuen, Chairperson"). Whatever is decided, just list those people in the Committee tab.
- The Projects tab and the Project Ref columns are stored but not used by the site.
- On tablets wider than 800px there's no hover, so the "About us" drop-down doesn't open by touch; Committee is still reachable from the About page and the footer.
- If member profiles come back, the removed code is in git history before the Review 3 commit (`member.html`, `static/scripts/member.js`, the `member` request in `code.gs`).
- The old `kenneth` branch can be deleted.
- Photo consent: the Home and About photos show committee members; the Collaborate photo shows children. Confirm consent before launch (asked in Website Review 2).
- There's no README. This file serves as the main documentation.
- This file is public: the repository is public, and GitHub Pages may also serve it at `/HANDOVER`. Don't add passwords or private details here.
