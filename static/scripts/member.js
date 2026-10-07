/* ==========================================================
   Member profile — /member?name=<username> (needs api.js first)

   Loaded live from the "Committee" tab via code.gs (?type=member&name=…).
   Shows: photo or initials, name, position, bio, then
     Projects  — project names; linked to /events#<ref> when a past event has that ref
     Photos    — up to 10 latest gallery photos tagged with this username, in their own
                 shape, one row with ‹ › arrows
     Featured  — up to 2 past events, laid out like the Events page
   Sections with nothing in them are left out. A missing, unknown or hidden
   username shows the "Page not found" design.
   ========================================================== */
(function () {
    var B = window.BVYN;
    var el = B.el;
    var main = document.querySelector('[data-member]');
    if (!main) return;

    var SITE = 'Buona Vista Youth Network';

    function showNotFound() {
        document.title = 'Page not found — ' + SITE;
        main.innerHTML =
            '<section class="page-hero section-pad">' +
            '<p class="eyebrow"><span class="pulse light"></span> Error 404</p>' +
            '<h1>This page<br><em>wandered off.</em></h1>' +
            '<p class="hero-intro">The link might be old, or the address might have a typo. Let’s get you back somewhere real.</p>' +
            '<div class="hero-actions">' +
            '<a class="button button-gold" href="/">Back to home <span>↗</span></a>' +
            '<a class="text-link" href="/events">See upcoming events <span>↗</span></a>' +
            '</div>' +
            '<div class="blob" aria-hidden="true"></div>' +
            '</section>';
    }

    // ---------- Top: photo, name, position, bio ----------
    function buildIntro(m) {
        var hero = el('section', 'page-hero section-pad profile-hero');
        var back = el('a', 'back-link', '← Back to committee');
        back.href = '/committee';
        hero.appendChild(back);

        var intro = el('div', 'profile-intro');
        intro.appendChild(B.avatar(m, 'profile-photo'));
        var text = el('div', 'profile-text');
        text.appendChild(el('h1', '', m.name));
        if (m.position) text.appendChild(el('p', 'profile-position', m.position));
        if (m.bio) text.appendChild(el('p', 'profile-bio', m.bio));
        intro.appendChild(text);
        hero.appendChild(intro);
        return hero;
    }

    // ---------- A titled section, numbered like the rest of the site ----------
    var sectionNumber = 0;
    function buildSection(title, extraClass) {
        sectionNumber++;
        var section = el('section', 'section-pad profile-section' + (extraClass ? ' ' + extraClass : ''));
        var label = el('div', 'section-label');
        label.appendChild(el('span', '', String(sectionNumber).padStart(2, '0')));
        label.appendChild(el('span', '', title));
        section.appendChild(label);
        return section;
    }

    function buildProjects(projects) {
        var section = buildSection('Projects');
        var chips = el('div', 'chips profile-projects');
        projects.forEach(function (p) {
            var chip;
            if (p.link) {
                chip = el('a', 'chip chip-link', p.name + ' ↗');
                chip.href = p.link;
            } else {
                chip = el('span', 'chip', p.name);
            }
            chips.appendChild(chip);
        });
        section.appendChild(chips);
        return section;
    }

    function buildPhotos(photos) {
        var section = buildSection('Photos');
        var box = el('div', 'photo-carousel');
        section.appendChild(box);
        var items = photos.map(function (p) {
            var fig = el('figure', 'photo');
            var img = el('img');
            img.src = p.image;
            img.alt = p.name || 'Photo';
            // Not lazy: photos further along the row must load so the row knows its full width
            img.addEventListener('error', function () { fig.remove(); });
            fig.appendChild(img);
            return fig;
        });
        // Built after the section is on the page, so the arrows know whether everything fits
        return { section: section, finish: function () { B.carousel(box, items, 'photo-track', 'photos'); } };
    }

    function buildFeatured(featured) {
        var section = buildSection('Featured');
        var box = el('div', 'featured-carousel');
        section.appendChild(box);
        return { section: section, finish: function () { B.carousel(box, featured.map(B.buildPast), 'featured-track', 'featured projects'); } };
    }

    function render(m) {
        document.title = m.name + ' — ' + SITE;
        main.innerHTML = '';
        main.appendChild(buildIntro(m));

        var later = [];
        if (m.projects && m.projects.length) main.appendChild(buildProjects(m.projects));
        if (m.photos && m.photos.length) {
            var photos = buildPhotos(m.photos);
            main.appendChild(photos.section);
            later.push(photos.finish);
        }
        if (m.featured && m.featured.length) {
            var featured = buildFeatured(m.featured);
            main.appendChild(featured.section);
            later.push(featured.finish);
        }
        later.forEach(function (fn) { fn(); });
    }

    var name = new URLSearchParams(window.location.search).get('name');
    if (!B.slug(name)) {
        showNotFound();
        return;
    }
    B.getJSON('type=member&name=' + encodeURIComponent(B.slug(name)))
        .then(function (data) {
            if (data.member) render(data.member);
            else showNotFound();
        })
        .catch(function (err) {
            console.error('Could not load this profile:', err);
            main.querySelector('.profile-loading').textContent = 'We couldn’t load this profile right now. Please try again later.';
        });
})();
