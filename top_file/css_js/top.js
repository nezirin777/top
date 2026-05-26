document.addEventListener("DOMContentLoaded", init);

function init() {
  initLateNightMode();
  initFooterMessage();
  initNoticePanel();
  initUpdatePanel();
  initTheme();
  initHeroBanner();
}

async function initNoticePanel() {
  const el = document.getElementById("notice_content");
  if (!el) return;

  try {
    const res = await fetch("./top_file/notice.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      el.textContent = "お知らせはありません";
      return;
    }

    const items = data
      .filter((item) => item && typeof item === "object")
      .slice(0, 5);

    if (!items.length) {
      el.textContent = "お知らせはありません";
      return;
    }

    el.innerHTML = items.map((item) => {
      const date  = escapeHtml(item.date ?? "");
      const title = escapeHtml(item.title ?? "お知らせ");
      const body  = escapeHtml(item.body ?? "").replace(/\r?\n/g, "<br>");

      return `
        <article class="notice">
          <div class="notice-title">${date ? `${date} | ` : ""}${title}</div>
          <div class="notice-body">${body || "本文なし"}</div>
        </article>
      `;
    }).join("");
  } catch (e) {
    console.error("[notice] 取得失敗:", e);
    el.textContent = "お知らせの取得に失敗しました";
  }
}

async function initUpdatePanel() {
  const el = document.getElementById("update_content");
  if (!el) return;

  try {
    const res = await fetch("./top_file/update.cgi", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!data.monsters && !data.syounin) {
      el.textContent = "更新情報なし";
      return;
    }

    el.innerHTML = `
      <div class="update-row">
        <span class="update-label">MONSTAR'S</span>
        <span class="mono">${escapeHtml(data.monsters ?? "—")}</span>
      </div>
      <div class="update-row">
        <span class="update-label">商人物語</span>
        <span class="mono">${escapeHtml(data.syounin ?? "—")}</span>
      </div>
    `;
  } catch (e) {
    console.error("[update] 取得失敗:", e);
    el.textContent = "更新情報の取得に失敗しました";
  }
}

function initTheme() {
  const btn   = document.getElementById("themeToggle");
  const label = document.getElementById("themeLabel");
  if (!btn || !label) return;

  const themes       = ["retro", "cyber", "oldweb"];
  const defaultTheme = "retro";
  const saved        = localStorage.getItem("site_theme");
  const initialTheme = themes.includes(saved) ? saved : defaultTheme;

  applyTheme(initialTheme);

  btn.addEventListener("click", () => {
    const current      = document.body.dataset.theme;
    const currentIndex = themes.indexOf(current);
    const nextTheme    = themes[currentIndex >= 0 ? (currentIndex + 1) % themes.length : 0];

    applyTheme(nextTheme);
    localStorage.setItem("site_theme", nextTheme);

    if (window.updateHeroBanner) {
      window.updateHeroBanner(nextTheme);
    }
  });

  function applyTheme(theme) {
    const safeTheme = themes.includes(theme) ? theme : defaultTheme;
    document.body.dataset.theme = safeTheme;
    label.textContent = safeTheme.toUpperCase();
    btn.setAttribute("aria-pressed", String(safeTheme !== "retro"));
  }
}

// =========================
// バナーマニフェスト読み込み
// JSONが取得できない場合はフォールバック値を使用
// top_file/banner_manifest.json の形式:
// { "retro": { "folder": "retro", "count": 12 }, ... }
// =========================
const BANNER_FALLBACK = {
  retro:  { folder: "retro",  count: 12 },
  cyber:  { folder: "cyber",  count: 14 },
  oldweb: { folder: "retro",  count: 12 },
};

async function loadBannerManifest() {
  try {
    const res = await fetch("./top_file/banner_manifest.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("[banner] マニフェスト取得失敗、フォールバック使用:", e);
    return null;
  }
}

function buildBannerList(theme, manifest) {
  const entry    = manifest?.[theme] ?? BANNER_FALLBACK[theme] ?? BANNER_FALLBACK.retro;
  const { folder, count } = entry;
  return Array.from({ length: count }, (_, i) =>
    `./top_file/banner/${folder}/banner${i + 1}.jpg`
  );
}

async function initHeroBanner() {
  const img      = document.getElementById("hero-banner");
  const heroCard = document.querySelector(".hero-card");
  const btnPrev  = document.querySelector(".hero-nav-prev");
  const btnNext  = document.querySelector(".hero-nav-next");

  if (!img) return;

  const manifest = await loadBannerManifest();

  let currentList  = [];
  let currentIndex = 0;
  let autoTimer    = null;

  const AUTO_ROTATE_MS = 15000;
  const FADE_MS        = 220;
  const reducedMotion  = window.matchMedia("(prefers-reduced-motion: reduce)");

  function stopAutoRotate() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startAutoRotate() {
    if (reducedMotion.matches || !currentList.length) return;
    stopAutoRotate();
    autoTimer = window.setInterval(() => step(1), AUTO_ROTATE_MS);
  }

  function fadeBanner() {
    img.classList.add("is-changing");
    window.setTimeout(() => img.classList.remove("is-changing"), FADE_MS);
  }

  function setBanner(src) {
    if (!src) return;

    let settled = false;

    const pre      = new Image();
    pre.decoding   = "async";
    pre.loading    = "eager";

    pre.onload = () => {
      if (settled) return;
      settled  = true;
      fadeBanner();
      img.src  = src;
    };

    pre.src = src;

    if (pre.complete && pre.naturalWidth > 0) {
      settled  = true;
      fadeBanner();
      img.src  = src;
    }
  }

  function step(delta) {
    if (!currentList.length) return;
    currentIndex = (currentIndex + delta + currentList.length) % currentList.length;
    setBanner(currentList[currentIndex]);
  }

  function updateHeroBanner(theme, options = {}) {
    const randomize = options.randomize !== false;
    const list      = buildBannerList(theme, manifest);
    if (!list.length) return;

    currentList = list;

    if (randomize) {
      currentIndex = Math.floor(Math.random() * currentList.length);
    } else if (currentIndex >= currentList.length) {
      currentIndex = 0;
    }

    setBanner(currentList[currentIndex]);
    startAutoRotate();
  }

  window.updateHeroBanner = (theme) => updateHeroBanner(theme, { randomize: true });

  updateHeroBanner(document.body.dataset.theme || "retro");

  btnPrev?.addEventListener("click", () => { step(-1); startAutoRotate(); });
  btnNext?.addEventListener("click", () => { step(1);  startAutoRotate(); });

  heroCard?.addEventListener("mouseenter", stopAutoRotate);
  heroCard?.addEventListener("mouseleave", startAutoRotate);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAutoRotate();
    } else {
      startAutoRotate();
    }
  });

  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      stopAutoRotate();
    } else {
      startAutoRotate();
    }
  });
}

function initLateNightMode() {
  const hour = new Date().getHours();
  document.body.classList.toggle("late-night", hour >= 0 && hour < 5);
}

function initFooterMessage() {
  const footerSmall = document.querySelector(".footer-small");
  if (!footerSmall) return;

  const footerLines = [
    "CGI / Perl / Python / だいたいノリで動いてる",
    "古き良きCGI魂で運営中",
    "だいたい動く、たぶん動く",
    "今日もどこかでPerlが鳴いている",
    "レトロだけど一応現役",
    "昔ながらの空気でのんびり稼働中",
    "手作業とノリと気合いでできています",
  ];

  footerSmall.textContent =
    footerLines[Math.floor(Math.random() * footerLines.length)];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
    }
  });
}
