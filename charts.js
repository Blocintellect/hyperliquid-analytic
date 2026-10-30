const $ = id => document.getElementById(id);

let pnlChartInstance = null;
let feeChartInstance = null;
let assetBarInstance = null;

let rawGlobalFills = [];
let rawGlobalFunding = [];
let currentZoomRange = "all";

let analyticsCache = {
  peakPnl: 0,
  maxDrawdown: 0,
  totalWins: 0,
  totalLosses: 0,
  grossProfit: 0,
  grossLoss: 0,
  winLossRatioStr: "0.00",
  profitFactorVal: "0.00",
  avgTradeExpectancy: 0,
  maxWinStreak: 0,
  maxLossStreak: 0,
  bestTrade: { coin: "—", pnl: 0 },
  worstTrade: { coin: "—", pnl: 0 },
  longPnl: 0,
  longWinRate: 0,
  shortPnl: 0,
  shortWinRate: 0,
  sessionPnl: { asian: 0, london: 0, ny: 0 },
  durationPnl: { scalp: 0, intraday: 0, swing: 0 },
  avgRecoveryDays: 0,
  daysCount: 0
};

const CACHE_FILLS_KEY = "hyperliquid_persisted_fills";
const CACHE_FUNDING_KEY = "hyperliquid_persisted_funding";
const CACHE_TIME_KEY = "hyperliquid_cache_timestamp";
const SAVED_THEME_KEY = "hyperliquid_theme";

const statusEl = $("status");

function initTheme() {
  const currentTheme = localStorage.getItem(SAVED_THEME_KEY) || "dark";
  applyTheme(currentTheme);
}

function applyTheme(theme) {
  const themeIcon = $("themeIcon");
  const themeLabel = $("themeLabel");

  if (theme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
    if (themeIcon) themeIcon.textContent = "🌙";
    if (themeLabel) themeLabel.textContent = "Dark Mode";
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
    if (themeIcon) themeIcon.textContent = "☀️";
    if (themeLabel) themeLabel.textContent = "Light Mode";
  }
  localStorage.setItem(SAVED_THEME_KEY, theme);
  
  if (rawGlobalFills.length > 0) {
    applyDataZoomAndRender();
  }
}

$("themeToggleBtn")?.addEventListener("click", () => {
  const isLight = document.body.classList.contains("light-theme");
  applyTheme(isLight ? "dark" : "light");
});

initTheme();

const peakCard = $("peakCard"), peakModal = $("peakModal"), closePeakModal = $("closePeakModal");
const ddCard = $("ddCard"), ddModal = $("ddModal"), closeDdModal = $("closeDdModal");
const winLossCard = $("winLossCard"), winLossModal = $("winLossModal"), closeWinLossModal = $("closeWinLossModal");
const profitFactorCard = $("profitFactorCard"), profitFactorModal = $("profitFactorModal"), closeProfitFactorModal = $("closeProfitFactorModal");
const avgTradeCard = $("avgTradeCard"), avgTradeModal = $("avgTradeModal"), closeAvgTradeModal = $("closeAvgTradeModal");
const streakCard = $("streakCard"), streakModal = $("streakModal"), closeStreakModal = $("closeStreakModal");
const outlierCard = $("outlierCard"), outlierModal = $("outlierModal"), closeOutlierModal = $("closeOutlierModal");
const longShortCard = $("longShortCard"), longShortModal = $("longShortModal"), closeLongShortModal = $("closeLongShortModal");
const sessionCard = $("sessionCard"), sessionModal = $("sessionModal"), closeSessionModal = $("closeSessionModal");
const durationCard = $("durationCard"), durationModal = $("durationModal"), closeDurationModal = $("closeDurationModal");
const recoveryCard = $("recoveryCard"), recoveryModal = $("recoveryModal"), closeRecoveryModal = $("closeRecoveryModal");
const daysCard = $("daysCard"), daysModal = $("daysModal"), closeDaysModal = $("closeDaysModal");
const assetModal = $("assetModal"), closeAssetModal = $("closeAssetModal");

peakCard?.addEventListener("click", () => {
  $("modalPeakVal").textContent = money(analyticsCache.peakPnl, 2);
  peakModal.classList.remove("hidden");
});
closePeakModal?.addEventListener("click", () => peakModal.classList.add("hidden"));

ddCard?.addEventListener("click", () => {
  $("modalDdVal").textContent = "−" + plainMoney(analyticsCache.maxDrawdown, 2);
  ddModal.classList.remove("hidden");
});
closeDdModal?.addEventListener("click", () => ddModal.classList.add("hidden"));

winLossCard?.addEventListener("click", () => {
  $("modalWinsVal").textContent = analyticsCache.totalWins.toLocaleString();
  $("modalLossesVal").textContent = analyticsCache.totalLosses.toLocaleString();
  $("modalRatioVal").textContent = analyticsCache.winLossRatioStr;
  winLossModal.classList.remove("hidden");
});
closeWinLossModal?.addEventListener("click", () => winLossModal.classList.add("hidden"));

profitFactorCard?.addEventListener("click", () => {
  $("modalGrossProfit").textContent = money(analyticsCache.grossProfit, 2);
  $("modalGrossLoss").textContent = plainMoney(analyticsCache.grossLoss, 2);
  $("modalPfVal").textContent = analyticsCache.profitFactorVal;
  profitFactorModal.classList.remove("hidden");
});
closeProfitFactorModal?.addEventListener("click", () => profitFactorModal.classList.add("hidden"));

avgTradeCard?.addEventListener("click", () => {
  $("modalAvgVal").textContent = money(analyticsCache.avgTradeExpectancy, 2);
  avgTradeModal.classList.remove("hidden");
});
closeAvgTradeModal?.addEventListener("click", () => avgTradeModal.classList.add("hidden"));

streakCard?.addEventListener("click", () => {
  $("modalMaxWinStreak").textContent = analyticsCache.maxWinStreak.toLocaleString() + " Wins";
  $("modalMaxLossStreak").textContent = analyticsCache.maxLossStreak.toLocaleString() + " Losses";
  streakModal.classList.remove("hidden");
});
closeStreakModal?.addEventListener("click", () => streakModal.classList.add("hidden"));

outlierCard?.addEventListener("click", () => {
  $("modalBestTrade").textContent = `${analyticsCache.bestTrade.coin}: ${money(analyticsCache.bestTrade.pnl, 2)}`;
  $("modalWorstTrade").textContent = `${analyticsCache.worstTrade.coin}: ${money(analyticsCache.worstTrade.pnl, 2)}`;
  outlierModal.classList.remove("hidden");
});
closeOutlierModal?.addEventListener("click", () => outlierModal.classList.add("hidden"));

longShortCard?.addEventListener("click", () => {
  $("modalLongPnl").textContent = money(analyticsCache.longPnl, 2);
  $("modalLongWinRate").textContent = analyticsCache.longWinRate.toFixed(1) + "%";
  $("modalShortPnl").textContent = money(analyticsCache.shortPnl, 2);
  $("modalShortWinRate").textContent = analyticsCache.shortWinRate.toFixed(1) + "%";
  longShortModal.classList.remove("hidden");
});
closeLongShortModal?.addEventListener("click", () => longShortModal.classList.add("hidden"));

sessionCard?.addEventListener("click", () => {
  $("modalAsianPnl").textContent = money(analyticsCache.sessionPnl.asian, 2);
  $("modalLondonPnl").textContent = money(analyticsCache.sessionPnl.london, 2);
  $("modalNyPnl").textContent = money(analyticsCache.sessionPnl.ny, 2);
  sessionModal.classList.remove("hidden");
});
closeSessionModal?.addEventListener("click", () => sessionModal.classList.add("hidden"));

durationCard?.addEventListener("click", () => {
  $("modalScalpPnl").textContent = money(analyticsCache.durationPnl.scalp, 2);
  $("modalIntradayPnl").textContent = money(analyticsCache.durationPnl.intraday, 2);
  $("modalSwingPnl").textContent = money(analyticsCache.durationPnl.swing, 2);
  durationModal.classList.remove("hidden");
});
closeDurationModal?.addEventListener("click", () => durationModal.classList.add("hidden"));

recoveryCard?.addEventListener("click", () => {
  $("modalRecoveryDays").textContent = `${analyticsCache.avgRecoveryDays} Days`;
  recoveryModal.classList.remove("hidden");
});
closeRecoveryModal?.addEventListener("click", () => recoveryModal.classList.add("hidden"));

daysCard?.addEventListener("click", () => {
  $("modalDaysVal").textContent = analyticsCache.daysCount.toLocaleString();
  daysModal.classList.remove("hidden");
});
closeDaysModal?.addEventListener("click", () => daysModal.classList.add("hidden"));

closeAssetModal?.addEventListener("click", () => assetModal.classList.add("hidden"));

window.addEventListener("click", e => {
  if (e.target === peakModal) peakModal.classList.add("hidden");
  if (e.target === ddModal) ddModal.classList.add("hidden");
  if (e.target === winLossModal) winLossModal.classList.add("hidden");
  if (e.target === profitFactorModal) profitFactorModal.classList.add("hidden");
  if (e.target === avgTradeModal) avgTradeModal.classList.add("hidden");
  if (e.target === streakModal) streakModal.classList.add("hidden");
  if (e.target === outlierModal) outlierModal.classList.add("hidden");
  if (e.target === longShortModal) longShortModal.classList.add("hidden");
  if (e.target === sessionModal) sessionModal.classList.add("hidden");
  if (e.target === durationModal) durationModal.classList.add("hidden");
  if (e.target === recoveryModal) recoveryModal.classList.add("hidden");
  if (e.target === daysModal) daysModal.classList.add("hidden");
  if (e.target === assetModal) assetModal.classList.add("hidden");
});

document.querySelectorAll("#zoomPresetBtns button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#zoomPresetBtns button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentZoomRange = btn.getAttribute("data-range");
    applyDataZoomAndRender();
  });
});

function setStatus(m, t = "") {
  if (!statusEl) return;
  statusEl.textContent = m;
  statusEl.className = "status" + (t ? " " + t : "");
  statusEl.classList.remove("hidden");
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function money(v, d = 2) {
  const n = num(v), s = n > 0 ? "+" : n < 0 ? "−" : "";
  return s + "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function plainMoney(v, d = 2) {
  return "$" + num(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.addEventListener("DOMContentLoaded", () => {
  const cacheTime = Number(localStorage.getItem(CACHE_TIME_KEY) || 0);
  const isExpired = (Date.now() - cacheTime) > 7200000;

  if (isExpired) {
    localStorage.removeItem(CACHE_FILLS_KEY);
    localStorage.removeItem(CACHE_FUNDING_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    sessionStorage.clear();
    setStatus("Cached statement data has expired. Please fetch fresh data on the main statement page.", "error");
    return;
  }

  const savedFills = localStorage.getItem(CACHE_FILLS_KEY) || sessionStorage.getItem("hl_cached_fills");
  const savedFunding = localStorage.getItem(CACHE_FUNDING_KEY) || sessionStorage.getItem("hl_cached_funding");

  if (savedFills) {
    try {
      const fillsData = JSON.parse(savedFills);
      const fundingData = savedFunding ? JSON.parse(savedFunding) : [];
      
      if (fillsData.length > 0) {
        fillsData.sort((a, b) => Number(a.time) - Number(b.time));
        rawGlobalFills = fillsData;
        rawGlobalFunding = fundingData;
        applyDataZoomAndRender();
        setStatus(`Successfully extracted and analyzed ${fillsData.length.toLocaleString()} trade fill(s) from main statement.`, "success");
        return;
      }
    } catch (e) {
      console.warn("Error parsing persisted storage data:", e);
    }
  }

  setStatus("No active statement data found. Please enter your wallet and click 'Fetch Data' on the main statement page first.", "error");
});

function applyDataZoomAndRender() {
  if (!rawGlobalFills.length) return;

  let cutoffTime = 0;
  const now = Date.now();

  if (currentZoomRange === "7d") {
    cutoffTime = now - (7 * 86400000);
  } else if (currentZoomRange === "30d") {
    cutoffTime = now - (30 * 86400000);
  } else if (currentZoomRange === "90d") {
    cutoffTime = now - (90 * 86400000);
  } else if (currentZoomRange === "ytd") {
    cutoffTime = new Date(new Date().getFullYear(), 0, 1).getTime();
  }

  const filteredFills = cutoffTime > 0 ? rawGlobalFills.filter(f => Number(f.time) >= cutoffTime) : rawGlobalFills;
  const filteredFunding = cutoffTime > 0 ? rawGlobalFunding.filter(item => Number(item.time || item.delta?.time || 0) >= cutoffTime) : rawGlobalFunding;

  processAndRenderAnalytics(filteredFills, filteredFunding);
}

function processAndRenderAnalytics(fills, funding) {
  const dailyMap = {};
  const assetMap = {};
  let grossProfit = 0;
  let grossLoss = 0;

  let bestTrade = { coin: "—", pnl: -Infinity };
  let worstTrade = { coin: "—", pnl: Infinity };

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  let longPnl = 0, longWins = 0, longTotal = 0;
  let shortPnl = 0, shortWins = 0, shortTotal = 0;

  let sessionPnl = { asian: 0, london: 0, ny: 0 };
  let durationPnl = { scalp: 0, intraday: 0, swing: 0 };

  fills.forEach((f, idx, arr) => {
    const tMs = Number(f.time);
    const d = new Date(tMs);
    const dateKey = d.toISOString().split("T")[0];
    const coin = f.coin || "PERP";
    const side = String(f.side || "").toUpperCase();

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { netPnl: 0, fees: 0, wins: 0, losses: 0 };
    }

    if (!assetMap[coin]) {
      assetMap[coin] = { closedPnl: 0, fees: 0, netPnl: 0, volume: 0, fills: 0, wins: 0, losses: 0 };
    }

    const closedPnl = num(f.closedPnl);
    const tradingFee = num(f.fee);
    const builderFee = num(f.builderFee);
    const totalItemFee = tradingFee + builderFee;
    const netTradePnl = closedPnl - totalItemFee;
    const notionalVol = Math.abs(num(f.px) * num(f.sz));

    dailyMap[dateKey].netPnl += netTradePnl;
    dailyMap[dateKey].fees += totalItemFee;

    assetMap[coin].closedPnl += closedPnl;
    assetMap[coin].fees += totalItemFee;
    assetMap[coin].netPnl += netTradePnl;
    assetMap[coin].volume += notionalVol;
    assetMap[coin].fills += 1;

    if (side === "B" || side.includes("BUY")) {
      longPnl += netTradePnl;
      longTotal++;
      if (closedPnl > 0) longWins++;
    } else {
      shortPnl += netTradePnl;
      shortTotal++;
      if (closedPnl > 0) shortWins++;
    }

    const utcHour = d.getUTCHours();
    if (utcHour >= 0 && utcHour < 8) {
      sessionPnl.asian += netTradePnl;
    } else if (utcHour >= 8 && utcHour < 16) {
      sessionPnl.london += netTradePnl;
    } else {
      sessionPnl.ny += netTradePnl;
    }

    let timeDeltaMin = 30;
    if (idx < arr.length - 1 && arr[idx + 1].coin === coin) {
      timeDeltaMin = Math.abs(tMs - Number(arr[idx + 1].time)) / 60000;
    }
    if (timeDeltaMin < 15) {
      durationPnl.scalp += netTradePnl;
    } else if (timeDeltaMin <= 240) {
      durationPnl.intraday += netTradePnl;
    } else {
      durationPnl.swing += netTradePnl;
    }

    if (netTradePnl > bestTrade.pnl) {
      bestTrade = { coin, pnl: netTradePnl };
    }
    if (netTradePnl < worstTrade.pnl) {
      worstTrade = { coin, pnl: netTradePnl };
    }

    if (closedPnl > 0) {
      dailyMap[dateKey].wins += 1;
      assetMap[coin].wins += 1;
      grossProfit += closedPnl;

      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (closedPnl < 0) {
      dailyMap[dateKey].losses += 1;
      assetMap[coin].losses += 1;
      grossLoss += Math.abs(closedPnl);

      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    }
  });

  funding.forEach(item => {
    const timeVal = item.time || item.delta?.time;
    if (!timeVal) return;
    const d = new Date(Number(timeVal));
    const dateKey = d.toISOString().split("T")[0];
    const usdPayment = num(item.delta?.usdc);

    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { netPnl: 0, fees: 0, wins: 0, losses: 0 };
    }

    if (usdPayment < 0) {
      const paid = Math.abs(usdPayment);
      dailyMap[dateKey].fees += paid;
      dailyMap[dateKey].netPnl -= paid;
    } else {
      dailyMap[dateKey].netPnl += usdPayment;
    }
  });

  if (bestTrade.pnl === -Infinity) bestTrade = { coin: "—", pnl: 0 };
  if (worstTrade.pnl === Infinity) worstTrade = { coin: "—", pnl: 0 };

  const dates = Object.keys(dailyMap).sort();
  let cumulativePnl = 0;
  let cumulativeFeeDrag = 0;
  let peakPnl = -Infinity;
  let maxDrawdown = 0;
  let totalWins = 0;
  let totalLosses = 0;
  
  const cumulativePnlData = [];
  const cumulativeFeeData = [];

  let inDrawdown = false;
  let ddStartDayIndex = 0;
  let recoveryDaysSum = 0;
  let recoveryCount = 0;

  dates.forEach((date, idx) => {
    const dayObj = dailyMap[date];
    cumulativePnl += dayObj.netPnl;
    cumulativeFeeDrag += dayObj.fees;

    cumulativePnlData.push(cumulativePnl);
    cumulativeFeeData.push(cumulativeFeeDrag);

    if (cumulativePnl > peakPnl) {
      peakPnl = cumulativePnl;
      if (inDrawdown) {
        recoveryDaysSum += (idx - ddStartDayIndex);
        recoveryCount++;
        inDrawdown = false;
      }
    } else {
      const dd = peakPnl - cumulativePnl;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (!inDrawdown) {
        inDrawdown = true;
        ddStartDayIndex = idx;
      }
    }

    totalWins += dayObj.wins;
    totalLosses += dayObj.losses;
  });

  const avgRecoveryDays = recoveryCount > 0 ? Math.round(recoveryDaysSum / recoveryCount) : (dates.length > 0 ? Math.round(dates.length / 4) : 0);
  const avgTradeExpectancy = fills.length > 0 ? cumulativePnl / fills.length : 0;
  const winLossRatioStr = totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : totalWins > 0 ? "∞" : "0.00";
  const profitFactorVal = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";

  const longWinRate = longTotal > 0 ? (longWins / longTotal) * 100 : 0;
  const shortWinRate = shortTotal > 0 ? (shortWins / shortTotal) * 100 : 0;

  let topSessionName = "London";
  let maxSessionVal = sessionPnl.london;
  if (sessionPnl.asian > maxSessionVal) { maxSessionVal = sessionPnl.asian; topSessionName = "Asian"; }
  if (sessionPnl.ny > maxSessionVal) { maxSessionVal = sessionPnl.ny; topSessionName = "New York"; }

  analyticsCache = {
    peakPnl,
    maxDrawdown,
    totalWins,
    totalLosses,
    grossProfit,
    grossLoss,
    winLossRatioStr: `${winLossRatioStr} (${totalWins}W / ${totalLosses}L)`,
    profitFactorVal,
    avgTradeExpectancy,
    maxWinStreak,
    maxLossStreak,
    bestTrade,
    worstTrade,
    longPnl,
    longWinRate,
    shortPnl,
    shortWinRate,
    sessionPnl,
    durationPnl,
    avgRecoveryDays,
    daysCount: dates.length
  };

  if ($("statPeak")) $("statPeak").textContent = money(peakPnl, 2);
  if ($("statMaxDD")) $("statMaxDD").textContent = "−" + plainMoney(maxDrawdown, 2);
  if ($("statWinLoss")) $("statWinLoss").textContent = `${winLossRatioStr} (${totalWins}W / ${totalLosses}L)`;
  if ($("statProfitFactor")) $("statProfitFactor").textContent = profitFactorVal;
  if ($("statAvgTrade")) $("statAvgTrade").textContent = money(avgTradeExpectancy, 2);
  if ($("statStreak")) $("statStreak").textContent = `${maxWinStreak}W / ${maxLossStreak}L`;
  if ($("statOutliers")) $("statOutliers").textContent = `${bestTrade.coin} (+${money(bestTrade.pnl, 0)})`;
  if ($("statLongShort")) $("statLongShort").textContent = longPnl >= shortPnl ? `Longs (+${money(longPnl, 0)})` : `Shorts (+${money(shortPnl, 0)})`;
  if ($("statSession")) $("statSession").textContent = `${topSessionName} (${money(maxSessionVal, 0)})`;
  if ($("statDuration")) $("statDuration").textContent = durationPnl.scalp >= durationPnl.intraday ? "Scalps" : "Intraday";
  if ($("statRecovery")) $("statRecovery").textContent = `${avgRecoveryDays} Days`;
  if ($("statDays")) $("statDays").textContent = dates.length.toLocaleString();

  renderAssetTable(assetMap);
  renderAssetBarChart(assetMap);

  if (pnlChartInstance) pnlChartInstance.destroy();
  if (feeChartInstance) feeChartInstance.destroy();

  const chartTextColor = getComputedStyle(document.body).getPropertyValue('--text-muted') || '#8492a6';

  const ctxPnl = $("pnlLineChart").getContext("2d");
  pnlChartInstance = new Chart(ctxPnl, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Cumulative Net P&L ($)',
        data: cumulativePnlData,
        borderColor: '#00b87c',
        backgroundColor: 'rgba(0, 184, 124, 0.12)',
        fill: true,
        tension: 0.2,
        borderWidth: 2.5,
        pointRadius: dates.length > 50 ? 0 : 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' Cumulative Net P&L: ' + plainMoney(c.raw, 2) } }
      },
      scales: {
        x: { ticks: { color: chartTextColor, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: chartTextColor, callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });

  const ctxFee = $("feeDragChart").getContext("2d");
  feeChartInstance = new Chart(ctxFee, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Cumulative Fee & Funding Drag ($)',
        data: cumulativeFeeData,
        borderColor: '#f6465d',
        backgroundColor: 'rgba(246, 70, 93, 0.12)',
        fill: true,
        tension: 0.2,
        borderWidth: 2.5,
        pointRadius: dates.length > 50 ? 0 : 3,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' Cumulative Fee Drag: ' + plainMoney(c.raw, 2) } }
      },
      scales: {
        x: { ticks: { color: chartTextColor, maxTicksLimit: 6 }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: chartTextColor, callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderAssetBarChart(assetMap) {
  if (assetBarInstance) assetBarInstance.destroy();

  const sortedCoins = Object.keys(assetMap).sort((a, b) => assetMap[b].netPnl - assetMap[a].netPnl).slice(0, 10);
  const labels = sortedCoins;
  const dataVals = sortedCoins.map(c => assetMap[c].netPnl);
  const backgroundColors = dataVals.map(v => v >= 0 ? 'rgba(0, 184, 124, 0.7)' : 'rgba(246, 70, 93, 0.7)');

  const ctxBar = $("assetBarChart").getContext("2d");
  const chartTextColor = getComputedStyle(document.body).getPropertyValue('--text-muted') || '#8492a6';

  assetBarInstance = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Net P&L ($)',
        data: dataVals,
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' Net P&L: ' + money(c.raw, 2) } }
      },
      scales: {
        x: { ticks: { color: chartTextColor }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: chartTextColor, callback: v => '$' + v.toLocaleString() }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderAssetTable(assetMap) {
  const assetBody = $("assetTableBody");
  if (!assetBody) return;

  const sortedCoins = Object.keys(assetMap).sort((a, b) => assetMap[b].netPnl - assetMap[a].netPnl);

  if (!sortedCoins.length) {
    assetBody.innerHTML = '<tr class="empty-row"><td colspan="6">No asset trading data available for selected range.</td></tr>';
    return;
  }

  let totalClosedPnl = 0;
  let totalFees = 0;
  let totalNetPnl = 0;
  let totalVolume = 0;
  let totalFills = 0;

  const rowsHtml = sortedCoins.map(coin => {
    const row = assetMap[coin];
    totalClosedPnl += row.closedPnl;
    totalFees += row.fees;
    totalNetPnl += row.netPnl;
    totalVolume += row.volume;
    totalFills += row.fills;

    return `
    <tr class="asset-card-row" data-coin="${esc(coin)}">
      <td class="coin-name-cell" style="padding: 0;">
        <div class="mobile-card-header">
          <span class="coin-name">${esc(coin)}</span>
          <div class="mobile-header-right">
            <span class="${row.netPnl >= 0 ? "text-positive" : "text-negative"}">${money(row.netPnl, 2)}</span>
            <button class="mobile-card-toggle-btn" aria-label="Toggle details">▼</button>
          </div>
        </div>
        <div class="asset-detail-wrapper">
          <div class="asset-detail-inner">
            <div class="collapsible-detail-row">
              <span class="mobile-label-text">CLOSED P&L</span>
              <span class="${row.closedPnl >= 0 ? "text-positive" : "text-negative"}">${money(row.closedPnl, 2)}</span>
            </div>
            <div class="collapsible-detail-row">
              <span class="mobile-label-text">TOTAL FEES</span>
              <span>${plainMoney(row.fees, 2)}</span>
            </div>
            <div class="collapsible-detail-row">
              <span class="mobile-label-text">NET P&L</span>
              <span class="${row.netPnl >= 0 ? "text-positive" : "text-negative"}">${money(row.netPnl, 2)}</span>
            </div>
            <div class="collapsible-detail-row">
              <span class="mobile-label-text">TOTAL VOLUME</span>
              <span>${plainMoney(row.volume, 2)}</span>
            </div>
            <div class="collapsible-detail-row" style="border-bottom: none;">
              <span class="mobile-label-text">FILLS COUNT</span>
              <span>${row.fills.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </td>
      <td style="display:none;"></td><td style="display:none;"></td><td style="display:none;"></td><td style="display:none;"></td><td style="display:none;"></td>
    </tr>`;
  }).join("");

  const totalRowHtml = `
  <tr class="asset-total-row">
    <td class="coin-name-cell" style="padding: 0;">
      <div class="mobile-card-header">
        <span class="coin-name">TOTAL / SUMMARY</span>
        <div class="mobile-header-right">
          <span class="${totalNetPnl >= 0 ? "text-positive" : "text-negative"}">${money(totalNetPnl, 2)}</span>
          <button class="mobile-card-toggle-btn" aria-label="Toggle details">▼</button>
        </div>
      </div>
      <div class="asset-detail-wrapper">
        <div class="asset-detail-inner">
          <div class="collapsible-detail-row">
            <span class="mobile-label-text">CLOSED P&L</span>
            <span class="${totalClosedPnl >= 0 ? "text-positive" : "text-negative"}">${money(totalClosedPnl, 2)}</span>
          </div>
          <div class="collapsible-detail-row">
            <span class="mobile-label-text">TOTAL FEES</span>
            <span>${plainMoney(totalFees, 2)}</span>
          </div>
          <div class="collapsible-detail-row">
            <span class="mobile-label-text">NET P&L</span>
            <span class="${totalNetPnl >= 0 ? "text-positive" : "text-negative"}">${money(totalNetPnl, 2)}</span>
          </div>
          <div class="collapsible-detail-row">
            <span class="mobile-label-text">TOTAL VOLUME</span>
            <span>${plainMoney(totalVolume, 2)}</span>
          </div>
          <div class="collapsible-detail-row" style="border-bottom: none;">
            <span class="mobile-label-text">FILLS COUNT</span>
            <span>${totalFills.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </td>
    <td style="display:none;"></td><td style="display:none;"></td><td style="display:none;"></td><td style="display:none;"></td><td style="display:none;"></td>
  </tr>`;

  assetBody.innerHTML = rowsHtml + totalRowHtml;

  assetBody.querySelectorAll(".asset-card-row, .asset-total-row").forEach(tr => {
    tr.addEventListener("click", (e) => {
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        const wasExpanded = tr.classList.contains("expanded");
        assetBody.querySelectorAll(".asset-card-row, .asset-total-row").forEach(row => {
          row.classList.remove("expanded");
        });
        
        if (!wasExpanded) {
          tr.classList.add("expanded");
        }
      } else {
        e.preventDefault();
        const coin = tr.getAttribute("data-coin");
        if (!coin) return;
        const data = assetMap[coin];
        if (!data) return;

        $("modalAssetTitle").textContent = `${coin} — Performance Details`;
        $("modalAssetClosedPnl").textContent = money(data.closedPnl, 2);
        $("modalAssetClosedPnl").className = data.closedPnl >= 0 ? "text-positive" : "text-negative";
        $("modalAssetFees").textContent = plainMoney(data.fees, 2);
        $("modalAssetNetPnl").textContent = money(data.netPnl, 2);
        $("modalAssetNetPnl").className = data.netPnl >= 0 ? "text-positive" : "text-negative";
        $("modalAssetVolume").textContent = plainMoney(data.volume, 2);
        $("modalAssetFills").textContent = data.fills.toLocaleString();
        $("modalAssetWinLoss").textContent = `${data.wins}W / ${data.losses}L`;

        assetModal.classList.remove("hidden");
      }
    });
  });

  if ($("tableMeta")) {
    $("tableMeta").textContent = `Displaying performance across ${sortedCoins.length} traded asset market(s).`;
  }
}