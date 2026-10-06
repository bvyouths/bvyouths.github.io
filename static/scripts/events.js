/* ==========================================================
   Events — loaded live from Google Sheets (needs api.js first)

   Upcoming events list:
     <div class="event-list" data-events data-max="3"></div>
     data-max = how many events to show (leave out to show all)
   Upcoming event posters (only events with a Poster link):
     <div class="poster-carousel" data-event-posters></div>
     Add data-placeholder to show every event, using a branded card when there's no poster:
     <div class="poster-carousel" data-event-posters data-placeholder></div>
   Past events (from the "Past events" tab, newest first):
     <section data-past-section hidden> … <div class="past-list" data-past-events></div> </section>
     The data-past-section stays hidden unless there are past events to show.
     Each past event with a Project Ref gets that ref as its id, so /events#2026-hlw scrolls to it.

   Events whose Type is "Volunteering Opportunity" get a tag on their card.
   ========================================================== */
(function () {
    var B = window.BVYN;
    var el = B.el;

    var lists = document.querySelectorAll('[data-events]');
    var carousels = document.querySelectorAll('[data-event-posters]');
    var pastLists = document.querySelectorAll('[data-past-events]');

    var VOLUNTEERING = 'volunteering opportunity';
    function isVolunteering(ev) {
        return String(ev.type || '').trim().toLowerCase().replace(/\s+/g, ' ') === VOLUNTEERING;
    }
    function volunteeringTag(className) {
        return el('span', className, 'Volunteering Opportunity');
    }

    // "6.30pm to 9.30pm · Leng Kee CC · $5/pax"
    function metaLine(ev) {
        return [ev.time, ev.location, ev.price].filter(Boolean).join(' · ');
    }

    function buildDate(ev) {
        var date = el('div', 'date');
        if (ev.day) {
            date.appendChild(el('b', '', ev.day));
            var span = el('span', '', ev.month);
            span.appendChild(document.createElement('br'));
            span.appendChild(document.createTextNode(' ' + ev.year));
            date.appendChild(span);
        } else {
            date.appendChild(el('span', 'date-text', ev.dateText || 'Date TBC'));
        }
        return date;
    }

    // ---------- Upcoming events list ----------
    function buildCard(ev) {
        var link = B.cleanLink(ev.link);
        var card = el(link ? 'a' : 'article', 'event-card');
        if (link) {
            B.openInNewTab(card, link);
            card.setAttribute('aria-label', ev.name + ' — sign up (opens link)');
        }

        card.appendChild(buildDate(ev));

        // Details: Time · Location · Price, name (+ volunteering tag), description
        var details = el('div');
        var meta = metaLine(ev);
        if (meta) details.appendChild(el('p', 'event-type', meta));
        var title = el('h3', '', ev.name);
        if (isVolunteering(ev)) title.appendChild(volunteeringTag('event-tag'));
        details.appendChild(title);
        if (ev.description) details.appendChild(el('p', 'event-desc', ev.description));
        card.appendChild(details);

        if (link) card.appendChild(el('span', 'event-cta', 'Sign up ↗'));
        return card;
    }

    // ---------- Upcoming event posters ----------
    function buildPoster(ev) {
        var link = B.cleanLink(ev.link);
        var poster = el('article', 'poster');
        poster.tabIndex = 0;
        poster.setAttribute('aria-label', ev.name);

        // No poster (or it fails to load): branded card with the date and name
        function addCover() {
            poster.classList.add('placeholder');
            var cover = el('div', 'poster-cover');
            var logo = el('img', 'poster-logo');
            logo.src = '/static/images/logo.png';
            logo.alt = '';
            cover.appendChild(logo);
            cover.appendChild(buildDate(ev));
            cover.appendChild(el('h3', '', ev.name));
            poster.insertBefore(cover, poster.firstChild);
        }
        if (ev.poster) {
            var img = el('img');
            img.src = ev.poster;
            img.alt = 'Poster for ' + ev.name;
            img.loading = 'lazy';
            img.addEventListener('error', function () { img.remove(); addCover(); });
            poster.appendChild(img);
        } else {
            addCover();
        }

        // Corner tag, hidden once the details are showing
        if (isVolunteering(ev)) poster.appendChild(volunteeringTag('poster-tag'));

        // Details shown on hover / focus / tap
        var info = el('div', 'poster-info');
        info.appendChild(buildDate(ev));
        var meta = metaLine(ev);
        if (meta) info.appendChild(el('p', 'event-type', meta));
        info.appendChild(el('h3', '', ev.name));
        if (ev.description) info.appendChild(el('p', 'event-desc', ev.description));
        if (link) {
            var cta = el('a', 'event-cta', 'Sign up ↗');
            B.openInNewTab(cta, link);
            cta.setAttribute('aria-label', 'Sign up for ' + ev.name + ' (opens link)');
            info.appendChild(cta);
        }
        poster.appendChild(info);

        // Touch screens have no hover: first tap shows the details, tapping again hides them
        poster.addEventListener('click', function (e) {
            if (e.target.closest('a')) return;
            var open = !poster.classList.contains('is-open');
            poster.parentNode.querySelectorAll('.poster.is-open').forEach(function (p) { p.classList.remove('is-open'); });
            poster.classList.toggle('is-open', open);
        });
        return poster;
    }

    // ---------- Load upcoming events ----------
    var upcomingDone = Promise.resolve(); // past events wait for this before jumping to a #project-ref
    if (lists.length || carousels.length) {
        // Loading placeholders
        lists.forEach(function (list) {
            list.innerHTML = '';
            for (var i = 0; i < 2; i++) list.appendChild(el('div', 'skeleton'));
        });
        carousels.forEach(function (carousel) {
            if (carousel.hasAttribute('data-placeholder')) carousel.appendChild(el('div', 'skeleton'));
        });

        upcomingDone = B.getJSON('')
            .then(function (data) {
                var all = data.events || [];
                lists.forEach(function (list) {
                    var max = parseInt(list.getAttribute('data-max'), 10);
                    var events = max > 0 ? all.slice(0, max) : all;
                    if (!events.length) {
                        B.showStatus(list, 'No upcoming events just yet — new ones are on the way.', true);
                        return;
                    }
                    list.innerHTML = '';
                    events.forEach(function (ev) { list.appendChild(buildCard(ev)); });
                });

                var withPosters = all.filter(function (ev) { return ev.poster; });
                carousels.forEach(function (carousel) {
                    var events = carousel.hasAttribute('data-placeholder') ? all : withPosters;
                    if (events.length) {
                        B.carousel(carousel, events.map(buildPoster), 'poster-track', 'posters');
                    } else if (carousel.hasAttribute('data-placeholder')) {
                        B.showStatus(carousel, 'No upcoming events just yet — new ones are on the way.', true);
                    } else {
                        carousel.hidden = true;
                    }
                });
            })
            .catch(function (err) {
                console.error('Could not load events:', err);
                lists.forEach(function (list) {
                    B.showStatus(list, 'We couldn’t load events right now. For the latest, check our Instagram.', true);
                });
                carousels.forEach(function (carousel) {
                    if (carousel.hasAttribute('data-placeholder')) {
                        B.showStatus(carousel, 'We couldn’t load events right now. For the latest, check our Instagram.', true);
                    } else {
                        carousel.hidden = true;
                    }
                });
            });
    }

    // ---------- Load past events ----------
    if (pastLists.length) {
        B.getJSON('type=past')
            .then(function (data) {
                var events = data.events || [];
                if (!events.length) return;
                pastLists.forEach(function (list) {
                    list.innerHTML = '';
                    events.forEach(function (ev) { list.appendChild(B.buildPast(ev)); });
                    var section = list.closest('[data-past-section]');
                    if (section) section.hidden = false;
                });

                // Arrived from a profile's project link (/events#2026-hlw): scroll there once it exists
                // and the upcoming events above it have finished loading (so it doesn't move afterwards)
                var target = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
                if (target) {
                    Promise.all([upcomingDone, window.includesReady]).then(function () {
                        setTimeout(function () { target.scrollIntoView({ behavior: 'instant', block: 'start' }); }, 50);
                    });
                }
            })
            .catch(function (err) {
                console.error('Could not load past events:', err);
            });
    }
})();
