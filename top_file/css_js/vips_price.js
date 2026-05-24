(() => {
  "use strict";

  const API_URL = "./top_file/vips_price_api.py";
  const THEMES = ["retro", "cyber", "oldweb"];
  const DEFAULT_THEME = "retro";
  const THEME_STORAGE_KEY = "site_theme";

  let VIPS_JPY = 0;
  let VIPS_USD = 0;

  const statusEl = document.getElementById("status");
  const priceAreaEl = document.getElementById("priceArea");

  const vipsUsdTextEl = document.getElementById("vipsUsdText");
  const vipsJpyTextEl = document.getElementById("vipsJpyText");
  const vips10kUsdTextEl = document.getElementById("vips10kUsdText");
  const vips10kJpyTextEl = document.getElementById("vips10kJpyText");
  const vips1mUsdTextEl = document.getElementById("vips1mUsdText");
  const vips1mJpyTextEl = document.getElementById("vips1mJpyText");
  const dexLinkEl = document.getElementById("dexLink");

  const mintTextEl = document.getElementById("mintText");
  const providerTextEl = document.getElementById("providerText");
  const dexTextEl = document.getElementById("dexText");
  const liquidityTextEl = document.getElementById("liquidityText");

  const vipsInputEl = document.getElementById("vipsInput");
  const jpyInputEl = document.getElementById("jpyInput");
  const jpyResultEl = document.getElementById("jpyResult");
  const vipsResultEl = document.getElementById("vipsResult");

  const clearVipsBtnEl = document.getElementById("clearVipsBtn");
  const clearJpyBtnEl = document.getElementById("clearJpyBtn");
  const reloadBtnEl = document.getElementById("reloadBtn");

  const themeToggleBtnEl = document.getElementById("themeToggle");
  const themeLabelEl = document.getElementById("themeLabel");

  function parseNum(value) {
    const cleaned = String(value).replace(/,/g, "").trim();
    if (cleaned === "") return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
  }

  function formatFloor(num) {
    return Math.floor(num).toLocaleString("ja-JP");
  }

  function formatFixed(num, digits) {
    return Number(num).toLocaleString("ja-JP", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function formatMaybeNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num.toLocaleString("ja-JP") : "-";
  }

  function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? "status-line error" : "status-line";
  }

  function updateFromVips() {
    const vips = parseNum(vipsInputEl.value);
    const jpy = Math.floor(vips * VIPS_JPY);
    jpyResultEl.textContent = formatFloor(jpy);
  }

  function updateFromJpy() {
    const jpy = parseNum(jpyInputEl.value);
    const vips = VIPS_JPY > 0 ? Math.floor(jpy / VIPS_JPY) : 0;
    vipsResultEl.textContent = formatFloor(vips);
  }

  function clearVips() {
    vipsInputEl.value = "";
    jpyResultEl.textContent = "0";
  }

  function clearJpy() {
    jpyInputEl.value = "";
    vipsResultEl.textContent = "0";
  }

  function updateStaticPriceView() {
    vipsUsdTextEl.textContent = formatFixed(VIPS_USD, 8);
    vipsJpyTextEl.textContent = formatFixed(VIPS_JPY, 6);

    vips10kUsdTextEl.textContent = formatFixed(VIPS_USD * 10000, 4);
    vips10kJpyTextEl.textContent = formatFixed(VIPS_JPY * 10000, 4);

    vips1mUsdTextEl.textContent = formatFixed(VIPS_USD * 1000000, 4);
    vips1mJpyTextEl.textContent = formatFixed(VIPS_JPY * 1000000, 4);
  }

  function updateMeta(data) {
    mintTextEl.textContent = data.token?.mint || "-";
    providerTextEl.textContent = data.source?.provider || "-";
    dexTextEl.textContent = data.source?.dex_id || "-";
    liquidityTextEl.textContent = data.source?.liquidity_usd
      ? formatMaybeNumber(data.source.liquidity_usd)
      : "-";
  }

  function updateSourceLink(data) {
    dexLinkEl.href = data.source?.url || "#";
  }

  async function loadPrice() {
    setStatus("価格取得中...");
    priceAreaEl.style.display = "none";

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || "価格取得失敗");
      }

      VIPS_USD = Number(data.price?.vips_usd);
      VIPS_JPY = Number(data.price?.vips_jpy);

      if (!Number.isFinite(VIPS_USD) || !Number.isFinite(VIPS_JPY) || VIPS_JPY <= 0) {
        throw new Error("不正な価格データ");
      }

      updateStaticPriceView();
      updateMeta(data);
      updateSourceLink(data);
      updateFromVips();
      updateFromJpy();

      setStatus("価格取得完了");
      priceAreaEl.style.display = "";
    } catch (error) {
      setStatus("価格取得に失敗しました: " + error.message, true);
    }
  }

  function applyTheme(theme) {
    const nextTheme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
    document.body.dataset.theme = nextTheme;

    if (themeLabelEl) {
      themeLabelEl.textContent = nextTheme.toUpperCase();
    }

    if (themeToggleBtnEl) {
      themeToggleBtnEl.setAttribute("aria-pressed", String(nextTheme !== DEFAULT_THEME));
    }
  }

  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    applyTheme(savedTheme || DEFAULT_THEME);

    if (!themeToggleBtnEl) return;

    themeToggleBtnEl.addEventListener("click", () => {
      const currentTheme = document.body.dataset.theme || DEFAULT_THEME;
      const currentIndex = THEMES.indexOf(currentTheme);
      const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];

      applyTheme(nextTheme);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    });
  }

  function bindEvents() {
    vipsInputEl?.addEventListener("input", updateFromVips);
    jpyInputEl?.addEventListener("input", updateFromJpy);

    clearVipsBtnEl?.addEventListener("click", clearVips);
    clearJpyBtnEl?.addEventListener("click", clearJpy);
    reloadBtnEl?.addEventListener("click", loadPrice);
  }

  initTheme();
  bindEvents();
  loadPrice();
})();
