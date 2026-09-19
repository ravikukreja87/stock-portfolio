const state = { symbols: [], portfolioSymbols: [], rows: [], filter: "all", visibleRows: 20, cache: JSON.parse(localStorage.getItem("marketLensScreeningCache") || "{}") };
const $ = (id) => document.getElementById(id);
const number = (value) => { const result = Number(String(value ?? "").replace(/,/g, "").replace("%", "")); return Number.isFinite(result) ? result : null; };
const uniqueSymbols = (symbols) => [...new Set(symbols.map((s) => String(s).trim().toUpperCase().replace(/\.(NS|BO)$/i, "")).filter((s) => /^[A-Z][A-Z0-9&-]{1,24}$/.test(s)))];
const formatPrice = (value) => value == null ? "—" : `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const showToast = (message) => { const toast = $("toast"); toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 3500); };
const persist = () => { localStorage.setItem("marketLensSymbols", JSON.stringify(state.symbols)); localStorage.setItem("marketLensPortfolio", JSON.stringify(state.portfolioSymbols)); $("nseCount").textContent = `${state.symbols.length} symbols`; $("portfolioCount").textContent = `${state.portfolioSymbols.length} symbols`; $("symbolInput").value = state.symbols.join("\n"); };
const setConnection = (connected, label) => { $("connectionLabel").textContent = label; document.querySelector(".status-dot").style.background = connected ? "var(--teal)" : "var(--yellow)"; };
const apiHeaders = () => { const key = $("apiKey").value.trim(); return key ? { "X-Api-Key": key, Authorization: "Bearer " + key } : {}; };
async function getApi(path, params = {}) { const url = new URL(`${$("apiBase").value.trim().replace(/\/$/, "")}${path}`); Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value)); const response = await fetch(url, { headers: apiHeaders() }); if (!response.ok) throw new Error(`${response.status} ${response.statusText}`); return response.json(); }
async function loadLocalFile(path) { const response = await fetch(`./${path}`); if (!response.ok) throw new Error(`${path} could not be loaded`); return uniqueSymbols((await response.text()).split(/[\s,;]+/)); }
const extractLatest = (datasets, metric) => { const item = datasets.find((entry) => String(entry.metric || entry.label || "").toLowerCase().includes(metric)); const values = item?.values || []; const latest = values[values.length - 1]; return Array.isArray(latest) ? number(latest[1]) : null; };
async function loadStock(symbol) {
  const cached = state.cache[symbol];
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) return cached.row;
  const historical = await getApi("/historical_data", { symbol, stock_name: symbol, period: "1yr", filter: "price" });
  const datasets = historical.datasets || historical.data?.datasets || [];
  const priceEntry = datasets.find((entry) => String(entry.metric || entry.label || "").toLowerCase().includes("price"));
  const prices = (priceEntry?.values || []).map((entry) => Array.isArray(entry) ? number(entry[1]) : null).filter((value) => value != null);
  const row = { symbol, company: symbol, price: prices.at(-1) ?? null, dma200: extractLatest(datasets, "dma200"), yearHigh: prices.length ? Math.max(...prices) : null, yearLow: prices.length ? Math.min(...prices) : null };
  state.cache[symbol] = { fetchedAt: Date.now(), row };
  localStorage.setItem("marketLensScreeningCache", JSON.stringify(state.cache));
  return row;
}
async function syncMarket() {
  const symbols = uniqueSymbols([...state.symbols, ...state.portfolioSymbols]);
  if (!symbols.length) { showToast("Nifty200.csv and Holdings.csv have no symbols."); return; }
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  if (apiBase === "https://stock.indianapi.in" && !$("apiKey").value.trim()) { showToast("Configure the Netlify proxy URL, or add a direct IndianAPI key."); $("settings").scrollIntoView({ behavior: "smooth" }); return; }
  $("syncButton").disabled = true; $("syncButton").textContent = "Syncing…"; setConnection(false, `Screening ${symbols.length} unique symbols`);
  const rows = [];
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = await Promise.all(symbols.slice(i, i + 5).map((symbol) => loadStock(symbol).catch((error) => ({ symbol, error: error.message }))));
    rows.push(...batch); state.rows = rows; renderRows(); $("tableSummary").textContent = `${rows.length} of ${symbols.length} symbols screened`;
  }
  state.rows = rows; renderRows(); updateMetrics(); $("lastUpdated").textContent = `Synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`; setConnection(true, "Connected"); $("syncButton").disabled = false; $("syncButton").innerHTML = "Sync market <span>↗</span>";
}
const signal = (row) => row.error ? ["Unavailable", "warning"] : row.price < row.dma200 ? ["Below DMA", "danger"] : row.price <= row.yearLow * 1.05 ? ["52W low zone", "warning"] : row.price >= row.yearHigh * .95 ? ["52W high zone", "good"] : ["Neutral", ""];
const filteredRows = () => state.rows.filter((row) => state.filter === "dma" ? row.price < row.dma200 : state.filter === "low" ? row.price <= row.yearLow * 1.05 : state.filter === "high" ? row.price >= row.yearHigh * .95 : true);
function renderRows() { const rows = filteredRows(); $("loadMore").hidden = rows.length <= state.visibleRows; $("tableSummary").textContent = `${rows.length} stocks loaded`; $("stockTable").innerHTML = rows.slice(0, state.visibleRows).map((row) => { const [label, className] = signal(row); const vs = row.price != null && row.dma200 != null ? `${((row.price / row.dma200 - 1) * 100).toFixed(1)}%` : "—"; return `<tr><td><div class="stock-name"><span class="stock-avatar">${row.symbol.slice(0, 2)}</span><span>${row.company || row.symbol}<small class="muted">${row.symbol}</small></span></div></td><td class="mono">${formatPrice(row.price)}</td><td class="mono">${formatPrice(row.dma200)}</td><td class="mono ${Number(vs) < 0 ? "negative" : "positive"}">${vs}</td><td class="mono">${formatPrice(row.yearLow)} <span class="muted">—</span> ${formatPrice(row.yearHigh)}</td><td><span class="signal ${className}">${label}</span></td></tr>`; }).join("") || `<tr><td colspan="6" class="empty-state"><div class="empty-icon">⌁</div><strong>No stocks match this filter</strong></td></tr>`; }
function updateMetrics() { const rows = state.rows.filter((row) => row.price != null); const below = rows.filter((row) => row.price < row.dma200).length; const low = rows.filter((row) => row.price <= row.yearLow * 1.05).length; const high = rows.filter((row) => row.price >= row.yearHigh * .95).length; $("belowDmaCount").textContent = below; $("lowCount").textContent = low; $("highCount").textContent = high; $("belowDmaPercent").textContent = rows.length ? `${Math.round(below / rows.length * 100)}% of universe` : "Waiting for data"; $("lowPercent").textContent = rows.length ? `${Math.round(low / rows.length * 100)}% of universe` : "Within 5%"; $("highPercent").textContent = rows.length ? `${Math.round(high / rows.length * 100)}% of universe` : "Within 5%"; }
function initialise() { $("apiKey").value = localStorage.getItem("marketLensApiKey") || ""; $("apiBase").value = localStorage.getItem("marketLensApiBase") || "https://stock.indianapi.in"; $("apiKey").addEventListener("change", () => localStorage.setItem("marketLensApiKey", $("apiKey").value)); $("apiBase").addEventListener("change", () => localStorage.setItem("marketLensApiBase", $("apiBase").value)); $("syncButton").addEventListener("click", syncMarket); $("heroImport").addEventListener("click", () => location.href = "./lists.html?list=portfolio"); $("filterTabs").addEventListener("click", (event) => { const button = event.target.closest("button"); if (!button) return; state.filter = button.dataset.filter; document.querySelectorAll("#filterTabs button").forEach((item) => item.classList.toggle("selected", item === button)); renderRows(); }); $("loadMore").addEventListener("click", () => { state.visibleRows += 20; renderRows(); }); Promise.all([loadLocalFile("Nifty200.csv"), loadLocalFile("Holdings.csv")]).then(([nse, portfolio]) => { state.symbols = nse; state.portfolioSymbols = portfolio; persist(); renderRows(); }).catch((error) => showToast(error.message)); }
initialise();
