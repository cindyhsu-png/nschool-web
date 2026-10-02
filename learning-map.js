// 學習地圖頁：分頁切換 ＋ 訓練循環 iframe 的高度貼合
(function () {
  "use strict";

  const tabs = [...document.querySelectorAll(".lm-tabs [role=tab]")];
  const panels = {
    map: document.getElementById("panel-map"),
    loop: document.getElementById("panel-loop"),
  };
  if (!tabs.length || !panels.map || !panels.loop) return;

  function show(name, push) {
    if (!panels[name]) return;
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panels).forEach(([k, p]) => {
      p.hidden = k !== name;
      p.classList.toggle("is-on", k === name);
    });
    if (name === "loop") fitFrame();
    // 用 hash 記住目前分頁，連結才分享得出去、重新整理也回得到同一頁
    if (push) history.replaceState(null, "", name === "map" ? location.pathname : "#loop");
  }

  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.tab, true)));

  // 左右方向鍵切換，照 tablist 的鍵盤慣例
  document.querySelector(".lm-tabs").addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    if (n === null) return;
    e.preventDefault();
    tabs[n].focus();
    show(tabs[n].dataset.tab, true);
  });

  // ---- 訓練循環 iframe：量內容高度貼合，避免出現內捲軸 ----
  const frame = document.getElementById("loopFrame");
  const loopBox = document.getElementById("loopBox");
  let fitTimer = null;

  function fitFrame() {
    if (!frame) return;
    let doc;
    try {
      doc = frame.contentDocument;
    } catch (e) {
      return; // 同源才量得到；量不到就讓 CSS 的預設高度頂著
    }
    if (!doc || !doc.body) return;
    if (loopBox && loopBox.classList.contains("is-full")) {
      frame.style.height = "100%";
      return;
    }
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    if (h > 100) frame.style.height = h + "px";
  }

  if (frame) {
    frame.addEventListener("load", () => {
      fitFrame();
      // 內容裡的字體、互動面板載入後高度會再變，補量幾次
      [120, 400, 1000].forEach((d) => setTimeout(fitFrame, d));
      try {
        // 點環節會換右側說明，高度可能跟著變
        const ro = new ResizeObserver(fitFrame);
        ro.observe(frame.contentDocument.body);
      } catch (e) {}
    });
    addEventListener("resize", () => {
      clearTimeout(fitTimer);
      fitTimer = setTimeout(fitFrame, 150);
    });
  }

  // ---- 放大檢視 ----
  // 嵌在 Kolable 裡時，上方導覽列加紅色公告大約吃掉 155px 的高度，
  // 這個環形圖又高，常常被切掉。優先用全螢幕；
  // 外層 iframe 沒給 allow="fullscreen" 時會被擋，就改開新分頁 ——
  // 新分頁完全跳出 Kolable 的框，一定看得到完整內容。
  const expandBtn = document.getElementById("loopExpand");
  if (expandBtn && loopBox) {
    expandBtn.addEventListener("click", () => {
      // 要同步決定。嵌在 Kolable 的 iframe 裡、外層沒給 allow="fullscreen" 時，
      // document.fullscreenEnabled 就是 false，這時直接開新分頁 ——
      // 若等 requestFullscreen 的 promise 被拒再開，那已經脫離使用者操作，
      // 會被當成彈出視窗擋掉。
      if (!document.fullscreenEnabled) {
        window.open("training-loop.html", "_blank", "noopener");
        return;
      }
      const req = loopBox.requestFullscreen || loopBox.webkitRequestFullscreen;
      if (!req) {
        window.open("training-loop.html", "_blank", "noopener");
        return;
      }
      try {
        Promise.resolve(req.call(loopBox)).catch(() => {});
      } catch (e) {}
      // 不要只靠 promise 被拒來判斷：實測有瀏覽器既不進全螢幕、也不 reject。
      // 直接看結果 —— 過一下還沒進去就換成整頁版（不用 window.open，
      // 那時已經脫離使用者操作會被彈出視窗擋掉）。
      setTimeout(() => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          location.href = "training-loop.html";
        }
      }, 700);
    });
    ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) =>
      document.addEventListener(ev, () => {
        const on = document.fullscreenElement === loopBox || document.webkitFullscreenElement === loopBox;
        loopBox.classList.toggle("is-full", on);
        setTimeout(fitFrame, 60);
      }));
  }

  show(location.hash === "#loop" ? "loop" : "map", false);
  addEventListener("hashchange", () => show(location.hash === "#loop" ? "loop" : "map", false));
})();
