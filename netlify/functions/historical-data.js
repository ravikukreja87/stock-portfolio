const allowedPeriods = new Set(["1m", "6m", "1yr", "3yr", "5yr", "10yr", "max"]);
const allowedFilters = new Set(["default", "price", "pe", "sm", "evebitda", "ptb", "mcs"]);

exports.handler = async (event) => {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "GET") return { statusCode: 405, headers, body: JSON.stringify({ error: "Only GET is supported." }) };

  const params = event.queryStringParameters || {};
  const symbol = String(params.symbol || params.stock_name || "").trim().toUpperCase().replace(/\.(NS|BO)$/i, "");
  const period = params.period || "1yr";
  const filter = params.filter || "price";

  if (!/^[A-Z][A-Z0-9&-]{1,24}$/.test(symbol)) return { statusCode: 400, headers, body: JSON.stringify({ error: "A valid NSE symbol is required." }) };
  if (!allowedPeriods.has(period) || !allowedFilters.has(filter)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Unsupported historical-data parameters." }) };
  if (!process.env.INDIAN_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "INDIAN_API_KEY is not configured on Netlify." }) };

  const upstream = new URL("https://stock.indianapi.in/historical_data");
  upstream.searchParams.set("symbol", symbol);
  upstream.searchParams.set("stock_name", symbol);
  upstream.searchParams.set("period", period);
  upstream.searchParams.set("filter", filter);

  try {
    const response = await fetch(upstream, {
      headers: {
        "X-Api-Key": process.env.INDIAN_API_KEY,
        Authorization: `Bearer ${process.env.INDIAN_API_KEY}`
      }
    });
    const body = await response.text();
    return { statusCode: response.status, headers, body };
  } catch (error) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: "IndianAPI is unreachable.", detail: error.message }) };
  }
};
