/**
 * Hyperliquid Pro - Watchlist & Live Prices Module
 */

(function () {
  const PRICES_API = "https://api.hyperliquid.xyz/info";
  const PRICES_WS_URL = "wss://api.hyperliquid.xyz/ws";
  const SAVED_PRICE_WATCHLIST_KEY = "hyperliquid_price_watchlist_coins";

  let allAssetsData = [];
  let priceWatchlist = [];
  let pricesWs = null;
  let currentSearchQuery = "";
  let activeTab = "all";
  
  const expandedPricesCoins = new Set();

  const ASSET_NAME_MAP = {
    "CL": "WTI Crude Oil Futures",
    "BRENTOIL": "Brent Crude Oil",
    "GOLD": "Gold Spot / Futures",
    "SILVER": "Silver Spot / Futures",
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

    const modalHTML = `
      <div id="pricesModal" class="modal hidden">
        <div class="modal-content" style="width: 820px; max-width: 95vw; max-height: 85vh; display: flex; flex-direction: column;">
          <div class="modal-header">
            <h3>Hyperliquid USDC Perpetual Markets & Watchlist</h3>
            <button id="closePricesModal" class="btn-ghost">✕</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; overflow: hidden; flex: 1;">
            
            <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap;">
              <div style="display: flex; gap: 6px; align-items: center;">
                <button id="tabAllCoins" class="secondary active" style="height: 32px; padding: 0 12px; font-size: 11px;" onclick="switchPricesTab('all')">All Perpetual Markets</button>
                <button id="tabWatchlistCoins" class="secondary" style="height: 32px; padding: 0 12px; font-size: 11px;" onclick="switchPricesTab('watchlist')">⭐ Watchlist (${priceWatchlist.length})</button>
                <button id="clearWatchlistBtn" class="btn-ghost" style="height: 32px; padding: 0 8px; font-size: 10px; color: var(--coinglass-red);" onclick="clearAllWatchlist()" title="Clear Watchlist">Clear All</button>
              </div>
              <input id="pricesSearchInput" type="text" placeholder="Search asset (e.g. BTC, WTI, OIL, GOLD)..." style="max-width: 260px; height: 34px; font-size: 11px;" oninput="filterPricesSearch(this.value)">
            </div>

            <div class="table-wrap" style="overflow-y: auto; overflow-x: hidden; max-height: 52vh; border: 1px solid var(--panel-border); border-radius: 6px; width: 100%;">
              <table class="coinglass-table prices-table" style="font-size: 11.5px; width: 100%; table-layout: fixed;">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 40px;">⭐</th>
                    <th style="text-align: left;">PERP PAIR / ASSET</th>
                    <th>MARK PRICE</th>
                    <th>24H CHANGE</th>
                    <th>FUNDING RATE</th>
                    <th>OPEN INTEREST</th>
                    <th style="text-align: right;">ACTION</th>
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
    `;

    const div = document.createElement("div");
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);

    document.getElementById("closePricesModal")?.addEventListener("click", () => {
      document.getElementById("pricesModal").classList.add("hidden");
    });

    window.addEventListener("click", (e) => {
      const modal = document.getElementById("pricesModal");
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  window.openPricesModal = function() {
    const modal = document.getElementById("pricesModal");
    if (modal) {
      modal.classList.remove("hidden");
      renderPricesTable();
    }
  };

  window.switchPricesTab = function(tab) {
    activeTab = tab;
    document.getElementById("tabAllCoins")?.classList.toggle("active", tab === "all");
    document.getElementById("tabWatchlistCoins")?.classList.toggle("active", tab === "watchlist");
    renderPricesTable();
  };

  window.filterPricesSearch = function(query) {
    currentSearchQuery = query.toLowerCase().trim();
    renderPricesTable();
  };

  window.clearAllWatchlist = function() {
    priceWatchlist = [];
    savePriceWatchlist();
    document.getElementById("tabWatchlistCoins").textContent = `⭐ Watchlist (0)`;
    renderPricesTable();
  };

  window.togglePriceWatchlist = function(coin) {
    const idx = priceWatchlist.indexOf(coin);
    if (idx > -1) {
      priceWatchlist.splice(idx, 1);
    } else {
      priceWatchlist.push(coin);
    }
    savePriceWatchlist();
    
    // Instantly update the button style without full re-render if present
    const btn = document.getElementById(`watchlist-btn-${coin}`);
    const isStarred = priceWatchlist.includes(coin);
    if (btn) {
      btn.textContent = isStarred ? "★" : "☆";
      btn.style.color = isStarred ? "#f59e0b" : "var(--text-muted)";
    }
    document.getElementById("tabWatchlistCoins").textContent = `⭐ Watchlist (${priceWatchlist.length})`;
    if (activeTab === "watchlist") renderPricesTable();
  };

  window.togglePricesMobileCard = function(btnElement, coin) {
    if (window.innerWidth <= 768) {
      const tr = btnElement.closest("tr");
      if (tr) {
        const isAlreadyExpanded = tr.classList.contains("expanded");
        expandedPricesCoins.clear();
        document.querySelectorAll("#pricesTableBody tr.expanded").forEach(row => {
          row.classList.remove("expanded");
        });
        if (!isAlreadyExpanded) {
          tr.classList.add("expanded");
          expandedPricesCoins.add(coin);
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
            fullName: ASSET_NAME_MAP[coin] || coin,
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
              fullName: ASSET_NAME_MAP[coin] || coin,
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

    let filtered = allAssetsData;

    if (activeTab === "watchlist") {
      filtered = filtered.filter(item => priceWatchlist.includes(item.coin));
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

    tbody.innerHTML = filtered.map(item => {
      const isStarred = priceWatchlist.includes(item.coin);
      const starIcon = isStarred ? "★" : "☆";
      // Explicit vibrant yellow/gold color for favorited stars
      const starColor = isStarred ? "#f59e0b" : "var(--text-muted)";
      const changeClass = item.change24h > 0 ? "text-positive" : item.change24h < 0 ? "text-negative" : "";
      const changeStr = (item.change24h > 0 ? "+" : "") + item.change24h.toFixed(2) + "%";
      const fundingPct = (item.funding * 100).toFixed(4) + "%";
      const fundingClass = item.funding > 0 ? "text-positive" : item.funding < 0 ? "text-negative" : "";

      const formattedPrice = item.markPx >= 1 ? item.markPx.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.markPx.toFixed(6);

      const isCurrentlyFiltered = activeFilteredCoin === item.coin;
      const actionLabel = isCurrentlyFiltered ? "Unfilter" : "Filter Fills";
      const actionClass = isCurrentlyFiltered ? "btn-ghost" : "secondary";
      const actionStyle = isCurrentlyFiltered 
        ? "height: 26px; padding: 0 8px; font-size: 10px; color: var(--coinglass-red); border-color: var(--coinglass-red);" 
        : "height: 26px; padding: 0 8px; font-size: 10px;";

      const isExpanded = expandedPricesCoins.has(item.coin);

      return `
        <tr class="${isExpanded ? "expanded" : ""}" onclick="togglePricesMobileCard(this, '${item.coin}')" style="cursor: pointer;">
          <td style="text-align: left; width: 40px;" onclick="event.stopPropagation()">
            <button id="watchlist-btn-${item.coin}" class="btn-ghost" style="padding: 0 4px; font-size: 16px; color: ${starColor};" onclick="togglePriceWatchlist('${item.coin}')" title="Toggle Watchlist">${starIcon}</button>
          </td>
          <td style="text-align: left; font-weight: 800; color: var(--text-main);" class="prices-coin-name mobile-card-header">
            <span>${item.pair}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="prices-mobile-price-preview">$${formattedPrice}</span>
              <button class="mobile-card-toggle-btn" type="button" onclick="event.stopPropagation(); togglePricesMobileCard(this, '${item.coin}')">▼</button>
            </div>
          </td>
          <td class="prices-collapsible-detail"><span class="mobile-label-text">Mark Price</span><span>$${formattedPrice}</span></td>
          <td class="prices-collapsible-detail ${changeClass}"><span class="mobile-label-text">24h Change</span><span>${changeStr}</span></td>
          <td class="prices-collapsible-detail ${fundingClass}"><span class="mobile-label-text">Funding Rate</span><span>${fundingPct}</span></td>
          <td class="prices-collapsible-detail"><span class="mobile-label-text">Open Interest</span><span>${item.openInterest > 0 ? Math.round(item.openInterest).toLocaleString() : "—"}</span></td>
          <td style="text-align: right;" class="prices-collapsible-detail" onclick="event.stopPropagation()">
            <button class="${actionClass}" style="${actionStyle}" onclick="toggleCoinFilter('${item.coin}')">${actionLabel}</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  window.toggleCoinFilter = function(coin) {
    const coinSelect = document.getElementById("coinFilterSelect");
    if (coinSelect) {
      if (coinSelect.value === coin) {
        coinSelect.value = "all";
      } else {
        coinSelect.value = coin;
      }
      coinSelect.dispatchEvent(new Event("change"));
    }
    document.getElementById("pricesModal")?.classList.add("hidden");
  };

  window.loadCoinFilter = window.toggleCoinFilter;

})();