// getStockData.js — CommonJS port of getStockData.ts.
// Fetches up to 5 years of monthly closes from Alpha Vantage, cached in memory
// by ticker. On missing key, error, rate-limit, or unknown ticker it returns an
// empty array — never a fabricated series — so the frontend can show a
// "couldn't load data for <TICKER>" message instead of another company's chart.
// The Alpha Vantage key stays server-side; the frontend calls /api/stock.

const memoryCache = new Map();

async function getStockData(ticker) {
  const key = (ticker || "").toUpperCase().trim();
  if (!key) return [];

  const cached = memoryCache.get(key);
  if (cached) return cached;

  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  // No real data available → return empty (never a fabricated series). Failures
  // aren't cached, so a transient rate-limit can recover on the next request.
  if (!apiKey) return [];

  try {
    const url =
      "https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY" +
      `&symbol=${encodeURIComponent(key)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const json = await res.json();
    if (json.Note || json.Information || json["Error Message"]) return [];

    const series = json["Monthly Time Series"];
    if (!series) return [];

    const points = Object.entries(series)
      .map(([date, row]) => ({
        date: date.slice(0, 7),
        close: Number(row["4. close"]),
      }))
      .filter((p) => Number.isFinite(p.close))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(-60);

    if (points.length === 0) return [];
    return cacheAndReturn(key, points);
  } catch {
    return [];
  }
}

function cacheAndReturn(key, points) {
  memoryCache.set(key, points);
  return points;
}

module.exports = { getStockData };
