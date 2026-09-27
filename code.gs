/**
 * Buona Vista Youth Network — Upcoming events API
 *
 * Serves the "Upcoming events" tab as JSON so the GitHub Pages site can fetch it.
 * Expected columns (row 1 headers, any order):
 *   Date | Type | Location | Event Name | Description | Link
 *
 * - Past events are hidden automatically (dates compared in the script's time zone).
 * - Events are sorted soonest first.
 * - Rows whose date can't be understood are still shown, at the end, with the raw date text.
 */

const SHEET_NAME = 'Upcoming events';
const CACHE_SECONDS = 300; // sheet edits show on the site within 5 minutes
const CACHE_KEY = 'events_v2'; // change this to clear the cache after editing the script

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
                     'august', 'september', 'october', 'november', 'december'];

function doGet(e) {
  let body;
  try {
    const cache = CacheService.getScriptCache();
    const skipCache = e && e.parameter && e.parameter.nocache === '1';
    body = skipCache ? null : cache.get(CACHE_KEY);

    if (!body) {
      body = JSON.stringify({
        events: getUpcomingEvents_(),
        updated: new Date().toISOString()
      });
      cache.put(CACHE_KEY, body, CACHE_SECONDS);
    }
  } catch (err) {
    body = JSON.stringify({ error: String(err && err.message ? err.message : err), events: [] });
  }

  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function getUpcomingEvents_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Tab "' + SHEET_NAME + '" not found');

  // Display values = exactly what you see in the cells, all as text.
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  if (values.length < 2) return [];

  // Used to find links hidden behind cell text (Insert link / =HYPERLINK).
  const richText = range.getRichTextValues();
  const formulas = range.getFormulas();

  const headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {
    date: headers.indexOf('date'),
    type: headers.indexOf('type'),
    location: headers.indexOf('location'),
    name: headers.indexOf('event name'),
    description: headers.indexOf('description'),
    link: headers.indexOf('link')
  };
  if (idx.date === -1 || idx.name === -1) {
    throw new Error('Missing "Date" or "Event Name" column header');
  }

  const tz = Session.getScriptTimeZone();
  const today = new Date();
  const todayKey = Number(Utilities.formatDate(today, tz, 'yyyyMMdd'));
  const thisYear = Number(Utilities.formatDate(today, tz, 'yyyy'));

  const events = [];

  values.slice(1).forEach(function (row, i) {
    const rowIndex = i + 1; // position in values / richText / formulas
    const get = function (key) {
      return idx[key] === -1 ? '' : String(row[idx[key]] || '').trim();
    };

    const name = get('name');
    const dateText = get('date');
    if (!name && !dateText) return; // skip blank rows

    const parsed = parseDate_(dateText, thisYear, todayKey);
    if (parsed && parsed.key < todayKey) return; // already happened

    const link = idx.link === -1 ? '' : findLink_(
      row[idx.link],
      richText[rowIndex][idx.link],
      formulas[rowIndex][idx.link]
    );

    events.push({
      dateText: dateText,
      day: parsed ? String(parsed.day).padStart(2, '0') : '',
      month: parsed ? MONTHS_SHORT[parsed.month - 1] : '',
      year: parsed ? String(parsed.year) : '',
      sortKey: parsed ? parsed.key : 99999999,
      type: get('type'),
      location: get('location'),
      name: name,
      description: get('description'),
      link: link
    });
  });

  events.sort(function (a, b) { return a.sortKey - b.sortKey; });
  return events;
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
