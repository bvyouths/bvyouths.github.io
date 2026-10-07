/**
 * Buona Vista Youth Network — Website API
 *
 * Serves the sheet's tabs as JSON so the GitHub Pages site can fetch them.
 *   .../exec                          → "Upcoming events"
 *   .../exec?type=past                → "Past events"
 *   .../exec?type=gallery             → "Gallery"
 *   .../exec?type=committee           → "Committee" (shown members only, for the /committee grid)
 *   .../exec?type=member&name=jane-tan → one shown member's profile (/member?name=jane-tan)
 *
 * Line breaks typed in a cell (Ctrl/Cmd+Enter) are kept and shown as new lines on the site
 * for descriptions and bios.
 *   add &nocache=1 (or ?nocache=1) to skip the 5-minute cache after editing the sheet
 *
 * Columns (row 1 headers, any order). Missing tabs / columns are created automatically
 * the first time the API runs — or run setUpSheets() from the editor to create them now.
 *   Upcoming events: Date | Time | Location | Price | Event Name | Description | Link | Poster | Type
 *   Past events:     Hero Image | Event Name | Event Date | Event Type | Event Description | Project Ref
 *   Projects:        Project Ref | Project Name
 *   Gallery:         Image | Event Name | Description | Label | Persons | Project Ref
 *   Committee:       Name | Username | Position | Image | Bio | Projects | Featured | Show
 *
 * Upcoming events
 * - Past dates are hidden automatically (dates compared in the script's time zone).
 * - Sorted soonest first. Rows whose date can't be understood are shown at the end.
 * - Type isn't displayed; "Volunteering Opportunity" adds a tag on the event's card.
 * Past events, Gallery
 * - Shown newest first = bottom row first. Event Date is free text (e.g. "Quarterly",
 *   "Mar – Jul 2026"), so it is never used for sorting.
 * - Project Refs should be unique in Past events. If one repeats, the bottom row wins.
 * Committee
 * - Only rows with the Show checkbox ticked appear anywhere (grid, profile, photo tags).
 *   Hidden members' details never leave the sheet.
 * - Username is tidied to lower case with hyphens for spaces ("Jane Tan" → jane-tan).
 *   If two rows share one, the first row wins.
 * - Projects / Featured / Persons are multi-select dropdowns: comma-separated refs/usernames.
 *   Only the first 2 Featured refs are used.
 * - Gallery's Persons column is never sent to the website; it only picks each member's
 *   10 latest photos.
 *
 * New columns are formatted as plain text (the Show column gets checkboxes), so entries
 * like "6.30pm to 9.30pm" or "$5/pax" are shown exactly as typed.
 *
 * Images: paste an image link. Google Drive links work if the file is shared as
 * "Anyone with the link". Posters A4 portrait, hero images 4:3, committee photos square.
 */

const TABS = {
  upcoming: {
    name: 'Upcoming events',
    headers: ['Date', 'Time', 'Location', 'Price', 'Event Name', 'Description', 'Link', 'Poster', 'Type']
  },
  past: {
    name: 'Past events',
    headers: ['Hero Image', 'Event Name', 'Event Date', 'Event Type', 'Event Description', 'Project Ref']
  },
  projects: {
    name: 'Projects',
    headers: ['Project Ref', 'Project Name']
  },
  gallery: {
    name: 'Gallery',
    headers: ['Image', 'Event Name', 'Description', 'Label', 'Persons', 'Project Ref']
  },
  committee: {
    name: 'Committee',
    headers: ['Name', 'Username', 'Position', 'Image', 'Bio', 'Projects', 'Featured', 'Show']
  }
};
const CHECKBOX_HEADERS = ['show'];
const CACHE_SECONDS = 300; // sheet edits show on the site within 5 minutes
const CACHE_KEY = 'site_v6'; // change this to clear the cache after editing the script
const MAX_FEATURED = 2;
const MAX_MEMBER_PHOTOS = 10;

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_FULL = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
                     'august', 'september', 'october', 'november', 'december'];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const type = ['past', 'gallery', 'committee', 'member'].indexOf(params.type) !== -1 ? params.type : 'upcoming';
  const username = type === 'member' ? slug_(params.name) : '';
  const cacheKey = CACHE_KEY + '_' + type + (username ? '_' + username : '');
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
      else if (type === 'member') data = { member: getMember_(username) }; // null = not found / hidden
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
 * Makes sure every tab exists with all its column headers.
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
 *   list(key)  → a comma-separated cell as an array of tidied refs / usernames
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
      list: function (key) { return text(key).split(',').map(slug_).filter(Boolean); },
      link: function (key) {
        return has(key) ? findLink_(row[idx[key]], richText[r][idx[key]], formulas[r][idx[key]]) : '';
      },
      image: function (key) {
        return has(key) ? findImage_(row[idx[key]], richText[r][idx[key]], formulas[r][idx[key]]) : '';
      }
    };
  });
}

/** Tidies a username or ref for matching: "  Jane Tan " → "jane-tan". */
function slug_(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '-');
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
    description: 'event description',
    projectRef: 'project ref'
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
      image: row.image('image'),
      projectRef: slug_(row.text('projectRef'))
    });
  });

  return events.reverse();
}

/** Past events by Project Ref. If a ref repeats, the bottom row wins. */
function pastEventsByRef_() {
  const byRef = {};
  getPastEvents_().slice().reverse().forEach(function (ev) {
    if (ev.projectRef) byRef[ev.projectRef] = ev;
  });
  return byRef;
}

/** Gallery rows with an image, newest first (bottom row first). `persons` is internal only. */
function readGallery_() {
  const rows = readTab_(TABS.gallery.name, {
    image: 'image',
    name: 'event name',
    description: 'description',
    label: 'label',
    persons: 'persons',
    projectRef: 'project ref'
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
      projectRef: slug_(row.text('projectRef')),
      persons: row.list('persons')
    });
  });
  return photos.reverse();
}

/** What /gallery shows — without Persons, so who is tagged isn't public. */
function getGallery_() {
  return readGallery_().map(function (p) {
    return { image: p.image, name: p.name, description: p.description, label: p.label, projectRef: p.projectRef };
  });
}

/** Committee rows with Name and Username, Show ticked, one row per username (first wins). */
function readCommittee_() {
  const rows = readTab_(TABS.committee.name, {
    name: 'name',
    username: 'username',
    position: 'position',
    image: 'image',
    bio: 'bio',
    projects: 'projects',
    featured: 'featured',
    show: 'show'
  });
  const seen = {};
  const members = [];
  rows.forEach(function (row) {
    const name = row.text('name');
    const username = slug_(row.text('username'));
    if (!name || !username || seen[username]) return;
    seen[username] = true; // a later duplicate never replaces the first row, even if this one is hidden
    if (['true', 'yes'].indexOf(row.text('show').toLowerCase()) === -1) return;
    members.push({
      name: name,
      username: username,
      position: row.text('position'),
      image: row.image('image'),
      bio: row.text('bio'),
      projects: row.list('projects'),
      featured: row.list('featured')
    });
  });
  return members;
}

/** The /committee grid: shown members in sheet order. */
function getCommittee_() {
  return readCommittee_().map(function (m) {
    return { name: m.name, username: m.username, position: m.position, image: m.image };
  });
}

/** One shown member's profile, or null if the username is unknown or hidden. */
function getMember_(username) {
  if (!username) return null;
  const member = readCommittee_().filter(function (m) { return m.username === username; })[0];
  if (!member) return null;

  const pastByRef = pastEventsByRef_();

  const projectNames = {};
  readTab_(TABS.projects.name, { ref: 'project ref', name: 'project name' }).forEach(function (row) {
    const ref = slug_(row.text('ref'));
    if (ref && !projectNames[ref]) projectNames[ref] = row.text('name');
  });

  const projects = member.projects.map(function (ref) {
    return {
      ref: ref,
      name: projectNames[ref] || ref,
      link: pastByRef[ref] ? '/events#' + ref : ''
    };
  });

  const featured = member.featured.slice(0, MAX_FEATURED)
    .map(function (ref) { return pastByRef[ref]; })
    .filter(Boolean);

  const photos = readGallery_()
    .filter(function (p) { return p.persons.indexOf(username) !== -1; })
    .slice(0, MAX_MEMBER_PHOTOS)
    .map(function (p) { return { image: p.image, name: p.name, description: p.description, label: p.label }; });

  return {
    name: member.name,
    username: member.username,
    position: member.position,
    image: member.image,
    bio: member.bio,
    projects: projects,
    featured: featured,
    photos: photos
  };
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
