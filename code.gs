/**
 * Buona Vista Youth Network — Events API
 *
 * Serves the event tabs as JSON so the GitHub Pages site can fetch them.
 *   .../exec             → "Upcoming events" tab
 *   .../exec?type=past   → "Past events" tab
 *   add &nocache=1 (or ?nocache=1) to skip the 5-minute cache after editing the sheet
 *
 * Columns (row 1 headers, any order). Missing tabs / columns are created automatically
 * the first time the API runs — or run setUpSheets() from the editor to create them now.
 *   Upcoming events: Date | Type | Location | Event Name | Description | Link | Poster
 *   Past events:     Hero Image | Event Name | Event Date | Event Type | Event Description
 *
 * Upcoming events
 * - Past dates are hidden automatically (dates compared in the script's time zone).
 * - Sorted soonest first. Rows whose date can't be understood are shown at the end.
 * Past events
 * - Sorted most recent first. Rows whose date can't be understood are shown at the end.
 *
 * Poster / Hero Image: paste an image link. Google Drive links work if the file is shared
 * as "Anyone with the link". Posters should be A4 portrait.
 */

const TABS = {
  upcoming: {
    name: 'Upcoming events',
    headers: ['Date', 'Type', 'Location', 'Event Name', 'Description', 'Link', 'Poster']
  },
  past: {
    name: 'Past events',
    headers: ['Hero Image', 'Event Name', 'Event Date', 'Event Type', 'Event Description']
  }
};
const CACHE_SECONDS = 300; // sheet edits show on the site within 5 minutes
const CACHE_KEY = 'events_v3'; // change this to clear the cache after editing the script

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
                     'august', 'september', 'october', 'november', 'december'];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const type = params.type === 'past' ? 'past' : 'upcoming';
  const cacheKey = CACHE_KEY + '_' + type;
  let body;
  try {
    const cache = CacheService.getScriptCache();
    body = params.nocache === '1' ? null : cache.get(cacheKey);

    if (!body) {
      ensureSheets_();
      body = JSON.stringify({
        events: type === 'past' ? getPastEvents_() : getUpcomingEvents_(),
        updated: new Date().toISOString()
      });
      cache.put(cacheKey, body, CACHE_SECONDS);
    }
  } catch (err) {
    body = JSON.stringify({ error: String(err && err.message ? err.message : err), events: [] });
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
 * Makes sure both tabs exist with all their column headers.
 * Existing tabs keep their data; any missing headers are added after the last column.
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
      sheet.setFrozenRows(1);
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reads a tab and returns helpers for each data row:
 *   text(key)  → the cell as displayed
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
    return {
      text: function (key) { return has(key) ? String(row[idx[key]] || '').trim() : ''; },
      link: function (key) {
        return has(key) ? findLink_(row[idx[key]], richText[r][idx[key]], formulas[r][idx[key]]) : '';
      },
      image: function (key) {
        return has(key) ? findImage_(row[idx[key]], richText[r][idx[key]], formulas[r][idx[key]]) : '';
      }
    };
  });
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
    type: 'type',
    location: 'location',
    name: 'event name',
    description: 'description',
    link: 'link',
    poster: 'poster'
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
      type: row.text('type'),
      location: row.text('location'),
      name: name,
      description: row.text('description'),
      link: row.link('link'),
      poster: row.image('poster')
    });
  });

  events.sort(function (a, b) { return a.sortKey - b.sortKey; });
  return events;
}

function getPastEvents_() {
  const rows = readTab_(TABS.past.name, {
    image: 'hero image',
    name: 'event name',
    date: 'event date',
    type: 'event type',
    description: 'event description'
  });
  const today = today_();
  const events = [];

  rows.forEach(function (row) {
    const name = row.text('name');
    if (!name) return; // skip blank rows

    const dateText = row.text('date');
    // todayKey 0: a date without a year is taken as this year, not next year.
    const parsed = parseDate_(dateText, today.year, 0);

    events.push({
      dateText: dateText,
      sortKey: parsed ? parsed.key : 0,
      type: row.text('type'),
      name: name,
      description: row.text('description'),
      image: row.image('image')
    });
  });

  events.sort(function (a, b) { return b.sortKey - a.sortKey; });
  return events;
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
