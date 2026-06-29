/* ============================================================
   Marcus Sullivan — Portfolio behaviors
   Vanilla JS, no dependencies. Reproduces the prototype's
   interactions: smooth-scroll nav, scroll-spy, sticky-header
   tint, mobile menu, lazy media (profile + project videos with
   autoplay-in-view and click-to-fullscreen).
   ============================================================ */
(function () {
  'use strict';

  var HEADER_OFFSET = 84;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Declared up here on purpose: this script is `defer`, so document.readyState
  // is already "interactive" and ready() runs the init callback synchronously.
  // If these were declared lower in the file, their `= null` initializers would
  // execute AFTER initMobileMenu() and wipe out the element references.
  var menuEl = null;
  var burgerEl = null;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    initRevealSafetyNet();
    initNav();
    initScrollSpy();
    initMobileMenu();
    initVideos();
    initProfile();
  });

  /* If the animation timeline gets throttled (background tab / synthetic
     capture), CSS keyframes may not tick — force the final state shortly
     after the entrance window so nothing is ever stuck hidden. */
  function initRevealSafetyNet() {
    if (reduceMotion) return;
    setTimeout(function () {
      var els = document.querySelectorAll('[data-reveal]');
      for (var i = 0; i < els.length; i++) els[i].classList.add('is-revealed');
    }, 1300);
  }

  /* Smooth-scroll for in-page anchors, accounting for the sticky header. */
  function initNav() {
    var links = document.querySelectorAll('[data-nav]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) {
        var id = this.getAttribute('href');
        if (!id || id.charAt(0) !== '#') return;
        var target = id === '#top' ? document.body : document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        var top = id === '#top'
          ? 0
          : target.getBoundingClientRect().top + window.scrollY - (HEADER_OFFSET - 8);
        window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
        closeMenu();
      });
    }
  }

  /* Highlight the nav link for the section currently in view, and tint
     the header background once the page is scrolled. */
  function initScrollSpy() {
    var header = document.getElementById('site-header');
    var ids = ['work', 'about', 'stack', 'contact'];
    var linksByHref = {};
    var navLinks = document.querySelectorAll('#desktop-nav [data-nav], #mobile-menu [data-nav]');
    for (var i = 0; i < navLinks.length; i++) {
      var h = navLinks[i].getAttribute('href');
      (linksByHref[h] = linksByHref[h] || []).push(navLinks[i]);
    }

    function onScroll() {
      var y = window.scrollY + HEADER_OFFSET + 60;
      var current = null;
      for (var j = 0; j < ids.length; j++) {
        var s = document.getElementById(ids[j]);
        if (s && s.offsetTop <= y) current = '#' + ids[j];
      }
      for (var href in linksByHref) {
        if (!linksByHref.hasOwnProperty(href)) continue;
        var active = href === current;
        var arr = linksByHref[href];
        for (var k = 0; k < arr.length; k++) arr[k].classList.toggle('is-active', active);
      }
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initMobileMenu() {
    burgerEl = document.getElementById('burger');
    menuEl = document.getElementById('mobile-menu');
    if (!burgerEl || !menuEl) return;
    burgerEl.addEventListener('click', function () {
      if (menuEl.classList.contains('is-open')) closeMenu();
      else openMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  function openMenu() {
    if (!menuEl) return;
    menuEl.classList.add('is-open');
    if (burgerEl) {
      burgerEl.setAttribute('aria-expanded', 'true');
      burgerEl.setAttribute('aria-label', 'Close menu');
    }
  }

  function closeMenu() {
    if (!menuEl) return;
    menuEl.classList.remove('is-open');
    if (burgerEl) {
      burgerEl.setAttribute('aria-expanded', 'false');
      burgerEl.setAttribute('aria-label', 'Open menu');
    }
  }

  /* Project video tiles. Behavior:
     - Each tile shows a screen-grab poster; metadata is loaded for every tile
       up front so any tile can be opened in the larger "Expand" player.
     - Exactly one video autoplays (muted) at a time: the tile whose center is
       nearest the viewport center, and only while it's actually near center.
     - When a video stops playing, its poster returns.
     - Clicking a tile (or Enter/Space) expands the video: on phones it opens
       native fullscreen (a small modal isn't worth it); on larger screens it
       opens a modal ~3x the tile size. Either way it plays with sound.
     A missing file errors out and simply stays a styled placeholder. */
  function initVideos() {
    var tiles = Array.prototype.slice.call(document.querySelectorAll('[data-vtile]'));
    if (!tiles.length) return;

    // A tile autoplays when its center is within this fraction of the viewport
    // height from the viewport's center (i.e. the middle ~70% band).
    var ACTIVE_BAND = 0.35;
    var EXPAND_SCALE = 3;   // expanded modal target size vs. the tile

    function ensureSrc(v) {
      if (!v.getAttribute('src') && v.dataset.src) v.setAttribute('src', v.dataset.src);
    }
    function projectName(tile) {
      var art = tile.closest('.project');
      var h = art && art.querySelector('.project-name');
      return h ? h.textContent.trim() : 'project';
    }

    function makePlayable(tile, v) {
      if (tile.classList.contains('is-playable')) return;
      tile.classList.add('is-playable');
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
      tile.setAttribute('aria-label', 'Expand ' + projectName(tile) + ' demo video');
    }

    // Centralized playback so there is always at most one active video,
    // whether triggered by scrolling or by a fullscreen click.
    var current = null;
    function playOnly(v) {
      if (current && current !== v) { try { current.pause(); } catch (e) {} }
      current = v;
      ensureSrc(v);
      try { v.preload = 'auto'; } catch (e) {}
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    function pauseCurrent() {
      if (current) { try { current.pause(); } catch (e) {} current = null; }
    }

    // ---- expand modal (larger in-page player; no native fullscreen) ----
    var modal = document.getElementById('player-modal');
    var modalDialog = modal && modal.querySelector('.modal__dialog');
    var modalVideo = modal && modal.querySelector('.modal__video');
    var modalOpener = null;
    var lastFocused = null;

    function sizeModal(tile) {
      if (!modalDialog) return;
      var tileW = tile.getBoundingClientRect().width;
      var w = Math.min(tileW * EXPAND_SCALE, window.innerWidth * 0.92);
      var h = w * 9 / 16;
      var maxH = window.innerHeight * 0.86;
      if (h > maxH) { h = maxH; w = h * 16 / 9; }
      modalDialog.style.width = Math.round(w) + 'px';
      modalDialog.style.height = Math.round(h) + 'px';
    }

    function openModal(tile, v) {
      if (!modal || !modalVideo) return;
      modalOpener = tile;
      lastFocused = document.activeElement;
      pauseCurrent();                                   // stop background autoplay
      var poster = tile.querySelector('.project-poster');
      if (poster) modalVideo.poster = poster.getAttribute('src') || '';
      if (modalDialog) modalDialog.setAttribute('aria-label', projectName(tile) + ' — demo video');
      modalVideo.src = v.getAttribute('src') || v.dataset.src || '';
      sizeModal(tile);
      modal.hidden = false;
      document.body.classList.add('modal-open');
      modalVideo.muted = false;
      try { modalVideo.currentTime = 0; } catch (e) {}
      var p = modalVideo.play();
      if (p && p.catch) p.catch(function () {});
      var closeBtn = modal.querySelector('.modal__close');
      if (closeBtn) { try { closeBtn.focus({ preventScroll: true }); } catch (e) { closeBtn.focus(); } }
    }

    function closeModal() {
      if (!modal || modal.hidden) return;
      try { modalVideo.pause(); } catch (e) {}
      modalVideo.removeAttribute('src');
      try { modalVideo.load(); } catch (e) {}            // stop buffering
      modal.hidden = true;
      document.body.classList.remove('modal-open');
      modalOpener = null;
      if (lastFocused && lastFocused.focus) {
        try { lastFocused.focus({ preventScroll: true }); } catch (e) { try { lastFocused.focus(); } catch (e2) {} }
      }
      if (!reduceMotion) updateActive();                 // resume background autoplay
    }

    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-modal-close')) closeModal();
      });
      modal.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeModal(); return; }
        if (e.key !== 'Tab') return;
        var f = modal.querySelectorAll('button, video, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      });
    }

    // ---- expand router: native fullscreen on phones, modal on larger screens ----
    // Phone = either viewport dimension is small (catches portrait & landscape).
    function isPhone() {
      return window.matchMedia('(max-width: 540px), (max-height: 540px)').matches;
    }
    function expandNative(v) {
      // Runs synchronously in the click/keydown handler so the user activation
      // needed by requestFullscreen / webkitEnterFullscreen is preserved.
      if (current && current !== v) { try { current.pause(); } catch (e) {} }
      current = v;
      ensureSrc(v);
      v.muted = false;
      v.controls = true;
      var req = v.requestFullscreen || v.webkitRequestFullscreen || v.webkitEnterFullscreen;
      if (req) { try { var fp = req.call(v); if (fp && fp.catch) fp.catch(function () {}); } catch (e) {} }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    // After leaving native fullscreen, restore tile state and re-sync autoplay.
    function syncAfterNativeExit() {
      if (modal && !modal.hidden) return;   // a modal video's own fullscreen — leave the grid alone
      tiles.forEach(function (tile) {
        var vv = tile.querySelector('[data-pvideo]');
        if (vv) { vv.controls = false; vv.muted = true; }
      });
      current = null;                       // clear stale ref so updateActive can re-pick
      if (!reduceMotion) updateActive();
    }
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) syncAfterNativeExit();
    });
    document.addEventListener('webkitfullscreenchange', function () {
      if (!document.webkitFullscreenElement) syncAfterNativeExit();
    });
    function expand(tile, v) {
      if (isPhone()) expandNative(v);
      else openModal(tile, v);
    }

    tiles.forEach(function (tile) {
      var v = tile.querySelector('[data-pvideo]');
      if (!v) return;

      // Interactive once metadata resolves (a missing file errors instead and
      // stays a non-interactive placeholder).
      v.addEventListener('loadedmetadata', function () { makePlayable(tile, v); });
      v.addEventListener('loadeddata', function () { makePlayable(tile, v); });
      // Hide the poster only while actually playing; show it the moment playback
      // stops. Driven by the element's own events so it always tracks real state
      // (scroll-away pause, fullscreen exit, etc.).
      v.addEventListener('playing', function () { tile.classList.add('is-playing'); });
      v.addEventListener('pause', function () { tile.classList.remove('is-playing'); });
      // iOS native player exit fires this on the <video>, not fullscreenchange.
      v.addEventListener('webkitendfullscreen', syncAfterNativeExit);

      tile.addEventListener('click', function () {
        if (tile.classList.contains('is-playable')) expand(tile, v);
      });
      tile.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && tile.classList.contains('is-playable')) {
          e.preventDefault();
          expand(tile, v);
        }
      });

      // Load metadata so every tile is openable regardless of which one is
      // autoplaying. Metadata is small; the active video upgrades to a full
      // load via playOnly().
      try { v.preload = 'metadata'; } catch (e) {}
      ensureSrc(v);
      try { v.load(); } catch (e) {}
    });

    // Play the tile nearest the viewport center (if it's actually near center);
    // pause everything else. Suspended while the expand modal is open.
    function updateActive() {
      if (modal && !modal.hidden) return;
      var centerY = window.innerHeight / 2;
      var best = null, bestDist = Infinity;
      tiles.forEach(function (tile) {
        var v = tile.querySelector('[data-pvideo]');
        if (!v) return;
        var rect = tile.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return; // off-screen
        var dist = Math.abs((rect.top + rect.height / 2) - centerY);
        if (dist < bestDist) { bestDist = dist; best = v; }
      });
      if (best && bestDist <= window.innerHeight * ACTIVE_BAND) {
        if (best !== current) playOnly(best);
      } else {
        pauseCurrent();
      }
    }

    // Throttle scroll work to one update per frame; fall back to a direct call
    // where requestAnimationFrame is unavailable.
    var scheduled = false;
    function onScroll() {
      if (scheduled) return;
      scheduled = true;
      var run = function () { scheduled = false; updateActive(); };
      if (window.requestAnimationFrame) requestAnimationFrame(run); else run();
    }
    if (!reduceMotion) {
      window.addEventListener('scroll', onScroll, { passive: true });
      updateActive();
    }
    window.addEventListener('resize', function () {
      if (modal && !modal.hidden && modalOpener) sizeModal(modalOpener);
      else if (!reduceMotion) onScroll();
    }, { passive: true });
  }

  /* Lazy-load the hero profile photo; fade in on load, stay hidden on error. */
  function initProfile() {
    var img = document.querySelector('[data-profile]');
    if (!img) return;
    img.addEventListener('load', function () { img.style.opacity = '1'; });
    img.addEventListener('error', function () { img.style.opacity = '0'; });
    function set() { if (!img.getAttribute('src') && img.dataset.src) img.setAttribute('src', img.dataset.src); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { set(); io.unobserve(en.target); }
        });
      }, { rootMargin: '200px' });
      io.observe(img);
    } else {
      set();
    }
  }
})();
