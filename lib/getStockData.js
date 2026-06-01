// getStockData.js — CommonJS port of getStockData.ts.
// Fetches up to 5 years of monthly closes from Alpha Vantage, cached in memory
// by ticker. Falls back to a hardcoded series for SNAP / FIGMA / META / GOOGL on
// error, rate-limit, or missing key. The Alpha Vantage key stays server-side and
// is never shipped to the browser — the frontend calls /api/stock instead.

const memoryCache = new Map();

async function getStockData(ticker) {
  const key = (ticker || "").toUpperCase().trim();
  if (!key) return fallbackFor("SNAP");

  const cached = memoryCache.get(key);
  if (cached) return cached;

  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return cacheAndReturn(key, fallbackFor(key));

  try {
    const url =
      "https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY" +
      `&symbol=${encodeURIComponent(key)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return cacheAndReturn(key, fallbackFor(key));

    const json = await res.json();
    if (json.Note || json.Information || json["Error Message"]) {
      return cacheAndReturn(key, fallbackFor(key));
    }
    const series = json["Monthly Time Series"];
    if (!series) return cacheAndReturn(key, fallbackFor(key));

    const points = Object.entries(series)
      .map(([date, row]) => ({
        date: date.slice(0, 7),
        close: Number(row["4. close"]),
      }))
      .filter((p) => Number.isFinite(p.close))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(-60);

    if (points.length === 0) return cacheAndReturn(key, fallbackFor(key));
    return cacheAndReturn(key, points);
  } catch {
    return cacheAndReturn(key, fallbackFor(key));
  }
}

function cacheAndReturn(key, points) {
  memoryCache.set(key, points);
  return points;
}

function fallbackFor(ticker) {
  return FALLBACKS[ticker] || FALLBACKS.SNAP;
}

// Small hardcoded fallbacks — rough shape only, enough to render a chart.
const FALLBACKS = {
  SNAP: [
    { date: "2021-05", close: 62.80 }, { date: "2021-08", close: 76.50 },
    { date: "2021-11", close: 50.30 }, { date: "2022-02", close: 41.20 },
    { date: "2022-05", close: 19.10 }, { date: "2022-08", close: 11.60 },
    { date: "2022-11", close: 9.10 },  { date: "2023-02", close: 10.90 },
    { date: "2023-05", close: 9.40 },  { date: "2023-08", close: 9.80 },
    { date: "2023-11", close: 14.90 }, { date: "2024-02", close: 11.30 },
    { date: "2024-05", close: 15.10 }, { date: "2024-08", close: 10.20 },
    { date: "2024-11", close: 11.60 }, { date: "2025-02", close: 10.40 },
    { date: "2025-05", close: 10.60 }, { date: "2025-08", close: 9.40 },
    { date: "2025-11", close: 9.60 },  { date: "2026-02", close: 9.80 },
    { date: "2026-04", close: 10.40 },
  ],
  FIGMA: [
    { date: "2024-07", close: 33.00 }, { date: "2024-09", close: 41.50 },
    { date: "2024-11", close: 58.20 }, { date: "2025-01", close: 72.10 },
    { date: "2025-03", close: 64.80 }, { date: "2025-05", close: 81.40 },
    { date: "2025-07", close: 95.20 }, { date: "2025-09", close: 88.60 },
    { date: "2025-11", close: 102.30 }, { date: "2026-01", close: 114.50 },
    { date: "2026-03", close: 108.90 }, { date: "2026-04", close: 112.40 },
  ],
  META: [
    { date: "2021-05", close: 328.70 }, { date: "2021-08", close: 371.40 },
    { date: "2021-11", close: 324.50 }, { date: "2022-02", close: 211.00 },
    { date: "2022-05", close: 193.60 }, { date: "2022-08", close: 163.20 },
    { date: "2022-11", close: 118.10 }, { date: "2023-02", close: 174.50 },
    { date: "2023-05", close: 263.80 }, { date: "2023-08", close: 295.90 },
    { date: "2023-11", close: 327.10 }, { date: "2024-02", close: 490.40 },
    { date: "2024-05", close: 465.90 }, { date: "2024-08", close: 521.30 },
    { date: "2024-11", close: 578.20 }, { date: "2025-02", close: 682.50 },
    { date: "2025-05", close: 620.10 }, { date: "2025-08", close: 654.80 },
    { date: "2025-11", close: 598.30 }, { date: "2026-02", close: 612.70 },
    { date: "2026-04", close: 605.40 },
  ],
  GOOGL: [
    { date: "2021-05", close: 118.40 }, { date: "2021-08", close: 137.20 },
    { date: "2021-11", close: 142.90 }, { date: "2022-02", close: 134.10 },
    { date: "2022-05", close: 113.20 }, { date: "2022-08", close: 109.50 },
    { date: "2022-11", close: 94.80 },  { date: "2023-02", close: 90.30 },
    { date: "2023-05", close: 123.40 }, { date: "2023-08", close: 137.60 },
    { date: "2023-11", close: 134.20 }, { date: "2024-02", close: 140.10 },
    { date: "2024-05", close: 176.80 }, { date: "2024-08", close: 164.30 },
    { date: "2024-11", close: 174.90 }, { date: "2025-02", close: 191.30 },
    { date: "2025-05", close: 178.40 }, { date: "2025-08", close: 195.60 },
    { date: "2025-11", close: 188.20 }, { date: "2026-02", close: 192.70 },
    { date: "2026-04", close: 186.50 },
  ],
};

module.exports = { getStockData };
