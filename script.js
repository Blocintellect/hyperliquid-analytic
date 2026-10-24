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
      tableMeta = $("tableMeta"),
      contractsMeta = $("contractsMeta"),
      dailyMeta = $("dailyMeta"),
      monthlyMeta = $("monthlyMeta"),
      csvBtn = $("csvBtn"),
      jsonBtn = $("jsonBtn"),
      pdfBtn = $("pdfBtn"),
      allBtn = $("allBtn"),
      monthBtn = $("monthBtn"),
      ytdBtn = $("ytdBtn"),
      todayBtn = $("todayBtn"),
      pnlFilterSelect = $("pnlFilterSelect"),
      coinFilterSelect = $("coinFilterSelect"),
      themeToggleBtn = $("themeToggleBtn"),
      themeIcon = $("themeIcon"),
      themeLabel = $("themeLabel"),
      tabTradesBtn = $("tabTradesBtn"),
      tabContractsBtn = $("tabContractsBtn"),
      tabDailyBtn = $("tabDailyBtn"),
      tabMonthlyBtn = $("tabMonthlyBtn"),
      panelTrades = $("panelTrades"),
      panelContracts = $("panelContracts"),
      panelDaily = $("panelDaily"),
      panelMonthly = $("panelMonthly"),
      prevPageBtn = $("prevPageBtn"),
      nextPageBtn = $("nextPageBtn"),
      pageIndicator = $("pageIndicator"),
      paginationContainer = $("paginationContainer");

// Modal Elements
const fillsCard = $("fillsCard"), fillsModal = $("fillsModal"), closeFillsModal = $("closeFillsModal");
const netPnlCard = $("netPnlCard"), netPnlModal = $("netPnlModal"), closeNetModal = $("closeNetModal");
const closedPnlCard = $("closedPnlCard"), closedPnlModal = $("closedPnlModal"), closeClosedModal = $("closeClosedModal");
const feeCard = $("feeCard"), feeModal = $("feeModal"), closeModalBtn = $("closeModalBtn");
const winRateCard = $("winRateCard"), winRateModal = $("winRateModal"), closeWinModal = $("closeWinModal");
const holdingsCard = $("holdingsCard"), holdingsModal = $("holdingsModal"), closeHoldingsModal = $("closeHoldingsModal");

fillsCard.addEventListener("click", () => fillsModal.classList.remove("hidden"));
closeFillsModal.addEventListener("click", () => fillsModal.classList.add("hidden"));

netPnlCard.addEventListener("click", () => netPnlModal.classList.remove("hidden"));
closeNetModal.addEventListener("click", () => netPnlModal.classList.add("hidden"));

closedPnlCard.addEventListener("click", () => closedPnlModal.classList.remove("hidden"));
closeClosedModal.addEventListener("click", () => closedPnlModal.classList.add("hidden"));

feeCard.addEventListener("click", () => feeModal.classList.remove("hidden"));
closeModalBtn.addEventListener("click", () => feeModal.classList.add("hidden"));

winRateCard.addEventListener("click", () => winRateModal.classList.remove("hidden"));
closeWinModal.addEventListener("click", () => winRateModal.classList.add("hidden"));

holdingsCard.addEventListener("click", () => holdingsModal.classList.remove("hidden"));
closeHoldingsModal.addEventListener("click", () => holdingsModal.classList.add("hidden"));

window.addEventListener("click", e => { 
  if (e.target === feeModal) feeModal.classList.add("hidden");
  if (e.target === fillsModal) fillsModal.classList.add("hidden");
  if (e.target === netPnlModal) netPnlModal.classList.add("hidden");
  if (e.target === closedPnlModal) closedPnlModal.classList.add("hidden");
  if (e.target === winRateModal) winRateModal.classList.add("hidden");
  if (e.target === holdingsModal) holdingsModal.classList.add("hidden");
});

let fills = [];
let fundingHistory = [];
let holdingsData = null;
let xyzHoldingsData = null;
let activePositions = [];
let livePrices = {};
let previousNumericValues = {}; 
let wsConnection = null;
let pollTimer = null;
let currentPage = 1;
const rowsPerPage = 50;

const SAVED_WALLET_KEY = "hyperliquid_saved_wallet";
const SAVED_THEME_KEY = "hyperliquid_theme";
const CACHE_FILLS_KEY = "hyperliquid_persisted_fills";
const CACHE_FUNDING_KEY = "hyperliquid_persisted_funding";
const CACHE_HOLDINGS_KEY = "hyperliquid_persisted_holdings";
const CACHE_POSITIONS_KEY = "hyperliquid_persisted_positions";
const CACHE_TIME_KEY = "hyperliquid_cache_timestamp";

if (localStorage.getItem(SAVED_WALLET_KEY)) {
  walletEl.value = localStorage.getItem(SAVED_WALLET_KEY);
}

walletEl.addEventListener("input", () => {
  localStorage.setItem(SAVED_WALLET_KEY, walletEl.value.trim());
});

function switchTab(activeBtn, activePanel) {
  [tabTradesBtn, tabContractsBtn, tabDailyBtn, tabMonthlyBtn].forEach(b => b.classList.remove("active"));
  [panelTrades, panelContracts, panelDaily, panelMonthly].forEach(p => p.classList.add("hidden"));

  activeBtn.classList.add("active");
  activePanel.classList.remove("hidden");
}

tabContractsBtn.addEventListener("click", () => { switchTab(tabContractsBtn, panelContracts); renderContracts(); });
tabTradesBtn.addEventListener("click", () => { switchTab(tabTradesBtn, panelTrades); renderTrades(); });
tabDailyBtn.addEventListener("click", () => { switchTab(tabDailyBtn, panelDaily); renderDailyPnl(); });
tabMonthlyBtn.addEventListener("click", () => { switchTab(tabMonthlyBtn, panelMonthly); renderMonthlyPnl(); });

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

function setPreset(k) {
  const n = new Date();
  const e = new Date(n);
  let s = new Date(n);

  [allBtn, monthBtn, ytdBtn, todayBtn].forEach(b => b && b.classList.remove("active"));

  if (k === "today") {
    s = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    if (todayBtn) todayBtn.classList.add("active");
  } else if (k === "month") {
    s = new Date(n.getFullYear(), n.getMonth(), 1);
    if (monthBtn) monthBtn.classList.add("active");
  } else if (k === "ytd") {
    s = new Date(n.getFullYear(), 0, 1);
    if (ytdBtn) ytdBtn.classList.add("active");
  } else {
    s.setDate(s.getDate() - 30);
    if (allBtn) allBtn.classList.add("active");
  }

  startEl.value = formatDateInput(s);
  endEl.value = formatDateInput(e);
}

setPreset("30");

function setStatus(m, t = "") {
  statusEl.textContent = m;
  statusEl.className = "status" + (t ? " " + t : "");
  statusEl.classList.remove("hidden");
}

function clearStatus() {
  statusEl.className = "status hidden";
  statusEl.textContent = "";
}

function isAddress(v) { return /^0x[a-fA-F0-9]{40}$/.test(v.trim()); }
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

  const [fillsRes, fundingRes, holdingsRes] = await Promise.all([
    fillsPromise, fundingPromise, holdingsPromise
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

// 1-Second Smooth Number Animation Loop
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
  let totalUnPnl = 0;

  activePositions.forEach(item => {
    const pos = item.position || item;
    if (!pos) return;
    const sizeNum = num(pos.szi);
    if (sizeNum === 0) return;

    const coin = pos.coin || "PERP";
    const entryPx = num(pos.entryPx);
    const currentMarkPx = num(livePrices[coin]) || (sizeNum !== 0 ? Math.abs(num(pos.positionValue) / sizeNum) : entryPx);
    const priceDiff = sizeNum > 0 ? (currentMarkPx - entryPx) : (entryPx - currentMarkPx);
    totalUnPnl += priceDiff * Math.abs(sizeNum);
  });

  return totalUnPnl;
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

  // Populate Modals
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

  // Set Metrics Grid Cards (mPnl is CLOSED P&L)
  setMetric("mFills", targetFills.length, null, false, 0, false);
  setMetric("mPnl", closedPnl, closedPnl, true, 2, true);
  setMetric("mFees", totalFees, null, true, 2, false);
  setMetric("mNet", netPnl, netPnl, true, 2, true);
  setMetric("mWinRate", winRate, winRate > 50 ? 1 : winRate < 50 ? -1 : 0, false, 1, false);
  setMetric("mWalletHoldings", totalAccountVal, null, true, 2, false);
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
    contractsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="7">No open perpetual positions currently active.</td></tr>';
    contractsMeta.textContent = "0 active derivative contracts | Total Unrealized P&L: $0.00";
    return;
  }

  const rows = [];
  let count = 0;
  let totalUnrealizedPnl = 0;

  activePositions.forEach(item => {
    const pos = item.position || item;
    if (!pos) return;

    const sizeNum = num(pos.szi);
    if (sizeNum === 0) return;

    count++;
    const coin = pos.coin || "PERP";
    const entryPx = num(pos.entryPx);
    
    const currentMarkPx = num(livePrices[coin]) || (sizeNum !== 0 ? Math.abs(num(pos.positionValue) / sizeNum) : entryPx);
    const liveNotional = Math.abs(sizeNum * currentMarkPx);
    const priceDiff = sizeNum > 0 ? (currentMarkPx - entryPx) : (entryPx - currentMarkPx);
    const liveUnPnl = priceDiff * Math.abs(sizeNum);

    totalUnrealizedPnl += liveUnPnl;

    const levObj = pos.leverage;
    const leverageText = levObj && levObj.value ? ` (${levObj.value}x)` : "";
    const dirLabel = sizeNum > 0 ? `LONG${leverageText}` : `SHORT${leverageText}`;

    const unPnlId = `contract-unpnl-${coin}`;
    const pnlClass = liveUnPnl > 0 ? "text-positive" : liveUnPnl < 0 ? "text-negative" : "";

    rows.push(`
      <tr>
        <td style="text-align: left; font-weight: 800;" class="coin-name">${esc(coin)}</td>
        <td class="${sizeNum > 0 ? "text-positive" : "text-negative"}">${dirLabel}</td>
        <td>${Math.abs(sizeNum).toLocaleString()}</td>
        <td>${plainMoney(entryPx, 4)}</td>
        <td>${plainMoney(currentMarkPx, 4)}</td>
        <td>${plainMoney(liveNotional, 2)}</td>
        <td class="${pnlClass}">
          <span id="${unPnlId}" class="contract-animated-pnl">${money(liveUnPnl, 2)}</span>
        </td>
      </tr>
    `);
  });

  if (rows.length === 0) {
    contractsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="7">No open perpetual positions currently active.</td></tr>';
    contractsMeta.textContent = "0 active derivative contracts | Total Unrealized P&L: $0.00";
    return;
  }

  contractsBodyEl.innerHTML = rows.join("");

  activePositions.forEach(item => {
    const pos = item.position || item;
    if (!pos) return;
    const sizeNum = num(pos.szi);
    if (sizeNum === 0) return;

    const coin = pos.coin || "PERP";
    const entryPx = num(pos.entryPx);
    const currentMarkPx = num(livePrices[coin]) || (sizeNum !== 0 ? Math.abs(num(pos.positionValue) / sizeNum) : entryPx);
    const liveUnPnl = (sizeNum > 0 ? (currentMarkPx - entryPx) : (entryPx - currentMarkPx)) * Math.abs(sizeNum);

    animateNumber(`contract-unpnl-${coin}`, liveUnPnl, true, 2, true);
  });
  
  const totalPnlClass = totalUnrealizedPnl > 0 ? "text-positive" : totalUnrealizedPnl < 0 ? "text-negative" : "";
  contractsMeta.innerHTML = `Displaying ${count} active contract(s) | Total Unrealized P&L: <strong id="totalUnrealizedMeta" class="${totalPnlClass}">${money(totalUnrealizedPnl, 2)}</strong>`;
  animateNumber("totalUnrealizedMeta", totalUnrealizedPnl, true, 2, true);
}

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

window.addEventListener("DOMContentLoaded", () => {
  const cacheTime = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
  const isExpired = (Date.now() - cacheTime) > 7200000;

  if (isExpired) {
    localStorage.removeItem(CACHE_FILLS_KEY);
    localStorage.removeItem(CACHE_FUNDING_KEY);
    localStorage.removeItem(CACHE_HOLDINGS_KEY);
    localStorage.removeItem(CACHE_POSITIONS_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    sessionStorage.clear();
    return;
  }

  const savedFills = localStorage.getItem(CACHE_FILLS_KEY);
  const savedFunding = localStorage.getItem(CACHE_FUNDING_KEY);
  const savedHoldings = localStorage.getItem(CACHE_HOLDINGS_KEY);
  const savedPositions = localStorage.getItem(CACHE_POSITIONS_KEY);

  if (savedFills) {
    try {
      fills = JSON.parse(savedFills);
      fundingHistory = savedFunding ? JSON.parse(savedFunding) : [];
      holdingsData = savedHoldings ? JSON.parse(savedHoldings) : null;
      activePositions = savedPositions ? JSON.parse(savedPositions) : [];
      if (fills.length > 0 || activePositions.length > 0) {
        updateCoinFilterOptions();
        renderTrades();
        renderContracts();
        if (activePositions.length > 0) {
          const uniqueCoins = [...new Set(activePositions.map(p => (p.position || p).coin))];
          initWebSocket(uniqueCoins);
          if (walletEl.value.trim()) {
            startFiveSecondPoller(walletEl.value.trim().toLowerCase());
          }
        }
        setStatus(`Loaded persisted data from local storage.`, "success");
      }
    } catch (e) {
      console.warn("Failed to load persisted storage data:", e);
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

  const wallet = walletEl.value.trim();
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
  fills = [];
  fundingHistory = [];
  holdingsData = null;
  xyzHoldingsData = null;
  activePositions = [];
  currentPage = 1;
  resetMetrics();

  try {
    setStatus("Fetching trade statement and active perpetual contracts from Hyperliquid…");

    const accountData = await fetchAccountData(wallet, s, e);
    fills = accountData.fills;
    fundingHistory = accountData.funding;
    holdingsData = accountData.holdings;
    activePositions = accountData.positions;

    localStorage.setItem(CACHE_FILLS_KEY, JSON.stringify(fills));
    localStorage.setItem(CACHE_FUNDING_KEY, JSON.stringify(fundingHistory));
    localStorage.setItem(CACHE_HOLDINGS_KEY, JSON.stringify(holdingsData));
    localStorage.setItem(CACHE_POSITIONS_KEY, JSON.stringify(activePositions));
    localStorage.setItem(CACHE_TIME_KEY, Date.now());

    updateCoinFilterOptions();
    renderTrades();
    renderContracts();

    if (activePositions.length > 0) {
      const uniqueCoins = [...new Set(activePositions.map(p => (p.position || p).coin))];
      initWebSocket(uniqueCoins);
      startFiveSecondPoller(wallet.toLowerCase());
    }

    if (accountData.reachedGlobalLimit) {
      noticeEl.textContent = "Hyperliquid API returned maximum fill capacity (10,000). Older fills may be omitted.";
      noticeEl.classList.remove("hidden");
    }

    setStatus(`Successfully fetched trades and ${activePositions.length} active perpetual contract(s).`, "success");
  } catch (err) {
    console.error(err);
    setStatus("Error fetching data: " + (err?.message || "Check network connection or wallet address."), "error");
  } finally {
    fetchBtn.disabled = false;
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
  if (targetFills.length) {
    downloadBlob(toCSV(targetFills), `hyperliquid-statement-${walletEl.value.trim().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  }
});

jsonBtn.addEventListener("click", () => {
  const targetFills = getFilteredFills();
  if (targetFills.length) {
    const mappedFills = targetFills.map(f => ({ ...f, sideFormatted: mapSide(f.side) }));
    downloadBlob(JSON.stringify({ fills: mappedFills, fundingHistory, holdings: holdingsData, positions: activePositions }, null, 2), `hyperliquid-statement-${walletEl.value.trim().slice(0, 10)}.json`, "application/json");
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

    const wallet = walletEl.value.trim();
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
allBtn.addEventListener("click", () => setPreset("30"));

$("clearBtn").addEventListener("click", () => {
  walletEl.value = "";
  if (pollTimer) clearInterval(pollTimer);
  if (wsConnection) wsConnection.close();
  localStorage.removeItem(SAVED_WALLET_KEY);
  localStorage.removeItem(CACHE_FILLS_KEY);
  localStorage.removeItem(CACHE_FUNDING_KEY);
  localStorage.removeItem(CACHE_HOLDINGS_KEY);
  localStorage.removeItem(CACHE_POSITIONS_KEY);
  localStorage.removeItem(CACHE_TIME_KEY);
  sessionStorage.clear();
  setPreset("30");
  fills = [];
  fundingHistory = [];
  holdingsData = null;
  xyzHoldingsData = null;
  activePositions = [];
  previousMetricsMap = {};
  previousNumericValues = {};
  pnlFilterSelect.value = "all";
  coinFilterSelect.innerHTML = '<option value="all">All Coins</option>';
  clearStatus();
  noticeEl.classList.add("hidden");
  bodyEl.innerHTML = '<tr class="empty-row"><td colspan="12">Enter a valid wallet address to display trade history.</td></tr>';
  contractsBodyEl.innerHTML = '<tr class="empty-row"><td colspan="7">Enter a valid wallet address to view active contracts.</td></tr>';
  dailyBodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">Enter a valid wallet address to view daily breakdown.</td></tr>';
  monthlyBodyEl.innerHTML = '<tr class="empty-row"><td colspan="6">Enter a valid wallet address to view monthly breakdown.</td></tr>';
  tableMeta.textContent = "No data loaded.";
  contractsMeta.textContent = "No data loaded.";
  dailyMeta.textContent = "No data loaded.";
  monthlyMeta.textContent = "No data loaded.";
  resetMetrics();
});

walletEl.addEventListener("keydown", e => { if (e.key === "Enter") fetchBtn.click(); });