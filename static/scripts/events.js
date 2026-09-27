/* ==========================================================
   Upcoming events — loaded live from Google Sheets
   (via the Apps Script web app in code.gs)

   Usage: <div class="event-list" data-events data-max="3"></div>
   data-max = how many events to show (leave out to show all)
   ========================================================== */
(function () {
    var EVENTS_API_URL = 'https://script.google.com/macros/s/AKfycbzTZgfYLZR5Q3GDXlDA4x4c0uiSsvm_4zES7nu0puxyXODW-CItLcexHqHlpM-y3gIU/exec';

    var lists = document.querySelectorAll('[data-events]');
    if (!lists.length) return;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
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

    function buildCard(ev, featured) {
        var link = cleanLink(ev.link);
        var card = el(link ? 'a' : 'article', 'event-card' + (featured ? ' featured' : ''));
        if (link) {
            card.href = link;
            if (!/^mailto:/i.test(link)) {
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
            }
            card.setAttribute('aria-label', ev.name + ' — sign up (opens link)');
        }

        // Date
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
        card.appendChild(date);

        // Details: Type · Location, name, description
        var details = el('div');
        var meta = [ev.type, ev.location].filter(Boolean).join(' · ');
        if (meta) details.appendChild(el('p', 'event-type', meta));
        details.appendChild(el('h3', '', ev.name));
        if (ev.description) details.appendChild(el('p', 'event-desc', ev.description));
        card.appendChild(details);

        if (link) card.appendChild(el('span', 'event-cta', 'Sign up ↗'));
        return card;
    }

    // Loading placeholders
    lists.forEach(function (list) {
        list.innerHTML = '';
        for (var i = 0; i < 2; i++) list.appendChild(el('div', 'skeleton'));
    });

    fetch(EVENTS_API_URL)
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) {
            if (data.error) throw new Error(data.error);
            var all = data.events || [];
            lists.forEach(function (list) {
                var max = parseInt(list.getAttribute('data-max'), 10);
                var events = max > 0 ? all.slice(0, max) : all;
                if (!events.length) {
                    showStatus(list, 'No upcoming events just yet — new ones are on the way.', true);
                    return;
                }
                list.innerHTML = '';
                events.forEach(function (ev, i) { list.appendChild(buildCard(ev, i === 0)); });
            });
        })
        .catch(function (err) {
            console.error('Could not load events:', err);
            lists.forEach(function (list) {
                showStatus(list, 'We couldn’t load events right now. For the latest, check our Instagram.', true);
            });
        });
})();
