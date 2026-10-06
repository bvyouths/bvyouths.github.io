/* ==========================================================
   Gallery — loaded live from the "Gallery" tab (needs api.js first)

     <div class="gallery" data-gallery></div>   (see partials/gallery.html)

   Newest photos first (bottom row of the sheet first), in a masonry layout
   that keeps each photo's own shape: 3 columns on laptop, 2 on tablet, 1 on phone.
   Laptop: hover shows the event name, description and label; click enlarges.
   Phone/tablet: tap shows the details.
   ========================================================== */
(function () {
    var B = window.BVYN;
    var el = B.el;

    function columnCount() {
        if (window.innerWidth > 960) return 3;
        if (window.innerWidth > 700) return 2;
        return 1;
    }

    // ---------- Enlarged view (laptop) ----------
    var lightbox, lightboxImg, lightboxCaption, lastFocus;
    function openLightbox(photo) {
        if (!lightbox) {
            lightbox = el('div', 'lightbox');
            lightbox.setAttribute('role', 'dialog');
            lightbox.setAttribute('aria-modal', 'true');
            lightbox.setAttribute('aria-label', 'Enlarged photo');
            var close = el('button', 'lightbox-close', '✕');
            close.type = 'button';
            close.setAttribute('aria-label', 'Close');
            lightboxImg = el('img');
            lightboxCaption = el('p', 'lightbox-caption');
            lightbox.appendChild(close);
            lightbox.appendChild(lightboxImg);
            lightbox.appendChild(lightboxCaption);
            lightbox.addEventListener('click', function (e) { if (e.target !== lightboxImg) closeLightbox(); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLightbox(); });
            document.body.appendChild(lightbox);
        }
        lastFocus = document.activeElement;
        lightboxImg.src = photo.image;
        lightboxImg.alt = photo.name || 'Gallery photo';
        lightboxCaption.textContent = [photo.name, photo.label].filter(Boolean).join(' · ');
        lightboxCaption.hidden = !lightboxCaption.textContent;
        lightbox.classList.add('is-open');
        document.documentElement.classList.add('no-scroll');
        lightbox.querySelector('.lightbox-close').focus();
    }
    function closeLightbox() {
        if (!lightbox || !lightbox.classList.contains('is-open')) return;
        lightbox.classList.remove('is-open');
        document.documentElement.classList.remove('no-scroll');
        if (lastFocus) lastFocus.focus();
    }

    // ---------- One photo ----------
    function buildItem(photo) {
        var item = el('figure', 'gallery-item');
        item.tabIndex = 0;

        var img = el('img');
        img.src = photo.image;
        img.alt = photo.name || 'Gallery photo';
        img.loading = 'lazy';
        img.addEventListener('error', function () { item.remove(); });
        item.appendChild(img);

        // Any of name / description / label can be blank
        if (photo.name || photo.description || photo.label) {
            var info = el('figcaption', 'gallery-info');
            if (photo.label) info.appendChild(el('p', 'event-type', photo.label));
            if (photo.name) info.appendChild(el('h3', '', photo.name));
            if (photo.description) info.appendChild(el('p', 'event-desc', photo.description));
            item.appendChild(info);
        }

        function activate() {
            if (B.canHover()) {
                openLightbox(photo);
            } else {
                var open = !item.classList.contains('is-open');
                document.querySelectorAll('.gallery-item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
                item.classList.toggle('is-open', open);
            }
        }
        item.addEventListener('click', activate);
        item.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
        });
        return item;
    }

    // Deals photos into columns left to right, so the newest are along the top
    function layout(box, items) {
        var count = columnCount();
        if (box.dataset.columns === String(count)) return;
        box.dataset.columns = count;
        box.innerHTML = '';
        var columns = [];
        for (var c = 0; c < count; c++) columns.push(box.appendChild(el('div', 'gallery-column')));
        items.forEach(function (item, i) { columns[i % count].appendChild(item); });
    }

    function setUp(box) {
        box.appendChild(el('div', 'skeleton'));
        B.getJSON('type=gallery')
            .then(function (data) {
                var photos = data.photos || [];
                if (!photos.length) {
                    B.showStatus(box, 'Photos are on the way — follow us for the latest.', true);
                    return;
                }
                var items = photos.map(buildItem);
                layout(box, items);
                window.addEventListener('resize', function () { layout(box, items); });
            })
            .catch(function (err) {
                console.error('Could not load the gallery:', err);
                B.showStatus(box, 'We couldn’t load photos right now. For the latest, check our Instagram.', true);
            });
    }

    B.ready(function () {
        document.querySelectorAll('[data-gallery]').forEach(setUp);
    });
})();
