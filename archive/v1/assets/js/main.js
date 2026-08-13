/* ═══════════════════════════════════════════════
   NSCHOOL — interaction layer
   Lenis · GSAP ScrollTrigger · preloader · cursor
   ═══════════════════════════════════════════════ */

(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  gsap.registerPlugin(ScrollTrigger);

  /* ─────────── Lenis smooth scroll ─────────── */
  let lenis = null;
  if (!prefersReduced && typeof Lenis !== "undefined") {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.0 });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ─────────── text splitting ─────────── */
  // wrap each .split-lines element's <br>-separated lines
  document.querySelectorAll(".split-lines").forEach((el) => {
    const parts = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = parts
      .map((p) => `<span class="line"><span class="line-inner">${p.trim()}</span></span>`)
      .join("");
  });

  // manifesto: word-level spans for scroll-lit effect
  document.querySelectorAll(".split-words").forEach((el) => {
    const text = el.textContent.trim();
    el.innerHTML = Array.from(text)
      .map((ch) => (ch === " " ? " " : `<span class="w">${ch}</span>`))
      .join("");
  });

  /* ─────────── ticker data ─────────── */
  const TICKS = [
    ["加權指數 TAIEX", "23,847.62", "+1.24%", 1],
    ["櫃買指數 TPEx", "261.43", "+0.86%", 1],
    ["台積電 2330", "1,085", "+1.40%", 1],
    ["鴻海 2317", "215.5", "+0.93%", 1],
    ["聯發科 2454", "1,420", "-0.35%", 0],
    ["電子類指數", "1,342.06", "+1.18%", 1],
    ["金融類指數", "2,418.55", "-0.24%", 0],
    ["外資買賣超", "+182.4 億", "連三買", 1],
    ["台指期 TXF", "23,810", "+1.10%", 1],
    ["USD/TWD", "31.42", "+0.06", 1],
  ];
  const track = document.getElementById("tickerTrack");
  if (track) {
    const html = TICKS.map(
      ([sym, px, chg, up]) =>
        `<span class="tick"><span class="t-sym">${sym}</span><span>${px}</span><span class="${up ? "t-up" : "t-dn"}">${up ? "▲" : "▼"} ${chg}</span></span>`
    ).join("");
    track.innerHTML = html + html; // doubled for seamless loop
  }

  /* ─────────── hero market panel ─────────── */
  const panelRows = document.getElementById("panelRows");
  const panelChart = document.getElementById("panelChart");

  // deterministic pseudo-random walk for sparklines
  function walk(seed, n, drift) {
    let s = seed, v = 50;
    const out = [];
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646 - 0.5;
    };
    for (let i = 0; i < n; i++) {
      v += rnd() * 9 + drift;
      out.push(v);
    }
    return out;
  }
  function sparkPath(vals, w, h, pad = 2) {
    const min = Math.min(...vals), max = Math.max(...vals);
    const sx = (i) => pad + (i / (vals.length - 1)) * (w - pad * 2);
    const sy = (v) => pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
    return vals.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join("");
  }

  if (panelRows) {
    const ROWS = [
      ["櫃買指數 TPEx", "261.43", "+0.86%", 1, 11, 0.6],
      ["台積電 2330", "1,085", "+1.40%", 1, 23, 0.9],
      ["電子類指數", "1,342.06", "+1.18%", 1, 37, 0.7],
      ["金融類指數", "2,418.55", "-0.24%", 0, 53, -0.5],
    ];
    panelRows.innerHTML = ROWS.map(([sym, px, chg, up, seed, drift]) => {
      const d = sparkPath(walk(seed, 28, drift), 64, 22);
      const cls = up ? "t-up" : "t-dn";
      const color = up ? "var(--up)" : "var(--down)";
      return `<div class="panel-row">
        <span class="pr-sym">${sym}</span>
        <span class="pr-px">${px}</span>
        <span class="pr-chg ${cls}">${up ? "▲" : "▼"} ${chg}</span>
        <svg viewBox="0 0 64 22" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/></svg>
      </div>`;
    }).join("");
  }

  if (panelChart) {
    const vals = walk(7, 64, 0.9);
    const W = 360, H = 120;
    const line = sparkPath(vals, W, H, 4);
    const min = Math.min(...vals), max = Math.max(...vals);
    const lastY = 4 + (1 - (vals[vals.length - 1] - min) / (max - min)) * (H - 8);
    panelChart.innerHTML = `
      <defs>
        <linearGradient id="pcFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(124,58,237,0.22)"/>
          <stop offset="100%" stop-color="rgba(124,58,237,0)"/>
        </linearGradient>
      </defs>
      <path d="${line} L ${W - 4},${H} L 4,${H} Z" fill="url(#pcFill)" stroke="none"/>
      <path id="pcLine" d="${line}" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="${W - 4}" cy="${lastY.toFixed(1)}" r="3.2" fill="#7c3aed"/>
      <circle cx="${W - 4}" cy="${lastY.toFixed(1)}" r="7" fill="rgba(124,58,237,0.18)"/>`;
  }

  const dateEl = document.getElementById("panelDate");
  if (dateEl) {
    const d = new Date();
    dateEl.textContent = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  /* gentle float on the panel */
  const heroPanel = document.getElementById("heroPanel");
  if (heroPanel && !prefersReduced) {
    gsap.to(heroPanel, {
      y: -10, duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 3,
    });
  }

  /* ─────────── orbiting financial cards ─────────── */
  const NS_SVG = "http://www.w3.org/2000/svg";
  const mkEl = (t, a) => {
    const n = document.createElementNS(NS_SVG, t);
    for (const k in a) n.setAttribute(k, a[k]);
    return n;
  };

  // mini candlestick (Taiwan colours: red up · green down)
  const candleSvg = document.querySelector(".oc-candle");
  if (candleSvg) {
    const W = 120, H = 46, N = 7, gap = W / N;
    let price = 20, sd = 991;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646 - 0.5; };
    const cs = [];
    let min = 1e9, max = -1e9;
    for (let i = 0; i < N; i++) {
      const o = price;
      price += rnd() * 9 + 1.3;
      const c = price;
      const hi = Math.max(o, c) + Math.abs(rnd()) * 4.2;
      const lo = Math.min(o, c) - Math.abs(rnd()) * 4.2;
      cs.push({ o, c, hi, lo });
      min = Math.min(min, lo); max = Math.max(max, hi);
    }
    const Y = (v) => H - 4 - ((v - min) / (max - min)) * (H - 8);
    cs.forEach((cd, i) => {
      const x = gap * (i + 0.5);
      const up = cd.c >= cd.o;
      const col = up ? "#dc2626" : "#16a34a";
      candleSvg.appendChild(mkEl("line", { x1: x, x2: x, y1: Y(cd.hi), y2: Y(cd.lo), stroke: col, "stroke-width": 1 }));
      const yT = Y(Math.max(cd.o, cd.c)), yB = Y(Math.min(cd.o, cd.c));
      candleSvg.appendChild(mkEl("rect", {
        x: x - gap * 0.26, y: yT, width: gap * 0.52,
        height: Math.max(1.6, yB - yT), fill: col, rx: 1,
      }));
    });
  }

  // bokeh card faint sparkline
  const sparkEl = document.querySelector(".oc-spark");
  if (sparkEl) {
    const v = walk(5, 40, 0.7);
    sparkEl.innerHTML = `<path d="${sparkPath(v, 160, 60, 6)}" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/>`;
  }

  // market mini card — area sparkline
  const omktEl = document.querySelector(".omkt-spark");
  if (omktEl) {
    const v = walk(13, 44, 0.8);
    const W = 220, H = 64, line = sparkPath(v, W, H, 3);
    omktEl.innerHTML =
      `<defs><linearGradient id="omktFill" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="rgba(124,58,237,0.22)"/>` +
      `<stop offset="100%" stop-color="rgba(124,58,237,0)"/></linearGradient></defs>` +
      `<path d="${line} L ${W - 3},${H} L 3,${H} Z" fill="url(#omktFill)"/>` +
      `<path d="${line}" fill="none" stroke="#7c3aed" stroke-width="1.8" stroke-linejoin="round"/>`;
  }

  // single-quote card — line sparkline (台積電 up → red)
  const oqEl = document.querySelector(".oq-spark");
  if (oqEl) {
    const v = walk(29, 36, 0.7);
    oqEl.innerHTML = `<path d="${sparkPath(v, 120, 32, 3)}" fill="none" stroke="#dc2626" stroke-width="1.6" stroke-linejoin="round"/>`;
  }

  // depth parallax — cards drift opposite the cursor, scaled by depth
  const ocards = Array.from(document.querySelectorAll(".ocard[data-depth]"));
  const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (ocards.length && fineHover && !prefersReduced) {
    let tx = 0, ty = 0, cx = 0, cy = 0;
    window.addEventListener("pointermove", (e) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
    gsap.ticker.add(() => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      // the whole curved surface turns toward the cursor (holographic)
      const mry = (cx * 9).toFixed(2);
      const mrx = (-cy * 6).toFixed(2);
      ocards.forEach((c) => {
        const d = parseFloat(c.dataset.depth) || 1;
        c.style.setProperty("--px", (-cx * d * 9).toFixed(1) + "px");
        c.style.setProperty("--py", (-cy * d * 6).toFixed(1) + "px");
        c.style.setProperty("--mry", mry + "deg");
        c.style.setProperty("--mrx", mrx + "deg");
      });
    });
  }

  /* ─────────── nav clock (TPE) ─────────── */
  const clockEl = document.getElementById("navClock");
  if (clockEl) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    const tickClock = () => (clockEl.textContent = "TPE " + fmt.format(new Date()));
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* ─────────── preloader ─────────── */
  const preloader = document.getElementById("preloader");
  const countEl = document.getElementById("preloaderCount");

  function startIntro() {
    const tl = gsap.timeline();
    tl.to(".hero-title .line-inner", {
      y: 0, duration: 1.3, ease: "power4.out", stagger: 0.14,
    })
      .to(".hero .reveal-fade", {
        opacity: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.1,
      }, "-=0.9");
  }

  if (preloader && !prefersReduced) {
    const counter = { v: 0 };
    const tl = gsap.timeline();
    tl.to(counter, {
      v: 100, duration: 1.6, ease: "power2.inOut",
      onUpdate: () => (countEl.textContent = String(Math.round(counter.v)).padStart(2, "0")),
    })
      .to(".preloader-inner", { opacity: 0, y: -30, duration: 0.5, ease: "power2.in" })
      .to(preloader, { yPercent: -100, duration: 0.9, ease: "power4.inOut" }, "-=0.1")
      .set(preloader, { display: "none" })
      .add(startIntro, "-=1.15");
  } else {
    if (preloader) preloader.style.display = "none";
    if (prefersReduced) {
      document.querySelectorAll(".reveal-fade, .reveal-up").forEach((el) => {
        el.style.opacity = 1; el.style.transform = "none";
      });
    } else {
      startIntro();
    }
  }

  /* ─────────── nav behavior ─────────── */
  const nav = document.getElementById("nav");
  let lastY = 0;
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      const y = self.scroll();
      nav.classList.toggle("is-scrolled", y > 40);
      if (y > 500 && y > lastY + 4) nav.classList.add("is-hidden");
      else if (y < lastY - 4) nav.classList.remove("is-hidden");
      lastY = y;
    },
  });

  /* mobile menu */
  const burger = document.getElementById("navBurger");
  const menu = document.getElementById("menu");
  if (burger && menu) {
    burger.addEventListener("click", () => {
      const open = menu.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      menu.querySelectorAll(".menu-links a").forEach((a, i) => {
        a.style.transitionDelay = open ? `${0.08 + i * 0.06}s` : "0s";
      });
      if (lenis) open ? lenis.stop() : lenis.start();
    });
    menu.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        menu.classList.remove("is-open");
        burger.classList.remove("is-open");
        if (lenis) lenis.start();
      })
    );
  }

  /* anchor scrolling via lenis */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -60, duration: 1.4 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ─────────── global page progress → WebGL + progress bar ─────────── */
  const progressBar = document.getElementById("progress");
  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => {
      window.dispatchEvent(new CustomEvent("nschool:progress", { detail: self.progress }));
      if (progressBar) progressBar.style.transform = `scaleX(${self.progress})`;
    },
  });

  /* ─────────── nav scroll-spy ─────────── */
  const spyLinks = new Map();
  document.querySelectorAll(".nav-links a[href^='#']").forEach((a) => {
    spyLinks.set(a.getAttribute("href").slice(1), a);
  });
  spyLinks.forEach((link, id) => {
    const target = document.getElementById(id);
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: "top 45%",
      end: "bottom 45%",
      onToggle: (self) => {
        if (self.isActive) {
          spyLinks.forEach((l) => l.classList.remove("is-active"));
          link.classList.add("is-active");
        } else if (link.classList.contains("is-active")) {
          link.classList.remove("is-active");
        }
      },
    });
  });

  /* ─────────── section reveals ─────────── */
  if (!prefersReduced) {
    document.querySelectorAll("section .reveal-fade, footer .reveal-fade").forEach((el) => {
      if (el.closest(".hero")) return; // hero handled by intro
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

    document.querySelectorAll(".reveal-up").forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%" },
      });
    });

    document.querySelectorAll(".split-lines").forEach((el) => {
      gsap.to(el.querySelectorAll(".line-inner"), {
        y: 0, duration: 1.15, ease: "power4.out", stagger: 0.12,
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });

    /* method items: slide in with border draw */
    gsap.utils.toArray(".method-item").forEach((item, i) => {
      gsap.from(item, {
        opacity: 0, y: 60, duration: 1.1, ease: "power3.out", delay: i * 0.05,
        scrollTrigger: { trigger: item, start: "top 85%" },
      });
    });

    /* course cards stagger */
    gsap.set(".course-card", { opacity: 0, y: 50 });
    ScrollTrigger.batch(".course-card", {
      start: "top 92%",
      onEnter: (batch) =>
        gsap.to(batch, {
          opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08,
        }),
    });

    /* scene photos: subtle parallax inside their frames */
    document.querySelectorAll(".photo-wrap img").forEach((img) => {
      gsap.to(img, {
        yPercent: -9, ease: "none",
        scrollTrigger: {
          trigger: img.closest(".photo-card"),
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      });
    });

    /* manifesto words light up with scrub */
    const words = document.querySelectorAll(".manifesto-text .w");
    if (words.length) {
      const prox = { v: 0 };
      gsap.to(prox, {
        v: 1, ease: "none",
        scrollTrigger: {
          trigger: ".manifesto",
          start: "top 75%",
          end: "bottom 65%",
          scrub: 0.6,
        },
        onUpdate: () => {
          const lit = Math.floor(prox.v * words.length);
          words.forEach((w, i) => w.classList.toggle("is-lit", i <= lit));
        },
      });
    }
  } else {
    document.querySelectorAll(".split-lines .line-inner").forEach((el) => {
      el.style.transform = "none";
    });
  }

  /* ─────────── counters ─────────── */
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: "top 88%",
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: target, duration: 2, ease: "power3.out",
          onUpdate: () => (el.textContent = Math.round(obj.v).toLocaleString("en-US")),
        }),
    });
  });

  /* ─────────── evidence chart (SVG draw) ─────────── */
  const svg = document.getElementById("chartSvg");
  if (svg) {
    const W = 640, H = 360, PAD = { t: 16, r: 16, b: 34, l: 52 };
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const Y0 = 1928, Y1 = 2024;
    // log-scale real growth of $1 — approximate long-run shapes
    const mkSeries = (annual, vol, seed) => {
      const pts = [];
      let v = 1, sd = seed;
      const rnd = () => {
        sd = (sd * 16807) % 2147483647;
        return (sd - 1) / 2147483646 - 0.5;
      };
      for (let y = Y0; y <= Y1; y++) {
        // crude regime drama: depression, 70s, 2008
        let shock = 0;
        if (annual > 0.05) {
          if (y >= 1929 && y <= 1932) shock = -0.28;
          if (y >= 1973 && y <= 1974) shock = -0.18;
          if (y === 2008) shock = -0.37;
          if (y === 2022) shock = -0.19;
        } else if (annual > 0.01) {
          if (y >= 1977 && y <= 1981) shock = -0.09;
          if (y === 2022) shock = -0.17;
        }
        v *= 1 + annual + shock + rnd() * vol;
        v = Math.max(v, 0.05);
        pts.push([y, v]);
      }
      return pts;
    };
    const eq = mkSeries(0.085, 0.12, 7919);   // equities ~ ends in the thousands
    const bd = mkSeries(0.022, 0.05, 104729); // bonds
    const ca = mkSeries(0.003, 0.012, 1299709); // cash

    const maxV = Math.max(...eq.map((p) => p[1]));
    const logMax = Math.log10(maxV * 1.4);
    const logMin = Math.log10(0.3);
    const X = (y) => PAD.l + ((y - Y0) / (Y1 - Y0)) * iw;
    const Y = (v) => PAD.t + ih - ((Math.log10(v) - logMin) / (logMax - logMin)) * ih;
    const path = (pts) =>
      pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");

    const NS = "http://www.w3.org/2000/svg";
    const make = (tag, attrs) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    };

    // gridlines at powers of 10
    for (let e = 0; e <= Math.floor(logMax); e++) {
      const v = Math.pow(10, e);
      if (Math.log10(v) < logMin) continue;
      svg.appendChild(make("line", {
        x1: PAD.l, x2: W - PAD.r, y1: Y(v), y2: Y(v),
        stroke: "rgba(13,13,20,0.08)", "stroke-width": 1,
      }));
      const label = make("text", {
        x: PAD.l - 10, y: Y(v) + 4, "text-anchor": "end",
        fill: "rgba(13,13,20,0.4)",
        "font-family": "IBM Plex Mono, monospace", "font-size": 10,
      });
      label.textContent = "$" + v.toLocaleString("en-US");
      svg.appendChild(label);
    }
    // x labels
    [1928, 1950, 1975, 2000, 2024].forEach((yr) => {
      const label = make("text", {
        x: X(yr), y: H - 12, "text-anchor": "middle",
        fill: "rgba(13,13,20,0.4)",
        "font-family": "IBM Plex Mono, monospace", "font-size": 10,
      });
      label.textContent = yr;
      svg.appendChild(label);
    });

    const lines = [
      [ca, "rgba(13,13,20,0.30)", 1.2],
      [bd, "#0d9488", 1.5],
      [eq, "#7c3aed", 2],
    ].map(([pts, color, wdt]) => {
      const p = make("path", {
        d: path(pts), fill: "none", stroke: color, "stroke-width": wdt,
        "stroke-linejoin": "round", "stroke-linecap": "round",
      });
      svg.appendChild(p);
      return p;
    });

    // terminal value tag on equities
    const last = eq[eq.length - 1];
    const tag = make("text", {
      x: X(last[0]) - 6, y: Y(last[1]) - 10, "text-anchor": "end",
      fill: "#7c3aed", "font-family": "IBM Plex Mono, monospace", "font-size": 11,
    });
    tag.textContent = "$1 → $" + Math.round(last[1]).toLocaleString("en-US");
    svg.appendChild(tag);

    // endpoint pulse
    const endDot = make("circle", { cx: X(last[0]), cy: Y(last[1]), r: 3, fill: "#7c3aed" });
    const endHalo = make("circle", {
      cx: X(last[0]), cy: Y(last[1]), r: 3,
      fill: "none", stroke: "#7c3aed", "stroke-width": 1.5, "stroke-opacity": 0.6,
    });
    if (!prefersReduced) {
      const animR = make("animate", { attributeName: "r", from: 3, to: 13, dur: "2.2s", repeatCount: "indefinite" });
      const animO = make("animate", { attributeName: "stroke-opacity", from: 0.6, to: 0, dur: "2.2s", repeatCount: "indefinite" });
      endHalo.appendChild(animR);
      endHalo.appendChild(animO);
    }
    svg.appendChild(endHalo);
    svg.appendChild(endDot);

    if (!prefersReduced) {
      lines.forEach((p, i) => {
        const len = p.getTotalLength();
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(p, {
          strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut", delay: i * 0.25,
          scrollTrigger: { trigger: svg, start: "top 80%" },
        });
      });
      gsap.from(tag, {
        opacity: 0, duration: 0.8, delay: 2.4,
        scrollTrigger: { trigger: svg, start: "top 80%" },
      });
    }
  }

  /* ─────────── course card cursor glow ─────────── */
  document.querySelectorAll(".course-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  });

  /* ─────────── custom cursor + magnetic ─────────── */
  const dot = document.getElementById("cursor");
  const ringEl = document.getElementById("cursorRing");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine && dot && ringEl && !prefersReduced) {
    const pos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    window.addEventListener("pointermove", (e) => {
      pos.x = e.clientX; pos.y = e.clientY;
    }, { passive: true });
    gsap.ticker.add(() => {
      ringPos.x += (pos.x - ringPos.x) * 0.16;
      ringPos.y += (pos.y - ringPos.y) * 0.16;
      dot.style.transform = `translate(${pos.x}px, ${pos.y}px) translate(-50%,-50%)`;
      ringEl.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px) translate(-50%,-50%)`;
    });
    document.querySelectorAll("a, button, .course-card").forEach((el) => {
      el.addEventListener("pointerenter", () => ringEl.classList.add("is-hover"));
      el.addEventListener("pointerleave", () => ringEl.classList.remove("is-hover"));
    });
  }

  /* magnetic buttons */
  if (fine && !prefersReduced) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const strength = 0.32;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.4, ease: "power3.out" });
      });
      el.addEventListener("pointerleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)" });
      });
    });
  }
})();
