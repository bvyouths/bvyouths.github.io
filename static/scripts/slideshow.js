/* ==========================================================
   Home page slideshow (needs api.js first)

     <figure class="hero-photo" data-hero-slideshow>
         <div class="hero-frame"><img class="slide is-active" src="…fallback photo…"></div>
     </figure>

   Also downloads the first few Gallery photos in the background once the home page
   has loaded, so the Gallery page opens with them ready (BVYN.prefetchGallery).

   Shows the Gallery photos ticked "Homepage Header" in the sheet, newest first,
   changing every few seconds. The photo already in the page shows while they load,
   and stays if nothing is ticked or the sheet can't be reached.
   ========================================================== */
(function () {
    var B = window.BVYN;
    var el = B.el;
    var frame = document.querySelector('[data-hero-slideshow] .hero-frame');
    if (!frame) return;

    var INTERVAL = 5000;   // milliseconds each photo stays up
    var WIDTH = 1200;      // px asked for (the frame is about 500px wide, doubled for sharp screens)
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var slides = [];       // <img> elements that have finished loading, in order
    var timer = null;

    function show(img) {
        frame.querySelectorAll('.slide.is-active').forEach(function (s) { if (s !== img) s.classList.remove('is-active'); });
        img.classList.add('is-active');
    }

    function next() {
        if (document.hidden || slides.length < 2) return;
        var current = slides.indexOf(frame.querySelector('.slide.is-active'));
        show(slides[(current + 1) % slides.length]);
    }

    // Runs with the remembered photos first (if any), then again if the sheet has changed
    function start(photos) {
        var chosen = photos.filter(function (p) { return p.homepage; });
        if (!chosen.length) return; // keep whatever is showing

        clearInterval(timer);
        var old = Array.prototype.slice.call(frame.querySelectorAll('.slide'));
        slides = [];

        chosen.forEach(function (photo, i) {
            var img = el('img', 'slide');
            img.alt = photo.name || 'Buona Vista Youth Network event photo';
            img.decoding = 'async';
            img.addEventListener('load', function () {
                slides.push(img);
                slides.sort(function (a, b) { return a.dataset.order - b.dataset.order; });
                if (slides.length === 1 || (i === 0 && old.length)) {
                    // First new photo is ready: switch to it and drop the earlier set
                    show(img);
                    setTimeout(function () { old.forEach(function (o) { o.remove(); }); old = []; }, 1200);
                }
            });
            img.addEventListener('error', function () { img.remove(); });
            img.dataset.order = i;
            img.src = B.sized(photo.image, WIDTH);
            frame.appendChild(img);
        });

        if (!still) timer = setInterval(next, INTERVAL);
    }

    var prefetched = false;
    B.cachedJSON('type=gallery', function (data) {
        start(data.photos || []);
        if (!prefetched) { prefetched = true; B.prefetchGallery(data.photos || []); }
    }, function (err) {
        console.error('Could not load the slideshow photos:', err);
    });
})();
