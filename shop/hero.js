/* 3D hero ("M") + course-card tilt for the shop.
   Decorative only: everything is guarded so it can never break
   the shop (courses, orders, login, admin, player all live in app.js).
   No Telegram WebApp usage here; works fine outside Telegram. */
(function () {
  'use strict';

  try {
    var doc = document;
    var reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
      reduced = false;
    }

    /* ---------- hero parallax (mouse/pen only; touch keeps the CSS idle motion) ---------- */
    var hero = doc.getElementById('hero3d');
    if (hero && !reduced) {
      var targetRX = 0, targetRY = 0, curRX = 0, curRY = 0;
      var rafId = 0, hovering = false;
      var MAX_DEG = 11;

      function applyParallax() {
        curRX += (targetRX - curRX) * 0.08;
        curRY += (targetRY - curRY) * 0.08;
        if (Math.abs(targetRX - curRX) < 0.01) curRX = targetRX;
        if (Math.abs(targetRY - curRY) < 0.01) curRY = targetRY;
        hero.style.setProperty('--rx', curRX.toFixed(2) + 'deg');
        hero.style.setProperty('--ry', curRY.toFixed(2) + 'deg');
        if (hovering || curRX !== targetRX || curRY !== targetRY) {
          rafId = requestAnimationFrame(applyParallax);
        } else {
          rafId = 0;
        }
      }
      function kick() {
        if (!rafId) rafId = requestAnimationFrame(applyParallax);
      }

      hero.addEventListener('pointermove', function (ev) {
        if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
        var r = hero.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (ev.clientX - r.left) / r.width - 0.5;
        var py = (ev.clientY - r.top) / r.height - 0.5;
        targetRY = Math.max(-MAX_DEG, Math.min(MAX_DEG, px * 2 * MAX_DEG));
        targetRX = Math.max(-MAX_DEG, Math.min(MAX_DEG, -py * 2 * MAX_DEG));
        hovering = true;
        kick();
      });
      hero.addEventListener('pointerleave', function () {
        targetRX = 0;
        targetRY = 0;
        hovering = false;
        kick();
      });

      /* Pause the CSS idle animations while the page is hidden. */
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) hero.classList.add('paused');
        else hero.classList.remove('paused');
      });
    }

    /* ---------- course-card tilt (delegated on #list, survives re-renders) ---------- */
    var list = doc.getElementById('list');
    if (list && !reduced) {
      var activeCard = null;
      var touchStart = null; // {x, y, card}

      function setTilt(card, rx, ry) {
        card.style.transform =
          'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      }
      function clearTilt(card) {
        if (!card) return;
        card.style.transform = '';
        card.classList.remove('tilt-active');
      }
      function tiltFromPoint(card, clientX, clientY, maxDeg) {
        var r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (clientX - (r.left + r.width / 2)) / (r.width / 2);
        var py = (clientY - (r.top + r.height / 2)) / (r.height / 2);
        px = Math.max(-1, Math.min(1, px));
        py = Math.max(-1, Math.min(1, py));
        setTilt(card, -py * maxDeg, px * maxDeg);
      }

      /* Mouse / pen: tilt on hover, spring back on leave. */
      list.addEventListener('pointermove', function (ev) {
        if (ev.pointerType === 'touch') return;
        var card = ev.target && ev.target.closest
          ? ev.target.closest('.card') : null;
        if (!card || !list.contains(card)) {
          if (activeCard) { clearTilt(activeCard); activeCard = null; }
          return;
        }
        if (activeCard && activeCard !== card) clearTilt(activeCard);
        activeCard = card;
        card.classList.add('tilt-active');
        tiltFromPoint(card, ev.clientX, ev.clientY, 6);
      });
      list.addEventListener('pointerleave', function () {
        if (activeCard) { clearTilt(activeCard); activeCard = null; }
      });

      /* Touch: gentle tilt while the finger is down; any drag/scroll kills it.
         Never preventDefault — taps and clicks always go through. */
      list.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType !== 'touch') return;
        var card = ev.target && ev.target.closest
          ? ev.target.closest('.card') : null;
        if (!card || !list.contains(card)) return;
        touchStart = { x: ev.clientX, y: ev.clientY, card: card };
        card.classList.add('tilt-active');
        tiltFromPoint(card, ev.clientX, ev.clientY, 4);
      });
      list.addEventListener('pointermove', function (ev) {
        if (ev.pointerType !== 'touch' || !touchStart) return;
        var dx = ev.clientX - touchStart.x;
        var dy = ev.clientY - touchStart.y;
        if (Math.abs(dy) > 10 || Math.abs(dx) > 10) {
          clearTilt(touchStart.card);
          touchStart = null;
        }
      });
      function endTouch() {
        if (touchStart) { clearTilt(touchStart.card); touchStart = null; }
      }
      list.addEventListener('pointerup', endTouch);
      list.addEventListener('pointercancel', endTouch);

      /* Any scroll kills tilt immediately — never fight the scroll. */
      window.addEventListener('scroll', function () {
        if (activeCard) { clearTilt(activeCard); activeCard = null; }
        endTouch();
      }, { passive: true });
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) {
          if (activeCard) { clearTilt(activeCard); activeCard = null; }
          endTouch();
        }
      });
    }
  } catch (err) {
    if (window.console && console.warn) console.warn('[hero] disabled:', err);
  }
})();
