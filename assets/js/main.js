  // Light 3D + counters: starfield, card tilt, count-up stats. Fine pointer only, respects reduced motion.
  (function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fine = window.matchMedia('(pointer: fine)').matches;
    var cv = document.getElementById('stars');
    if (cv && !reduce) {
      var ctx = cv.getContext('2d');
      var stars = [], w = 0, h = 0;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      function size() {
        var r = cv.parentElement.getBoundingClientRect();
        w = r.width; h = r.height;
        cv.width = w * dpr; cv.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function init() {
        size();
        var n = w < 640 ? 40 : 80;
        stars = [];
        for (var i = 0; i < n; i++) {
          stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.4, s: Math.random() * 0.25 + 0.08, o: Math.random() * 0.5 + 0.25 });
        }
      }
      function tick() {
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          st.y += st.s;
          if (st.y > h + 2) { st.y = -2; st.x = Math.random() * w; }
          ctx.globalAlpha = st.o;
          ctx.fillStyle = '#cbb9ff';
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (!document.hidden) requestAnimationFrame(tick);
        else setTimeout(tick, 500);
      }
      init(); tick();
      window.addEventListener('resize', init);
    }
    if (fine && !reduce) {
      document.querySelectorAll('.card').forEach(function (card) {
        card.addEventListener('mousemove', function (e) {
          var r = card.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = 'perspective(900px) rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg) translateY(-4px)';
        });
        card.addEventListener('mouseleave', function () { card.style.transform = ''; });
      });
    }
    // Count-up stats
    // Portfolio / courses counts follow the cards on the page: adding a
    // card updates the number by itself, no hard-coded target to edit.
    var pc = document.querySelectorAll('#portfolio .card').length;
    var cc = document.querySelectorAll('.course-card').length;
    var sp = document.getElementById('stat-portfolio');
    var sc = document.getElementById('stat-courses');
    if (sp && pc > 0) sp.setAttribute('data-target', pc);
    if (sc && cc > 0) sc.setAttribute('data-target', cc);
    // Course accordions: tap a header to open it; only one open at a time.
    var accHeads = document.querySelectorAll('.course-card .acc-head');
    accHeads.forEach(function (head) {
      head.addEventListener('click', function () {
        var item = head.closest('.course-card');
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.course-card.open').forEach(function (o) {
          o.classList.remove('open');
          o.querySelector('.acc-head').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('open');
          head.setAttribute('aria-expanded', 'true');
        }
      });
    });
    function fmt(n) { return n.toLocaleString('fa-IR'); }
    document.querySelectorAll('.stat-num').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      if (reduce) { el.textContent = fmt(target); return; }
      var done = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting || done) return;
          done = true;
          var start = null;
          function step(ts) {
            if (!start) start = ts;
            var p = Math.min((ts - start) / 1200, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = fmt(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
          io.disconnect();
        });
      }, { threshold: 0.5 });
      io.observe(el);
    });
  })();
  
