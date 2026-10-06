/* ==========================================================
   Site script
   1. Loads the shared header and footer (partials/*.html)
      into any element with data-include="..."
   2. Highlights the current page in the menu
   3. Mobile menu, smooth scrolling, footer year
   Other scripts can wait for the partials with window.includesReady.then(...)
   ========================================================== */

// ---------- 1. Load shared header / footer ----------
function loadIncludes() {
    const slots = document.querySelectorAll('[data-include]');
    return Promise.all(Array.from(slots).map((slot) =>
        fetch(slot.getAttribute('data-include'))
            .then((res) => {
                if (!res.ok) throw new Error(res.status + ' ' + res.url);
                return res.text();
            })
            .then((html) => { slot.outerHTML = html; })
            .catch((err) => {
                console.warn(
                    'Could not load ' + slot.getAttribute('data-include') + '. ' +
                    'If you opened this file directly, run a local server instead (see README).', err
                );
            })
    ));
}

// ---------- 2. Highlight the current page ----------
function markCurrentPage() {
    // "/events", "/events.html" and "/events/" all count as "events"; "/" and "/index" as ""
    const normalise = (path) => path.split('#')[0].replace(/\.html$/, '').replace(/\/$/, '')
        .split('/').pop().replace(/^index$/, '');
    const page = normalise(window.location.pathname);
    document.querySelectorAll('.nav-links a').forEach((a) => {
        const raw = a.getAttribute('href') || '';
        // Section links like "/collaborate#join" don't count as the page itself
        if (normalise(raw) === page && raw.indexOf('#') === -1) {
            a.setAttribute('aria-current', 'page');
        }
    });
}

// ---------- 3. Mobile menu ----------
function setUpMenu() {
    const header = document.querySelector('.site-header');
    const toggle = document.querySelector('.menu-toggle');
    if (!header || !toggle) return;

    const close = () => {
        header.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
    };
    toggle.addEventListener('click', () => {
        const open = header.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', open);
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    header.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// ---------- Smooth scrolling for on-page links ----------
function setUpSmoothScroll() {
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href^="#"]');
        if (!link) return;
        const id = link.getAttribute('href');
        if (id.length < 2) return;
        const target = document.getElementById(decodeURIComponent(id.slice(1)));
        if (target) {
            event.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

// ---------- Footer year ----------
function setYear() {
    document.querySelectorAll('[data-year]').forEach((el) => {
        el.textContent = new Date().getFullYear();
    });
}

// ---------- Run ----------
setUpSmoothScroll();
window.includesReady = loadIncludes().then(() => {
    markCurrentPage();
    setUpMenu();
    setYear();

    // If the page was opened with a #section link, jump there now that the header is in place
    // (getElementById, because ids such as "2026-hlw" aren't valid CSS selectors)
    if (window.location.hash) {
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        if (target) target.scrollIntoView({ behavior: 'instant' });
    }
});
