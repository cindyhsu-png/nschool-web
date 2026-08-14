// ============================================================
//  Interaction layer — schematic overlay, stat counters, reveals
// ============================================================
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- schematic technical callouts over the 3D object ----------
  const svg = document.getElementById("schematic");
  const NS = "http://www.w3.org/2000/svg";

  // stock-market quote pool — code + plausible price band (TW 紅漲綠跌)
  const TICKERS = [
    ["2330", 980], ["2317", 205], ["2454", 1320], ["0050", 188],
    ["TAIEX", 23150], ["2412", 126], ["2881", 92], ["2303", 54],
    ["3008", 2450], ["2882", 68], ["NVDA", 138], ["AAPL", 226],
    ["TSLA", 248], ["S&P", 5870], ["2308", 480], ["1301", 78],
    ["00878", 22], ["2891", 28], ["VIX", 17], ["2603", 168],
  ];
  const UP = "#e8413f", DOWN = "#13a06a";   // 紅漲綠跌
  function fmt(p) { return p >= 1000 ? p.toLocaleString() : p.toFixed(2); }
  function sparkPath(px, py, w, h, rnd) {
    let d = `M${px + 6} ${py + h - 7}`;
    for (let k = 1; k <= 6; k++) d += ` L${px + 6 + k * 5} ${py + 8 + rnd() * 14}`;
    return d;
  }
  // ---------- hero ticker: quotes GROW from the orb, live briefly, fade ----------
  // Rhythmic spawn/despawn (like market pulses); everything clears on first scroll.
  const W = 84, H = 30;
  function fitViewBox() { svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`); }
  fitViewBox();
  addEventListener("resize", fitViewBox);
  svg.style.opacity = "1";

  function makeCallout(tone, code, price, pct, up) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("fill", "none");
    g.setAttribute("stroke-width", "1");

    // leader line + dot — anchored to the orb surface, updated every frame
    const line = document.createElementNS(NS, "line");
    line.setAttribute("stroke", "rgba(255,255,255,.45)");
    g.appendChild(line);

    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", 0); r.setAttribute("y", 0);
    r.setAttribute("width", W); r.setAttribute("height", H); r.setAttribute("rx", "2");
    r.setAttribute("stroke", "rgba(255,255,255,.72)");
    g.appendChild(r);

    let s = (code.length * 11 + 7);
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const spark = document.createElementNS(NS, "path");
    spark.setAttribute("d", sparkPath(0, 0, W, H, rnd));
    spark.setAttribute("stroke", tone); spark.setAttribute("stroke-width", "1.2"); spark.setAttribute("opacity", "0.9");
    g.appendChild(spark);

    const mk = (x, y, fill, size, anchor, txt, weight) => {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("fill", fill);
      t.setAttribute("stroke", "none"); t.setAttribute("font-size", size);
      if (anchor) t.setAttribute("text-anchor", anchor);
      if (weight) t.setAttribute("font-weight", weight);
      t.setAttribute("font-family", "'IBM Plex Mono', monospace");
      t.textContent = txt; g.appendChild(t);
    };
    mk(0, -6, "rgba(255,255,255,.92)", 11, null, code, 600);
    mk(W, -6, tone, 10, "end", `${up ? "▲" : "▼"}${pct.toFixed(2)}%`);
    mk(4, H + 13, "rgba(255,255,255,.78)", 10, null, fmt(price));

    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("r", "2.6"); dot.setAttribute("fill", tone); dot.setAttribute("stroke", "none");
    g.appendChild(dot);

    return { g, line, dot };
  }

  const active = new Set();
  const MAX = innerWidth < 760 ? 3 : 5;
  const atHero = () => scrollY < 60;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const orbNow = () => window.__orb || { x: innerWidth * 0.62, y: innerHeight * 0.5, r: 200 };

  function spawn() {
    const o = orbNow();
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.95 + Math.random() * 0.7;                 // multiples of orb radius
    const [code, base] = TICKERS[Math.floor(Math.random() * TICKERS.length)];
    const up = Math.random() > 0.5;
    const pct = 0.05 + Math.random() * 3;
    const price = base * (1 + (up ? 1 : -1) * pct / 100);
    const parts = makeCallout(up ? UP : DOWN, code, price, pct, up);
    parts.g.style.opacity = "0";
    svg.appendChild(parts.g);
    const now = performance.now();
    const life = 2600 + Math.random() * 2400;
    active.add({
      ...parts,
      ux: Math.cos(ang), uy: Math.sin(ang) * 0.82,         // direction from orb
      radK: rad,
      born: now, killAt: now + life, removeAt: now + life + 680,
    });
  }

  // single rAF loop: every quote tracks the orb's live position + radius,
  // grows out from its centre, and tethers to a dot on its surface
  function frame() {
    const o = orbNow();
    const now = performance.now();
    for (const c of active) {
      if (now >= c.removeAt) { active.delete(c); c.g.remove(); continue; }
      const grow = easeOut(Math.min((now - c.born) / 680, 1));
      let op;
      if (now < c.born + 480) op = (now - c.born) / 480;
      else if (now >= c.killAt) op = Math.max(0, 1 - (now - c.killAt) / (c.removeAt - c.killAt));
      else op = 1;

      // box position = orb centre + direction * (orb radius * k) * grow
      const dist = o.r * c.radK * grow;
      let tx = o.x + c.ux * dist;
      let ty = o.y + c.uy * dist;
      tx = Math.max(16, Math.min(innerWidth - W - 90, tx));
      ty = Math.max(64, Math.min(innerHeight - 64, ty));
      c.g.style.transform = `translate(${tx}px,${ty}px)`;
      c.g.style.opacity = op.toFixed(3);

      // orb-surface point (in the box's local coords) facing the box
      const lox = o.x - tx, loy = o.y - ty;                 // orb centre, local
      const cdx = W / 2 - lox, cdy = H / 2 - loy;           // orb → box centre
      const dl = Math.hypot(cdx, cdy) || 1;
      const ex = lox + (cdx / dl) * o.r;                    // on the orb surface
      const ey = loy + (cdy / dl) * o.r;
      c.dot.setAttribute("cx", ex.toFixed(1));
      c.dot.setAttribute("cy", ey.toFixed(1));
      const cornerX = lox < W / 2 ? 0 : W;
      const cornerY = loy < H / 2 ? 0 : H;
      c.line.setAttribute("x1", cornerX); c.line.setAttribute("y1", cornerY);
      c.line.setAttribute("x2", ex.toFixed(1)); c.line.setAttribute("y2", ey.toFixed(1));
    }
    requestAnimationFrame(frame);
  }

  let scrolledAway = false;
  if (!reduce) {
    requestAnimationFrame(frame);
    (function loop() {
      if (atHero() && document.visibilityState === "visible" && active.size < MAX) spawn();
      setTimeout(loop, 550 + Math.random() * 900);
    })();
    addEventListener("scroll", () => {
      if (scrollY > 60 && !scrolledAway) {
        scrolledAway = true;
        const now = performance.now();
        active.forEach((c) => { c.killAt = now; c.removeAt = now + 240; });
      } else if (scrollY <= 60 && scrolledAway) {
        scrolledAway = false;
      }
    }, { passive: true });
  }

  // ---------- stat counters ----------
  const nums = document.querySelectorAll(".num[data-count]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      io.unobserve(el);
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const fmtN = (n) => n.toLocaleString("en-US");
      if (reduce) { el.textContent = fmtN(target) + suffix; return; }
      const dur = 1600, t0 = performance.now();
      (function step(now) {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmtN(Math.round(target * e)) + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.6 });
  nums.forEach((n) => io.observe(n));

  // ---------- reveal on scroll ----------
  const reveal = document.querySelectorAll(
    ".s-card, .w-card, .b-card, .t-card, .stat, .pil, .app-card, .corp-item, .jn-foot span"
  );
  reveal.forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(26px)";
    el.style.transition = "opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)";
  });
  const ro = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const sibs = [...el.parentElement.children].indexOf(el);
      el.style.transitionDelay = (Math.min(sibs, 5) * 0.07) + "s";
      el.style.opacity = "1";
      el.style.transform = "none";
      ro.unobserve(el);
    });
  }, { threshold: 0.18 });
  reveal.forEach((el) => ro.observe(el));

  // ---------- faculty marquee: duplicate the cards so the CSS loop is seamless ----------
  const track = document.getElementById("teamTrack");
  if (track && !reduce) {
    const originals = [...track.children];
    originals.forEach((el) => {
      const c = el.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      track.appendChild(c);
    });
  }

  // ---------- footer disclaimer: 一行顯示，字級自動縮到剛好放得下（絕不截字） ----------
  (function fitDisclaimer() {
    const el = document.querySelector(".footer-disclaimer");
    if (!el) return;
    const MAX = 11.5, MIN = 9;
    // 用一顆離屏的量測節點：量真實文字寬度，不受父層裁切影響
    const probe = document.createElement("span");
    probe.textContent = el.textContent;
    probe.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden";
    const avail = () => el.parentElement.clientWidth
      - parseFloat(getComputedStyle(el.parentElement).paddingLeft)
      - parseFloat(getComputedStyle(el.parentElement).paddingRight);
    const fit = () => {
      const room = avail();
      if (room <= 0) return;
      document.body.appendChild(probe);
      const cs = getComputedStyle(el);
      probe.style.fontFamily = cs.fontFamily;
      probe.style.fontWeight = cs.fontWeight;
      probe.style.letterSpacing = cs.letterSpacing;
      let size = MAX;
      probe.style.fontSize = size + "px";
      while (probe.offsetWidth > room && size > MIN) {
        size = Math.round((size - 0.25) * 100) / 100;
        probe.style.fontSize = size + "px";
      }
      const fits = probe.offsetWidth <= room;
      probe.remove();
      // 縮到下限還放不下（窄螢幕）→ 換行；寧可多行，也不能截掉聲明內容
      el.classList.toggle("wrapped", !fits);
      el.style.fontSize = fits ? size + "px" : "";
    };
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(el.parentElement);
    else addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  })();

  // ---------- left rail: scroll-spy + progress fill ----------
  (function rail() {
    const rail = document.getElementById("rail");
    const fill = document.getElementById("railFill");
    if (!rail) return;
    const links = [...rail.querySelectorAll("a[data-sec]")];
    const secs = links.map((a) => document.getElementById(a.dataset.sec)).filter(Boolean);
    if (!secs.length) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const mid = scrollY + innerHeight * 0.4;
      let cur = 0;
      secs.forEach((s, i) => { if (s.offsetTop <= mid) cur = i; });
      links.forEach((a, i) => a.classList.toggle("on", i === cur));
      if (fill) {
        const max = document.documentElement.scrollHeight - innerHeight;
        fill.style.height = Math.min(100, Math.max(0, (scrollY / Math.max(1, max)) * 100)) + "%";
      }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    update();
  })();

  // ---------- article grid: render from articles.json (auto-updated by CI) ----------
  (function renderArticles() {
    const grid = document.getElementById("articleGrid");
    if (!grid || !window.fetch) return;
    const esc = (s) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    fetch("articles.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items.filter((i) => i && i.url && i.cover) : [];
        if (items.length < 1) return; // keep the hardcoded fallback cards
        grid.innerHTML = items.slice(0, 4).map((it) => {
          let cat = "深度專欄", title = it.title || "";
          const m = title.match(/^【(.+?)】\s*(.*)$/);
          if (m) { cat = m[1]; title = m[2]; }
          const d = (it.date || "").replace(/-/g, ".");
          return `<a class="w-card" href="${esc(it.url)}" target="_blank" rel="noopener">` +
            `<div class="thumb"><img src="${esc(it.cover)}" alt="${esc(title)}" loading="lazy"></div>` +
            `<div class="tag">${esc(cat)}${d ? " · " + d : ""}</div>` +
            `<h4 class="w-name">${esc(title)}</h4></a>`;
        }).join("");
        grid.querySelectorAll(".w-card").forEach((el) => { el.style.opacity = "1"; el.style.transform = "none"; });
      })
      .catch(() => {});
  })();

  // ---------- trial course modal ----------
  const modal = document.getElementById("trialModal");
  const trialBtn = document.getElementById("trialBtn");
  if (modal && trialBtn) {
    const open = () => { modal.classList.add("open"); modal.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; };
    const close = () => { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; };
    trialBtn.addEventListener("click", open);
    modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", close));
    modal.querySelectorAll(".modal-list a").forEach((a) => a.addEventListener("click", close));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
  }

  // ---------- smooth anchor scroll ----------
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      const t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });
})();
