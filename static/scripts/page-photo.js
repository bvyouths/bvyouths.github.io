/* ==========================================================
   Page photos chosen in the sheet (needs api.js first)

     <figure class="photo-banner" data-page-photo="/about">
         <img src="…built-in photo…">
     </figure>

   Uses the newest Gallery photo whose Page Photo column includes this page
   (e.g. "/about"). The built-in photo stays if none is chosen, or if the
   chosen one can't be loaded. Photos are cropped to the banner's shape.
   ========================================================== */
(function () {
    var B = window.BVYN;
    var banners = document.querySelectorAll('[data-page-photo]');
    if (!banners.length) return;

    var WIDTH = 1600; // px asked for: the banner spans the page

    function apply(photos) {
        banners.forEach(function (banner) {
            var page = banner.getAttribute('data-page-photo').toLowerCase();
            var img = banner.querySelector('img');
            // The list is newest first, so the first match is the newest
            var chosen = photos.filter(function (p) { return (p.pages || []).indexOf(page) !== -1; })[0];
            if (!img || !chosen) return;
            var src = B.sized(chosen.image, WIDTH);
            if (img.dataset.chosen === src) return;

            // Load it first; only swap if it actually loads, so the built-in photo stays otherwise
            var probe = new Image();
            probe.onload = function () {
                img.src = src;
                img.dataset.chosen = src;
                if (chosen.name) img.alt = chosen.name;
            };
            probe.src = src;
        });
    }

    B.cachedJSON('type=gallery', function (data) { apply(data.photos || []); }, function (err) {
        console.error('Could not load the page photo:', err);
    });
})();
