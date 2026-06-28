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

  /* Project video tiles: lazy-load on first view, autoplay (muted) while
     in view, and click/keyboard to open fullscreen with sound + controls.
     Tiles only become interactive once their video has real data, so a
     missing file simply stays a styled placeholder. */
  function initVideos() {
    var tiles = document.querySelectorAll('[data-vtile]');
    if (!tiles.length) return;

    function ensureSrc(v) {
      if (!v.getAttribute('src') && v.dataset.src) v.setAttribute('src', v.dataset.src);
    }

    function makePlayable(tile, v) {
      if (tile.classList.contains('is-playable')) return;
      tile.classList.add('is-playable');
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
      var label = tile.querySelector('.project-media-label');
      tile.setAttribute('aria-label',
        'Play ' + (label ? label.textContent.trim() + ' ' : '') + 'demo video fullscreen');
    }

    function toggleFullscreen(v) {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
        return;
      }
      ensureSrc(v);
      v.muted = false;
      v.controls = true;
      var req = v.requestFullscreen || v.webkitRequestFullscreen || v.webkitEnterFullscreen;
      if (req) { try { req.call(v); } catch (e) {} }
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }

    Array.prototype.forEach.call(tiles, function (tile) {
      var v = tile.querySelector('[data-pvideo]');
      if (!v) return;

      v.addEventListener('loadeddata', function () { v.style.opacity = '1'; makePlayable(tile, v); });
      v.addEventListener('error', function () { v.style.opacity = '0'; });
      // iOS native player exit (webkitEnterFullscreen) doesn't fire fullscreenchange.
      v.addEventListener('webkitendfullscreen', function () { v.controls = false; v.muted = true; });

      tile.addEventListener('click', function () {
        if (!tile.classList.contains('is-playable')) return;
        toggleFullscreen(v);
      });
      tile.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && tile.classList.contains('is-playable')) {
          e.preventDefault();
          toggleFullscreen(v);
        }
      });
    });

    function resetTiles() {
      Array.prototype.forEach.call(tiles, function (tile) {
        var v = tile.querySelector('[data-pvideo]');
        if (v) { v.controls = false; v.muted = true; }
      });
    }
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) resetTiles();
    });
    document.addEventListener('webkitfullscreenchange', function () {
      if (!document.webkitFullscreenElement) resetTiles();
    });

    if ('IntersectionObserver' in window && !reduceMotion) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var v = en.target;
          if (en.isIntersecting) {
            ensureSrc(v);
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            try { v.pause(); } catch (e) {}
          }
        });
      }, { threshold: 0.55 });
      Array.prototype.forEach.call(tiles, function (tile) {
        var v = tile.querySelector('[data-pvideo]');
        if (v) io.observe(v);
      });
    } else {
      // No IntersectionObserver (or reduced motion): we never autoplay, but a
      // tile with real media must still become interactive. preload="none" +
      // ensureSrc alone never fires 'loadeddata', so bump preload and kick a
      // load so makePlayable runs (the 'error' handler keeps missing files as
      // placeholders, and the fade-in still waits on real frame data).
      Array.prototype.forEach.call(tiles, function (tile) {
        var v = tile.querySelector('[data-pvideo]');
        if (!v) return;
        v.preload = 'metadata';
        ensureSrc(v);
        v.load();
      });
    }
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
