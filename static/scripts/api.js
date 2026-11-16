/* ==========================================================
   Shared helpers for pages that load data from the Google Sheet
   (via the Apps Script web app in code.gs).

   Load after script.js and before events.js / gallery.js /
   committee.js / slideshow.js:
     <script src="/static/scripts/api.js"></script>
   ========================================================== */
window.BVYN = (function () {
    var API_URL = 'https://script.google.com/macros/s/AKfycbyZ_Sp_VuXyBVqNtekwKcshiGuwXohG6PH-J7k9gnOFOteFzzNzm_lpIbJFLZr7Hyd3/exec';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    // query: '' for upcoming events, or e.g. 'type=gallery'.
    // Apps Script occasionally returns a one-off error, so try once more before giving up.
    function getJSON(query, retried) {
        return fetch(API_URL + (query ? '?' + query : ''))
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                return data;
            })
            .catch(function (err) {
                if (retried) throw err;
                return new Promise(function (r) { setTimeout(r, 800); }).then(function () { return getJSON(query, true); });
            });
    }

    // Like getJSON, but remembers the last answer in this browser so repeat visits show
    // something straight away. onData runs with the remembered data (if any), then again
    // with fresh data only if it changed. onError runs only when there is nothing to show.
    function cachedJSON(query, onData, onError) {
        var key = 'bvyn:' + query;
        var remembered = null;
        try { remembered = window.localStorage.getItem(key); } catch (e) { /* storage blocked */ }
        if (remembered) {
            try { onData(JSON.parse(remembered)); } catch (e) { remembered = null; }
        }
        return getJSON(query)
            .then(function (data) {
                var copy = {};
                Object.keys(data).forEach(function (k) { if (k !== 'updated') copy[k] = data[k]; });
                var fresh = JSON.stringify(copy);
                if (fresh === remembered) return;
                try { window.localStorage.setItem(key, fresh); } catch (e) { /* storage blocked or full */ }
                onData(copy);
            })
            .catch(function (err) {
                if (!remembered && onError) onError(err);
                else if (!remembered) throw err;
            });
    }

    // Google Drive image links come as ...thumbnail?id=…&sz=w1600. Asking for a size closer
    // to what's shown makes pages load much faster. Other links are returned unchanged.
    function sized(url, width) {
        return String(url || '').replace(/([?&]sz=w)\d+/, '$1' + width);
    }

    // Turns whatever is in a Link column into a proper URL
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

    // "Jane Tan" → "JT"
    function initials(name) {
        return String(name || '').trim().split(/\s+/).slice(0, 2)
            .map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    }

    // Phones and tablets: no hover, so details are shown on tap instead
    function canHover() {
        return window.matchMedia('(hover: hover)').matches;
    }

    // Square photo, or a branded square with the person's initials
    function avatar(person, className) {
        var box = el('div', className);
        function useInitials() {
            box.innerHTML = '';
            box.classList.add('avatar-initials');
            box.appendChild(el('span', '', initials(person.name)));
        }
        if (person.image) {
            var img = el('img');
            img.src = sized(person.image, 600);
            img.alt = person.name;
            img.loading = 'lazy';
            img.addEventListener('error', useInitials);
            box.appendChild(img);
        } else {
            useInitials();
        }
        return box;
    }

    // One past event: image on one side, details on the other (sides alternate in CSS)
    function buildPast(ev) {
        var item = el('article', 'past-event');
        if (ev.projectRef) item.id = ev.projectRef; // so /events#2026-hlw scrolls here

        var media = el('div', 'past-media');
        if (ev.image) {
            var img = el('img');
            img.src = sized(ev.image, 1200);
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

    function arrowButton(dir, label) {
        var btn = el('button', 'carousel-arrow carousel-arrow-' + dir, dir === 'prev' ? '‹' : '›');
        btn.type = 'button';
        btn.setAttribute('aria-label', (dir === 'prev' ? 'Previous ' : 'Next ') + label);
        return btn;
    }

    // Side-scrolling row with ‹ › arrows. The arrows only appear when the items don't all fit.
    // trackClass sets the layout in CSS (e.g. poster-track, photo-track, featured-track).
    function carousel(container, nodes, trackClass, label) {
        container.innerHTML = '';
        container.classList.add('carousel');
        var track = el('div', 'carousel-track ' + trackClass);
        nodes.forEach(function (node) { track.appendChild(node); });

        var prev = arrowButton('prev', label || 'items');
        var next = arrowButton('next', label || 'items');
        container.appendChild(prev);
        container.appendChild(track);
        container.appendChild(next);

        // Distance to the start of the next (or previous) item, so items of different widths work too
        function step(dir) {
            var start = track.getBoundingClientRect().left;
            var items = Array.prototype.slice.call(track.children);
            var offsets = items.map(function (item) { return item.getBoundingClientRect().left - start; });
            var target = dir > 0
                ? offsets.filter(function (x) { return x > 5; })[0]
                : offsets.filter(function (x) { return x < -5; }).pop();
            return target === undefined ? dir * track.clientWidth : target;
        }
        function update() {
            var overflow = track.scrollWidth - track.clientWidth > 2;
            container.classList.toggle('has-overflow', overflow);
            prev.disabled = track.scrollLeft <= 2;
            next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
        }
        prev.addEventListener('click', function () { track.scrollBy({ left: step(-1), behavior: 'smooth' }); });
        next.addEventListener('click', function () { track.scrollBy({ left: step(1), behavior: 'smooth' }); });
        track.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        // Images that size themselves change the row's width once loaded
        track.querySelectorAll('img').forEach(function (img) { img.addEventListener('load', update); });
        update();
        return track;
    }

    // Small grey message in place of content, with an optional Instagram link
    function showStatus(box, message, withLink) {
        box.innerHTML = '';
        var p = el('p', 'event-status', message + ' ');
        if (withLink) {
            var a = el('a', '', 'Follow @buonavistayn ↗');
            a.href = 'https://www.instagram.com/buonavistayn/';
            a.target = '_blank';
            a.rel = 'noopener';
            p.appendChild(a);
        }
        box.appendChild(p);
    }

    // Waits for partials (header, footer, gallery, committee…) loaded by script.js
    function ready(fn) {
        (window.includesReady || Promise.resolve()).then(fn);
    }

    return {
        el: el,
        getJSON: getJSON,
        cachedJSON: cachedJSON,
        sized: sized,
        cleanLink: cleanLink,
        openInNewTab: openInNewTab,
        initials: initials,
        canHover: canHover,
        avatar: avatar,
        buildPast: buildPast,
        carousel: carousel,
        showStatus: showStatus,
        ready: ready
    };
})();
