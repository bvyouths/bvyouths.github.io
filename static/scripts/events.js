/* ==========================================================
   Events — loaded live from Google Sheets
   (via the Apps Script web app in code.gs)

   Upcoming events list:
     <div class="event-list" data-events data-max="3"></div>
     data-max = how many events to show (leave out to show all)
   Upcoming event posters (only events with a Poster link):
     <div class="poster-carousel" data-event-posters></div>
     Add data-placeholder to show every event, using a branded card when there's no poster:
     <div class="poster-carousel" data-event-posters data-placeholder></div>
   Past events (from the "Past events" tab):
     <section data-past-section hidden> … <div class="past-list" data-past-events></div> </section>
     The data-past-section stays hidden unless there are past events to show.
   ========================================================== */
(function () {
    var EVENTS_API_URL = 'https://script.google.com/macros/s/AKfycbyZ_Sp_VuXyBVqNtekwKcshiGuwXohG6PH-J7k9gnOFOteFzzNzm_lpIbJFLZr7Hyd3/exec';

    var lists = document.querySelectorAll('[data-events]');
    var carousels = document.querySelectorAll('[data-event-posters]');
    var pastLists = document.querySelectorAll('[data-past-events]');

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    // Apps Script occasionally returns a one-off error, so try once more before giving up
    function getJSON(url, retried) {
        return fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                return data.events || [];
            })
            .catch(function (err) {
                if (retried) throw err;
                return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return getJSON(url, true); });
            });
    }

    // Turns whatever is in the Link column into a proper URL
    function cleanLink(value) {
        var url = String(value || '').trim();
        if (!url) return '';
        if (/^(https?:|mailto:)/i.test(url)) return url;
        if (/^[^\s@\/]+@[^\s@\/]+\.[a-z]{2,}$/i.test(url)) return 'mailto:' + url;
        if (/\s/.test(url) || url.indexOf('.') === -1) return '';
        return 'https://' + url.replace(/^\/+/, '');
    }

    function openInNewTab(a, link) {
        a.href = link;
        if (!/^mailto:/i.test(link)) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
    }

    function showStatus(list, message, withLink) {
        list.innerHTML = '';
        var p = el('p', 'event-status', message + ' ');
        if (withLink) {
            var a = el('a', '', 'Follow @buonavistayn ↗');
            a.href = 'https://www.instagram.com/buonavistayn/';
            a.target = '_blank';
            a.rel = 'noopener';
            p.appendChild(a);
        }
        list.appendChild(p);
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
        var link = cleanLink(ev.link);
        var card = el(link ? 'a' : 'article', 'event-card');
        if (link) {
            openInNewTab(card, link);
            card.setAttribute('aria-label', ev.name + ' — sign up (opens link)');
        }

        card.appendChild(buildDate(ev));

        // Details: Time · Location · Price, name, description
        var details = el('div');
        var meta = metaLine(ev);
        if (meta) details.appendChild(el('p', 'event-type', meta));
        details.appendChild(el('h3', '', ev.name));
        if (ev.description) details.appendChild(el('p', 'event-desc', ev.description));
        card.appendChild(details);

        if (link) card.appendChild(el('span', 'event-cta', 'Sign up ↗'));
        return card;
    }

    // ---------- Upcoming event posters ----------
    function buildPoster(ev) {
        var link = cleanLink(ev.link);
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

        // Details shown on hover / focus / tap
        var info = el('div', 'poster-info');
        info.appendChild(buildDate(ev));
        var meta = metaLine(ev);
        if (meta) info.appendChild(el('p', 'event-type', meta));
        info.appendChild(el('h3', '', ev.name));
        if (ev.description) info.appendChild(el('p', 'event-desc', ev.description));
        if (link) {
            var cta = el('a', 'event-cta', 'Sign up ↗');
            openInNewTab(cta, link);
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

    function arrowButton(dir) {
        var btn = el('button', 'poster-arrow poster-arrow-' + dir, dir === 'prev' ? '‹' : '›');
        btn.type = 'button';
        btn.setAttribute('aria-label', dir === 'prev' ? 'Previous posters' : 'Next posters');
        return btn;
    }

    // Arrows only appear when there are more posters than fit on screen
    function setUpCarousel(carousel, events) {
        carousel.innerHTML = '';
        var track = el('div', 'poster-track');
        events.forEach(function (ev) { track.appendChild(buildPoster(ev)); });

        var prev = arrowButton('prev');
        var next = arrowButton('next');
        carousel.appendChild(prev);
        carousel.appendChild(track);
        carousel.appendChild(next);

        function step() {
            var first = track.firstElementChild;
            var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            return first ? first.offsetWidth + gap : track.clientWidth;
        }
        function update() {
            var overflow = track.scrollWidth - track.clientWidth > 2;
            carousel.classList.toggle('has-overflow', overflow);
            prev.disabled = track.scrollLeft <= 2;
            next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
        }
        prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
        next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
        track.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    }

    // ---------- Past events ----------
    function buildPast(ev) {
        var item = el('article', 'past-event');

        var media = el('div', 'past-media');
        if (ev.image) {
            var img = el('img');
            img.src = ev.image;
            img.alt = ev.name;
            img.loading = 'lazy';
            img.addEventListener('error', function () { media.classList.add('no-image'); img.remove(); });
            media.appendChild(img);
        } else {
            media.classList.add('no-image');
        }
        item.appendChild(media);

        var body = el('div', 'past-body');
        if (ev.type) body.appendChild(el('p', 'event-type', ev.type));
        body.appendChild(el('h3', '', ev.name));
        if (ev.dateText) body.appendChild(el('p', 'past-date', ev.dateText));
        if (ev.description) body.appendChild(el('p', 'event-desc', ev.description));
        item.appendChild(body);
        return item;
    }

    // ---------- Load ----------
    if (lists.length || carousels.length) {
        // Loading placeholders
        lists.forEach(function (list) {
            list.innerHTML = '';
            for (var i = 0; i < 2; i++) list.appendChild(el('div', 'skeleton'));
        });
        carousels.forEach(function (carousel) {
            if (carousel.hasAttribute('data-placeholder')) carousel.appendChild(el('div', 'skeleton'));
        });

        getJSON(EVENTS_API_URL)
            .then(function (all) {
                lists.forEach(function (list) {
                    var max = parseInt(list.getAttribute('data-max'), 10);
                    var events = max > 0 ? all.slice(0, max) : all;
                    if (!events.length) {
                        showStatus(list, 'No upcoming events just yet — new ones are on the way.', true);
                        return;
                    }
                    list.innerHTML = '';
                    events.forEach(function (ev) { list.appendChild(buildCard(ev)); });
                });

                var withPosters = all.filter(function (ev) { return ev.poster; });
                carousels.forEach(function (carousel) {
                    if (carousel.hasAttribute('data-placeholder')) {
                        if (all.length) setUpCarousel(carousel, all);
                        else showStatus(carousel, 'No upcoming events just yet — new ones are on the way.', true);
                    } else if (withPosters.length) {
                        setUpCarousel(carousel, withPosters);
                    } else {
                        carousel.hidden = true;
                    }
                });
            })
            .catch(function (err) {
                console.error('Could not load events:', err);
                lists.forEach(function (list) {
                    showStatus(list, 'We couldn’t load events right now. For the latest, check our Instagram.', true);
                });
                carousels.forEach(function (carousel) {
                    if (carousel.hasAttribute('data-placeholder')) {
                        showStatus(carousel, 'We couldn’t load events right now. For the latest, check our Instagram.', true);
                    } else {
                        carousel.hidden = true;
                    }
                });
            });
    }

    if (pastLists.length) {
        getJSON(EVENTS_API_URL + '?type=past')
            .then(function (events) {
                if (!events.length) return;
                pastLists.forEach(function (list) {
                    list.innerHTML = '';
                    events.forEach(function (ev) { list.appendChild(buildPast(ev)); });
                    var section = list.closest('[data-past-section]');
                    if (section) section.hidden = false;
                });
            })
            .catch(function (err) {
                console.error('Could not load past events:', err);
            });
    }
})();
