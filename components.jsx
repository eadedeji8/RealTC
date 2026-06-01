// components.jsx — reusable primitives: JargonTerm, ExplainToggle, StockChart, BrandMark, Modal

const { useState, useEffect, useRef } = React;

// ── Money / number formatting ────────────────────────────────────────────────
const fmtMoney = (n) => "$" + Math.round(n).toLocaleString("en-US");
const fmtK = (n) => {
  if (n >= 1000) return "$" + (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + n;
};

// ── BrandMark ────────────────────────────────────────────────────────────────
// Geometric check/decoder glyph + wordmark.
function BrandMark({ size = 20 }) {
  return (
    <div className="brand" style={{ "--bm": size + "px" }}>
      <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden="true">
        <circle cx="14" cy="14" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
        <path d="M8 14 L12 18 L20 10" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span className="brand-word">Decoder</span>
    </div>
  );
}

// ── JargonTerm — hover/tap tooltip ──────────────────────────────────────────
function JargonTerm({ term, children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, flip: false });
  const ref = useRef(null);
  const def = JARGON[term] || JARGON[term?.toLowerCase()] || "No definition available.";

  const position = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const flip = r.top < 120;
    setCoords({ x: r.left + r.width / 2, y: flip ? r.bottom + 8 : r.top - 8, flip });
  };

  const show = () => { position(); setOpen(true); };
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={ref}
        className="jargon"
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.preventDefault(); open ? hide() : show(); }}
      >
        {children || term}
      </span>
      <span className="jargon-inline" aria-hidden="true">{def}</span>
      {open && ReactDOM.createPortal(
        <div
          className={"tooltip" + (coords.flip ? " flip" : "")}
          style={{ left: coords.x, top: coords.y }}
          role="tooltip"
        >
          <div className="tooltip-term">{term}</div>
          <div className="tooltip-def">{def}</div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── ExplainToggle — "explain this to me" inline expand ──────────────────────
function ExplainToggle({ label = "Explain this to me", children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="explain">
      <button className="explain-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="explain-icon" aria-hidden="true">{open ? "–" : "+"}</span>
        <span>{label}</span>
      </button>
      <div className={"explain-body" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="explain-inner">{children}</div>
      </div>
    </div>
  );
}

// ── getStockData client + recharts loader ───────────────────────────────────
// Mirrors lib/getStockData.ts. Browser uses the same cache + fallback shape.
const __stockCache = new Map();

const __STOCK_FALLBACKS = {
  SNAP: [
    ["2021-05", 62.80], ["2021-08", 76.50], ["2021-11", 50.30], ["2022-02", 41.20],
    ["2022-05", 19.10], ["2022-08", 11.60], ["2022-11", 9.10],  ["2023-02", 10.90],
    ["2023-05", 9.40],  ["2023-08", 9.80],  ["2023-11", 14.90], ["2024-02", 11.30],
    ["2024-05", 15.10], ["2024-08", 10.20], ["2024-11", 11.60], ["2025-02", 10.40],
    ["2025-05", 10.60], ["2025-08", 9.40],  ["2025-11", 9.60],  ["2026-02", 9.80],
    ["2026-04", 10.40],
  ],
  FIGMA: [
    ["2024-07", 33.00], ["2024-09", 41.50], ["2024-11", 58.20], ["2025-01", 72.10],
    ["2025-03", 64.80], ["2025-05", 81.40], ["2025-07", 95.20], ["2025-09", 88.60],
    ["2025-11", 102.30],["2026-01", 114.50],["2026-03", 108.90],["2026-04", 112.40],
  ],
  META: [
    ["2021-05", 328.70],["2021-08", 371.40],["2021-11", 324.50],["2022-02", 211.00],
    ["2022-05", 193.60],["2022-08", 163.20],["2022-11", 118.10],["2023-02", 174.50],
    ["2023-05", 263.80],["2023-08", 295.90],["2023-11", 327.10],["2024-02", 490.40],
    ["2024-05", 465.90],["2024-08", 521.30],["2024-11", 578.20],["2025-02", 682.50],
    ["2025-05", 620.10],["2025-08", 654.80],["2025-11", 598.30],["2026-02", 612.70],
    ["2026-04", 605.40],
  ],
  GOOGL: [
    ["2021-05", 118.40],["2021-08", 137.20],["2021-11", 142.90],["2022-02", 134.10],
    ["2022-05", 113.20],["2022-08", 109.50],["2022-11", 94.80], ["2023-02", 90.30],
    ["2023-05", 123.40],["2023-08", 137.60],["2023-11", 134.20],["2024-02", 140.10],
    ["2024-05", 176.80],["2024-08", 164.30],["2024-11", 174.90],["2025-02", 191.30],
    ["2025-05", 178.40],["2025-08", 195.60],["2025-11", 188.20],["2026-02", 192.70],
    ["2026-04", 186.50],
  ],
};

function __stockFallback(key) {
  const rows = __STOCK_FALLBACKS[key] || __STOCK_FALLBACKS.SNAP;
  return rows.map(([date, close]) => ({ date, close }));
}

async function getStockData(ticker) {
  const key = (ticker || "").toUpperCase().trim();
  if (!key) return __stockFallback("SNAP");
  if (__stockCache.has(key)) return __stockCache.get(key);

  const apiKey = typeof window !== "undefined" ? window.ALPHA_VANTAGE_KEY : undefined;
  if (!apiKey) {
    const fb = __stockFallback(key);
    __stockCache.set(key, fb);
    return fb;
  }

  try {
    const url = "https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY" +
      "&symbol=" + encodeURIComponent(key) + "&apikey=" + encodeURIComponent(apiKey);
    const res = await fetch(url);
    if (!res.ok) throw new Error("bad status");
    const json = await res.json();
    if (json.Note || json.Information || json["Error Message"] || !json["Monthly Time Series"]) {
      throw new Error("rate limit or error");
    }
    const points = Object.entries(json["Monthly Time Series"])
      .map(([date, row]) => ({ date: date.slice(0, 7), close: Number(row["4. close"]) }))
      .filter((p) => Number.isFinite(p.close))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .slice(-60);
    if (points.length === 0) throw new Error("empty series");
    __stockCache.set(key, points);
    return points;
  } catch {
    const fb = __stockFallback(key);
    __stockCache.set(key, fb);
    return fb;
  }
}

let __rechartsPromise = null;
function loadRecharts() {
  if (typeof window !== "undefined" && window.Recharts) return Promise.resolve(window.Recharts);
  if (__rechartsPromise) return __rechartsPromise;
  const loadScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("failed to load " + src));
    document.head.appendChild(s);
  });
  __rechartsPromise = (async () => {
    if (!window.PropTypes) await loadScript("https://unpkg.com/prop-types@15.8.1/prop-types.min.js");
    if (!window.Recharts) await loadScript("https://unpkg.com/recharts@2.12.7/umd/Recharts.js");
    return window.Recharts;
  })();
  return __rechartsPromise;
}

// ── StockChart — responsive line chart (recharts in ticker mode, SVG otherwise)
function StockChart({ data, annotations = [], height = 140, ticker }) {
  if (ticker) return <StockChartLive ticker={ticker} height={height} />;
  const wrapRef = useRef(null);
  const [w, setW] = useState(600);

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.round(e.contentRect.width));
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const padL = 8, padR = 8, padT = 18, padB = 22;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, height - padT - padB);

  const closes = data.map((d) => d[1]);
  const minV = Math.min(...closes);
  const maxV = Math.max(...closes);
  const span = Math.max(0.01, maxV - minV);
  const n = data.length;

  const xAt = (i) => padL + (i / (n - 1)) * innerW;
  const yAt = (v) => padT + innerH - ((v - minV) / span) * innerH;

  // Line path
  let d = "";
  data.forEach(([_, v], i) => {
    d += (i === 0 ? "M " : " L ") + xAt(i).toFixed(2) + " " + yAt(v).toFixed(2);
  });
  // Area path (line + close to bottom)
  const areaD = d + ` L ${xAt(n - 1).toFixed(2)} ${padT + innerH} L ${xAt(0).toFixed(2)} ${padT + innerH} Z`;

  const annIdx = annotations.map((a) => ({
    ...a,
    i: data.findIndex((d) => d[0] === a.date),
  })).filter((a) => a.i >= 0);

  // Year tick marks (Jan of each year)
  const yearTicks = data
    .map(([date], i) => ({ year: date.slice(0, 4), month: date.slice(5, 7), i }))
    .filter((t) => t.month === "01");

  return (
    <div className="chart" ref={wrapRef}>
      <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} role="img"
           aria-label="5-year stock price history">
        <defs>
          <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <line key={i} x1={padL} x2={w - padR}
                y1={padT + innerH * f} y2={padT + innerH * f}
                stroke="var(--hairline)" strokeDasharray="2 3" />
        ))}

        {/* area + line */}
        <path d={areaD} fill="url(#stockGrad)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.6"
              strokeLinejoin="round" strokeLinecap="round" />

        {/* annotations */}
        {annIdx.map((a, i) => {
          const x = xAt(a.i);
          const y = yAt(data[a.i][1]);
          const leftSide = x < w / 2;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="var(--paper)"
                      stroke="var(--accent)" strokeWidth="1.4" />
              <line x1={x} y1={y} x2={x} y2={y - 10} stroke="var(--ink-40)" />
              <text x={leftSide ? x + 4 : x - 4} y={y - 12}
                    textAnchor={leftSide ? "start" : "end"}
                    className="chart-lbl">{a.label}</text>
            </g>
          );
        })}

        {/* year labels */}
        {yearTicks.map((t, i) => (
          <text key={i} x={xAt(t.i)} y={height - 6} textAnchor="middle"
                className="chart-axis">{t.year}</text>
        ))}
      </svg>
    </div>
  );
}

// ── StockChartLive — ticker-driven recharts line chart with price summary ───
function StockChartLive({ ticker, height = 180 }) {
  const [points, setPoints] = useState(null);
  const [Recharts, setRecharts] = useState(() =>
    (typeof window !== "undefined" ? window.Recharts : null) || null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    getStockData(ticker).then((pts) => { if (!cancelled) setPoints(pts); });
    if (!Recharts) {
      loadRecharts().then((R) => { if (!cancelled && R) setRecharts(R); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [ticker]);

  const ready = points && Recharts;

  if (!ready) {
    return (
      <div className="stock-live loading" aria-busy="true">
        <div className="stock-live-hd">
          <div className="stock-live-skel stock-live-skel-price" />
          <div className="stock-live-skel stock-live-skel-label" />
        </div>
        <div className="stock-live-skel stock-live-skel-chart"
             style={{ height: height + "px" }} />
        <div className="stock-live-foot">
          <div className="stock-live-skel stock-live-skel-stat" />
          <div className="stock-live-skel stock-live-skel-stat" />
        </div>
      </div>
    );
  }

  const { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = Recharts;
  const last = points[points.length - 1];
  const closes = points.map((p) => p.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);

  return (
    <div className="stock-live">
      <div className="stock-live-hd">
        <div className="stock-live-price">${last.close.toFixed(2)}</div>
        <div className="stock-live-label">
          {ticker.toUpperCase()} · current price ({last.date})
        </div>
      </div>
      <div className="stock-live-chart" style={{ height: height + "px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--ink-60)" }}
                   minTickGap={32} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--ink-60)" }}
                   width={36} tickLine={false} axisLine={false}
                   domain={["auto", "auto"]}
                   tickFormatter={(v) => "$" + Math.round(v)} />
            <Tooltip formatter={(v) => ["$" + Number(v).toFixed(2), "Close"]} />
            <Line type="monotone" dataKey="close" stroke="var(--accent)"
                  strokeWidth={1.8} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="stock-live-foot">
        <div className="stock-live-stat">
          <div className="stock-live-stat-l">All-time high</div>
          <div className="stock-live-stat-v up">${high.toFixed(2)}</div>
        </div>
        <div className="stock-live-stat">
          <div className="stock-live-stat-l">All-time low</div>
          <div className="stock-live-stat-v down">${low.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children, maxWidth = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return ReactDOM.createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div className="modal-title">{title}</div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ── CountUp — animates a number from 0 on mount ──────────────────────────────
function CountUp({ value, duration = 1100, format = fmtMoney }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = 0, to = value;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - t, 4);
      setN(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else setN(to);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(n)}</>;
}

Object.assign(window, {
  fmtMoney, fmtK,
  BrandMark, JargonTerm, ExplainToggle, StockChart, StockChartLive, Modal, CountUp,
  getStockData,
});
