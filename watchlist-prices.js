/**
 * Hyperliquid Pro - Watchlist & Live Prices Module (Fixed Non-Scrolling & Event Propagation)
 */

(function () {
  const PRICES_API = "https://api.hyperliquid.xyz/info";
  const PRICES_WS_URL = "wss://api.hyperliquid.xyz/ws";
  const SAVED_PRICE_WATCHLIST_KEY = "hyperliquid_price_watchlist_coins";

  let allAssetsData = [];
  window.hyperliquidAllAssetsData = [];

  let priceWatchlist = [];
  let pricesWs = null;
  let currentSearchQuery = "";
  let activeTab = "all";
  let clearWatchlistTimeout = null;
  let undoCountdownInterval = null;
  let activePopupChart = null;
  
  let currentChartCoin = "BTC";
  let currentChartInterval = "1d";
  let currentChartType = "candles"; // 'candles' or 'line'
  let expandedMobileCoin = null;

  const ASSET_NAME_MAP = {
    "CL": "WTI Crude Oil Futures",
    "BRENTOIL": "Brent Crude Oil",
    "GOLD": "Gold Spot / Futures",
    "SILVER": "Silver Spot / Futures",
    "ILV": "Silver / Illuvium Asset",
    "OP": "Copper / Optimism",
    "NATGAS": "Natural Gas Futures",
    "SP500": "S&P 500 Index",
    "GOOGL": "Alphabet / Google",
    "NVDA": "NVIDIA Corp",
    "AAPL": "Apple Inc"
  };

  window.addEventListener("DOMContentLoaded", () => {
    loadPriceWatchlist();
    initPricesModuleDOM();
    fetchAssetPricesData();
    startPricesWebSocket();
  });

  function loadPriceWatchlist() {
    try {
      const saved = localStorage.getItem(SAVED_PRICE_WATCHLIST_KEY);
      priceWatchlist = saved ? JSON.parse(saved) : [];
    } catch (e) {
      priceWatchlist = [];
    }
  }

  function savePriceWatchlist() {
    localStorage.setItem(SAVED_PRICE_WATCHLIST_KEY, JSON.stringify(priceWatchlist));
  }

  function initPricesModuleDOM() {
    if (document.getElementById("pricesModal")) return;

    const containerDiv = document.createElement("div");
    containerDiv.innerHTML = `
      <div id="pricesModal" class="modal hidden" onclick="event.stopPropagation()">
        <div class="modal-content" onclick="event.stopPropagation()" style="width: 860px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column; box-sizing: border-box;">
          <div class="modal-header">
            <h3>Markets & Watchlist</h3>
            <button id="closePricesModal" class="btn-ghost">✕</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; overflow: hidden; flex: 1; box-sizing: border-box;">
            
            <div class="prices-header-controls" style="display: flex; gap: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; width: 100%; box-sizing: border-box;">
              <div class="prices-tabs-group" style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap; flex: 1; min-width: 0;">
                <button id="tabAllCoins" class="secondary active" style="height: 32px; padding: 0 8px; font-size: 10px;" onclick="switchPricesTab('all')">All Markets</button>
                <button id="tabWatchlistCoins" class="secondary" style="height: 32px; padding: 0 8px; font-size: 10px;" onclick="switchPricesTab('watchlist')">⭐ Watchlist (<span id="watchlistCountBadge">${priceWatchlist.length}</span>)</button>
                <button id="tabHasFillsCoins" class="secondary" style="height: 32px; padding: 0 8px; font-size: 10px;" onclick="switchPricesTab('hasFills')">🎯 Has Fills</button>
                <button id="clearWatchlistBtn" class="btn-ghost" style="height: 32px; padding: 0 8px; font-size: 10px; color: var(--coinglass-red); border-color: rgba(246, 70, 93, 0.3);" onclick="clearAllWatchlist()" title="Clear Watchlist">Clear All</button>
              </div>
              <div class="prices-search-group" style="position: relative; display: flex; align-items: center; max-width: 200px; width: 100%; box-sizing: border-box; flex-shrink: 0;">
                <input id="pricesSearchInput" type="text" placeholder="Search asset..." style="width: 100%; height: 32px; font-size: 11px; padding-right: 32px; box-sizing: border-box;" oninput="handlePricesSearchInput(this.value)">
                <button id="clearSearchBtn" class="btn-ghost hidden" style="position: absolute; right: 4px; height: 24px; width: 24px; padding: 0; font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: center;" onclick="clearPricesSearch()" title="Clear search">✕</button>
              </div>
            </div>

            <!-- Undo Banner Container -->
            <div id="undoClearBanner" class="hidden" style="background: rgba(246, 70, 93, 0.12); border: 1px solid rgba(246, 70, 93, 0.35); padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--text-main); box-sizing: border-box;">
              <span id="undoClearText">Watchlist cleared. Clearing in 5s...</span>
              <button class="secondary" style="height: 26px; padding: 0 10px; font-size: 10.5px; background: var(--coinglass-red); color: #fff; border: none; font-weight: 700;" onclick="undoClearWatchlist()">Undo</button>
            </div>

            <div class="table-wrap" style="overflow-y: auto; overflow-x: hidden; max-height: 52vh; border: 1px solid var(--panel-border); border-radius: 6px; width: 100%; box-sizing: border-box;">
              <table class="coinglass-table prices-table" style="font-size: 11px; width: 100%; table-layout: fixed;">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 35px; padding-left: 6px;">⭐</th>
                    <th style="text-align: left; width: 28%;">ASSET</th>
                    <th class="pc-col pc-col-right" style="width: 15%;">PRICE</th>
                    <th class="pc-col pc-col-right" style="width: 12%;">24H</th>
                    <th class="pc-col pc-col-right" style="width: 12%;">FUNDING</th>
                    <th class="pc-col pc-col-right" style="width: 13%;">OI</th>
                    <th class="pc-col pc-col-right" style="text-align: right; width: 22%; padding-right: 8px;">ACTION</th>
                  </tr>
                </thead>
                <tbody id="pricesTableBody">
                  <tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">Loading all USDC perpetual markets from Hyperliquid...</td></tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      <!-- Asset Chart Popup Modal -->
      <div id="assetChartModal" class="modal hidden" onclick="event.stopPropagation()">
        <div class="modal-content" onclick="event.stopPropagation()" style="width: 960px; max-width: 95vw; height: 85vh; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;">
          <div class="modal-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <h3 id="chartModalTitle" style="margin: 0;">Asset Chart</h3>
              <div style="display: flex; gap: 2px; background: var(--input-bg); padding: 2px; border-radius: 4px; border: 1px solid var(--panel-border);">
                <button id="typeCandles" class="secondary active" style="height: 24px; padding: 0 8px; font-size: 9.5px;" onclick="setChartType('candles')">Candles</button>
                <button id="typeLine" class="secondary" style="height: 24px; padding: 0 8px; font-size: 9.5px;" onclick="setChartType('line')">Line</button>
              </div>
            </div>
            
            <div style="display: flex; gap: 3px; align-items: center; flex-wrap: wrap;">
              <button id="tf15m" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('15m')">15m</button>
              <button id="tf30m" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('30m')">30m</button>
              <button id="tf1h" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('1h')">1h</button>
              <button id="tf4h" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('4h')">4h</button>
              <button id="tf12h" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('12h')">12h</button>
              <button id="tf1d" class="secondary active" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('1d')">1d</button>
              <button id="tf1w" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('1w')">1w</button>
              <button id="tf2w" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('2w')">2w</button>
              <button id="tf1M" class="secondary" style="height: 26px; padding: 0 6px; font-size: 9.5px;" onclick="changeChartInterval('1M')">1M</button>
              <button id="closeChartModal" class="btn-ghost" style="margin-left: 6px;">✕</button>
            </div>
          </div>
          <div class="modal-body" style="flex: 1; padding: 16px; display: flex; flex-direction: column; background: #0b0e14; overflow: hidden; position: relative;" onclick="event.stopPropagation()">
            <div style="position: relative; width: 100%; height: 100%; flex: 1; overflow: hidden;" onclick="event.stopPropagation()">
              <canvas id="assetPopupCanvas"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;

    while (containerDiv.firstChild) {
      document.body.appendChild(containerDiv.firstChild);
    }

    document.getElementById("closePricesModal")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("pricesModal").classList.add("hidden");
    });

    document.getElementById("closeChartModal")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("assetChartModal").classList.add("hidden");
      if (activePopupChart) {
        activePopupChart.destroy();
        activePopupChart = null;
      }
    });

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("pricesModal");
      const chartModal = document.getElementById("assetChartModal");
      if (e.target === modal) modal.classList.add("hidden");
      if (e.target === chartModal) {
        chartModal.classList.add("hidden");
        if (activePopupChart) {
          activePopupChart.destroy();
          activePopupChart = null;
        }
      }
    });
  }

  window.openPricesModal = function() {
    const modal = document.getElementById("pricesModal");
    if (modal) {
      modal.classList.remove("hidden");
      renderPricesTable();
    }
  };

  window.openAssetChart = function(coin) {
    currentChartCoin = coin;
    currentChartInterval = "1d";
    currentChartType = "candles";
    updateChartControlsUI();
    fetchAndRenderAssetChart(currentChartCoin, currentChartInterval, currentChartType);
  };

  window.changeChartInterval = function(interval) {
    currentChartInterval = interval;
    updateChartControlsUI();
    fetchAndRenderAssetChart(currentChartCoin, currentChartInterval, currentChartType);
  };

  window.setChartType = function(type) {
    currentChartType = type;
    updateChartControlsUI();
    fetchAndRenderAssetChart(currentChartCoin, currentChartInterval, currentChartType);
  };

  function updateChartControlsUI() {
    ["15m", "30m", "1h", "4h", "12h", "1d", "1w", "2w", "1M"].forEach(tf => {
      const btn = document.getElementById(`tf${tf}`);
      if (btn) {
        if (tf === currentChartInterval) {
          btn.classList.add("active");
          btn.style.background = "var(--panel-border)";
          btn.style.borderColor = "var(--coinglass-blue)";
        } else {
          btn.classList.remove("active");
          btn.style.background = "transparent";
          btn.style.borderColor = "var(--panel-border)";
        }
      }
    });

    ["candles", "line"].forEach(t => {
      const btn = document.getElementById(`type${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        if (t === currentChartType) {
          btn.classList.add("active");
          btn.style.background = "var(--panel-border)";
          btn.style.borderColor = "var(--coinglass-blue)";
        } else {
          btn.classList.remove("active");
          btn.style.background = "transparent";
          btn.style.borderColor = "var(--panel-border)";
        }
      }
    });
  }

  async function fetchAndRenderAssetChart(coin, interval, chartType) {
    const modal = document.getElementById("assetChartModal");
    const title = document.getElementById("chartModalTitle");
    if (!modal) return;

    title.textContent = `${coin} — Live Price History (${interval.toUpperCase()} • ${chartType.toUpperCase()})`;
    modal.classList.remove("hidden");

    if (activePopupChart) {
      activePopupChart.destroy();
      activePopupChart = null;
    }

    let apiSymbol = `${coin.toUpperCase()}USDT`;
    const upper = coin.toUpperCase();
    if (upper === "GOLD") apiSymbol = "PAXGUSDT";
    else if (upper === "SILVER" || upper === "CL" || upper === "BRENTOIL" || upper === "NATGAS" || upper === "SP500") apiSymbol = "BTCUSDT";

    try {
      let binanceInterval = interval;
      if (interval === "2w") binanceInterval = "1w";
      if (interval === "1M") binanceInterval = "1M";

      const limit = 60; // Keep fixed so candles fit nicely without scrolling

      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${binanceInterval}&limit=${limit}`);
      if (!res.ok) throw new Error("Network response failed");
      const rawData = await res.json();

      if (!Array.isArray(rawData) || rawData.length === 0) throw new Error("No data");

      const labels = rawData.map(k => {
        const d = new Date(k[0]);
        return ["15m", "30m", "1h", "4h", "12h"].includes(interval)
          ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
      });

      let allPrices = [];
      rawData.forEach(k => {
        allPrices.push(parseFloat(k[2]));
        allPrices.push(parseFloat(k[3]));
      });
      const minPrice = Math.min(...allPrices);
      const maxPrice = Math.max(...allPrices);
      const pricePadding = (maxPrice - minPrice) * 0.08;

      const canvasCtx = document.getElementById("assetPopupCanvas").getContext("2d");

      if (chartType === "candles") {
        const lows = rawData.map(k => parseFloat(k[3]));
        const highs = rawData.map(k => parseFloat(k[2]));
        const opens = rawData.map(k => parseFloat(k[1]));
        const closes = rawData.map(k => parseFloat(k[4]));

        const candleColors = closes.map((c, i) => c >= opens[i] ? "#00b87c" : "#f6465d");

        activePopupChart = new Chart(canvasCtx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Wick',
                data: rawData.map(k => [parseFloat(k[3]), parseFloat(k[2])]),
                backgroundColor: candleColors,
                borderColor: candleColors,
                borderWidth: 1.5,
                barThickness: 1.5,
                borderRadius: 0
              },
              {
                label: 'Body',
                data: rawData.map(k => [Math.min(parseFloat(k[1]), parseFloat(k[4])), Math.max(parseFloat(k[1]), parseFloat(k[4]))]),
                backgroundColor: candleColors,
                borderColor: candleColors,
                borderWidth: 0,
                barThickness: 5,
                borderRadius: 1
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const idx = context.dataIndex;
                    const o = opens[idx], h = highs[idx], l = lows[idx], c = closes[idx];
                    return [`Open: $${o}`, `High: $${h}`, `Low: $${l}`, `Close: $${c}`];
                  }
                },
                backgroundColor: '#121721',
                titleColor: '#f0f4f8',
                bodyColor: '#00b87c',
                borderColor: '#1e2638',
                borderWidth: 1
              }
            },
            scales: {
              x: {
                grid: { color: '#161b22' },
                ticks: { color: '#8492a6', font: { size: 9 }, maxTicksLimit: 12 }
              },
              y: {
                min: minPrice - pricePadding,
                max: maxPrice + pricePadding,
                grid: { color: '#161b22' },
                ticks: { color: '#8492a6', font: { size: 10 } }
              }
            }
          }
        });

      } else {
        const prices = rawData.map(k => parseFloat(k[4]));
        const isPositive = prices[prices.length - 1] >= prices[0];
        const lineColor = isPositive ? "#00b87c" : "#f6465d";

        activePopupChart = new Chart(canvasCtx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{
              label: `${coin} Price ($)`,
              data: prices,
              borderColor: lineColor,
              backgroundColor: isPositive ? 'rgba(0, 184, 124, 0.1)' : 'rgba(246, 70, 93, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.2,
              pointRadius: 1,
              pointHoverRadius: 5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: '#121721',
                titleColor: '#f0f4f8',
                bodyColor: '#00b87c',
                borderColor: '#1e2638',
                borderWidth: 1
              }
            },
            scales: {
              x: {
                grid: { color: '#161b22' },
                ticks: { color: '#8492a6', font: { size: 9 }, maxTicksLimit: 12 }
              },
              y: {
                min: minPrice - pricePadding,
                max: maxPrice + pricePadding,
                grid: { color: '#161b22' },
                ticks: { color: '#8492a6', font: { size: 10 } }
              }
            }
          }
        });
      }

    } catch (err) {
      console.warn("Chart render failed:", err);
    }
  }

  window.switchPricesTab = function(tab) {
    activeTab = tab;
    document.getElementById("tabAllCoins")?.classList.toggle("active", tab === "all");
    document.getElementById("tabWatchlistCoins")?.classList.toggle("active", tab === "watchlist");
    document.getElementById("tabHasFillsCoins")?.classList.toggle("active", tab === "hasFills");
    renderPricesTable();
  };

  window.handlePricesSearchInput = function(query) {
    currentSearchQuery = query.toLowerCase().trim();
    const clearBtn = document.getElementById("clearSearchBtn");
    if (clearBtn) {
      if (query.length > 0) {
        clearBtn.classList.remove("hidden");
      } else {
        clearBtn.classList.add("hidden");
      }
    }
    renderPricesTable();
  };

  window.clearPricesSearch = function() {
    const input = document.getElementById("pricesSearchInput");
    if (input) {
      input.value = "";
      handlePricesSearchInput("");
    }
  };

  let cachedWatchlistBeforeClear = [];

  window.clearAllWatchlist = function() {
    if (priceWatchlist.length === 0) return;
    cachedWatchlistBeforeClear = [...priceWatchlist];
    
    priceWatchlist = [];
    savePriceWatchlist();
    updateWatchlistCountUI();
    renderPricesTable();

    const banner = document.getElementById("undoClearBanner");
    const textSpan = document.getElementById("undoClearText");
    if (banner && textSpan) {
      banner.classList.remove("hidden");
      let secondsLeft = 5;
      textSpan.textContent = `Watchlist cleared. Undoing available for ${secondsLeft}s...`;

      if (undoCountdownInterval) clearInterval(undoCountdownInterval);
      if (clearWatchlistTimeout) clearTimeout(clearWatchlistTimeout);

      undoCountdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          textSpan.textContent = `Watchlist cleared. Undoing available for ${secondsLeft}s...`;
        } else {
          clearInterval(undoCountdownInterval);
        }
      }, 1000);

      clearWatchlistTimeout = setTimeout(() => {
        banner.classList.add("hidden");
        cachedWatchlistBeforeClear = [];
      }, 5000);
    }
  };

  window.undoClearWatchlist = function() {
    if (cachedWatchlistBeforeClear.length > 0) {
      priceWatchlist = [...cachedWatchlistBeforeClear];
      savePriceWatchlist();
      cachedWatchlistBeforeClear = [];
    }

    if (clearWatchlistTimeout) clearTimeout(clearWatchlistTimeout);
    if (undoCountdownInterval) clearInterval(undoCountdownInterval);

    const banner = document.getElementById("undoClearBanner");
    if (banner) banner.classList.add("hidden");

    updateWatchlistCountUI();
    renderPricesTable();
  };

  function updateWatchlistCountUI() {
    const badge = document.getElementById("watchlistCountBadge");
    if (badge) badge.textContent = priceWatchlist.length;
  }

  window.togglePriceWatchlist = function(coin) {
    const idx = priceWatchlist.indexOf(coin);
    if (idx > -1) {
      priceWatchlist.splice(idx, 1);
    } else {
      priceWatchlist.push(coin);
    }
    savePriceWatchlist();
    
    const btn = document.getElementById(`watchlist-btn-${coin}`);
    const isStarred = priceWatchlist.includes(coin);
    if (btn) {
      btn.textContent = isStarred ? "★" : "☆";
      btn.style.color = isStarred ? "#f59e0b" : "var(--text-muted)";
    }
    updateWatchlistCountUI();
    if (activeTab === "watchlist") renderPricesTable();
  };

  window.togglePricesMobileCard = function(target, coin) {
    if (window.innerWidth <= 768) {
      const tr = target.closest("tr");
      if (tr) {
        const wasExpanded = tr.classList.contains("expanded");
        document.querySelectorAll("#pricesTableBody tr.expanded").forEach(row => {
          row.classList.remove("expanded");
        });
        if (!wasExpanded) {
          tr.classList.add("expanded");
          expandedMobileCoin = coin;
        } else {
          expandedMobileCoin = null;
        }
      }
    }
  };

  async function fetchAssetPricesData() {
    try {
      const [nativeRes, xyzRes] = await Promise.all([
        fetch(PRICES_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs" })
        }).then(res => res.json()).catch(() => null),

        fetch(PRICES_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "metaAndAssetCtxs", dex: "xyz" })
        }).then(res => res.json()).catch(() => null)
      ]);

      let parsedAssets = [];

      if (Array.isArray(nativeRes) && nativeRes.length >= 2) {
        const universe = nativeRes[0]?.universe || [];
        const assetCtxs = nativeRes[1] || [];
        universe.forEach((meta, index) => {
          const ctx = assetCtxs[index] || {};
          const coin = meta.name || `Asset${index}`;
          const markPx = Number(ctx.markPx || 0);
          const prevDayPx = Number(ctx.prevDayPx || markPx);
          parsedAssets.push({
            coin,
            pair: `${coin}-PERP`,
            fullName: ASSET_NAME_MAP[coin] || `${coin} Perpetual`,
            markPx,
            change24h: prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0,
            funding: Number(ctx.funding || 0),
            openInterest: Number(ctx.openInterest || 0),
            venue: "Native"
          });
        });
      }

      if (Array.isArray(xyzRes) && xyzRes.length >= 2) {
        const universe = xyzRes[0]?.universe || [];
        const assetCtxs = xyzRes[1] || [];
        universe.forEach((meta, index) => {
          const ctx = assetCtxs[index] || {};
          const rawName = meta.name || `XYZ_${index}`;
          const coin = rawName.includes(":") ? rawName.split(":")[1] : rawName;
          const markPx = Number(ctx.markPx || 0);
          const prevDayPx = Number(ctx.prevDayPx || markPx);
          if (!parsedAssets.some(a => a.coin === coin)) {
            parsedAssets.push({
              coin,
              pair: `xyz:${coin}-PERP`,
              fullName: ASSET_NAME_MAP[coin] || `${coin} Perpetual`,
              markPx,
              change24h: prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0,
              funding: Number(ctx.funding || 0),
              openInterest: Number(ctx.openInterest || 0),
              venue: "XYZ"
            });
          }
        });
      }

      allAssetsData = parsedAssets;
      window.hyperliquidAllAssetsData = parsedAssets;
      renderPricesTable();
    } catch (e) {
      console.warn("Failed to fetch perpetual asset prices:", e);
    }
  }

  function startPricesWebSocket() {
    if (pricesWs) pricesWs.close();
    pricesWs = new WebSocket(PRICES_WS_URL);

    pricesWs.onopen = () => {
      pricesWs.send(JSON.stringify({
        method: "subscribe",
        subscription: { type: "allMids" }
      }));
    };

    pricesWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === "allMids" && msg.data?.mids) {
          const mids = msg.data.mids;
          let updated = false;

          allAssetsData.forEach(item => {
            const key = item.venue === "XYZ" ? `xyz:${item.coin}` : item.coin;
            if (mids[key] !== undefined || mids[item.coin] !== undefined) {
              const newPx = Number(mids[key] || mids[item.coin]);
              if (newPx !== item.markPx) {
                item.markPx = newPx;
                updated = true;
              }
            }
          });

          window.hyperliquidAllAssetsData = allAssetsData;

          if (updated && !document.getElementById("pricesModal")?.classList.contains("hidden")) {
            renderPricesTable();
          }
        }
      } catch (err) {
        console.error("Prices WS parse error:", err);
      }
    };

    pricesWs.onclose = () => {
      setTimeout(startPricesWebSocket, 5000);
    };
  }

  function renderPricesTable() {
    const tbody = document.getElementById("pricesTableBody");
    if (!tbody) return;

    const coinSelect = document.getElementById("coinFilterSelect");
    const activeFilteredCoin = coinSelect ? coinSelect.value : "all";
    const cleanActiveFiltered = activeFilteredCoin.toUpperCase().replace("XYZ:", "").replace("-PERP", "").trim();

    const normalizedFillsCoins = new Set();
    if (typeof fills !== "undefined" && Array.isArray(fills)) {
      fills.forEach(f => {
        if (f.coin) {
          const raw = String(f.coin).toUpperCase().trim();
          const clean = raw.replace("-PERP", "").replace("XYZ:", "").trim();
          normalizedFillsCoins.add(raw);
          normalizedFillsCoins.add(clean);
        }
      });
    }

    let filtered = allAssetsData;

    if (activeTab === "watchlist") {
      filtered = filtered.filter(item => priceWatchlist.includes(item.coin));
    } else if (activeTab === "hasFills") {
      filtered = filtered.filter(item => {
        const itemCoinRaw = String(item.coin || "").toUpperCase().trim();
        const itemCoinClean = itemCoinRaw.replace("-PERP", "").replace("XYZ:", "").trim();
        return normalizedFillsCoins.has(itemCoinRaw) || 
               normalizedFillsCoins.has(itemCoinClean) ||
               Array.from(normalizedFillsCoins).some(c => c.includes(itemCoinClean) || itemCoinClean.includes(c));
      });
    }

    if (currentSearchQuery) {
      filtered = filtered.filter(item => 
        item.coin.toLowerCase().includes(currentSearchQuery) || 
        item.pair.toLowerCase().includes(currentSearchQuery) ||
        item.fullName.toLowerCase().includes(currentSearchQuery)
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No perpetual markets found matching criteria.</td></tr>';
      return;
    }

    const grouped = {
      "Metals & Commodities": [],
      "Indices & Equities": [],
      "Cryptocurrencies": []
    };

    filtered.forEach(item => {
      const upperCoin = item.coin.toUpperCase();
      if (["GOLD", "SILVER", "CL", "BRENTOIL", "NATGAS"].includes(upperCoin)) {
        grouped["Metals & Commodities"].push(item);
      } else if (["SP500", "GOOGL", "NVDA", "AAPL"].includes(upperCoin)) {
        grouped["Indices & Equities"].push(item);
      } else {
        grouped["Cryptocurrencies"].push(item);
      }
    });

    let finalHtml = "";

    Object.keys(grouped).forEach(categoryName => {
      const assetsInCat = grouped[categoryName];
      if (!assetsInCat || assetsInCat.length === 0) return;

      finalHtml += `
        <tr class="category-header-row" style="background: var(--input-bg); border-top: 2px solid var(--panel-border); border-bottom: 1px solid var(--panel-border);">
          <td colspan="7" style="padding: 8px 12px; font-size: 11px; font-weight: 800; color: var(--coinglass-blue); letter-spacing: 0.8px; text-transform: uppercase;">
            📁 ${categoryName} (${assetsInCat.length})
          </td>
        </tr>
      `;

      assetsInCat.forEach(item => {
        const isStarred = priceWatchlist.includes(item.coin);
        const starIcon = isStarred ? "★" : "☆";
        const starColor = isStarred ? "#f59e0b" : "var(--text-muted)";
        const changeClass = item.change24h > 0 ? "text-positive" : item.change24h < 0 ? "text-negative" : "";
        const changeStr = (item.change24h > 0 ? "+" : "") + item.change24h.toFixed(2) + "%";
        const fundingPct = (item.funding * 100).toFixed(4) + "%";
        const fundingClass = item.funding > 0 ? "text-positive" : item.funding < 0 ? "text-negative" : "";

        const formattedPrice = item.markPx >= 1 ? item.markPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.markPx.toFixed(6);

        const itemCoinRaw = String(item.coin || "").toUpperCase().trim();
        const itemCoinClean = itemCoinRaw.replace("-PERP", "").replace("XYZ:", "").trim();
        
        const hasFills = normalizedFillsCoins.has(itemCoinRaw) || 
                         normalizedFillsCoins.has(itemCoinClean) ||
                         Array.from(normalizedFillsCoins).some(c => c.includes(itemCoinClean) || itemCoinClean.includes(c));

        const isCurrentlyFiltered = activeFilteredCoin.toUpperCase() !== "ALL" && (
          activeFilteredCoin.toUpperCase() === itemCoinRaw || 
          activeFilteredCoin.toUpperCase() === itemCoinClean ||
          cleanActiveFiltered === itemCoinClean ||
          cleanActiveFiltered.includes(itemCoinClean) ||
          itemCoinClean.includes(cleanActiveFiltered)
        );

        let actionLabel = "Filter Fills";
        let actionClass = "secondary";
        let actionStyle = "height: 26px; padding: 0 6px; font-size: 10px; white-space: nowrap;";

        if (isCurrentlyFiltered) {
          actionLabel = "Unfilter";
          actionClass = "btn-ghost";
          actionStyle = "height: 26px; padding: 0 6px; font-size: 10px; color: var(--coinglass-red); border-color: var(--coinglass-red); white-space: nowrap;";
        } else if (!hasFills) {
          actionLabel = "No Fills";
          actionClass = "secondary";
          actionStyle = "height: 26px; padding: 0 6px; font-size: 10px; opacity: 0.4; cursor: not-allowed; background: transparent; border-color: var(--panel-border); color: var(--text-muted); white-space: nowrap;";
        }

        const clickHandler = hasFills || isCurrentlyFiltered ? `toggleCoinFilter('${item.coin}')` : `alert('This asset (${item.coin}) does not have any trade fills recorded in your statement.')`;
        const isThisExpanded = (expandedMobileCoin === item.coin) ? "expanded" : "";

        finalHtml += `
          <tr class="asset-card-row ${isThisExpanded}" onclick="togglePricesMobileCard(this, '${item.coin}')">
            <!-- PC Columns -->
            <td class="pc-col" style="text-align: left; width: 35px; padding-left: 8px;" onclick="event.stopPropagation()">
              <button id="watchlist-btn-${item.coin}" class="btn-ghost" style="padding: 0 4px; font-size: 15px; color: ${starColor};" onclick="togglePriceWatchlist('${item.coin}')" title="Toggle Watchlist">${starIcon}</button>
            </td>
            <td class="pc-col" style="text-align: left;">
              <div style="font-weight: 800; color: var(--text-main);">${item.coin}</div>
              <div style="font-size: 9.5px; font-weight: normal; color: var(--text-muted);">${item.fullName}</div>
            </td>
            <td class="pc-col" style="text-align: right; font-weight: 700;">$${formattedPrice}</td>
            <td class="pc-col" style="text-align: right;" class="${changeClass}">${changeStr}</td>
            <td class="pc-col" style="text-align: right;" class="${fundingClass}">${fundingPct}</td>
            <td class="pc-col" style="text-align: right;">${item.openInterest > 0 ? Math.round(item.openInterest).toLocaleString() : "—"}</td>
            <td class="pc-col" style="text-align: right; padding-right: 8px;" onclick="event.stopPropagation()">
              <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center;">
                <button class="secondary" style="height: 26px; padding: 0 6px; font-size: 10px; white-space: nowrap;" onclick="openAssetChart('${item.coin}')" title="View Chart">Chart</button>
                <button class="${actionClass}" style="${actionStyle}" onclick="${clickHandler}">${actionLabel}</button>
              </div>
            </td>

            <!-- Mobile Card Wrapper Cell -->
            <td class="mobile-card-wrapper-cell" style="display:none; padding:0; width:100%;">
              <div style="position: absolute; top: 8px; left: 8px; z-index: 2;" onclick="event.stopPropagation()">
                <button class="btn-ghost" style="padding: 0 4px; font-size: 15px; color: ${starColor};" onclick="togglePriceWatchlist('${item.coin}')">${starIcon}</button>
              </div>
              <div class="mobile-card-header" style="padding-left: 28px;">
                <div style="display: flex; flex-direction: column;">
                  <span class="coin-name" style="font-size: 13px;">${item.coin}</span>
                  <span style="font-size: 10px; font-weight: normal; color: var(--text-muted);">${item.fullName}</span>
                </div>
                <div class="mobile-header-right">
                  <span class="prices-mobile-price-preview" style="font-weight:700; color: var(--text-main);">$${formattedPrice}</span>
                  <button class="mobile-card-toggle-btn" type="button" aria-label="Toggle details">▼</button>
                </div>
              </div>
              <div class="asset-detail-wrapper">
                <div class="asset-detail-inner">
                  <div class="collapsible-detail-row">
                    <span class="mobile-label-text">24H CHANGE</span>
                    <span class="${changeClass}">${changeStr}</span>
                  </div>
                  <div class="collapsible-detail-row">
                    <span class="mobile-label-text">FUNDING RATE</span>
                    <span class="${fundingClass}">${fundingPct}</span>
                  </div>
                  <div class="collapsible-detail-row">
                    <span class="mobile-label-text">OPEN INTEREST</span>
                    <span>${item.openInterest > 0 ? Math.round(item.openInterest).toLocaleString() : "—"}</span>
                  </div>
                  <div class="collapsible-detail-row" style="border-bottom: none; justify-content: flex-end; gap: 6px; padding-top: 8px;" onclick="event.stopPropagation()">
                    <button class="secondary" style="height: 26px; padding: 0 8px; font-size: 10px;" onclick="openAssetChart('${item.coin}')">Chart</button>
                    <button class="${actionClass}" style="${actionStyle}" onclick="${clickHandler}">${actionLabel}</button>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      });
    });

    tbody.innerHTML = finalHtml;
  }

  window.toggleCoinFilter = function(coin) {
    const coinSelect = document.getElementById("coinFilterSelect");
    if (coinSelect) {
      let targetOptionValue = coin;
      let options = Array.from(coinSelect.options);
      
      const cleanTarget = coin.toUpperCase().replace("XYZ:", "").replace("-PERP", "").trim();

      let matchedOpt = options.find(opt => {
        const optVal = opt.value.toUpperCase();
        const cleanOpt = optVal.replace("XYZ:", "").replace("-PERP", "").trim();
        return cleanOpt === cleanTarget || 
               cleanOpt.includes(cleanTarget) || 
               cleanTarget.includes(cleanOpt) ||
               (cleanTarget === "SILVER" && cleanOpt.includes("SILVER")) ||
               (cleanTarget === "SP500" && (cleanOpt.includes("SP500") || cleanOpt.includes("SPX")));
      });

      if (matchedOpt) {
        targetOptionValue = matchedOpt.value;
      }

      const currentVal = coinSelect.value.toUpperCase();
      const cleanCurrent = currentVal.replace("XYZ:", "").replace("-PERP", "").trim();

      if (cleanCurrent === cleanTarget || cleanCurrent.includes(cleanTarget) || cleanTarget.includes(cleanTarget)) {
        coinSelect.value = "all";
      } else {
        coinSelect.value = targetOptionValue;
      }
      
      coinSelect.dispatchEvent(new Event("change"));
    }

    const viewSelect = document.getElementById("viewSelect");
    if (viewSelect) {
      viewSelect.value = "trades";
      viewSelect.dispatchEvent(new Event("change"));
    }

    document.getElementById("pricesModal")?.classList.add("hidden");
  };

})();