/* ==========================================================
   Committee grid — loaded live from the "Committee" tab (needs api.js first)

     <div class="member-grid" data-committee></div>   (see partials/committee.html)

   Only members with Show ticked are sent by code.gs. Each card links to
   /member?name=<username>. No photo → a square with their initials.
   ========================================================== */
(function () {
    var B = window.BVYN;
    var el = B.el;

    function buildCard(member) {
        var card = el('a', 'member');
        card.href = '/member?name=' + encodeURIComponent(member.username);
        card.appendChild(B.avatar(member, 'member-photo'));
        card.appendChild(el('h3', '', member.name));
        if (member.position) card.appendChild(el('p', '', member.position));
        return card;
    }

    function setUp(grid) {
        for (var i = 0; i < 4; i++) grid.appendChild(el('div', 'member-skeleton'));
        B.getJSON('type=committee')
            .then(function (data) {
                var members = data.members || [];
                grid.innerHTML = '';
                if (!members.length) {
                    B.showStatus(grid, 'Committee members will be introduced here soon.');
                    return;
                }
                members.forEach(function (m) { grid.appendChild(buildCard(m)); });
            })
            .catch(function (err) {
                console.error('Could not load the committee:', err);
                B.showStatus(grid, 'We couldn’t load the committee right now. Please try again later.');
            });
    }

    B.ready(function () {
        document.querySelectorAll('[data-committee]').forEach(setUp);
    });
})();
