const $ = (id) => document.getElementById(id);
const clean = (text) => [...new Set(text.split(/[\s,;]+/).map((item) => item.trim().toUpperCase().replace(/\.(NS|BO)$/i, "")).filter((item) => /^[A-Z][A-Z0-9&-]{1,24}$/.test(item)))];
const price = (value) => value == null ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const emptyRow = (message) => `<tr><td colspan="5" class="report-empty-row">${message}</td></tr>`;
const rowName = (row) => `<div class="stock-name"><span class="stock-avatar">${row.symbol.slice(0, 2)}</span><span>${row.symbol}<small class="muted">NSE</small></span></div>`;
const apiHeaders = () => { const key = localStorage.getItem("marketLensApiKey") || ""; return key ? { "X-Api-Key": key, Authorization: "Bearer " + key } : {}; };
const apiBase = () => (localStorage.getItem("marketLensApiBase") || "https://stock.indianapi.in").replace(/\/$/, "");

async function readSymbols(file) {
  const response = await fetch(`./${file}`);
  if (!response.ok) throw new Error(`${file} could not be loaded`);
  return clean(await response.text());
}

function render() {
  const cache = JSON.parse(localStorage.getItem("marketLensScreeningCache") || "{}");
  const rows = Object.values(cache).map((entry) => entry.row).filter(Boolean);
  const holdings = new Set(JSON.parse(localStorage.getItem("marketLensPortfolio") || "[]"));
  const nse = new Set(JSON.parse(localStorage.getItem("marketLensSymbols") || "[]"));
  const belowDma = rows.filter((row) => holdings.has(row.symbol) && row.price != null && row.dma200 != null && row.price < row.dma200).sort((a, b) => (a.price / a.dma200) - (b.price / b.dma200));
  const nearHigh = rows.filter((row) => nse.has(row.symbol) && row.price != null && row.dma200 != null && row.yearHigh != null && row.price >= row.yearHigh * .95 && row.price > row.dma200).sort((a, b) => (b.price / b.yearHigh) - (a.price / a.yearHigh));
  $("holdingsCount").textContent = belowDma.length;
  $("nseCount").textContent = nearHigh.length;
  $("holdingsTable").innerHTML = belowDma.length ? belowDma.map((row) => `<tr><td>${rowName(row)}</td><td class="mono">${price(row.price)}</td><td class="mono">${price(row.dma200)}</td><td class="mono negative">${((1 - row.price / row.dma200) * 100).toFixed(1)}%</td><td class="mono">${price(row.yearLow)} <span class="muted">—</span> ${price(row.yearHigh)}</td></tr>`).join("") : emptyRow("No holdings are currently below their 200 DMA.");
  $("nseTable").innerHTML = nearHigh.length ? nearHigh.map((row) => `<tr><td>${rowName(row)}</td><td class="mono">${price(row.price)}</td><td class="mono">${price(row.dma200)}</td><td class="mono positive">${price(row.yearHigh)}</td><td class="mono positive">${((row.yearHigh / row.price - 1) * 100).toFixed(1)}%</td></tr>`).join("") : emptyRow("No NSE 200 scrips currently match both conditions.");
  const timestamps = Object.values(cache).map((entry) => entry.fetchedAt).filter(Boolean);
  if (timestamps.length) $("reportTime").textContent = `Data ${new Date(Math.max(...timestamps)).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
  $("reportEmpty").hidden = rows.length > 0;
}

async function refreshData() {
  if (!window.confirm("Refresh report data now? This will make API calls for every unique symbol in Nifty200.csv and Holdings.csv.")) return;
  const key = localStorage.getItem("marketLensApiKey");
  if (!key) { window.alert("Add your API key on the Overview page before refreshing."); return; }
  const button = $("refreshReports");
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    const [nse, portfolio] = await Promise.all([readSymbols("Nifty200.csv"), readSymbols("Holdings.csv")]);
    const symbols = [...new Set([...nse, ...portfolio])];
    const cache = JSON.parse(localStorage.getItem("marketLensScreeningCache") || "{}");
    const load = async (symbol) => {
      const url = new URL(`${apiBase()}/historical_data`);
      url.searchParams.set("symbol", symbol); url.searchParams.set("stock_name", symbol); url.searchParams.set("period", "1yr"); url.searchParams.set("filter", "price");
      const response = await fetch(url, { headers: apiHeaders() });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const historical = await response.json();
      const datasets = historical.datasets || historical.data?.datasets || [];
      const priceEntry = datasets.find((entry) => String(entry.metric || entry.label || "").toLowerCase().includes("price"));
      const prices = (priceEntry?.values || []).map((entry) => Array.isArray(entry) ? Number(entry[1]) : null).filter(Number.isFinite);
      const dmaEntry = datasets.find((entry) => String(entry.metric || entry.label || "").toLowerCase().includes("dma200"));
      const dmaValues = dmaEntry?.values || [];
      const latest = dmaValues[dmaValues.length - 1];
      cache[symbol] = { fetchedAt: Date.now(), row: { symbol, company: symbol, price: prices.at(-1) ?? null, dma200: Array.isArray(latest) ? Number(latest[1]) : null, yearHigh: prices.length ? Math.max(...prices) : null, yearLow: prices.length ? Math.min(...prices) : null } };
    };
    for (let index = 0; index < symbols.length; index += 5) {
      await Promise.all(symbols.slice(index, index + 5).map((symbol) => load(symbol)));
      button.textContent = `Refreshing ${Math.min(index + 5, symbols.length)}/${symbols.length}…`;
    }
    localStorage.setItem("marketLensSymbols", JSON.stringify(nse));
    localStorage.setItem("marketLensPortfolio", JSON.stringify(portfolio));
    localStorage.setItem("marketLensScreeningCache", JSON.stringify(cache));
    render();
  } catch (error) {
    window.alert(`Refresh failed: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Refresh data ↻";
  }
}

async function initialise() {
  try {
    const [nse, portfolio] = await Promise.all([readSymbols("Nifty200.csv"), readSymbols("Holdings.csv")]);
    localStorage.setItem("marketLensSymbols", JSON.stringify(nse));
    localStorage.setItem("marketLensPortfolio", JSON.stringify(portfolio));
    render();
  } catch (error) {
    $("reportEmpty").hidden = false;
    $("reportEmpty").querySelector("span").textContent = error.message;
  }
}

initialise();
$("refreshReports").addEventListener("click", refreshData);
$("emptyRefresh").addEventListener("click", refreshData);
