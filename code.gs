/**
 * Buona Vista Youth Network — Website API
 *
 * Serves the sheet's tabs as JSON so the GitHub Pages site can fetch them.
 *   .../exec                 → "Upcoming events"
 *   .../exec?type=past       → "Past events"
 *   .../exec?type=gallery    → "Gallery" (also feeds the home page slideshow)
 *   .../exec?type=committee  → "Committee" (shown members only, for the /committee grid)
 *   add &nocache=1 (or ?nocache=1) to skip the 5-minute cache after editing the sheet
 *
 * Columns (row 1 headers, any order; capitals and extra spaces don't matter).
 * The tabs and columns below — only the ones the website uses — are created
 * automatically if missing (or run setUpSheets() from the editor). Nothing else is
 * ever added, and nothing is deleted or reordered; other columns are just ignored.
 *   Upcoming events: Date | Time | Location | Price | Event Name | Description | Link | Volunteer Link | Poster | Type
 *   Past events:     Hero Image | Event Name | Event Date | Event Type | Event Description
 *   Gallery:         Image | Event Name | Description | Label | Homepage Header | Page Photo
 *   Committee:       Name | Position | Image | Appointments | Show
 * Columns it creates are formatted as plain text, so entries like "6.30pm" or "$5/pax"
 * stay as typed; Show and Homepage Header get checkboxes.
 *
 * Upcoming events
 * - Past dates are hidden automatically (dates compared in the script's time zone).
 * - Sorted soonest first. Rows whose date can't be understood are shown at the end.
 * - Link = sign up to take part. Volunteer Link = sign up to volunteer. An event can have
 *   either, both or neither; each one gets its own button.
 * - Type isn't displayed; "Volunteering Opportunity" adds a tag on the event's card.
 * Past events, Gallery
 * - Shown newest first = bottom row first. Event Date is free text (e.g. "Quarterly",
 *   "Mar – Jul 2026"), so it is never used for sorting.
 * - Gallery photos with Homepage Header ticked make up the home page slideshow.
 * - Page Photo puts a photo on another page: "/about" (the wide photo under "A network of
 *   passionate leaders") or "/collaborate" (the wide photo on Get involved). Comma-separate
 *   for both. If several photos name the same page, the newest (bottom row) is used.
 * Committee
 * - Only rows with the Show checkbox ticked appear. Hidden members' details never leave
 *   the sheet. List whoever should be displayed (e.g. office bearers only).
 * - Appointments is optional: comma-separated items (e.g. "Membership, BV Social"), each
 *   shown as a small bubble under the name. Leave blank for no bubbles.
 *
 * Line breaks typed in a cell (Ctrl/Cmd+Enter) are kept and shown as new lines on the site
 * for descriptions.
 *
 * Images: paste an image link. Google Drive links work if the file is shared as
 * "Anyone with the link". Posters A4 portrait, hero images 4:3, committee photos square.
 */

// Only the columns the website reads. Keep this in step with the readTab_() calls below,
// so the script never adds columns nobody uses.
const TABS = {
  upcoming: {
    name: 'Upcoming events',
    headers: ['Date', 'Time', 'Location', 'Price', 'Event Name', 'Description', 'Link', 'Volunteer Link', 'Poster', 'Type']
  },
  past: {
    name: 'Past events',
    headers: ['Hero Image', 'Event Name', 'Event Date', 'Event Type', 'Event Description']
  },
  gallery: {
    name: 'Gallery',
    headers: ['Image', 'Event Name', 'Description', 'Label', 'Homepage Header', 'Page Photo']
  },
  committee: {
    name: 'Committee',
    headers: ['Name', 'Position', 'Image', 'Appointments', 'Show']
  }
};
const CHECKBOX_HEADERS = ['show', 'homepage header'];
const CACHE_SECONDS = 300; // sheet edits show on the site within 5 minutes
const CACHE_KEY = 'site_v9'; // change this to clear the cache after editing the script

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
                     'august', 'september', 'october', 'november', 'december'];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const type = ['past', 'gallery', 'committee'].indexOf(params.type) !== -1 ? params.type : 'upcoming';
  const cacheKey = CACHE_KEY + '_' + type;
  let body;
  try {
    const cache = CacheService.getScriptCache();
    body = params.nocache === '1' ? null : cache.get(cacheKey);

    if (!body) {
      ensureSheets_();
      let data;
      if (type === 'past') data = { events: getPastEvents_() };
      else if (type === 'gallery') data = { photos: getGallery_() };
      else if (type === 'committee') data = { members: getCommittee_() };
      else data = { events: getUpcomingEvents_() };
      data.updated = new Date().toISOString();
      body = JSON.stringify(data);
      cache.put(cacheKey, body, CACHE_SECONDS);
    }
  } catch (err) {
    body = JSON.stringify({ error: String(err && err.message ? err.message : err) });
  }

  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run this from the Apps Script editor to create the tabs and columns straight away. */
function setUpSheets() {
  ensureSheets_();
}

/**
 * Makes sure every tab the website uses exists, with the columns it reads (TABS above).
 * Existing tabs keep their data; any missing headers are added after the last column.
 * Never adds anything that isn't in TABS, and never deletes or moves columns.
 */
function ensureSheets_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.keys(TABS).forEach(function (key) {
      const tab = TABS[key];
      const sheet = ss.getSheetByName(tab.name) || ss.insertSheet(tab.name);
      const lastCol = sheet.getLastColumn();
      const existing = lastCol ? sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] : [];
      const have = existing.map(function (h) { return String(h).trim().toLowerCase(); });
      const missing = tab.headers.filter(function (h) { return have.indexOf(h.toLowerCase()) === -1; });
      if (!missing.length) return;

      // Fill after the last non-empty header so blank trailing header cells aren't skipped over.
      let start = have.length;
      while (start > 0 && !have[start - 1]) start--;
      sheet.getRange(1, start + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      if (sheet.getMaxRows() > 1) {
        missing.forEach(function (header, i) {
          const column = sheet.getRange(2, start + 1 + i, sheet.getMaxRows() - 1, 1);
          if (CHECKBOX_HEADERS.indexOf(header.toLowerCase()) !== -1) {
            column.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
          } else {
            // Plain text, so times / prices / dates aren't auto-converted by Sheets
            column.setNumberFormat('@');
          }
        });
      }
      sheet.setFrozenRows(1);
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reads a tab and returns helpers for each data row:
 *   text(key)  → the cell as displayed
 *   items(key) → a comma-separated cell as an array of trimmed items
 *   ticked(key) → whether a checkbox cell is ticked
 *   link(key)  → a usable URL from the cell (see findLink_)
 *   image(key) → a URL that can go straight into <img src> (see findImage_)
 * `columns` maps our keys to header names (lower case).
 */
function readTab_(tabName, columns) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('Tab "' + tabName + '" not found');

  // Display values = exactly what you see in the cells, all as text.
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  if (values.length < 2) return [];

  // Used to find links hidden behind cell text (Insert link / =HYPERLINK / =IMAGE).
  const richText = range.getRichTextValues();
  const formulas = range.getFormulas();

  const headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {};
  Object.keys(columns).forEach(function (key) { idx[key] = headers.indexOf(columns[key]); });

  return values.slice(1).map(function (row, i) {
    const r = i + 1; // position in values / richText / formulas
    const has = function (key) { return idx[key] !== undefined && idx[key] !== -1; };
    const text = function (key) { return has(key) ? String(row[idx[key]] || '').trim() : ''; };
    return {
      text: text,
      items: function (key) {
        return text(key).split(',').map(function (item) { return item.trim(); }).filter(Boolean);
      },
      ticked: function (key) { return ['true', 'yes'].indexOf(text(key).toLowerCase()) !== -1; },
      link: function (key) {
        return has(key) ? findLink_(row[idx[key]], richText[r][idx[key]], formulas[r][idx[key]]) : '';
      },
      image: function (key) {
        return has(key) ? findImage_(row[idx[key]], richText[r][idx[key]], formulas[r][idx[key]]) : '';
      }
    };
  });
}

/** Tidies a page name: "About", "/about/", " /About " → "/about". */
function pagePath_(value) {
  return '/' + String(value || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
}

function today_() {
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  return {
    key: Number(Utilities.formatDate(now, tz, 'yyyyMMdd')),
    year: Number(Utilities.formatDate(now, tz, 'yyyy'))
  };
}

function getUpcomingEvents_() {
  const rows = readTab_(TABS.upcoming.name, {
    date: 'date',
    time: 'time',
    location: 'location',
    price: 'price',
    name: 'event name',
    description: 'description',
    link: 'link',
    volunteerLink: 'volunteer link',
    poster: 'poster',
    type: 'type'
  });
  const today = today_();
  const events = [];

  rows.forEach(function (row) {
    const name = row.text('name');
    const dateText = row.text('date');
    if (!name && !dateText) return; // skip blank rows

    const parsed = parseDate_(dateText, today.year, today.key);
    if (parsed && parsed.key < today.key) return; // already happened

    events.push({
      dateText: dateText,
      day: parsed ? String(parsed.day).padStart(2, '0') : '',
      month: parsed ? MONTHS_SHORT[parsed.month - 1] : '',
      year: parsed ? String(parsed.year) : '',
      sortKey: parsed ? parsed.key : 99999999,
      time: row.text('time'),
      location: row.text('location'),
      price: row.text('price'),
      name: name,
      description: row.text('description'),
      link: row.link('link'),
      volunteerLink: row.link('volunteerLink'),
      poster: row.image('poster'),
      type: row.text('type')
    });
  });

  events.sort(function (a, b) { return a.sortKey - b.sortKey; });
  return events;
}

/** Past events, newest first (bottom row first). */
function getPastEvents_() {
  const rows = readTab_(TABS.past.name, {
    image: 'hero image',
    name: 'event name',
    date: 'event date',
    type: 'event type',
    description: 'event description'
  });
  const events = [];

  rows.forEach(function (row) {
    const name = row.text('name');
    if (!name) return; // skip blank rows
    events.push({
      dateText: row.text('date'),
      type: row.text('type'),
      name: name,
      description: row.text('description'),
      image: row.image('image')
    });
  });

  return events.reverse();
}

/**
 * Gallery rows with an image, newest first (bottom row first).
 * `homepage` marks the photos for the home page slideshow; `pages` lists the pages
 * (e.g. "/about") that use the photo in place of their built-in one.
 */
function getGallery_() {
  const rows = readTab_(TABS.gallery.name, {
    image: 'image',
    name: 'event name',
    description: 'description',
    label: 'label',
    homepage: 'homepage header',
    pages: 'page photo'
  });
  const photos = [];
  rows.forEach(function (row) {
    const image = row.image('image');
    if (!image) return; // rows without an image are skipped
    photos.push({
      image: image,
      name: row.text('name'),
      description: row.text('description'),
      label: row.text('label'),
      homepage: row.ticked('homepage'),
      pages: row.items('pages').map(pagePath_)
    });
  });
  return photos.reverse();
}

/** The /committee grid: rows with a Name and Show ticked, in sheet order. */
function getCommittee_() {
  const rows = readTab_(TABS.committee.name, {
    name: 'name',
    position: 'position',
    image: 'image',
    appointments: 'appointments',
    show: 'show'
  });
  const members = [];
  rows.forEach(function (row) {
    const name = row.text('name');
    if (!name || !row.ticked('show')) return;
    members.push({
      name: name,
      position: row.text('position'),
      image: row.image('image'),
      appointments: row.items('appointments')
    });
  });
  return members;
}

/**
 * Gets an image URL from a Poster / Hero Image cell:
 *   - =IMAGE("https://…")
 *   - a link (plain, behind text, or =HYPERLINK — see findLink_)
 * Google Drive share links are turned into direct image links.
 */
function findImage_(displayText, richTextValue, formula) {
  let url = '';
  const m = formula && String(formula).match(/IMAGE\(\s*"([^"]+)"/i);
  if (m && !/HYPERLINK/i.test(formula)) url = normaliseLink_(m[1]);
  if (!url) url = findLink_(displayText, richTextValue, formula);
  if (!url || /^mailto:/i.test(url)) return '';

  // drive.google.com/file/d/ID/view, /open?id=ID, /uc?id=ID, docs.google.com/…
  if (/^https?:\/\/(drive|docs)\.google\.com\//i.test(url)) {
    const id = (url.match(/\/d\/([\w-]{20,})/) || url.match(/[?&]id=([\w-]{20,})/) || [])[1];
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600';
  }
  return url;
}

/**
 * Gets the real URL from a Link cell, however it was entered:
 *   - a hyperlink behind text (Insert → Link, or pasted link with custom text)
 *   - =HYPERLINK("https://…", "Sign up")
 *   - a plain URL, with or without https:// (e.g. "forms.gle/abc123")
 * Returns a full https URL, or '' if there's no usable link.
 */
function findLink_(displayText, richTextValue, formula) {
  // 1. Link attached to the cell text
  if (richTextValue) {
    let url = richTextValue.getLinkUrl();
    if (!url) {
      const runs = richTextValue.getRuns();
      for (let i = 0; i < runs.length && !url; i++) url = runs[i].getLinkUrl();
    }
    if (url) return normaliseLink_(url);
  }

  // 2. =HYPERLINK("url", "text")
  if (formula) {
    const m = String(formula).match(/HYPERLINK\(\s*"([^"]+)"/i);
    if (m) return normaliseLink_(m[1]);
  }

  // 3. Plain text URL
  return normaliseLink_(displayText);
}

function normaliseLink_(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (/^mailto:/i.test(url)) return url;
  if (/^[^\s@\/]+@[^\s@\/]+\.[a-z]{2,}$/i.test(url)) return 'mailto:' + url; // plain email
  if (!/^https?:\/\//i.test(url)) {
    // Only treat it as a web address if it looks like one (has a dot, no spaces)
    if (/\s/.test(url) || url.indexOf('.') === -1) return '';
    url = 'https://' + url.replace(/^\/+/, '');
  }
  return url;
}

/**
 * Understands common text dates, e.g.
 *   "18 Oct 2025", "18 October 2025", "Sat, 18th Oct 2025", "Oct 18, 2025",
 *   "18/10/2025" (day first), "2025-10-18", "18 Oct" (year assumed).
 * Returns { day, month, year, key } or null.
 */
function parseDate_(text, thisYear, todayKey) {
  if (!text) return null;
  const t = text.trim();
  let y, m, d, match;

  if ((match = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) {
    y = +match[1]; m = +match[2]; d = +match[3];
  } else if ((match = t.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) {
    d = +match[1]; m = +match[2]; y = +match[3];
  } else {
    const words = t.match(/[A-Za-z]+/g) || [];
    for (let i = 0; i < words.length && !m; i++) {
      const w = words[i].toLowerCase();
      if (w.length < 3) continue;
      const mi = MONTHS_FULL.findIndex(function (full) { return full.indexOf(w) === 0; });
      if (mi !== -1) m = mi + 1;
    }
    const yearMatch = t.match(/\b(\d{4})\b/);
    const dayMatch = t.replace(/\b\d{4}\b/, '').match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (dayMatch) d = +dayMatch[1];
    if (yearMatch) y = +yearMatch[1];
  }

  if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;

  if (!y) {
    // No year given: use the next time this date comes round.
    y = thisYear;
    if (y * 10000 + m * 100 + d < todayKey) y += 1;
  } else if (y < 100) {
    y += 2000;
  }

  return { day: d, month: m, year: y, key: y * 10000 + m * 100 + d };
}
