const API = "https://api.hyperliquid.xyz/info";
const WS_URL = "wss://api.hyperliquid.xyz/ws";
const EXPLORER_URL = "https://app.hyperliquid.xyz/explorer/tx/";
const $ = id => document.getElementById(id);

const walletEl = $("wallet"),
      startEl = $("startDate"),
      endEl = $("endDate"),
      fetchBtn = $("fetchBtn"),
      statusEl = $("status"),
      noticeEl = $("limitNotice"),
      bodyEl = $("tradeBody"),
      contractsBodyEl = $("contractsBody"),
      dailyBodyEl = $("dailyBody"),
      monthlyBodyEl = $("monthlyBody"),
      depositsBodyEl = $("depositsBody"),
      openOrdersBodyEl = $("openOrdersBody"),
      tableMeta = $("tableMeta"),
      contractsMeta = $("contractsMeta"),
      dailyMeta = $("dailyMeta"),
      monthlyMeta = $("monthlyMeta"),
      depositsMeta = $("depositsMeta"),
      openOrdersMeta = $("openOrdersMeta"),
      csvBtn = $("csvBtn"),
      jsonBtn = $("jsonBtn"),
      pdfBtn = $("pdfBtn"),
      allInceptionBtn = $("allInceptionBtn"),
      monthBtn = $("monthBtn"),
      ytdBtn = $("ytdBtn"),
      todayBtn = $("todayBtn"),
      pnlFilterSelect = $("pnlFilterSelect"),
      coinFilterSelect = $("coinFilterSelect"),
      themeToggleBtn = $("themeToggleBtn"),
      themeIcon = $("themeIcon"),
      themeLabel = $("themeLabel"),
      viewSelect = $("viewSelect"),
      panelTrades = $("panelTrades"),
      panelContracts = $("panelContracts"),
      panelDaily = $("panelDaily"),
      panelMonthly = $("panelMonthly"),
      panelPerformance = $("panelPerformance"),
      panelDepositsWithdrawals = $("panelDepositsWithdrawals"),
      panelFeeCalculator = $("panelFeeCalculator"),
      panelMultiWallet = $("panelMultiWallet"),
      panelShareCard = $("panelShareCard"),
      panelOpenOrders = $("panelOpenOrders"),
      panelWalletDetails = $("panelWalletDetails"),
      prevPageBtn = $("prevPageBtn"),
      nextPageBtn = $("nextPageBtn"),
      pageIndicator = $("pageIndicator"),
      paginationContainer = $("paginationContainer"),
      controlsPanel = $("controlsPanel"),
      unhideBtn = $("unhideBtn");

// Modal Elements
const fillsCard = $("fillsCard"), fillsModal = $("fillsModal"), closeFillsModal = $("closeFillsModal");
const netPnlCard = $("netPnlCard"), netPnlModal = $("netPnlModal"), closeNetModal = $("closeNetModal");
const closedPnlCard = $("closedPnlCard"), closedPnlModal = $("closedPnlModal"), closeClosedModal = $("closeClosedModal");
const feeCard = $("feeCard"), feeModal = $("feeModal"), closeModalBtn = $("closeModalBtn");
const winRateCard = $("winRateCard"), winRateModal = $("winRateModal"), closeWinModal = $("closeWinModal");
const holdingsCard = $("holdingsCard"), holdingsModal = $("holdingsModal"), closeHoldingsModal = $("closeHoldingsModal");

fillsCard?.addEventListener("click", () => fillsModal.classList.remove("hidden"));
closeFillsModal?.addEventListener("click", () => fillsModal.classList.add("hidden"));

netPnlCard?.addEventListener("click", () => netPnlModal.classList.remove("hidden"));
closeNetModal?.addEventListener("click", () => netPnlModal.classList.add("hidden"));

closedPnlCard?.addEventListener("click", () => closedPnlModal.classList.remove("hidden"));
closeClosedModal?.addEventListener("click", () => closedPnlModal.classList.add("hidden"));

feeCard?.addEventListener("click", () => feeModal.classList.remove("hidden"));
closeModalBtn?.addEventListener("click", () => feeModal.classList.add("hidden"));

winRateCard?.addEventListener("click", () => winRateModal.classList.remove("hidden"));
closeWinModal?.addEventListener("click", () => winRateModal.classList.add("hidden"));

holdingsCard?.addEventListener("click", () => holdingsModal.classList.remove("hidden"));
closeHoldingsModal?.addEventListener("click", () => holdingsModal.classList.add("hidden"));

window.addEventListener("click", e => { 
  if (e.target === feeModal) feeModal.classList.add("hidden");
  if (e.target === fillsModal) fillsModal.classList.add("hidden");
  if (e.target === netPnlModal) netPnlModal.classList.add("hidden");
  if (e.target === closedPnlModal) closedPnlModal.classList.add("hidden");
  if (e.target === winRateModal) winRateModal.classList.add("hidden");
  if (e.target === holdingsModal) holdingsModal.classList.add("hidden");
});

// Unhide controls button event listener with persistence
unhideBtn?.addEventListener("click", () => {
  controlsPanel.classList.remove("hidden");
  unhideBtn.classList.add("hidden");
  localStorage.setItem("hyperliquid_controls_hidden", "false");
});

let fills = [];
let fundingHistory = [];
let ledgerUpdates = [];
let openOrdersList = [];
let holdingsData = null;
let xyzHoldingsData = null;
let activePositions = [];
let livePrices = {};
let previousNumericValues = {}; 
let wsConnection = null;
let pollTimer = null;
let walletPieChartInstance = null;
let watchlist = [];
let currentPage = 1;
const rowsPerPage = 50;

const SAVED_WALLET_KEY = "hyperliquid_saved_wallet";
const SAVED_THEME_KEY = "hyperliquid_theme";
const SAVED_WATCHLIST_KEY = "hyperliquid_watchlist";
const SAVED_VIEW_KEY = "hyperliquid_selected_view";
const CACHE_FILLS_KEY = "hyperliquid_persisted_fills";
const CACHE_FUNDING_KEY = "hyperliquid_persisted_funding";
const CACHE_LEDGER_KEY = "hyperliquid_persisted_ledger";
const CACHE_ORDERS_KEY = "hyperliquid_persisted_orders";
const CACHE_HOLDINGS_KEY = "hyperliquid_persisted_holdings";
const CACHE_POSITIONS_KEY = "hyperliquid_persisted_positions";
const CACHE_TIME_KEY = "hyperliquid_cache_timestamp";

// Helper for masking addresses securely
function maskAddress(addr) {
  const clean = String(addr || "").trim();
  if (!clean || clean.length < 10) return clean;
  return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
}

let actualWalletValue = "";

if (localStorage.getItem(SAVED_WALLET_KEY)) {
  actualWalletValue = localStorage.getItem(SAVED_WALLET_KEY);
  walletEl.value = maskAddress(actualWalletValue);
}

walletEl.addEventListener("focus", () => {
  if (actualWalletValue) walletEl.value = actualWalletValue;
});

walletEl.addEventListener("blur", () => {
  if (actualWalletValue) walletEl.value = maskAddress(actualWalletValue);
});

walletEl.addEventListener("input", () => {
  actualWalletValue = walletEl.value.trim();
  localStorage.setItem(SAVED_WALLET_KEY, actualWalletValue);
});

// Copy wallet address button handler
const copyWalletBtn = $("copyWalletBtn");
if (copyWalletBtn) {
  copyWalletBtn.addEventListener("click", () => {
    const valToCopy = actualWalletValue || walletEl.value.trim();
    if (!valToCopy) return;
    navigator.clipboard.writeText(valToCopy).then(() => {
      const originalText = copyWalletBtn.textContent;
      copyWalletBtn.textContent = "Copied!";
      setTimeout(() => { copyWalletBtn.textContent = originalText; }, 1500);
    });
  });
}

const savedView = localStorage.getItem(SAVED_VIEW_KEY);
if (savedView && viewSelect.querySelector(`option[value="${savedView}"]`)) {
  viewSelect.value = savedView;
  switchView(savedView);
}

function loadWatchlist() {
  try {
    const saved = localStorage.getItem(SAVED_WATCHLIST_KEY);
    watchlist = saved ? JSON.parse(saved) : [];
  } catch (e) {
    watchlist = [];
  }
  renderWatchlistUI();
}

function renderWatchlistUI() {
  const container = $("watchlistContainer");
  if (!container) return;

  if (!watchlist.length) {
    container.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 20px;">No saved watchlisted wallets yet.</td></tr>';
    return;
  }

  container.innerHTML = watchlist.map((item, idx) => `
    <tr>
      <td style="font-weight: 700; color: var(--coinglass-green);">${esc(item.label)}</td>
      <td style="font-family: monospace; color: var(--text-muted);">${esc(maskAddress(item.address))}</td>
      <td style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
        <button class="secondary" style="height: 30px; padding: 0 10px; font-size: 11px;" onclick="loadWatchlistedWallet('${item.address}')">Load</button>
        <button class="btn-ghost" style="height: 30px; padding: 0 8px; color: var(--coinglass-red);" onclick="removeWatchlistItem(${idx})">✕</button>
      </td>
    </tr>
  `).join("");
}

window.loadWatchlistedWallet = function(addr) {
  actualWalletValue = addr;
  walletEl.value = maskAddress(addr);
  localStorage.setItem(SAVED_WALLET_KEY, addr);
  fetchBtn.click();
};

window.removeWatchlistItem = function(idx) {
  watchlist.splice(idx, 1);
  localStorage.setItem(SAVED_WATCHLIST_KEY, JSON.stringify(watchlist));
  renderWatchlistUI();
};

$("saveWalletBtn")?.addEventListener("click", () => {
  const label = $("watchLabelInput").value.trim() || "Account " + (watchlist.length + 1);
  const address = $("watchAddressInput").value.trim();

  if (!isAddress(address)) {
    alert("Please enter a valid 42-character EVM address beginning with 0x.");
    return;
  }

  watchlist.push({ label, address });
  localStorage.setItem(SAVED_WATCHLIST_KEY, JSON.stringify(watchlist));
  $("watchLabelInput").value = "";
  $("watchAddressInput").value = "";
  renderWatchlistUI();
});

loadWatchlist();

function switchView(viewKey) {
  const panels = {
    contracts: panelContracts,
    trades: panelTrades,
    daily: panelDaily,
    monthly: panelMonthly,
    performanceAnalytics: panelPerformance,
    walletDetails: panelWalletDetails,
    depositsWithdrawals: panelDepositsWithdrawals,
    feeCalculator: panelFeeCalculator,
    multiWallet: panelMultiWallet,
    shareCard: panelShareCard,
    openOrders: panelOpenOrders
  };

  Object.values(panels).forEach(p => p && p.classList.add("hidden"));
  if (panels[viewKey]) {
    panels[viewKey].classList.remove("hidden");
  }

  if (viewKey === "contracts") renderContracts();
  if (viewKey === "trades") renderTrades();
  if (viewKey === "daily") renderDailyPnl();
  if (viewKey === "monthly") renderMonthlyPnl();
  if (viewKey === "performanceAnalytics") renderQuantMetrics();
  if (viewKey === "walletDetails") {
    renderWalletDetails();
    if (walletPieChartInstance) walletPieChartInstance.resize();
  }
  if (viewKey === "depositsWithdrawals") renderDepositsWithdrawals();
  if (viewKey === "feeCalculator") renderFeeCalculator();
  if (viewKey === "shareCard") renderShareCardPreview();
  if (viewKey === "openOrders") renderOpenOrders();
}

viewSelect.addEventListener("change", (e) => {
  const selectedView = e.target.value;
  localStorage.setItem(SAVED_VIEW_KEY, selectedView);
  switchView(selectedView);
});

function mapSide(side) {
  if (!side) return "";
  const s = String(side).toUpperCase();
  if (s === "B") return "Buy";
  if (s === "A") return "Sell";
  return side;
}

function initTheme() {
  const currentTheme = localStorage.getItem(SAVED_THEME_KEY) || "dark";
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
    themeIcon.textContent = "🌙";
    themeLabel.textContent = "Dark Mode";
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
    themeIcon.textContent = "☀️";
    themeLabel.textContent = "Light Mode";
  }
  localStorage.setItem(SAVED_THEME_KEY, theme);
  if (walletPieChartInstance) renderWalletPieChart(walletPieChartInstance.data.datasets[0].data);
}

themeToggleBtn.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-theme");
  applyTheme(isLight ? "dark" : "light");
});

initTheme();

function formatDateInput(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function setInceptionPreset() {
  const wallet = actualWalletValue || walletEl.value.trim();
  [allInceptionBtn, monthBtn, ytdBtn, todayBtn].forEach(b => b && b.classList.remove("active"));
  allInceptionBtn.classList.add("active");

  const today = new Date();
  endEl.value = formatDateInput(today);
  const depEnd = $("depositEndDate");
  if (depEnd) depEnd.value = formatDateInput(today);

  if (!isAddress(wallet)) {
    const defaultStart = new Date();
    defaultStart.setFullYear(defaultStart.getFullYear() - 1);
    startEl.value = formatDateInput(defaultStart);
    const depStart = $("depositStartDate");
    if (depStart) depStart.value = formatDateInput(defaultStart);
    return;
  }

  try {
    setStatus("Detecting wallet inception date...");
    const res = await postInfo({
      type: "userFillsByTime",
      user: wallet.toLowerCase(),
      startTime: 0,
      endTime: Date.now(),
      aggregateByTime: false
    });

    let minTime = Date.now();
    if (Array.isArray(res) && res.length > 0) {
      res.forEach(f => {
        const t = Number(f.time);
        if (t > 0 && t < minTime) minTime = t;
      });
    }

    try {
      const ledgerRes = await postInfo({
        type: "userNonFundingLedgerUpdates",
        user: wallet.toLowerCase(),
        startTime: 0,
        endTime: Date.now()
      });
      if (Array.isArray(ledgerRes) && ledgerRes.length > 0) {
        ledgerRes.forEach(item => {
          const t = Number(item.time || item.delta?.time || 0);
          if (t > 0 && t < minTime) minTime = t;
        });
      }
    } catch (e) {
      console.warn("Ledger inception check warning:", e);
    }

    const inceptionStr = formatDateInput(new Date(minTime === Date.now() ? Date.now() - 90*86400000 : minTime));
    startEl.value = inceptionStr;
    const depStart = $("depositStartDate");
    if (depStart) depStart.value = inceptionStr;

    setStatus(`Detected wallet initial transaction/inception date: ${new Date(minTime === Date.now() ? Date.now() - 90*86400000 : minTime).toLocaleDateString()}`, "success");
  } catch (e) {
    console.warn("Could not fetch inception date:", e);
    const defaultStart = new Date();
    defaultStart.setFullYear(defaultStart.getFullYear() - 1);
    startEl.value = formatDateInput(defaultStart);
    const depStart = $("depositStartDate");
    if (depStart) depStart.value = formatDateInput(defaultStart);
    clearStatus();
  }
}

function setPreset(k) {
  const n = new Date();
  const e = new Date(n);
  let s = new Date(n);

  [allInceptionBtn, monthBtn, ytdBtn, todayBtn, $("zoom7dBtn"), $("zoom30dBtn"), $("zoom90dBtn"), $("zoomYtdBtn"), $("zoomAllBtn")].forEach(b => b && b.classList.remove("active"));

  if (k === "today") {
    s = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    if (todayBtn) todayBtn.classList.add("active");
  } else if (k === "month" || k === "30d") {
    s = new Date(n.getTime() - 30 * 86400000);
    if (monthBtn) monthBtn.classList.add("active");
    if ($("zoom30dBtn")) $("zoom30dBtn").classList.add("active");
  } else if (k === "7d") {
    s = new Date(n.getTime() - 7 * 86400000);
    if ($("zoom7dBtn")) $("zoom7dBtn").classList.add("active");
  } else if (k === "90d") {
    s = new Date(n.getTime() - 90 * 86400000);
    if ($("zoom90dBtn")) $("zoom90dBtn").classList.add("active");
  } else if (k === "ytd") {
    s = new Date(n.getFullYear(), 0, 1);
    if (ytdBtn) ytdBtn.classList.add("active");
    if ($("zoomYtdBtn")) $("zoomYtdBtn").classList.add("active");
  } else {
    setInceptionPreset();
    if ($("zoomAllBtn")) $("zoomAllBtn").classList.add("active");
    return;
  }

  startEl.value = formatDateInput(s);
  endEl.value = formatDateInput(e);
  renderTrades();
}

setInceptionPreset();

function setStatus(m, t = "") {
  statusEl.textContent = m;
  statusEl.className = "status" + (t ? " " + t : "");
  statusEl.classList.remove("hidden");
}

function clearStatus() {
  statusEl.className = "status hidden";
  statusEl.textContent = "";
}

function isAddress(v) { return /^0x[a-fA-F0-9]{40}$/.test(String(v).trim()); }
function msStart(v) { return new Date(v + "T00:00:00").getTime(); }
function msEnd(v) { return new Date(v + "T23:59:59.999").getTime(); }

async function postInfo(body) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Hyperliquid API status: ${r.status}`);
  return r.json();
}

async function fetchActiveContractsOnly(cleanUser) {
  try {
    const [defaultData, xyzData] = await Promise.all([
      postInfo({ type: "clearinghouseState", user: cleanUser }).catch(() => null),
      postInfo({ type: "clearinghouseState", user: cleanUser, dex: "xyz" }).catch(() => null)
    ]);
    
    if (defaultData) holdingsData = defaultData;
    if (xyzData) xyzHoldingsData = xyzData;

    const rawAssetPositions = [
      ...(defaultData?.assetPositions || []),
      ...(xyzData?.assetPositions || [])
    ];
    return rawAssetPositions.filter(item => num(item.position?.szi) !== 0);
  } catch (e) {
    console.warn("Fast contracts poll error:", e);
    return null;
  }
}

function startFiveSecondPoller(cleanUser) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!cleanUser || !isAddress(cleanUser)) return;
    const freshPositions = await fetchActiveContractsOnly(cleanUser);
    if (freshPositions !== null) {
      activePositions = freshPositions;
      localStorage.setItem(CACHE_POSITIONS_KEY, JSON.stringify(activePositions));
      renderContracts();
      updateMetrics();
      renderWalletDetails();
    }
  }, 5000);
}

async function fetchAccountData(user, startMs, endMs) {
  const cleanUser = user.toLowerCase().trim();
  
  const fillsPromise = (async () => {
    const out = [], seen = new Set(), week = 7 * 86400000;
    let ws = startMs, limited = false;

    while (ws <= endMs) {
      const we = Math.min(ws + week - 1, endMs);
      let cursor = ws, pages = 0;

      while (cursor <= we) {
        const data = await postInfo({
          type: "userFillsByTime",
          user: cleanUser,
          startTime: cursor,
          endTime: we,
          aggregateByTime: false
        });

        if (!Array.isArray(data)) throw new Error("Invalid fills response format.");

        for (const f of data) {
          const key = [f.tid ?? "", f.hash ?? "", f.oid ?? "", f.time ?? "", f.coin ?? "", f.px ?? "", f.sz ?? ""].join("|");
          if (!seen.has(key)) {
            seen.add(key);
            out.push(f);
          }
        }

        pages++;
        if (data.length < 2000) break;
        const lt = Number(data.at(-1)?.time);
        if (!Number.isFinite(lt) || lt < cursor) break;
        cursor = lt + 1;
        if (pages >= 10) { limited = true; break; }
      }
      if (limited) break;
      ws = we + 1;
    }
    out.sort((a, b) => Number(b.time) - Number(a.time));
    return { result: out, reachedGlobalLimit: limited };
  })();

  const fundingPromise = (async () => {
    try {
      const fundingData = await postInfo({
        type: "userFunding",
        user: cleanUser,
        startTime: startMs,
        endTime: endMs
      });
      if (Array.isArray(fundingData)) return fundingData;
    } catch (e) {
      console.warn("Funding history fetch warning:", e);
    }
    return [];
  })();

  const ledgerPromise = (async () => {
    try {
      const ledgerData = await postInfo({
        type: "userNonFundingLedgerUpdates",
        user: cleanUser,
        startTime: 0,
        endTime: Date.now()
      });
      if (Array.isArray(ledgerData)) return ledgerData;
    } catch (e) {
      console.warn("Ledger updates fetch warning:", e);
    }
    return [];
  })();

  const ordersPromise = (async () => {
    try {
      const ordersData = await postInfo({
        type: "openOrders",
        user: cleanUser
      });
      if (Array.isArray(ordersData)) return ordersData;
    } catch (e) {
      console.warn("Open orders fetch warning:", e);
    }
    return [];
  })();

  const holdingsPromise = (async () => {
    try {
      const [defaultData, xyzData] = await Promise.all([
        postInfo({ type: "clearinghouseState", user: cleanUser }),
        postInfo({ type: "clearinghouseState", user: cleanUser, dex: "xyz" }).catch(() => null)
      ]);
      return { defaultData, xyzData };
    } catch (e) {
      console.warn("Clearinghouse state fetch warning:", e);
      return null;
    }
  })();

  const [fillsRes, fundingRes, ledgerRes, ordersRes, holdingsRes] = await Promise.all([
    fillsPromise, fundingPromise, ledgerPromise, ordersPromise, holdingsPromise
  ]);

  holdingsData = holdingsRes?.defaultData || null;
  xyzHoldingsData = holdingsRes?.xyzData || null;

  const rawAssetPositions = [
    ...(holdingsRes?.defaultData?.assetPositions || []),
    ...(holdingsRes?.xyzData?.assetPositions || [])
  ];

  return {
    fills: fillsRes.result,
    funding: fundingRes,
    ledger: ledgerRes,
    orders: ordersRes,
    holdings: holdingsRes?.defaultData || null,
    positions: rawAssetPositions.filter(item => num(item.position?.szi) !== 0),
    reachedGlobalLimit: fillsRes.reachedGlobalLimit
  };
}

function num(v) { 
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).trim()); 
  return Number.isFinite(n) ? n : 0; 
}

function money(v, d = 2) {
  const n = num(v), s = n > 0 ? "+" : n < 0 ? "−" : "";
  return s + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function plainMoney(v, d = 2) {
  return "$" + num(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function formatDate(ms) {
  return new Date(Number(ms)).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function initWebSocket(coins) {
  if (wsConnection) wsConnection.close();
  if (!coins || coins.length === 0) return;

  wsConnection = new WebSocket(WS_URL);

  wsConnection.onopen = () => {
    wsConnection.send(JSON.stringify({
      method: "subscribe",
      subscription: { type: "allMids" }
    }));
  };

  wsConnection.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.channel === "allMids" && msg.data?.mids) {
        livePrices = msg.data.mids;
        if (!panelContracts.classList.contains("hidden")) {
          renderContracts();
        }
        updateMetrics();
        renderWalletDetails();
      }
    } catch (e) {
      console.error("WS message parse error:", e);
    }
  };

  wsConnection.onclose = () => {
    setTimeout(() => {
      if (coins.length > 0) initWebSocket(coins);
    }, 5000);
  };
}

function animateNumber(elementId, targetVal, isCurrency = true, decimals = 2, isSigned = false) {
  const el = $(elementId);
  if (!el) return;

  const startVal = previousNumericValues[elementId] !== undefined ? previousNumericValues[elementId] : targetVal;
  previousNumericValues[elementId] = targetVal;

  if (startVal === targetVal) {
    el.textContent = isCurrency ? (isSigned ? money(targetVal, decimals) : plainMoney(targetVal, decimals)) : targetVal.toLocaleString();
    return;
  }

  el.classList.remove("flash-green", "flash-red");
  if (targetVal > startVal) {
    el.classList.add("flash-green");
  } else if (targetVal < startVal) {
    el.classList.add("flash-red");
  }

  const duration = 1000; 
  const startTime = performance.now();

  function updateStep(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = startVal + (targetVal - startVal) * easeProgress;

    if (isCurrency) {
      if (isSigned) {
        el.textContent = money(currentVal, decimals);
      } else {
        el.textContent = plainMoney(currentVal, decimals);
      }
    } else {
      el.textContent = Math.round(currentVal).toLocaleString();
    }

    if (progress < 1) {
      requestAnimationFrame(updateStep);
    } else {
      previousNumericValues[elementId] = targetVal;
      setTimeout(() => el.classList.remove("flash-green", "flash-red"), 600);
    }
  }

  requestAnimationFrame(updateStep);
}

function setMetric(id, rawValue, s = null, isCurrency = true, decimals = 2, isSigned = false) {
  const e = $(id);
  if (!e) return;

  animateNumber(id, rawValue, isCurrency, decimals, isSigned);

  e.classList.remove("text-positive", "text-negative");
  if (s !== null) {
    if (s > 0) e.classList.add("text-positive");
    if (s < 0) e.classList.add("text-negative");
  } else if (isSigned) {
    if (rawValue > 0) e.classList.add("text-positive");
    if (rawValue < 0) e.classList.add("text-negative");
  }
}

function resetMetrics() {
  ["mFills", "mPnl", "mFees", "mNet", "mWinRate", "mWalletHoldings"].forEach(id => {
    const e = $(id);
    if (e) e.textContent = "—";
  });
  previousNumericValues = {};
  csvBtn.disabled = true;
  jsonBtn.disabled = true;
  pdfBtn.disabled = true;
  paginationContainer.classList.add("hidden");
}

function calculateTotalUnrealizedPnl() {
  if (!activePositions || activePositions.length === 0) return 0;
  let totalUnrealizedPnl = 0;

  activePositions.forEach(item => {
    const pos = item.position || item;
    if (!pos) return;
    const sizeNum = num(pos.szi);
    if (sizeNum === 0) return;

    const coin = pos.coin || "PERP";
    const entryPx = num(pos.entryPx);
    const currentMarkPx = num(livePrices[coin]) || (sizeNum !== 0 ? Math.abs(num(pos.positionValue) / sizeNum) : entryPx);
    const priceDiff = sizeNum > 0 ? (currentMarkPx - entryPx) : (entryPx - currentMarkPx);
    totalUnrealizedPnl += priceDiff * Math.abs(sizeNum);
  });

  return totalUnrealizedPnl;
}

function updateMetrics() {
  const targetFills = getFilteredFills();
  const closedPnl = targetFills.reduce((s, f) => s + num(f.closedPnl), 0);
  const tradingFees = targetFills.reduce((s, f) => s + num(f.fee), 0);
  const builderFees = targetFills.reduce((s, f) => s + num(f.builderFee), 0);
  
  let netFundingUsd = 0;
  let totalFundingPaid = 0;
  fundingHistory.forEach(item => {
    const usdPayment = num(item.delta?.usdc);
    netFundingUsd += usdPayment;
    if (usdPayment < 0) totalFundingPaid += Math.abs(usdPayment);
  });

  const totalFees = tradingFees + totalFundingPaid + builderFees;
  const currentUnrealizedPnl = calculateTotalUnrealizedPnl();
  const netPnl = closedPnl - tradingFees - builderFees + netFundingUsd + currentUnrealizedPnl;

  const tradesWithPnl = targetFills.filter(f => num(f.closedPnl) !== 0);
  const winningTrades = tradesWithPnl.filter(f => num(f.closedPnl) > 0);
  const winRate = tradesWithPnl.length > 0 ? (winningTrades.length / tradesWithPnl.length) * 100 : 0;

  let totalAccountVal = 0;
  let perpAccountVal = 0, withdrawableVal = 0, spotVal = 0;

  if (holdingsData) {
    const margin = holdingsData.marginSummary || {};
    perpAccountVal = num(margin.accountValue);
    withdrawableVal = num(holdingsData.withdrawable);
    totalAccountVal += Math.max(perpAccountVal, withdrawableVal);

    if (Array.isArray(holdingsData.balances)) {
      holdingsData.balances.forEach(b => {
        spotVal += num(b.total) * (num(livePrices[b.coin]) || 1);
      });
      totalAccountVal += spotVal;
    }
  }

  if (xyzHoldingsData) {
    const xyzMargin = xyzHoldingsData.marginSummary || {};
    totalAccountVal += num(xyzMargin.accountValue);
  }

  const totalVol = targetFills.reduce((s, f) => s + Math.abs(num(f.px) * num(f.sz)), 0);
  $("modalTotalFills").textContent = targetFills.length.toLocaleString();
  $("modalTotalVol").textContent = plainMoney(totalVol, 2);

  $("netModalClosed").textContent = money(closedPnl, 2);
  $("netModalUnrealized").textContent = money(currentUnrealizedPnl, 2);
  $("netModalFunding").textContent = money(netFundingUsd, 2);
  $("netModalFees").textContent = plainMoney(totalFees, 2);
  $("netModalTotal").textContent = money(netPnl, 2);

  const winningTradesList = tradesWithPnl.filter(f => num(f.closedPnl) > 0);
  const losingTradesList = tradesWithPnl.filter(f => num(f.closedPnl) < 0);
  const evenTradesList = tradesWithPnl.filter(f => num(f.closedPnl) === 0);
  
  const grossProfit = winningTradesList.reduce((s, f) => s + num(f.closedPnl), 0);
  const grossLoss = losingTradesList.reduce((s, f) => s + num(f.closedPnl), 0);

  $("modalGrossProfit").textContent = money(grossProfit, 2);
  $("modalGrossLoss").textContent = money(grossLoss, 2);
  $("modalNetClosedPnl").textContent = money(closedPnl, 2);

  $("modalTradingFee").textContent = plainMoney(tradingFees, 4);
  $("modalFundingFee").textContent = plainMoney(totalFundingPaid, 4);
  $("modalBuilderFee").textContent = plainMoney(builderFees, 4);
  $("modalTotalFee").textContent = plainMoney(totalFees, 4);

  $("modalWinningFills").textContent = winningTradesList.length.toLocaleString();
  $("modalLosingFills").textContent = losingTradesList.length.toLocaleString();
  $("modalEvenFills").textContent = evenTradesList.length.toLocaleString();
  $("modalWinRateVal").textContent = winRate.toFixed(1) + "%";

  $("modalPerpValue").textContent = plainMoney(perpAccountVal, 2);
  $("modalWithdrawable").textContent = plainMoney(withdrawableVal, 2);
  $("modalSpotValue").textContent = plainMoney(spotVal, 2);
  $("modalTotalHoldings").textContent = plainMoney(totalAccountVal, 2);

  setMetric("mFills", targetFills.length, null, false, 0, false);
  setMetric("mPnl", closedPnl, closedPnl, true, 2, true);
  setMetric("mFees", totalFees, null, true, 2, false);
  setMetric("mNet", netPnl, netPnl, true, 2, true);
  setMetric("mWinRate", winRate, winRate > 50 ? 1 : winRate < 50 ? -1 : 0, false, 1, false);
  setMetric("mWalletHoldings", totalAccountVal, null, true, 2, false);

  const holdingsValEl = $("mWalletHoldings");
  if (holdingsValEl) {
    holdingsValEl.style.color = "var(--coinglass-purple)";
  }
}

function updateCoinFilterOptions() {
  const coins = [...new Set(fills.map(f => f.coin))].sort();
  const currentVal = coinFilterSelect.value;
  coinFilterSelect.innerHTML = '<option value="all">All Coins</option>' + coins.map(c => `<option value="${c}">${c}</option>`).join("");
  if (coins.includes(currentVal)) coinFilterSelect.value = currentVal;
}

function getFilteredFills() {
  const pnlVal = pnlFilterSelect.value;
  const coinVal = coinFilterSelect.value;

  return fills.filter(f => {
    const pnl = num(f.closedPnl);
    if (pnlVal === "positive" && pnl <= 0) return false;
    if (pnlVal === "negative" && pnl >= 0) return false;
    if (pnlVal === "nonzero" && pnl === 0) return false;
    if (coinVal !== "all" && f.coin !== coinVal) return false;
    return true;
  });
}

function renderContracts() {
  if (!activePositions || activePositions.length === 0) {
    contractsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="10">No open perpetual positions currently active.</td></tr>';
    contractsMeta.textContent = "0 active derivative contracts | Total Unrealized P&L: $0.00";
    return;
  }

  const rows = [];
  let count = 0;
  let totalUnrealizedPnl = 0;

  activePositions.forEach((item, index) => {
    const pos = item.position || item;
    if (!pos) return;

    const sizeNum = num(pos.szi);
    if (sizeNum === 0) return;

    count++;
    const coin = pos.coin || "PERP";
    const entryPx = num(pos.entryPx);
    const positionValue = num(pos.positionValue) || Math.abs(sizeNum * entryPx);
    const marginUsed = num(pos.marginUsed) || (positionValue / num(pos.leverage?.value || 1));
    
    const currentMarkPx = num(livePrices[coin]) || (sizeNum !== 0 ? Math.abs(positionValue / sizeNum) : entryPx);
    const priceDiff = sizeNum > 0 ? (currentMarkPx - entryPx) : (entryPx - currentMarkPx);
    const liveUnPnl = priceDiff * Math.abs(sizeNum);

    totalUnrealizedPnl += liveUnPnl;

    const levObj = pos.leverage;
    const levValue = levObj && levObj.value ? levObj.value : 1;
    const leverageText = ` (${levValue}x)`;
    const dirLabel = sizeNum > 0 ? `LONG${leverageText}` : `SHORT${leverageText}`;

    let estLiqPx = num(pos.liquidationPx || pos.liqPx);
    if (!estLiqPx || estLiqPx <= 0) {
      if (sizeNum > 0) {
        estLiqPx = entryPx - (marginUsed / Math.abs(sizeNum)) * 0.95;
      } else {
        estLiqPx = entryPx + (marginUsed / Math.abs(sizeNum)) * 0.95;
      }
      estLiqPx = Math.max(0, estLiqPx);
    }

    const distancePercent = Math.abs((currentMarkPx - estLiqPx) / currentMarkPx) * 100;
    let riskColor = "text-positive";
    let riskLabel = "Safe";
    if (distancePercent < 5) {
      riskColor = "text-negative";
      riskLabel = "Critical";
    } else if (distancePercent < 15) {
      riskColor = "";
      riskLabel = "Moderate";
    }

    const proximityHtml = `<span class="${riskColor}" style="font-weight: 700;">${distancePercent.toFixed(1)}% (${riskLabel})</span>`;

    const cumFundingObj = pos.cumFunding || {};
    const rawCumFunding = num(cumFundingObj.sinceOpen !== undefined ? cumFundingObj.sinceOpen : (cumFundingObj.allTime || 0));
    const positionFunding = -rawCumFunding; 
    const fundingClass = positionFunding > 0 ? "text-positive" : positionFunding < 0 ? "text-negative" : "";

    const unPnlId = `contract-unpnl-${coin}-${index}`;
    const pnlClass = liveUnPnl > 0 ? "text-positive" : liveUnPnl < 0 ? "text-negative" : "";

    rows.push(`
      <tr>
        <td style="text-align: left; font-weight: 800;" class="coin-name">${esc(coin)}</td>
        <td class="${sizeNum > 0 ? "text-positive" : "text-negative"}">${dirLabel}</td>
        <td>${Math.abs(sizeNum).toLocaleString()}</td>
        <td>${plainMoney(positionValue, 2)}</td>
        <td>${plainMoney(marginUsed, 2)}</td>
        <td>${plainMoney(entryPx, 4)}</td>
        <td>${plainMoney(currentMarkPx, 4)}</td>
        <td>${plainMoney(estLiqPx, 4)}</td>
        <td>${proximityHtml}</td>
        <td class="${fundingClass}">${money(positionFunding, 2)}</td>
        <td class="${pnlClass}">
          <span id="${unPnlId}" class="contract-animated-pnl">${money(liveUnPnl, 2)}</span>
          <button class="secondary" style="margin-left: 8px; height: 26px; padding: 0 6px; font-size: 10px;" onclick="openCloseSimulation('${esc(coin)}', ${sizeNum}, ${entryPx}, ${currentMarkPx})">Simulate Close</button>
        </td>
      </tr>
    `);
  });

  if (rows.length === 0) {
    contractsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="10">No open perpetual positions currently active.</td></tr>';
    contractsMeta.textContent = "0 active derivative contracts | Total Unrealized P&L: $0.00";
    return;
  }

  contractsBodyEl.innerHTML = rows.join("");

  activePositions.forEach((item, index) => {
    const pos = item.position || item;
    if (!pos) return;
    const sizeNum = num(pos.szi);
    if (sizeNum === 0) return;

    const coin = pos.coin || "PERP";
    const entryPx = num(pos.entryPx);
    const currentMarkPx = num(livePrices[coin]) || (sizeNum !== 0 ? Math.abs(num(pos.positionValue) / sizeNum) : entryPx);
    const liveUnPnl = (sizeNum > 0 ? (currentMarkPx - entryPx) : (entryPx - currentMarkPx)) * Math.abs(sizeNum);

    animateNumber(`contract-unpnl-${coin}-${index}`, liveUnPnl, true, 2, true);
  });
  
  const totalPnlClass = totalUnrealizedPnl > 0 ? "text-positive" : totalUnrealizedPnl < 0 ? "text-negative" : "";
  contractsMeta.innerHTML = `Displaying ${count} active contract(s) | Total Unrealized P&L: <strong id="totalUnrealizedMeta" class="${totalPnlClass}">${money(totalUnrealizedPnl, 2)}</strong>`;
  animateNumber("totalUnrealizedMeta", totalUnrealizedPnl, true, 2, true);
}

window.openCloseSimulation = function(coin, size, entryPx, markPx) {
  let modal = $("simModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "simModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="width: 400px;">
        <div class="modal-header">
          <h3 id="simModalTitle">Simulate Closing Contract</h3>
          <button class="btn-ghost" onclick="$('simModal').classList.add('hidden')">✕</button>
        </div>
        <div class="modal-body">
          <div class="fee-row"><span>Coin:</span> <strong id="simCoin">—</strong></div>
          <div class="fee-row"><span>Position Size:</span> <strong id="simSize">—</strong></div>
          <div class="fee-row"><span>Entry Price:</span> <strong id="simEntry">—</strong></div>
          <div style="margin: 14px 0;">
            <label style="font-size: 10px; font-weight: 800; color: var(--text-muted); display: block; margin-bottom: 6px;">CUSTOM CLOSING PRICE ($)</label>
            <input id="simClosePriceInput" type="number" step="any" style="width: 100%;">
          </div>
          <hr class="modal-divider">
          <div class="fee-row total"><span>Estimated P&L Result:</span> <strong id="simResultPnl">$0.00</strong></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Attach instant live calculation listener on input
    const closePriceInput = $("simClosePriceInput");
    if (closePriceInput) {
      closePriceInput.addEventListener("input", () => {
        const closePx = num(closePriceInput.value);
        const { size, entryPx } = window._simData || {};
        if (size === undefined || entryPx === undefined) return;
        const pnl = (size > 0 ? (closePx - entryPx) : (entryPx - closePx)) * Math.abs(size);
        const resEl = $("simResultPnl");
        if (resEl) {
          resEl.textContent = money(pnl, 2);
          resEl.className = pnl >= 0 ? "text-positive" : "text-negative";
        }
      });
    }
  }

  $("simCoin").textContent = coin;
  $("simSize").textContent = size;
  $("simEntry").textContent = plainMoney(entryPx, 4);
  
  const closePriceInput = $("simClosePriceInput");
  if (closePriceInput) {
    closePriceInput.value = markPx;
  }
  
  window._simData = { size, entryPx };

  const initialPnl = (size > 0 ? (markPx - entryPx) : (entryPx - markPx)) * Math.abs(size);
  const resEl = $("simResultPnl");
  if (resEl) {
    resEl.textContent = money(initialPnl, 2);
    resEl.className = initialPnl >= 0 ? "text-positive" : "text-negative";
  }

  modal.classList.remove("hidden");
};

function renderQuantMetrics() {
  const targetFills = getFilteredFills();
  const tradesWithPnl = targetFills.filter(f => num(f.closedPnl) !== 0);
  
  if (!tradesWithPnl.length) {
    $("quantSharpe").textContent = "0.00";
    $("quantSortino").textContent = "0.00";
    $("quantDrawdown").textContent = "$0.00 (0.0%)";
    $("quantProfitFactor").textContent = "0.00";
    $("quantAvgWinLoss").textContent = "$0.00 / $0.00";
    $("quantStreak").textContent = "0 Wins / 0 Losses";
    return;
  }

  const pnlList = tradesWithPnl.map(f => num(f.closedPnl));
  const meanPnl = pnlList.reduce((a, b) => a + b, 0) / pnlList.length;
  
  const variance = pnlList.reduce((sum, val) => sum + Math.pow(val - meanPnl, 2), 0) / pnlList.length;
  const stdDev = Math.sqrt(variance) || 1;
  const sharpe = (meanPnl / stdDev) * Math.sqrt(365);

  const negativeReturns = pnlList.filter(val => val < 0);
  const downsideVariance = negativeReturns.length > 0 ? negativeReturns.reduce((sum, val) => sum + Math.pow(val, 2), 0) / negativeReturns.length : 1;
  const downsideDeviation = Math.sqrt(downsideVariance) || 1;
  const sortino = (meanPnl / downsideDeviation) * Math.sqrt(365);

  let peak = 0, maxDd = 0, runningSum = 0;
  pnlList.forEach(p => {
    runningSum += p;
    if (runningSum > peak) { peak = runningSum; }
    const dd = peak - runningSum;
    if (dd > maxDd) { maxDd = dd; }
  });

  const grossProfit = tradesWithPnl.filter(f => num(f.closedPnl) > 0).reduce((s, f) => s + num(f.closedPnl), 0);
  const grossLoss = Math.abs(tradesWithPnl.filter(f => num(f.closedPnl) < 0).reduce((s, f) => s + num(f.closedPnl), 0)) || 1;
  const profitFactor = grossProfit / grossLoss;

  const winningTrades = tradesWithPnl.filter(f => num(f.closedPnl) > 0);
  const losingTrades = tradesWithPnl.filter(f => num(f.closedPnl) < 0);
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  tradesWithPnl.forEach(f => {
    if (num(f.closedPnl) > 0) {
      curWin++; curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
    } else if (num(f.closedPnl) < 0) {
      curLoss++; curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
    }
  });

  $("quantSharpe").textContent = sharpe.toFixed(2);
  $("quantSortino").textContent = sortino.toFixed(2);
  $("quantDrawdown").textContent = `-$${maxDd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  $("quantProfitFactor").textContent = profitFactor.toFixed(2);
  $("quantAvgWinLoss").textContent = `${plainMoney(avgWin, 2)} / ${plainMoney(avgLoss, 2)}`;
  $("quantStreak").textContent = `${maxWinStreak} Wins / ${maxLossStreak} Losses`;
}

function renderFeeCalculator() {
  const targetFills = getFilteredFills();
  const totalVol = targetFills.reduce((s, f) => s + Math.abs(num(f.px) * num(f.sz)), 0);
  
  $("feeCalcVol").textContent = plainMoney(totalVol, 2);

  let tierText = "Tier 0 (0.010% Maker / 0.035% Taker)";
  if (totalVol >= 100000000) {
    tierText = "Tier 3+ VIP (0.000% Maker / 0.015% Taker)";
  } else if (totalVol >= 10000000) {
    tierText = "Tier 2 VIP (0.000% Maker / 0.022% Taker)";
  } else if (totalVol >= 1000000) {
    tierText = "Tier 1 VIP (0.005% Maker / 0.028% Taker)";
  }

  $("feeCalcTier").textContent = tierText;
}

function renderShareCardPreview() {
  const targetFills = getFilteredFills();
  const closedPnl = targetFills.reduce((s, f) => s + num(f.closedPnl), 0);
  const winningTrades = targetFills.filter(f => num(f.closedPnl) > 0);
  const winRate = targetFills.length > 0 ? (winningTrades.length / targetFills.length) * 100 : 0;
  const totalVol = targetFills.reduce((s, f) => s + Math.abs(num(f.px) * num(f.sz)), 0);
  const wallet = actualWalletValue || walletEl.value.trim() || "0x0000...0000";

  $("shareCardWallet").textContent = maskAddress(wallet);
  $("shareCardPnl").textContent = money(closedPnl, 2);
  $("shareCardPnl").className = closedPnl >= 0 ? "text-positive" : "text-negative";
  $("shareCardFills").textContent = targetFills.length.toLocaleString();
  $("shareCardWinRate").textContent = winRate.toFixed(1) + "%";
  $("shareCardVol").textContent = plainMoney(totalVol, 2);
}

$("downloadShareCardBtn")?.addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0b0e14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#00b87c";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("HYPERLIQUID PRO STATEMENT", 80, 100);

  const targetFills = getFilteredFills();
  const closedPnl = targetFills.reduce((s, f) => s + num(f.closedPnl), 0);
  const winningTrades = targetFills.filter(f => num(f.closedPnl) > 0);
  const winRate = targetFills.length > 0 ? (winningTrades.length / targetFills.length) * 100 : 0;
  const totalVol = targetFills.reduce((s, f) => s + Math.abs(num(f.px) * num(f.sz)), 0);

  ctx.fillStyle = "#8492a6";
  ctx.font = "16px monospace";
  ctx.fillText("WALLET: " + maskAddress(actualWalletValue || walletEl.value.trim()), 80, 140);

  ctx.fillStyle = "#f0f4f8";
  ctx.font = "18px sans-serif";
  ctx.fillText("NET REALIZED P&L", 80, 220);

  ctx.fillStyle = closedPnl >= 0 ? "#00b87c" : "#f6465d";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText(money(closedPnl, 2), 80, 300);

  ctx.fillStyle = "#121721";
  ctx.fillRect(80, 380, 1040, 140);
  ctx.strokeStyle = "#1e2638";
  ctx.strokeRect(80, 380, 1040, 140);

  ctx.fillStyle = "#8492a6";
  ctx.font = "16px sans-serif";
  ctx.fillText("TOTAL FILLS", 140, 435);
  ctx.fillText("WIN RATE", 520, 435);
  ctx.fillText("TOTAL VOLUME", 840, 435);

  ctx.fillStyle = "#f0f4f8";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(targetFills.length.toLocaleString(), 140, 475);
  ctx.fillText(winRate.toFixed(1) + "%", 520, 475);
  ctx.fillText(plainMoney(totalVol, 2), 840, 475);

  const link = document.createElement("a");
  link.download = "hyperliquid-pnl-card.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

function renderDailyPnl() {
  if (!fills.length && !fundingHistory.length) {
    dailyBodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">No trade fills loaded to generate daily breakdown.</td></tr>';
    dailyMeta.textContent = "No data loaded.";
    return;
  }

  const dailyMap = {};

  fills.forEach(f => {
    const d = new Date(Number(f.time));
    const dateKey = d.toISOString().split("T")[0];

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { label: dateKey, closedPnl: 0, fees: 0, netPnl: 0, volume: 0, fillsCount: 0 };
    }

    const closedPnl = num(f.closedPnl);
    const tradingFee = num(f.fee);
    const builderFee = num(f.builderFee);

    dailyMap[dateKey].closedPnl += closedPnl;
    dailyMap[dateKey].fees += (tradingFee + builderFee);
    dailyMap[dateKey].netPnl += (closedPnl - tradingFee - builderFee);
    dailyMap[dateKey].volume += Math.abs(num(f.px) * num(f.sz));
    dailyMap[dateKey].fillsCount += 1;
  });

  fundingHistory.forEach(item => {
    const timeVal = item.time || item.delta?.time;
    if (!timeVal) return;
    const d = new Date(Number(timeVal));
    const dateKey = d.toISOString().split("T")[0];

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { label: dateKey, closedPnl: 0, fees: 0, netPnl: 0, volume: 0, fillsCount: 0 };
    }

    const usdPayment = num(item.delta?.usdc);
    if (usdPayment < 0) {
      const paid = Math.abs(usdPayment);
      dailyMap[dateKey].fees += paid;
      dailyMap[dateKey].netPnl -= paid;
    } else {
      dailyMap[dateKey].netPnl += usdPayment;
    }
  });

  const sortedKeys = Object.keys(dailyMap).sort().reverse();

  dailyBodyEl.innerHTML = sortedKeys.map(k => {
    const day = dailyMap[k];
    return `<tr>
      <td style="text-align: left; font-weight: 800;">${esc(day.label)}</td>
      <td class="${day.closedPnl > 0 ? "text-positive" : day.closedPnl < 0 ? "text-negative" : ""}">${money(day.closedPnl, 2)}</td>
      <td>${plainMoney(day.fees, 2)}</td>
      <td class="${day.netPnl > 0 ? "text-positive" : day.netPnl < 0 ? "text-negative" : ""}">${money(day.netPnl, 2)}</td>
      <td>${plainMoney(day.volume, 2)}</td>
      <td>${day.fillsCount.toLocaleString()}</td>
    </tr>`;
  }).join("");

  dailyMeta.textContent = `Showing aggregated daily performance across ${sortedKeys.length} active day(s).`;
}

function renderMonthlyPnl() {
  if (!fills.length && !fundingHistory.length) {
    monthlyBodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">No trade fills loaded to generate monthly breakdown.</td></tr>';
    monthlyMeta.textContent = "No data loaded.";
    return;
  }

  const monthlyMap = {};

  fills.forEach(f => {
    const d = new Date(Number(f.time));
    const yearMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    if (!monthlyMap[yearMonthKey]) {
      monthlyMap[yearMonthKey] = { label, closedPnl: 0, fees: 0, netPnl: 0, volume: 0, fillsCount: 0 };
    }

    const closedPnl = num(f.closedPnl);
    const tradingFee = num(f.fee);
    const builderFee = num(f.builderFee);

    monthlyMap[yearMonthKey].closedPnl += closedPnl;
    monthlyMap[yearMonthKey].fees += (tradingFee + builderFee);
    monthlyMap[yearMonthKey].netPnl += (closedPnl - tradingFee - builderFee);
    monthlyMap[yearMonthKey].volume += Math.abs(num(f.px) * num(f.sz));
    monthlyMap[yearMonthKey].fillsCount += 1;
  });

  fundingHistory.forEach(item => {
    const timeVal = item.time || item.delta?.time;
    if (!timeVal) return;
    const d = new Date(Number(timeVal));
    const yearMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    if (!monthlyMap[yearMonthKey]) {
      monthlyMap[yearMonthKey] = { label, closedPnl: 0, fees: 0, netPnl: 0, volume: 0, fillsCount: 0 };
    }

    const usdPayment = num(item.delta?.usdc);
    if (usdPayment < 0) {
      const paid = Math.abs(usdPayment);
      monthlyMap[yearMonthKey].fees += paid;
      monthlyMap[yearMonthKey].netPnl -= paid;
    } else {
      monthlyMap[yearMonthKey].netPnl += usdPayment;
    }
  });

  const sortedKeys = Object.keys(monthlyMap).sort().reverse();

  monthlyBodyEl.innerHTML = sortedKeys.map(k => {
    const m = monthlyMap[k];
    return `<tr>
      <td style="text-align: left; font-weight: 800;">${esc(m.label)}</td>
      <td class="${m.closedPnl > 0 ? "text-positive" : m.closedPnl < 0 ? "text-negative" : ""}">${money(m.closedPnl, 2)}</td>
      <td>${plainMoney(m.fees, 2)}</td>
      <td class="${m.netPnl > 0 ? "text-positive" : m.netPnl < 0 ? "text-negative" : ""}">${money(m.netPnl, 2)}</td>
      <td>${plainMoney(m.volume, 2)}</td>
      <td>${m.fillsCount.toLocaleString()}</td>
    </tr>`;
  }).join("");

  monthlyMeta.textContent = `Showing aggregated monthly performance across ${sortedKeys.length} month(s).`;
}

function renderDepositsWithdrawals() {
  if (!ledgerUpdates || !ledgerUpdates.length) {
    depositsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="5">No deposit or withdrawal ledger updates found for this timeframe.</td></tr>';
    depositsMeta.textContent = "0 transfer records found.";
    return;
  }

  const depStart = $("depositStartDate")?.value ? msStart($("depositStartDate").value) : 0;
  const depEnd = $("depositEndDate")?.value ? msEnd($("depositEndDate").value) : Date.now();

  const filteredLedger = ledgerUpdates.filter(item => {
    const t = Number(item.time || item.delta?.time || 0);
    return t >= depStart && t <= depEnd;
  });

  if (!filteredLedger.length) {
    depositsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="5">No deposit or withdrawal records in selected date range.</td></tr>';
    depositsMeta.textContent = "0 transfer records found in range.";
    return;
  }

  depositsBodyEl.innerHTML = filteredLedger.map(item => {
    const t = item.time || item.delta?.time;
    const delta = item.delta || item;
    const type = delta.type || "Transfer";
    const usdcVal = num(delta.usdc || delta.usdcValue || delta.amount || 0);
    const token = delta.token || (type === "deposit" || type === "withdraw" ? "USDC" : "Asset");
    const hash = item.hash || "—";
    const hasHash = hash && hash !== "null" && hash !== "0x0000000000000000000000000000000000000000000000000000000000000000";

    const hashCell = hasHash 
      ? `<a href="${EXPLORER_URL}${esc(hash)}" target="_blank" rel="noopener noreferrer" class="hash">${esc(hash)}</a>` 
      : '—';

    return `<tr>
      <td style="text-align: left;">${esc(formatDate(t))}</td>
      <td style="font-weight: 700; text-transform: capitalize;">${esc(type)}</td>
      <td>${esc(token)}</td>
      <td class="${usdcVal > 0 ? "text-positive" : usdcVal < 0 ? "text-negative" : ""}">${money(usdcVal, 2)}</td>
      <td>${hashCell}</td>
    </tr>`;
  }).join("");

  depositsMeta.textContent = `Displaying ${filteredLedger.length} deposit/withdrawal record(s).`;
}

$("depositFetchBtn")?.addEventListener("click", () => {
  const btn = $("depositFetchBtn");
  btn.disabled = true;
  btn.innerHTML = `<span style="display:inline-block; width:10px; height:10px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:4px; vertical-align:middle;"></span> Filtering...`;
  setTimeout(() => {
    renderDepositsWithdrawals();
    btn.disabled = false;
    btn.innerHTML = "Filter Dates";
  }, 300);
});

function renderOpenOrders() {
  if (!openOrdersList || !openOrdersList.length) {
    openOrdersBodyEl.innerHTML = '<tr class="empty-row"><td colspan="7">No open orders (limit, TP/SL) currently resting.</td></tr>';
    openOrdersMeta.textContent = "0 active open orders.";
    return;
  }

  openOrdersBodyEl.innerHTML = openOrdersList.map(o => {
    const coin = o.coin || "PERP";
    const oid = o.oid || "—";
    const side = mapSide(o.side);
    const limitPx = plainMoney(o.limitPx, 4);
    const triggerPx = o.triggerPx ? plainMoney(o.triggerPx, 4) : '—';
    const sz = num(o.sz).toLocaleString();
    const reduceOnly = o.reduceOnly ? "Yes" : "No";
    const orderType = o.triggerCondition ? "Trigger (TP/SL)" : "Limit Order";

    return `<tr>
      <td style="text-align: left; font-weight: 800;" class="coin-name">${esc(coin)}</td>
      <td>${esc(oid)}</td>
      <td class="${o.side === 'B' ? "text-positive" : "text-negative"}">${esc(orderType)} (${esc(side)})</td>
      <td>${limitPx}</td>
      <td>${triggerPx}</td>
      <td>${sz}</td>
      <td>${reduceOnly}</td>
    </tr>`;
  }).join("");

  openOrdersMeta.textContent = `Displaying ${openOrdersList.length} active open order(s).`;
}

function renderWalletPieChart(dataValues) {
  const ctx = $("walletPieChart").getContext("2d");
  const isLight = document.body.classList.contains("light-theme");
  const textColor = isLight ? "#0f172a" : "#f0f4f8";

  if (walletPieChartInstance) {
    walletPieChartInstance.data.datasets[0].data = dataValues;
    walletPieChartInstance.options.plugins.legend.labels.color = textColor;
    walletPieChartInstance.update();
    return;
  }

  walletPieChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Perp Margin Value', 'Withdrawable Balance', 'Spot Token Balances', 'Active Open Notional'],
      datasets: [{
        data: dataValues,
        backgroundColor: [
          '#00b87c',
          '#2962ff',
          '#8b5cf6',
          '#f59e0b'
        ],
        borderWidth: 2,
        borderColor: isLight ? '#ffffff' : '#121721',
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: {
              size: 10,
              weight: 'bold',
              family: 'inherit'
            },
            padding: 12,
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.label}: $${context.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      }
    }
  });
}

function renderWalletDetails() {
  let perpVal = 0, spotVal = 0, withdrawable = 0, totalNotional = 0;

  if (holdingsData) {
    const margin = holdingsData.marginSummary || {};
    perpVal = num(margin.accountValue);
    withdrawable = num(holdingsData.withdrawable);

    if (Array.isArray(holdingsData.balances)) {
      holdingsData.balances.forEach(b => {
        spotVal += num(b.total) * (num(livePrices[b.coin]) || 1);
      });
    }
  }

  if (xyzHoldingsData) {
    const xyzMargin = xyzHoldingsData.marginSummary || {};
    perpVal += num(xyzMargin.accountValue);
  }

  if (activePositions && activePositions.length > 0) {
    activePositions.forEach(item => {
      const pos = item.position || item;
      if (!pos) return;
      const sizeNum = num(pos.szi);
      if (sizeNum === 0) return;
      const coin = pos.coin || "PERP";
      const currentMarkPx = num(livePrices[coin]) || Math.abs(num(pos.positionValue) / sizeNum);
      totalNotional += Math.abs(sizeNum * currentMarkPx);
    });
  }

  const totalAccountValue = perpVal + spotVal;
  const totalLeverage = perpVal > 0 ? (totalNotional / perpVal) : 0;

  $("detAccountValue").textContent = plainMoney(totalAccountValue, 2);
  $("detPerpValue").textContent = plainMoney(perpVal, 2);
  $("detPerpsPosValue").textContent = plainMoney(totalNotional, 2);
  $("detWithdrawable").textContent = plainMoney(withdrawable, 2);
  $("detSpotValue").textContent = plainMoney(spotVal, 2);
  $("detLeverage").textContent = totalLeverage.toFixed(2) + "x";

  const dailyMap = {};
  const monthlyMap = {};
  const yearlyMap = {};

  fills.forEach(f => {
    const d = new Date(Number(f.time));
    const dateKey = d.toISOString().split("T")[0];
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const yearKey = `${d.getFullYear()}`;

    const netItemPnl = num(f.closedPnl) - num(f.fee) - num(f.builderFee);

    dailyMap[dateKey] = (dailyMap[dateKey] || 0) + netItemPnl;
    monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + netItemPnl;
    yearlyMap[yearKey] = (yearlyMap[yearKey] || 0) + netItemPnl;
  });

  fundingHistory.forEach(item => {
    const timeVal = item.time || item.delta?.time;
    if (!timeVal) return;
    const d = new Date(Number(timeVal));
    const dateKey = d.toISOString().split("T")[0];
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const yearKey = `${d.getFullYear()}`;

    const usdPayment = num(item.delta?.usdc);

    dailyMap[dateKey] = (dailyMap[dateKey] || 0) + usdPayment;
    monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + usdPayment;
    yearlyMap[yearKey] = (yearlyMap[yearKey] || 0) + usdPayment;
  });

  const dailyValues = Object.values(dailyMap);
  const monthlyValues = Object.values(monthlyMap);
  const yearlyValues = Object.values(yearlyMap);

  const avgDailyPnl = dailyValues.length ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
  const avgMonthlyPnl = monthlyValues.length ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length : 0;
  const avgYearlyPnl = yearlyValues.length ? yearlyValues.reduce((a, b) => a + b, 0) / yearlyValues.length : 0;

  const detAvgDailyEl = $("detAvgDailyPnl");
  const detAvgMonthlyEl = $("detAvgMonthlyPnl");
  const detAvgYearlyEl = $("detAvgYearlyPnl");

  if (detAvgDailyEl) {
    detAvgDailyEl.textContent = money(avgDailyPnl, 2);
    detAvgDailyEl.className = "value " + (avgDailyPnl > 0 ? "text-positive" : avgDailyPnl < 0 ? "text-negative" : "");
  }
  if (detAvgMonthlyEl) {
    detAvgMonthlyEl.textContent = money(avgMonthlyPnl, 2);
    detAvgMonthlyEl.className = "value " + (avgMonthlyPnl > 0 ? "text-positive" : avgMonthlyPnl < 0 ? "text-negative" : "");
  }
  if (detAvgYearlyEl) {
    detAvgYearlyEl.textContent = money(avgYearlyPnl, 2);
    detAvgYearlyEl.className = "value " + (avgYearlyPnl > 0 ? "text-positive" : avgYearlyPnl < 0 ? "text-negative" : "");
  }

  renderWalletPieChart([
    Math.max(0, perpVal),
    Math.max(0, withdrawable),
    Math.max(0, spotVal),
    Math.max(0, totalNotional)
  ]);
}

function renderTrades() {
  const displayFills = getFilteredFills();

  if (!displayFills.length) {
    bodyEl.innerHTML = '<tr class="empty-row"><td colspan="12">No trade fills found matching selected criteria.</td></tr>';
    tableMeta.textContent = "No trade fills to show.";
    paginationContainer.classList.add("hidden");
    return;
  }

  const totalPages = Math.ceil(displayFills.length / rowsPerPage);
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * rowsPerPage;
  const paginatedFills = displayFills.slice(startIdx, startIdx + rowsPerPage);

  bodyEl.innerHTML = paginatedFills.map(f => {
    const p = num(f.closedPnl);
    const d = String(f.dir ?? "");
    const dc = d.toLowerCase().includes("close") ? "dir-close" : "dir-open";
    const rawHash = String(f.hash ?? "");
    const hasHash = rawHash && rawHash !== "null" && rawHash !== "undefined";

    const hashCell = hasHash 
      ? `<a href="${EXPLORER_URL}${esc(rawHash)}" target="_blank" rel="noopener noreferrer" class="hash" title="View Explorer">${esc(rawHash)}</a>`
      : '—';

    return `<tr>
      <td>${esc(formatDate(f.time))}</td>
      <td class="coin-name">${esc(f.coin)}</td>
      <td class="${dc}">${esc(d)}</td>
      <td>${esc(mapSide(f.side))}</td>
      <td>${esc(f.px)}</td>
      <td>${esc(f.sz)}</td>
      <td>${plainMoney(Math.abs(num(f.px) * num(f.sz)), 2)}</td>
      <td class="${p > 0 ? "text-positive" : p < 0 ? "text-negative" : ""}">${money(p, 4)}</td>
      <td>${plainMoney(f.fee, 4)}</td>
      <td>${esc(f.feeToken)}</td>
      <td>${esc(f.oid)}</td>
      <td>${hashCell}</td>
    </tr>`;
  }).join("");

  tableMeta.textContent = `${displayFills.length.toLocaleString()} fills matching filters (Showing ${startIdx + 1}–${Math.min(startIdx + rowsPerPage, displayFills.length)})`;
  
  pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;
  paginationContainer.classList.remove("hidden");

  csvBtn.disabled = false;
  jsonBtn.disabled = false;
  pdfBtn.disabled = false;

  updateMetrics();
  renderDailyPnl();
  renderMonthlyPnl();
}

window.addEventListener("DOMContentLoaded", async () => {
  const savedControlsHidden = localStorage.getItem("hyperliquid_controls_hidden");
  if (savedControlsHidden === "true") {
    controlsPanel.classList.add("hidden");
    unhideBtn.classList.remove("hidden");
  }

  const cacheTime = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
  const isExpired = (Date.now() - cacheTime) > 7200000;

  if (isExpired) {
    localStorage.removeItem(CACHE_FILLS_KEY);
    localStorage.removeItem(CACHE_FUNDING_KEY);
    localStorage.removeItem(CACHE_LEDGER_KEY);
    localStorage.removeItem(CACHE_ORDERS_KEY);
    localStorage.removeItem(CACHE_HOLDINGS_KEY);
    localStorage.removeItem(CACHE_POSITIONS_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    sessionStorage.clear();
  }

  const savedFills = localStorage.getItem(CACHE_FILLS_KEY);
  const savedFunding = localStorage.getItem(CACHE_FUNDING_KEY);
  const savedLedger = localStorage.getItem(CACHE_LEDGER_KEY);
  const savedOrders = localStorage.getItem(CACHE_ORDERS_KEY);
  const savedHoldings = localStorage.getItem(CACHE_HOLDINGS_KEY);
  const savedPositions = localStorage.getItem(CACHE_POSITIONS_KEY);

  if (savedFills) {
    try {
      fills = JSON.parse(savedFills);
      fundingHistory = savedFunding ? JSON.parse(savedFunding) : [];
      ledgerUpdates = savedLedger ? JSON.parse(savedLedger) : [];
      openOrdersList = savedOrders ? JSON.parse(savedOrders) : [];
      holdingsData = savedHoldings ? JSON.parse(savedHoldings) : null;
      activePositions = savedPositions ? JSON.parse(savedPositions) : [];
      if (fills.length > 0 || activePositions.length > 0) {
        updateCoinFilterOptions();
        renderTrades();
        renderContracts();
        renderDepositsWithdrawals();
        renderOpenOrders();
        renderWalletDetails();
        renderQuantMetrics();
        if (activePositions.length > 0) {
          const uniqueCoins = [...new Set(activePositions.map(p => (p.position || p).coin))];
          initWebSocket(uniqueCoins);
          const currentWallet = actualWalletValue || walletEl.value.trim();
          if (currentWallet) {
            startFiveSecondPoller(currentWallet.toLowerCase());
          }
        }
        setStatus(`Loaded persisted data from local storage.`, "success");
      }
    } catch (e) {
      console.warn("Failed to load persisted storage data:", e);
    }
  }

  // Automatically fetch ALL TIME data on load if a wallet address is saved
  if (actualWalletValue && isAddress(actualWalletValue)) {
    try {
      await setInceptionPreset();
      const cleanUser = actualWalletValue.toLowerCase();
      const s = msStart(startEl.value), e = msEnd(endEl.value);

      const accountData = await fetchAccountData(cleanUser, s, e);
      fills = accountData.fills;
      fundingHistory = accountData.funding;
      ledgerUpdates = accountData.ledger;
      openOrdersList = accountData.orders;
      holdingsData = accountData.holdings;
      activePositions = accountData.positions;

      localStorage.setItem(CACHE_FILLS_KEY, JSON.stringify(fills));
      localStorage.setItem(CACHE_FUNDING_KEY, JSON.stringify(fundingHistory));
      localStorage.setItem(CACHE_LEDGER_KEY, JSON.stringify(ledgerUpdates));
      localStorage.setItem(CACHE_ORDERS_KEY, JSON.stringify(openOrdersList));
      localStorage.setItem(CACHE_HOLDINGS_KEY, JSON.stringify(holdingsData));
      localStorage.setItem(CACHE_POSITIONS_KEY, JSON.stringify(activePositions));
      localStorage.setItem(CACHE_TIME_KEY, Date.now());

      updateCoinFilterOptions();
      renderTrades();
      renderContracts();
      renderDepositsWithdrawals();
      renderOpenOrders();
      renderWalletDetails();
      renderQuantMetrics();

      if (activePositions.length > 0) {
        const uniqueCoins = [...new Set(activePositions.map(p => (p.position || p).coin))];
        initWebSocket(uniqueCoins);
        startFiveSecondPoller(cleanUser);
      }

      // Auto-hide controls and save state on successful auto-load
      controlsPanel.classList.add("hidden");
      unhideBtn.classList.remove("hidden");
      localStorage.setItem("hyperliquid_controls_hidden", "true");
    } catch (e) {
      console.warn("Auto-fetch all-time data on load error:", e);
    }
  }
});

pnlFilterSelect.addEventListener("change", () => { currentPage = 1; updateMetrics(); renderTrades(); });
coinFilterSelect.addEventListener("change", () => { currentPage = 1; updateMetrics(); renderTrades(); });

prevPageBtn.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderTrades(); } });
nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(getFilteredFills().length / rowsPerPage);
  if (currentPage < totalPages) { currentPage++; renderTrades(); }
});

fetchBtn.addEventListener("click", async () => {
  clearStatus();
  noticeEl.classList.add("hidden");

  const wallet = actualWalletValue || walletEl.value.trim();
  if (!isAddress(wallet)) {
    setStatus("Please enter a valid 42-character EVM address beginning with 0x.", "error");
    return;
  }
  if (!startEl.value || !endEl.value) {
    setStatus("Please select valid start and end dates.", "error");
    return;
  }

  const s = msStart(startEl.value), e = msEnd(endEl.value);
  if (s > e) {
    setStatus("Start date must be before or equal to end date.", "error");
    return;
  }

  fetchBtn.disabled = true;
  fetchBtn.innerHTML = `<span style="display:inline-block; width:12px; height:12px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-right:6px; vertical-align:middle;"></span> Fetching...`;

  fills = [];
  fundingHistory = [];
  ledgerUpdates = [];
  openOrdersList = [];
  holdingsData = null;
  xyzHoldingsData = null;
  activePositions = [];
  currentPage = 1;
  resetMetrics();

  try {
    setStatus("Fetching trade statement, deposits, open orders, and account state from Hyperliquid…");

    const accountData = await fetchAccountData(wallet, s, e);
    fills = accountData.fills;
    fundingHistory = accountData.funding;
    ledgerUpdates = accountData.ledger;
    openOrdersList = accountData.orders;
    holdingsData = accountData.holdings;
    activePositions = accountData.positions;

    localStorage.setItem(CACHE_FILLS_KEY, JSON.stringify(fills));
    localStorage.setItem(CACHE_FUNDING_KEY, JSON.stringify(fundingHistory));
    localStorage.setItem(CACHE_LEDGER_KEY, JSON.stringify(ledgerUpdates));
    localStorage.setItem(CACHE_ORDERS_KEY, JSON.stringify(openOrdersList));
    localStorage.setItem(CACHE_HOLDINGS_KEY, JSON.stringify(holdingsData));
    localStorage.setItem(CACHE_POSITIONS_KEY, JSON.stringify(activePositions));
    localStorage.setItem(CACHE_TIME_KEY, Date.now());

    updateCoinFilterOptions();
    renderTrades();
    renderContracts();
    renderDepositsWithdrawals();
    renderOpenOrders();
    renderWalletDetails();
    renderQuantMetrics();

    if (activePositions.length > 0) {
      const uniqueCoins = [...new Set(activePositions.map(p => (p.position || p).coin))];
      initWebSocket(uniqueCoins);
      startFiveSecondPoller(wallet.toLowerCase());
    }

    if (accountData.reachedGlobalLimit) {
      noticeEl.textContent = "Hyperliquid API returned maximum fill capacity (10,000). Older fills may be omitted.";
      noticeEl.classList.remove("hidden");
    }

    setStatus(`Successfully fetched data and ${activePositions.length} active perpetual contract(s).`, "success");

    controlsPanel.classList.add("hidden");
    unhideBtn.classList.remove("hidden");
    localStorage.setItem("hyperliquid_controls_hidden", "true");

  } catch (err) {
    console.error(err);
    setStatus("Error fetching data: " + (err?.message || "Check network connection or wallet address."), "error");
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = "Fetch Data";
  }
});

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV(rows) {
  const c = [
    ["Timestamp", f => new Date(Number(f.time)).toISOString()],
    ["Local Date/Time", f => formatDate(f.time)],
    ["Coin", f => f.coin],
    ["Direction", f => f.dir],
    ["Side", f => mapSide(f.side)],
    ["Price", f => f.px],
    ["Size", f => f.sz],
    ["Notional USD", f => Math.abs(num(f.px) * num(f.sz)).toFixed(8)],
    ["Closed P&L", f => f.closedPnl],
    ["Trading Fee", f => f.fee],
    ["Fee Token", f => f.feeToken],
    ["Order ID", f => f.oid],
    ["Hash", f => f.hash]
  ];
  return c.map(x => csvEscape(x[0])).join(",") + "\r\n" +
    rows.map(r => c.map(x => csvEscape(x[1](r))).join(",")).join("\r\n");
}

function downloadBlob(content, name, type) {
  const u = URL.createObjectURL(new Blob([content], { type })),
        a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

csvBtn.addEventListener("click", () => {
  const targetFills = getFilteredFills();
  const currentWallet = actualWalletValue || walletEl.value.trim();
  if (targetFills.length) {
    downloadBlob(toCSV(targetFills), `hyperliquid-statement-${currentWallet.slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  }
});

jsonBtn.addEventListener("click", () => {
  const targetFills = getFilteredFills();
  const currentWallet = actualWalletValue || walletEl.value.trim();
  if (targetFills.length) {
    const mappedFills = targetFills.map(f => ({ ...f, sideFormatted: mapSide(f.side) }));
    downloadBlob(JSON.stringify({ fills: mappedFills, fundingHistory, ledgerUpdates, openOrders: openOrdersList, holdings: holdingsData, positions: activePositions }, null, 2), `hyperliquid-statement-${currentWallet.slice(0, 10)}.json`, "application/json");
  }
});

function generatePDF() {
  const targetFills = getFilteredFills();
  if (!targetFills.length) return;

  if (typeof window.jspdf === "undefined" || typeof window.jspdf.jsPDF === "undefined") {
    alert("PDF generator library is still loading. Please retry in a moment.");
    return;
  }

  pdfBtn.disabled = true;
  pdfBtn.textContent = "Generating...";

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape", "pt", "a4");

    const wallet = actualWalletValue || walletEl.value.trim();
    const totalPnl = targetFills.reduce((s, f) => s + num(f.closedPnl), 0);
    const tradingFees = targetFills.reduce((s, f) => s + num(f.fee), 0);
    const builderFees = targetFills.reduce((s, f) => s + num(f.builderFee), 0);
    
    let netFundingUsd = 0;
    let totalFundingPaid = 0;
    fundingHistory.forEach(item => {
      const usdPayment = num(item.delta?.usdc);
      netFundingUsd += usdPayment;
      if (usdPayment < 0) totalFundingPaid += Math.abs(usdPayment);
    });

    const totalFees = tradingFees + totalFundingPaid + builderFees;
    const netPnl = totalPnl - tradingFees - builderFees + netFundingUsd;
    const totalVol = targetFills.reduce((s, f) => s + Math.abs(num(f.px) * num(f.sz)), 0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 184, 124);
    doc.text("HYPERLIQUID PRO", 40, 40);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text("OFFICIAL INSTITUTIONAL TRADE AUDIT STATEMENT", 40, 52);

    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Account: ${wallet}`, 802, 35, { align: "right" });
    doc.text(`Period: ${startEl.value} to ${endEl.value}`, 802, 47, { align: "right" });

    const cardWidth = 142;
    const cardGap = 13;
    let cardX = 40;

    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, 70, cardWidth, 40, 3, 3, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text("NET P&L", cardX + 10, 82);
    doc.setFontSize(10); doc.setTextColor(netPnl >= 0 ? 100 : 220, netPnl >= 0 ? 150 : 38, netPnl >= 0 ? 100 : 38);
    doc.text(money(netPnl, 2), cardX + 10, 100);

    cardX += cardWidth + cardGap;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, 70, cardWidth, 40, 3, 3, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text("CLOSED P&L", cardX + 10, 82);
    doc.setFontSize(10); doc.setTextColor(totalPnl >= 0 ? 100 : 220, totalPnl >= 0 ? 150 : 38, totalPnl >= 0 ? 100 : 38);
    doc.text(money(totalPnl, 2), cardX + 10, 100);

    cardX += cardWidth + cardGap;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, 70, cardWidth, 40, 3, 3, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text("TOTAL FEES", cardX + 10, 82);
    doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(plainMoney(totalFees, 2), cardX + 10, 100);

    cardX += cardWidth + cardGap;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, 70, cardWidth, 40, 3, 3, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text("TOTAL VOLUME", cardX + 10, 82);
    doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(plainMoney(totalVol, 2), cardX + 10, 100);

    cardX += cardWidth + cardGap;
    doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, 70, cardWidth, 40, 3, 3, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text("TOTAL TRADES", cardX + 10, 82);
    doc.setFontSize(10); doc.setTextColor(15, 23, 42);
    doc.text(targetFills.length.toLocaleString(), cardX + 10, 100);

    const tableHeaders = [["Date / Time", "Coin", "Dir", "Side", "Price", "Size", "Closed P&L", "Trade Fee"]];
    const tableBody = targetFills.map(f => [
      formatDate(f.time),
      f.coin,
      f.dir ?? "",
      mapSide(f.side),
      f.px,
      f.sz,
      money(num(f.closedPnl), 2),
      plainMoney(f.fee, 2)
    ]);

    doc.autoTable({
      head: tableHeaders,
      body: tableBody,
      startY: 125,
      theme: "striped",
      margin: { top: 40, bottom: 40, left: 40, right: 40 },
      styles: { fontSize: 7.5, cellPadding: 4, halign: "right", textColor: [30, 41, 59], fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left" }, 1: { halign: "left", fontStyle: "bold", textColor: [15, 23, 42] } },
      didDrawPage: function () {
        const str = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text("Hyperliquid On-Chain Statement", 40, doc.internal.pageSize.height - 20);
        doc.text(str, 802, doc.internal.pageSize.height - 20, { align: "right" });
      }
    });

    doc.save(`statement-${wallet.slice(0, 8)}.pdf`);
  } catch (err) {
    console.error("PDF error:", err);
    alert("Unable to compile PDF statement.");
  } finally {
    pdfBtn.disabled = false;
    pdfBtn.textContent = "PDF Statement";
  }
}

pdfBtn.addEventListener("click", generatePDF);

todayBtn.addEventListener("click", () => setPreset("today"));
monthBtn.addEventListener("click", () => setPreset("month"));
ytdBtn.addEventListener("click", () => setPreset("ytd"));
allInceptionBtn.addEventListener("click", () => setInceptionPreset());

$("zoom7dBtn")?.addEventListener("click", () => setPreset("7d"));
$("zoom30dBtn")?.addEventListener("click", () => setPreset("30d"));
$("zoom90dBtn")?.addEventListener("click", () => setPreset("90d"));
$("zoomYtdBtn")?.addEventListener("click", () => setPreset("ytd"));
$("zoomAllBtn")?.addEventListener("click", () => setInceptionPreset());

$("clearBtn").addEventListener("click", () => {
  actualWalletValue = "";
  walletEl.value = "";
  if (pollTimer) clearInterval(pollTimer);
  if (wsConnection) wsConnection.close();
  localStorage.removeItem(SAVED_WALLET_KEY);
  localStorage.removeItem(SAVED_VIEW_KEY);
  localStorage.removeItem(CACHE_FILLS_KEY);
  localStorage.removeItem(CACHE_FUNDING_KEY);
  localStorage.removeItem(CACHE_LEDGER_KEY);
  localStorage.removeItem(CACHE_ORDERS_KEY);
  localStorage.removeItem(CACHE_HOLDINGS_KEY);
  localStorage.removeItem(CACHE_POSITIONS_KEY);
  localStorage.removeItem(CACHE_TIME_KEY);
  localStorage.setItem("hyperliquid_controls_hidden", "false");
  sessionStorage.clear();
  setInceptionPreset();
  
  controlsPanel.classList.remove("hidden");
  unhideBtn.classList.add("hidden");

  viewSelect.value = "contracts";
  switchView("contracts");

  fills = [];
  fundingHistory = [];
  ledgerUpdates = [];
  openOrdersList = [];
  holdingsData = null;
  xyzHoldingsData = null;
  activePositions = [];
  previousNumericValues = {};
  pnlFilterSelect.value = "all";
  coinFilterSelect.innerHTML = '<option value="all">All Coins</option>';
  clearStatus();
  noticeEl.classList.add("hidden");
  bodyEl.innerHTML = '<tr class="empty-row"><td colspan="12">Enter a valid wallet address to display trade history.</td></tr>';
  contractsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="10">Enter a valid wallet address to view active contracts.</td></tr>';
  dailyBodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">Enter a valid wallet address to view daily breakdown.</td></tr>';
  monthlyBodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">Enter a valid wallet address to view monthly breakdown.</td></tr>';
  depositsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="5">Enter a valid wallet address to view deposit & withdrawal history.</td></tr>';
  openOrdersBodyEl.innerHTML = '<tr class="empty-row"><td colspan="7">Enter a valid wallet address to view open orders.</td></tr>';
  tableMeta.textContent = "No data loaded.";
  contractsMeta.textContent = "No data loaded.";
  dailyMeta.textContent = "No data loaded.";
  monthlyMeta.textContent = "No data loaded.";
  depositsMeta.textContent = "No data loaded.";
  openOrdersMeta.textContent = "No data loaded.";
  resetMetrics();
});

walletEl.addEventListener("keydown", e => { if (e.key === "Enter") fetchBtn.click(); });