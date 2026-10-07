# Buona Vista Youth Network website: handover

Last updated: 8 Oct 2026

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
├── index.html            Home: hero photo, About teaser + 3 pillars, event poster cards, Instagram feed
├── about.html            About us
├── events.html           Events: poster carousel, upcoming list, past events
├── collaborate.html      Collaborate: ways to work together, #join form, #contact
├── gallery.html          /gallery: photo gallery from the sheet. In the menu and footer; noindex
├── committee.html        /committee: committee grid from the sheet. In the footer and linked from About; noindex
├── member.html           Hidden page (/member?name=<username>): one member's profile. noindex
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
│   ├── scripts/api.js         Shared: the API address, fetching, ‹ › sliders, past-event rows, initials avatars
│   ├── scripts/events.js      Upcoming list, poster cards, past events
│   ├── scripts/gallery.js     Gallery masonry, hover details, enlarge on laptop, tap on phone
│   ├── scripts/committee.js   Committee grid cards
│   ├── scripts/member.js      Member profile page
│   └── images/                logo.png, favicon.png
│       └── photos/            Photos used on Home, About and Collaborate
├── HANDOVER.md           This document
└── .gitignore            Ignores .DS_Store files
```

### Partials
- Each page has placeholders like `<div data-include="partials/header.html"></div>`. At load time, `script.js` fetches the partial and swaps it in. Other scripts wait for this with `window.includesReady` (via `BVYN.ready()` in `api.js`).
- **To change the navigation or footer, edit `partials/header.html` or `partials/footer.html` only.** Every page updates.
- The header is **sticky** (stays at the top while scrolling). On phones the menu is a ☰ icon that turns into ✕. `scroll-padding-top` on `html` in `styles.css` keeps `#section` links from hiding under it.
- To show the gallery or committee grid on another page: add `<div data-include="/partials/gallery.html"></div>` (or `committee.html`) and load `api.js` then `gallery.js` (or `committee.js`) after `script.js`.
- Because the partials are fetched, the site **must be viewed through a web server**. Opening the `.html` file directly (`file://`) won't work (see §8).

### Brand colours
Defined as CSS variables at the top of `static/styles/styles.css`: `--purple #2c008d`, `--gold #f2af24`, `--orange #e34728`, `--cream #fbf6ec` (page background), `--sand #f4ebda` (alternate section background). Fonts are **Manrope** (text) and **DM Mono** (labels), from Google Fonts.

---

## 3. URLs and links

- **Internal links don't use `.html`:** `/about`, `/events`, `/collaborate`, and `/` for home. The `#join` and `#contact` sections are linked as `/collaborate#join` and `/collaborate#contact`. GitHub Pages maps `/about` to `about.html` automatically.
- **Menu:** About us · Events · Gallery · Collaborate · Join us. **Footer:** About us · Committee · Events · Gallery · Collaborate · Join us.
- **`noindex`:** `/gallery`, `/committee` and `/member` ask Google not to list them (kept on request while the committee decides about going public). `/committee` is linked from About ("Check out the faces behind BV YN") and the footer; profiles are reached from the committee cards.
- **Project links:** each past event with a Project Ref gets that ref as its id, so `/events#2026-hlw` scrolls to it (after the events load). Profiles link projects this way.
- `script.js` → `markCurrentPage()` highlights the current menu item. It treats `/events`, `/events.html` and `/events/` as the same page.
- **Paths in `404.html` and `member.html` start with `/`** (`/static/...`, `/partials/...`) so they work at any depth.
- **`/member` "not found":** a missing, unknown or hidden `?name=` shows the "Page not found" design. The browser still receives it as a normal page (a static site can't send a real 404 status for a page that exists); visitors won't notice.

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
| `…/exec?type=gallery` | Gallery photos, newest first (no Persons) |
| `…/exec?type=committee` | Shown members only: name, username, position, image |
| `…/exec?type=member&name=jane-tan` | One shown member: details, projects, up to 2 featured past events, up to 10 latest photos. `"member": null` if unknown or hidden |
| add `nocache=1` | Reads the sheet fresh and refreshes the cache (see below) |

### Sheet tabs and columns
Row 1 must hold the headers. They can be in any order, and capitals and extra spaces are ignored. **If a tab or column is missing, the script creates it automatically** the next time it runs, or you can run `setUpSheets()` from the Apps Script editor. It never deletes data. Missing columns are added after the last existing one: as plain-text cells, except **Show**, which gets checkboxes.

**`Upcoming events`**: `Date | Time | Location | Price | Event Name | Description | Link | Poster | Type`
- **Time** and **Price** are plain text, shown exactly as typed on one line: `Time · Location · Price` (e.g. `6.30pm to 9.30pm · Leng Kee CC · $5/pax`).
- **Type** isn't displayed. If it's `Volunteering Opportunity` (any capitals/spacing), the event's poster card (or brand card) gets an orange **Volunteering Opportunity** tag in the top-right corner, which stays visible while the details show, and the list row gets the same tag beside the name.
- **Line breaks:** a new line typed inside a cell (Ctrl/Cmd+Enter) shows as a new line on the site in Description, Event Description, Gallery Description and Bio.
- Events whose date has passed are hidden automatically. They are sorted soonest first.
- **Date** accepts `18 Oct 2026`, `18 October 2026`, `Sat, 18th Oct 2026`, `Oct 18, 2026`, `18/10/2026` (day first), `2026-10-18`, and `18 Oct` (year assumed). Dates it can't read still show, at the end, as the raw text.
- **Link** is the sign-up link. It can be a plain URL, a link behind text, `=HYPERLINK(...)`, or an email.
- **Poster** is an image link (see Images below).

**`Past events`**: `Hero Image | Event Name | Event Date | Event Type | Event Description | Project Ref`
- Only what's in this tab is shown. Upcoming events **do not** move here automatically once they pass (the committee picks a proper photo and write-up).
- **Shown newest first = bottom row first.** Event Date is free text (e.g. `Quarterly`, `Mar – Jul 2026`), so it's **never used for sorting**. Add new past events at the bottom.
- **Project Ref** (dropdown from `Projects`) links the event to a project. Refs should be **unique** here (e.g. `2026-hlw`, `2025-hlw`). If one repeats, the **bottom row** wins.

**`Projects`**: `Project Ref | Project Name`
- The master list of projects that the dropdowns pull from. Project Ref: lower case, no spaces (e.g. `2026-hlw`), used in links. Project Name is what profiles show.

**`Gallery`**: `Image | Event Name | Description | Label | Persons | Project Ref`
- Rows without an image are skipped. Name, description and label are each optional (shown on hover/tap). Label is free text, e.g. the date.
- **Shown newest first = bottom row first.** Add new photos at the bottom.
- **Persons**: multi-select dropdown of committee **usernames**. Never sent to the website as-is; the script only uses it to pick each member's 10 latest photos for their profile.
- **Project Ref**: dropdown from `Projects`. Stored for future use; not displayed yet.

**`Committee`**: `Name | Username | Position | Image | Bio | Projects | Featured | Show`
- **Name** and **Username** are required. Username is tidied to lower case with hyphens for spaces (`Jane Tan` → `jane-tan`) and is the `?name=` in `/member?name=jane-tan`. If two rows share one, the **first** row wins.
- **Show** checkbox: **unticked = hidden everywhere** (grid, profile, photo tags). Hidden members are filtered out by the script, so their details never reach the website.
- **Image**: square photo link. Blank (or broken) → purple square with their initials.
- **Bio**: short bio, profile only.
- **Projects**: multi-select dropdown of Project Refs. Shown as project names; a name links to `/events#<ref>` when a past event has that ref, otherwise plain text.
- **Featured**: multi-select dropdown of `Past events` Project Refs. **Only the first 2** are used; shown like the Events page (1st image left, 2nd image right; one at a time with ‹ › on phones). A ref with no past event is skipped.

### Setting up the dropdowns (one-off, in the Google Sheet)
Select the column's cells (e.g. Committee → Projects, row 2 down) → **Data → Data validation → Add rule** → *Criteria: Dropdown (from a range)* → choose the range → tick **Allow multiple selections** where it's multi-select → Done.

| Column | Range | Multiple selections |
|---|---|---|
| Past events → Project Ref | `Projects!A2:A` (the Project Ref column) | No |
| Gallery → Project Ref | `Projects!A2:A` | No |
| Gallery → Persons | `Committee!B2:B` (the Username column) | Yes |
| Committee → Projects | `Projects!A2:A` | Yes |
| Committee → Featured | `'Past events'!F2:F` (the Project Ref column) | Yes |

(Adjust the column letters if your columns are in a different order.) Multi-select cells store `a, b`; the script splits on commas.

### Images
- Paste a link to the image. Google Drive links (`drive.google.com/file/d/…/view`, `open?id=…`) are converted automatically. **The file must be shared as "Anyone with the link".** `=IMAGE("url")` and links behind text also work.
- Images **inserted into or over cells** (Insert → Image) are **not** picked up. Use a link.
- **Posters:** A4 portrait, e.g. **1240 × 1754 px**.
- **Past event hero images:** 4:3 landscape, **1600 × 1200 px**. Cropped to fill, so keep faces and text away from the edges.
- **Committee photos:** square, at least **600 × 600 px**.
- **Gallery:** any shape (the gallery and profile photo rows keep each photo's shape), about 1600 px on the long side.

### Caching (why sheet edits don't show instantly)
- The script caches each response for **5 minutes** (`CACHE_SECONDS` in `code.gs`). Each request type (and each member profile) is cached separately.
- To show changes immediately, add `nocache=1` to the matching request, e.g.:
  - Upcoming: `…/exec?nocache=1`
  - Past: `…/exec?type=past&nocache=1`
  - Gallery: `…/exec?type=gallery&nocache=1`
  - Committee grid: `…/exec?type=committee&nocache=1`
  - A profile: `…/exec?type=member&name=jane-tan&nocache=1`
- After changing `code.gs` itself, bump `CACHE_KEY` (currently `site_v5`; e.g. → `site_v6`) so old cached data is dropped.

### Updating the Apps Script (important)
`code.gs` in this repo is only a **copy**. The version that actually runs lives in the Google Sheet's Apps Script project (Extensions → Apps Script).
1. Paste the updated `code.gs` into the Apps Script editor and save.
2. Optional: run `setUpSheets` once (function dropdown → Run) to create new tabs and columns straight away.
3. **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
   This **keeps the same URL**. Choosing "New deployment" instead creates a new URL, and you would then need to update `API_URL` in `api.js`.
4. Open the `?nocache=1` links to confirm the JSON looks right.

### Testing code.gs without the sheet
`code.gs` has no external dependencies besides Google's services, so it can be run in Node with small stand-ins for `SpreadsheetApp`, `CacheService` etc. to check the JSON output (this was done for the Review 1 v2 changes).

---

## 5. Page layouts

### Events page (`events.html`)
1. **Poster carousel** (`data-event-posters data-placeholder`): every upcoming event; a branded purple card (logo, date, name) when there's no poster or it fails to load.
   - 3 across on desktop, 2 on tablet (≤960px), 1 on phone (≤700px).
   - When there are fewer posters than fit, they are centred. When there are more, **‹ ›** arrows appear (you can also swipe on phones).
   - **Hover** shows date, time · location · price, name, description and a *Sign up* button. On touch screens, **tap** to show the details.
2. **Upcoming events list** (`data-events`): all upcoming events, poster or not.
3. **Past events** (`data-past-section`, `data-past-events`): newest first; image and text swap sides on each row. On phones the image sits on top. Hidden entirely while the tab is empty. Events without an image get a logo placeholder.

The **homepage** (`index.html`) shows the same poster cards (no list). Remove `data-placeholder` from a carousel to show only events that have posters.

### Gallery (`/gallery`)
- Masonry: 3 columns on laptop, 2 on tablet, 1 on phone. Photos keep their own shape and are dealt left to right, so the newest are along the top.
- Laptop: hover shows label, name and description; **click enlarges** (Esc or click to close). Phone/tablet: **tap** shows the details.

### Committee (`/committee`)
- Grid of shown members (4 / 3 / 2 per row): photo or initials, name, position. Each card links to the profile.

### Member profile (`/member?name=<username>`)
- Top: photo or initials, name, position, bio, "Back to committee".
- Then **Projects** (chips), **Photos** (up to 10, uncropped, one row of equal height; about 4 landscape photos fit on a laptop; ‹ › arrows to see the rest), **Featured** (up to 2 past events). Sections with nothing in them are left out.

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
| Add a past event | `Past events` (at the **bottom**). Give it a unique Project Ref from `Projects`. |
| Add a project | `Projects` → new row with a Project Ref and Project Name |
| Add a gallery photo | `Gallery` (at the **bottom**). Tag committee members in Persons. |
| Add / edit / hide a committee member | `Committee`. Tick Show to make them visible. |
| Change nav or footer links | `partials/header.html`, `partials/footer.html` |
| Change colours / fonts / spacing | `static/styles/styles.css` (variables at the top) |
| Change the interest / sign-up form link | `collaborate.html` (`#join` section), currently `go.gov.sg/bvyn-interest-form` |
| Change contact email / socials | `collaborate.html` (`#contact`) and `partials/footer.html` |
| Change a site photo | Replace the file in `static/images/photos/` (same name), or change the `<img src>` in the page. Keep files under ~300 KB (about 1600 px wide). |
| Change the favicon | Replace `static/images/favicon.png` (square PNG, currently 256×256, logo on white) |
| Change cache time | `CACHE_SECONDS` in `code.gs`, then redeploy (see §4) |
| Change the API URL | `API_URL` in `static/scripts/api.js` |

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| New sheet row doesn't appear | 5-minute cache. Open the matching `nocache=1` link. For upcoming events, also check the date isn't in the past. |
| Image doesn't show | Check the link is on the right row and the Drive file is shared "Anyone with the link". Images inserted into cells don't work: use a link. Check there's no **second** empty column with the same header at the far right (the script adds one if it can't find the header). |
| Member missing from /committee, or their profile says "Page not found" | Show isn't ticked, Name or Username is blank, or another row above uses the same Username. |
| Project shows as plain text on a profile | No row in `Past events` has that Project Ref yet. |
| Featured section missing | The member's first 2 Featured refs don't match any `Past events` Project Ref. |
| Member's photos missing | Their username isn't in that photo's Persons cell, or the photo row has no image. |
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
| Sticky header, no separate top-right button | Requested (Review 1). Menu now: About us · Events · Gallery · Collaborate · Join us. |
| Upcoming events: Time and Price; Type only drives the volunteering tag | Requested (Review 1, Review 1 v2) |
| Gallery, committee and profiles from the sheet, on hidden pages | Review 1 v2. Internal users assess before deciding to make them public. |
| Show checkbox, filtered in `code.gs` | Hidden members' details never leave the sheet |
| Gallery Persons never sent to the website | Who is tagged in photos isn't public data |
| Past events and gallery: bottom row first, no date sorting | Dates are free text (e.g. "Quarterly") |
| Unique Project Refs; duplicates → bottom row | Simple foreign key; predictable if a duplicate slips in |
| Profiles via `/member?name=` (one page filled by script) | Works on GitHub Pages without generating a file per person. Trade-off: link previews are generic and Google can't index profiles (not needed now). |
| No yellow "featured" first event | Requested. All event cards styled the same. |
| Posters above the list on the Events page | Keeps a text list of every event, including ones without posters |
| Past events come only from the `Past events` tab | The committee chooses the photo and write-up. Nothing moves automatically. |
| 404, member pages use root-relative paths | So they work at any URL depth |
| Tabs and columns auto-created by `code.gs` | Setting up a fresh sheet needs no manual steps (except dropdowns) |
| All work on `staging`, merged to `main` by PR | `main` is the live site |

---

## 12. Open items / ideas

- Gallery may move onto `/events` later (drop in `partials/gallery.html`); committee may move onto `/about`.
- Gallery Project Ref is stored but not used yet.
- Per-person link previews or Google indexing for profiles would need a generated page per member (e.g. a scheduled build from the sheet).
- The old `kenneth` branch can be deleted.
- Photo consent: the Home and About photos show committee members; the Collaborate photo shows children. Confirm consent before launch (asked in Website Review 2).
- There's no README. This file serves as the main documentation.
- This file is public: the repository is public, and GitHub Pages may also serve it at `/HANDOVER`. Don't add passwords or private details here.
