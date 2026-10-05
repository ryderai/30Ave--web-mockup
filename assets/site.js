/* 30Avenue concept — nav, reveals, events, interactive map, trip-planner preview.
   Every block is guarded: a page without a given element skips that block. */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var AVE = window.AVE || { biz: [], events: [], cats: {} };
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function bySlug(s) { for (var i = 0; i < AVE.biz.length; i++) if (AVE.biz[i].slug === s) return AVE.biz[i]; return null; }
  function bldgOf(b) { return b.unit ? b.unit.charAt(0) : ""; }

  /* ---------- 1. Header + mobile menu ---------- */
  var header = $(".site-header");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 24); };
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
  }
  var menuBtn = $(".menu-btn"), nav = $("#site-nav");
  if (menuBtn && nav) {
    var setMenu = function (open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      if (open) nav.style.top = Math.max(0, header.getBoundingClientRect().bottom) + "px";
      nav.classList.toggle("open", open);
      document.body.classList.toggle("menu-open", open);
      document.body.style.overflow = open ? "hidden" : "";
      $$("main, footer, .chat-fab, .concept").forEach(function (el) { if (open) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
      if (open) { var f = nav.querySelector("a,button"); if (f) f.focus(); }
    };
    menuBtn.addEventListener("click", function () { setMenu(menuBtn.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 1060 && nav.classList.contains("open")) setMenu(false); });
  }

  /* ---------- 2. Scroll reveals ---------- */
  var rv = $$(".rv");
  if (rv.length) {
    if (reduce || !("IntersectionObserver" in window)) rv.forEach(function (el) { el.classList.add("in"); });
    else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px" });
      rv.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- 3. Events: mark tonight, hide past ones on short lists ---------- */
  var today = new Date(); var tKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  $$(".ev[data-date]").forEach(function (li) { if (li.getAttribute("data-date") === tKey) li.classList.add("today"); });
  $$(".events[data-upcoming]").forEach(function (ul) {
    var max = +ul.getAttribute("data-upcoming"), shown = 0;
    $$(".ev", ul).forEach(function (li) {
      var past = li.getAttribute("data-date") < tKey;
      var keep = !past && shown < max; if (keep) shown++;
      li.hidden = !keep;
    });
    if (!shown) { var sec = ul.closest(".js-upcoming"); if (sec) sec.hidden = true; }
  });

  /* ---------- 4. Interactive map ---------- */
  $$(".js-map").forEach(initMap);

  function initMap(root) {
    var svg = $("svg.map-svg", root); if (!svg) return;
    var mode = root.getAttribute("data-mode") || "full";
    var base = svg.getAttribute("viewBox").split(" ").map(Number);
    var vb = base.slice();
    var stage = $(".map-stage", root) || root;
    var bldgs = $$(".bldg", svg);
    var panel = $(".map-results", root);
    var live = $(".map-live", root);
    var state = { filter: root.getAttribute("data-filter") || "all", q: "", sel: null };
    var anim = null;

    function setVB(v) { vb = v; svg.setAttribute("viewBox", v.map(function (n) { return n.toFixed(1); }).join(" ")); }
    function animateTo(t) {
      if (anim) cancelAnimationFrame(anim);
      if (reduce) { setVB(t); return; }
      var from = vb.slice(), t0 = performance.now(), dur = 650;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur); k = 1 - Math.pow(1 - k, 3);
        setVB(from.map(function (f, i) { return f + (t[i] - f) * k; }));
        if (k < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    function clampVB(v) {
      var w = Math.max(base[2] * 0.28, Math.min(base[2], v[2])), h = w * base[3] / base[2];
      var x = Math.max(base[0] - w * 0.1, Math.min(base[0] + base[2] - w * 0.9, v[0]));
      var y = Math.max(base[1] - h * 0.1, Math.min(base[1] + base[3] - h * 0.9, v[1]));
      return [x, y, w, h];
    }
    function zoom(f) {
      var w = vb[2] * f, h = vb[3] * f;
      animateTo(clampVB([vb[0] + (vb[2] - w) / 2, vb[1] + (vb[3] - h) / 2, w, h]));
    }
    function focusBldg(L) {
      var g = $('.bldg[data-b="' + L + '"]', svg); if (!g) return;
      var bb = $("path", g).getBBox();
      var w = Math.max(bb.width * 4.2, base[2] * 0.42), h = w * base[3] / base[2];
      animateTo(clampVB([bb.x + bb.width / 2 - w / 2, bb.y + bb.height / 2 - h / 2, w, h]));
    }

    function matches(b) {
      var okF = state.filter === "all" || b.cats.indexOf(state.filter) > -1;
      var q = state.q.trim().toLowerCase();
      var okQ = !q || (b.name + " " + b.unit + " " + b.desc + " " + b.cats.map(function (c) { return AVE.cats[c].label; }).join(" ")).toLowerCase().indexOf(q) > -1;
      return okF && okQ;
    }
    function paint() {
      var hit = {};
      AVE.biz.forEach(function (b) { if (b.unit && matches(b)) hit[bldgOf(b)] = true; });
      bldgs.forEach(function (g) {
        var L = g.getAttribute("data-b");
        g.classList.toggle("is-dim", !hit[L]);
        g.classList.toggle("is-sel", state.sel === L);
        var p = $("path", g);
        if (state.filter !== "all" && hit[L]) p.style.fill = AVE.cats[state.filter].color; else p.style.fill = "";
        g.setAttribute("aria-pressed", String(state.sel === L));
      });
    }
    function bizRow(b) {
      var tags = b.cats.map(function (c) { return '<span class="tag"><i style="background:' + AVE.cats[c].color + '"></i>' + esc(AVE.cats[c].label) + "</span>"; }).join(" ");
      var bits = [];
      bits.push('<a href="/directory/' + b.slug + '/">Details<span class="sr-only"> for ' + esc(b.name) + "</span></a>");
      if (b.phone) bits.push('<a href="tel:+1' + b.phone.replace(/\D/g, "") + '">Call ' + esc(b.phone) + "</a>");
      if (b.web) bits.push('<a href="' + esc(b.web) + '" target="_blank" rel="noopener" aria-label="' + esc(b.name) + ' website (opens in a new tab)">Website</a>');
      if (b.unit && !state.sel) bits.push('<button type="button" data-show="' + bldgOf(b) + '">Show on map<span class="sr-only">: ' + esc(b.name) + "</span></button>");
      var th = b.photo ? '<img class="biz-th" src="/assets/img/biz/' + b.photo + '-700.webp" alt="" loading="lazy">' : (b.logo ? '<img class="biz-th logo" src="/assets/img/logo/' + b.slug + '.png" alt="" loading="lazy">' : '<span class="biz-th none" aria-hidden="true">' + esc(b.name.charAt(0)) + "</span>");
      return '<div class="biz">' + th + '<div class="biz-main"><div class="biz-top"><b>' + esc(b.name) + '</b><span class="unit">' + (b.unit ? "SUITE " + esc(b.unit) : "") + "</span></div>" +
        '<div class="meta">' + tags + (b.hours ? " · " + esc(b.hours) : "") + (b.note ? " · " + esc(b.note) : "") + "</div>" +
        '<div class="row">' + bits.join("") + "</div></div></div>";
    }
    function render() {
      paint();
      if (!panel) return;
      var list, head;
      if (state.sel) {
        list = AVE.biz.filter(function (b) { return bldgOf(b) === state.sel; });
        head = '<h2>Building ' + state.sel + '</h2><p class="muted">' + list.length + (list.length === 1 ? " business" : " businesses") +
          ' · <button type="button" class="link-reset" data-clear style="background:none;border:0;font:inherit;text-decoration:underline;cursor:pointer;padding:6px 0;color:inherit">Back to all</button></p>';
      } else {
        list = AVE.biz.filter(matches);
        list.sort(function (a, b) { return a.name.replace(/^the /i, "").localeCompare(b.name.replace(/^the /i, "")); });
        var label = state.filter === "all" ? "Everything at 30Avenue" : AVE.cats[state.filter].label;
        head = "<h2>" + esc(label) + '</h2><p class="muted">' + list.length + " results" + (state.q ? " for “" + esc(state.q) + "”" : "") + " · tap a building to see who is inside</p>";
      }
      panel.innerHTML = head + (list.length ? list.map(bizRow).join("") : '<p class="muted" style="margin-top:16px">Nothing matches yet. Try “coffee”, “wine” or “kids”.</p>');
      if (live) live.textContent = state.sel ? "Building " + state.sel + " selected, " + list.length + " businesses listed." : list.length + " businesses listed.";
    }
    function select(L, opts) {
      opts = opts || {};
      state.sel = L;
      render();
      if (L) focusBldg(L); else animateTo(base.slice());
      if (mode === "full" && !opts.noUrl && history.replaceState) {
        var u = new URL(location.href); if (L) u.searchParams.set("b", L); else u.searchParams.delete("b"); history.replaceState(null, "", u);
      }
      if (opts.scroll && panel && window.innerWidth <= 980) panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }

    // building interaction
    bldgs.forEach(function (g) {
      var L = g.getAttribute("data-b");
      function go() {
        if (mode !== "full") { location.href = "/map/?b=" + L; return; }
        select(state.sel === L ? null : L, { scroll: true });
      }
      g.addEventListener("click", function (e) { if (moved) { e.preventDefault(); return; } go(); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });

    // tools
    var zi = $("[data-zoom-in]", root), zo = $("[data-zoom-out]", root), zr = $("[data-zoom-reset]", root);
    if (zi) zi.addEventListener("click", function () { zoom(0.7); });
    if (zo) zo.addEventListener("click", function () { zoom(1 / 0.7); });
    if (zr) zr.addEventListener("click", function () { select(null); });

    // drag to pan (buttons above are the non-drag alternative)
    var drag = null, moved = false;
    stage.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || e.target.closest("button,a,input")) return;
      drag = { x: e.clientX, y: e.clientY, vb: vb.slice() }; moved = false;
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true; stage.classList.add("dragging");
      var r = svg.getBoundingClientRect(), s = drag.vb[2] / r.width;
      setVB(clampVB([drag.vb[0] - dx * s, drag.vb[1] - dy * s, drag.vb[2], drag.vb[3]]));
    });
    window.addEventListener("pointerup", function () { if (drag) { drag = null; stage.classList.remove("dragging"); setTimeout(function () { moved = false; }, 0); } });

    // filters + search
    $$("[data-filter]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filter = btn.getAttribute("data-filter"); state.sel = null;
        $$("[data-filter]", root).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        animateTo(base.slice()); render();
      });
    });
    var input = $("input[type=search]", root);
    if (input) input.addEventListener("input", function () { state.q = input.value; state.sel = null; render(); });
    if (panel) panel.addEventListener("click", function (e) {
      var s = e.target.closest("[data-show]"); if (s) { select(s.getAttribute("data-show"), { scroll: false }); return; }
      if (e.target.closest("[data-clear]")) select(null);
    });

    // initial state
    var params = new URLSearchParams(location.search);
    var start = root.getAttribute("data-focus") || (mode === "full" ? (params.get("b") || "").toUpperCase() : "");
    if (mode === "full" && params.get("cat") && AVE.cats[params.get("cat")]) {
      var cb = $('[data-filter="' + params.get("cat") + '"]', root); if (cb) cb.click();
    }
    if (start && $('.bldg[data-b="' + start + '"]', svg)) {
      state.sel = start; render();
      if (mode === "full") focusBldg(start);
    } else render();
  }

  /* ---------- 5. Plan-your-trip chat (preview: scripted sample answers, no AI yet) ---------- */
  var chats = $$(".chat");
  if (!chats.length) return;

  function L(slug) { var b = bySlug(slug); if (!b) return ""; return '<a href="/directory/' + b.slug + '/">' + esc(b.name) + "</a>"; }
  function H(slug) { var b = bySlug(slug); return b && b.hours ? " — " + esc(b.hours) : ""; }
  // a place card inside a reply: photo, name, suite + hours, Details / Map links
  function C(slug, note) {
    var b = bySlug(slug); if (!b) return "";
    var img = b.photo ? '<img src="/assets/img/biz/' + b.photo + '-700.webp" alt="" loading="lazy">' : '<span class="ph" aria-hidden="true">' + esc(b.name.charAt(0)) + "</span>";
    return '<div class="pcard">' + img + '<div><b>' + esc(b.name) + "</b><span>" + (b.unit ? "Suite " + esc(b.unit) : "") + (b.hours ? " · " + esc(b.hours) : "") + "</span>" +
      (note ? "<em>" + esc(note) + "</em>" : "") +
      '<span class="pc-links"><a href="/directory/' + b.slug + '/">Details<span class="sr-only"> for ' + esc(b.name) + "</span></a>" + (b.unit ? '<a href="/map/?b=' + b.unit.charAt(0) + '">Map<span class="sr-only"> for ' + esc(b.name) + "</span></a>" : "") + "</span></div></div>";
  }
  function nextEvents(n) {
    var list = AVE.events.filter(function (e) { return e.date >= tKey; }).slice(0, n);
    return list;
  }
  function fmt(d) { var p = d.split("-"); var dt = new Date(+p[0], +p[1] - 1, +p[2]); return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }

  var INTENTS = [
    { k: /plan|itinerar|whole day|day trip|schedule|first time/i, r: function () {
      var ev = nextEvents(1)[0];
      return "Here’s a day at 30Avenue — park once and spend the day:" +
        '<div class="step"><b>Morning</b></div>' + C("canopy-road-cafe", "From-scratch breakfast") +
        '<div class="step"><b>Late morning</b></div>' + C("willow-mercer", "Browse the boutiques") + C("30a-olive-oil", "Taste before you buy") +
        '<div class="step"><b>Afternoon</b></div>' + C("attycats-arcade", "Games for kids, teens and grown-ups") +
        '<div class="step"><b>Evening</b></div>' + C("cuvee-30a", "Dinner") + (ev ? '<div class="step">Then <b>' + esc(ev.title) + "</b> · " + fmt(ev.date) + ", " + esc(ev.time) + "</div>" : ""); } },
    { k: /breakfast|brunch|coffee|pancake|morning/i, r: function () { return "Breakfast is easy — this is the spot:" + C("canopy-road-cafe", "Omelets, French toast, giant pancakes"); } },
    { k: /date|romantic|anniversar|nice dinner|fancy|upscale/i, r: function () { return "Three picks for a night out:" + C("cuvee-30a") + C("aja-elevated-asian") + C("obscure-wine-company", "50 wines by the glass"); } },
    { k: /kid|child|family|rain|arcade|game|bored/i, r: function () { return "With kids, start with games, then something sweet in Building B:" + C("attycats-arcade") + C("marble-slab-creamery") + C("great-american-cookies") + "For dinner, " + L("amici-30a-italian-kitchen-2") + " has gelato and a family-style room."; } },
    { k: /music|tonight|event|band|live|happening|this week/i, r: function () { var e = nextEvents(3); if (!e.length) return 'Nothing is listed yet for the coming days. <a href="/calendar/">See the calendar</a>'; return "Coming up on the 30Avenue calendar:<ul>" + e.map(function (x) { return "<li><b>" + fmt(x.date) + ", " + esc(x.time) + "</b> — " + esc(x.title) + "</li>"; }).join("") + '</ul><a href="/calendar/">See every event</a>'; } },
    { k: /wine|beer|drink|cocktail|bar|happy hour/i, r: function () { return "Two good places for a drink:" + C("obscure-wine-company", "Sommelier-owned wine bar and shop") + C("idyll-hound-proper", "A fun, funky pub"); } },
    { k: /seafood|fish|shrimp|oyster/i, r: function () { return "For seafood, go here — dine in or take it to go:" + C("goatfeathers-seafood-market", "Restaurant, fish market and specialty store"); } },
    { k: /mexican|taco|italian|pizza|sushi|asian|lunch|eat|hungry|food|dinner|restaurant/i, r: function () { return "A few places to eat:" + C("amigos-30a-mexican-kitchen") + C("amici-30a-italian-kitchen-2") + C("aja-elevated-asian") + '<a class="more" href="/dining/">See all dining</a>'; } },
    { k: /shop|boutique|cloth|gift|fashion|olive|decor|home|interior/i, r: function () { return "Shopping picks:" + C("willow-mercer", "Street-chic style for men and women") + C("southern-charm", "Artisan-made apparel") + C("not-too-shabby-store", "Hand-finished furniture") + '<a class="more" href="/shopping/">See all shopping</a>'; } },
    { k: /yoga|spa|wellness|hair|salon|beauty|massage|facial/i, r: function () { return "To unwind:" + C("myst", "Yoga") + C("rollands-beauty-bar", "Hair and facials") + C("30a-medical-spa"); } },
    { k: /park|parking|where|address|direction|get there|location|underpass|bike|walk/i, r: function () { return "30Avenue is at <b>12805 US-98 East, Inlet Beach, FL 32461</b>, where 30A meets Highway 98. Parking lots surround the buildings. Walking or biking? The new U.S. 98 pedestrian underpass just east of C.R. 30A is open. " + '<a href="' + esc(AVE.site.maps) + '" target="_blank" rel="noopener" aria-label="Get directions in Google Maps (opens in a new tab)">Get directions</a>'; } },
    { k: /hours|open|close|when/i, r: function () { return "Hours are set by each business. Some examples: " + L("canopy-road-cafe") + H("canopy-road-cafe") + "; " + L("attycats-arcade") + H("attycats-arcade") + "; " + L("obscure-wine-company") + H("obscure-wine-company") + '. <a href="/map/">The map lists every business’s hours.</a>'; } },
    { k: /^(hi|hey|hello|yo|sup)\b/i, r: function () { return "Hi! Tell me who you’re with and what you’re in the mood for — I’ll build a plan."; } },
  ];
  var FALLBACK = "This preview only knows a few topics. Try one of the suggestions below — like “plan my day” or “live music tonight”. The live version will answer questions like yours in full.";

  chats.forEach(function (chat) {
    var log = $(".chat-log", chat), form = $(".chat-form", chat);
    if (!form) return;
    var input = $("input", form);
    var ORB = '<span class="orb av" aria-hidden="true"><i></i></span>';
    function add(html, who) {
      var row = document.createElement("div"); row.className = "row " + who;
      row.innerHTML = (who === "bot" ? ORB : "") + '<div class="col"><span class="who">' + (who === "bot" ? "Concierge" : "You") + '</span><div class="bubble">' + html + "</div></div>";
      log.appendChild(row); log.scrollTop = log.scrollHeight; return $(".bubble", row);
    }
    function reply(text) {
      add(esc(text), "me");
      var t = add('<span class="typing" role="img" aria-label="Concierge is typing"><i></i><i></i><i></i></span>', "bot");
      var hit = null; for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i].k.test(text)) { hit = INTENTS[i]; break; }
      setTimeout(function () { t.innerHTML = hit ? hit.r() : esc(FALLBACK); log.scrollTop = log.scrollHeight; }, reduce ? 50 : 750);
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value.trim(); if (!v) return; input.value = ""; reply(v); });
    if (chat.classList.contains("mock")) return;
    $$(".chat-sugg button", chat).forEach(function (b) { b.addEventListener("click", function () { reply(b.textContent); }); });
  });

  var fab = $(".chat-fab"), pop = $("#trip-chat");
  if (fab && pop) {
    var close = $(".chat-close", pop);
    var open = function () { pop.hidden = false; fab.setAttribute("aria-expanded", "true"); $("input", pop).focus(); };
    var shut = function () { pop.hidden = true; fab.setAttribute("aria-expanded", "false"); fab.focus(); };
    fab.addEventListener("click", open);
    if (close) close.addEventListener("click", shut);
    pop.addEventListener("keydown", function (e) { if (e.key === "Escape") shut(); });
    $$("[data-open-chat]").forEach(function (b) {
      b.addEventListener("click", function (e) { e.preventDefault(); open(); var q = b.getAttribute("data-open-chat"); if (q) { var f = $(".chat-form", pop); $("input", f).value = q; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true })); } });
    });
  }
})();
