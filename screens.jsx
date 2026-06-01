// screens.jsx — full detail screens: Equity, Layoffs, Negotiation Email
// These are full pages (not modals). They share a <ScreenShell> wrapper.

const { useState: uS, useMemo: uM, useEffect: uE } = React;

// ── Shared screen shell ─────────────────────────────────────────────────────
function ScreenShell({ eyebrow, title, lede, onBack, children, toc }) {
  return (
    <div className="screen">
      <button className="screen-back" onClick={onBack}>
        <span aria-hidden="true">←</span>
        <span>Back to your offer</span>
      </button>
      <header className="screen-hd">
        <div className="screen-eyebrow">{eyebrow}</div>
        <h1 className="screen-title">{title}</h1>
        {lede && <p className="screen-lede">{lede}</p>}
      </header>
      {toc && <nav className="screen-toc">{toc}</nav>}
      <div className="screen-body">{children}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EQUITY DETAIL SCREEN
// ────────────────────────────────────────────────────────────────────────────

function EquityScreen({ onBack }) {
  const [scenario, setScenario] = uS("flat"); // flat | up | down | custom
  const [customPct, setCustomPct] = uS(0);
  const [livePrice, setLivePrice] = uS(null);

  const isPrivate = BRIEF.isPublic === false || !BRIEF.ticker;

  // Pull the latest real close for the company ticker (display only — totals are
  // share-count invariant). Falls back to the demo series price.
  uE(() => {
    let cancelled = false;
    if (BRIEF.ticker) {
      getStockData(BRIEF.ticker).then((pts) => {
        if (!cancelled && pts && pts.length) setLivePrice(pts[pts.length - 1].close);
      });
    }
    return () => { cancelled = true; };
  }, []);

  const taxRate = Y1.combinedTax || 0.3765;
  const today = livePrice || STOCK_HISTORY[STOCK_HISTORY.length - 1][1];
  // Total shares granted: RSU grant / current price
  const totalShares = Math.round(OFFER.rsuTotal / today);
  const sharesPerYear = totalShares / OFFER.rsuYears; // 25% year 1, then quarterly

  // Scenario price trajectory over 4 years (relative to today)
  const scenarios = {
    flat: { label: "Stock stays flat", sub: "Price unchanged from today", endPct: 0 },
    up:   { label: "Stock up 50%", sub: "Optimistic case — company recovers", endPct: 50 },
    down: { label: "Stock down 50%", sub: "Pessimistic case — another drawdown", endPct: -50 },
    custom: { label: "Custom", sub: `${customPct >= 0 ? "+" : ""}${customPct}% over 4 years`, endPct: customPct },
  };
  const endPct = scenarios[scenario].endPct;

  // Simulate 16 quarterly vests (cliff at Q4, then quarterly Q5-Q16).
  // Linear interpolation of price from today to endPct over 16 quarters.
  const vests = uM(() => {
    const out = [];
    for (let q = 1; q <= 16; q++) {
      const t = q / 16;
      const price = today * (1 + (endPct / 100) * t);
      let shares = 0;
      if (q === 4) shares = sharesPerYear; // cliff vest = full first year worth
      else if (q > 4) shares = sharesPerYear / 4; // quarterly after cliff
      const gross = shares * price;
      const taxed = gross * (1 - taxRate);
      out.push({ q, price, shares, gross, taxed });
    }
    return out;
  }, [endPct, sharesPerYear, today, taxRate]);

  const totalGross = vests.reduce((s, v) => s + v.gross, 0);
  const totalNet = vests.reduce((s, v) => s + v.taxed, 0);
  const offerSays = OFFER.rsuTotal;
  const delta = totalGross - offerSays;

  if (isPrivate) {
    return (
      <ScreenShell
        eyebrow="Equity reality check"
        title={`Your ${fmtMoney(OFFER.rsuTotal)} RSU grant — a private valuation.`}
        lede="This company isn't publicly traded, so there's no market price to model. That makes the equity the most uncertain part of your offer."
        onBack={onBack}
      >
        <section className="eq-section">
          <div className="equity-private">
            <p>{BRIEF.rsuNote || (
              <>For a private company, the <strong>{fmtMoney(OFFER.rsuTotal)}</strong> figure comes from an
              internal 409A valuation, not a public market. You can&rsquo;t sell these shares until a liquidity
              event (an IPO or acquisition) that may be years away &mdash; or never come. Treat this number as
              a hopeful maximum, not money you can count on.</>
            )}</p>
          </div>
          <div className="sec-hd" style={{ marginTop: 24 }}>
            <h2>What to ask before you sign.</h2>
          </div>
          <ol className="eq-takeaways">
            <li><strong>Ask for the strike price and total shares outstanding.</strong> Your grant&rsquo;s real
              worth depends on what fraction of the company it represents.</li>
            <li><strong>Ask about the last 409A / preferred valuation and date.</strong> A stale or inflated
              valuation makes the headline number misleading.</li>
            <li><strong>Ask about liquidity.</strong> Is there a tender-offer program, or do you wait for an exit?
              What happens to unvested shares if you leave?</li>
          </ol>
        </section>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      eyebrow="Equity reality check"
      title={`Your ${fmtMoney(OFFER.rsuTotal)} RSU grant, modeled honestly.`}
      lede="The offer letter shows one number. Your actual payout depends on when each chunk vests and what the stock is worth on that day. Here&rsquo;s what could realistically happen."
      onBack={onBack}
    >
      {/* Summary bar */}
      <div className="eq-summary">
        <div className="eq-sum-card">
          <div className="eq-sum-l">Offer letter says</div>
          <div className="eq-sum-v">{fmtMoney(offerSays)}</div>
          <div className="eq-sum-n">Today&rsquo;s price × total shares</div>
        </div>
        <div className="eq-sum-arrow" aria-hidden="true">→</div>
        <div className="eq-sum-card eq-sum-emph">
          <div className="eq-sum-l">What you might actually get</div>
          <div className="eq-sum-v">{fmtMoney(totalGross)}</div>
          <div className="eq-sum-n">{fmtMoney(totalNet)} after taxes &middot;{" "}
            <span className={delta >= 0 ? "eq-delta up" : "eq-delta down"}>
              {delta >= 0 ? "+" : ""}{fmtMoney(delta)} vs. offer
            </span>
          </div>
        </div>
      </div>

      {/* Scenario picker */}
      <section className="eq-section">
        <div className="sec-hd">
          <h2>Pick a scenario.</h2>
          <p>Try each one. This isn&rsquo;t a prediction &mdash; it&rsquo;s the range of outcomes you should
             plan for. Stocks move. Factor that into how much this offer is really worth to you.</p>
        </div>
        <div className="eq-scenarios">
          {Object.entries(scenarios).map(([k, s]) => (
            <button
              key={k}
              className={"eq-scenario" + (scenario === k ? " on" : "")}
              onClick={() => setScenario(k)}
            >
              <div className="eq-scenario-l">{s.label}</div>
              <div className="eq-scenario-s">{s.sub}</div>
            </button>
          ))}
        </div>
        {scenario === "custom" && (
          <div className="eq-custom">
            <label>4-year price change</label>
            <input
              type="range" min="-80" max="200" step="5" value={customPct}
              onChange={(e) => setCustomPct(Number(e.target.value))}
            />
            <span className="eq-custom-v">{customPct >= 0 ? "+" : ""}{customPct}%</span>
          </div>
        )}
      </section>

      {/* Vest schedule table */}
      <section className="eq-section">
        <div className="sec-hd">
          <h2>Your vest schedule, paid out.</h2>
          <p>One row per vesting event. The first row is your 1-year{" "}
             <JargonTerm term="cliff">cliff</JargonTerm> &mdash; 25% of your total shares land at once.
             After that, you get a small chunk every quarter for three more years.</p>
        </div>
        <div className="eq-table">
          <div className="eq-table-hd">
            <div>Quarter</div>
            <div>Shares vesting</div>
            <div>Price/share</div>
            <div>Value (gross)</div>
            <div>After tax</div>
          </div>
          {vests.map((v) => (
            <div key={v.q} className={"eq-table-row" + (v.q === 4 ? " cliff" : "")}>
              <div className="eq-q">
                Q{v.q}
                {v.q === 4 && <span className="eq-cliff-tag">cliff</span>}
              </div>
              <div>{v.shares > 0 ? v.shares.toFixed(0) : "—"}</div>
              <div>${v.price.toFixed(2)}</div>
              <div className={v.gross > 0 ? "eq-val" : "eq-val muted"}>
                {v.gross > 0 ? fmtMoney(v.gross) : "—"}
              </div>
              <div className={v.gross > 0 ? "eq-val" : "eq-val muted"}>
                {v.gross > 0 ? fmtMoney(v.taxed) : "—"}
              </div>
            </div>
          ))}
          <div className="eq-table-row total">
            <div>Total</div>
            <div>{totalShares.toLocaleString()}</div>
            <div>—</div>
            <div className="eq-val">{fmtMoney(totalGross)}</div>
            <div className="eq-val">{fmtMoney(totalNet)}</div>
          </div>
        </div>
      </section>

      {/* Tax explainer */}
      <section className="eq-section eq-tax">
        <div className="eq-tax-grid">
          <div>
            <div className="card-eyebrow">How RSUs are taxed</div>
            <h3>You&rsquo;re taxed the day shares land in your account.</h3>
            <p>On each vest date, the IRS treats the full value of those shares as{" "}
               <JargonTerm term="ordinary income">ordinary income</JargonTerm> &mdash; same as salary.
               Your employer typically withholds by <strong>selling ~37% of the shares</strong> to
               cover federal + state + FICA and handing you the rest.</p>
            <p>If the stock goes <em>up</em> after you vest and you hold the remaining shares for a
               year, further gains are taxed at the lower long-term capital gains rate. If it goes
               <em>down</em>, well &mdash; you already paid tax on the higher value. Ouch.</p>
          </div>
          {(() => {
            const loc = BRIEF.location || {};
            const fed = num(loc.fedEffectiveRate, 0.22);
            const st = num(loc.stateEffectiveRate, 0.08);
            const fica = num(loc.ficaRate, 0.0765);
            const stateCode = loc.state || "State";
            const vestVal = OFFER.rsuTotal / OFFER.rsuYears;
            return (
              <div className="eq-tax-math">
                <div className="eq-tax-row">
                  <span>Shares vest, worth</span>
                  <span className="eq-tax-v">{fmtMoney(vestVal)}</span>
                </div>
                <div className="eq-tax-row sub">
                  <span>&minus; Federal ({Math.round(fed * 100)}%)</span>
                  <span>&minus;{fmtMoney(vestVal * fed)}</span>
                </div>
                {st > 0 && (
                  <div className="eq-tax-row sub">
                    <span>&minus; {stateCode} state ({Math.round(st * 100)}%)</span>
                    <span>&minus;{fmtMoney(vestVal * st)}</span>
                  </div>
                )}
                <div className="eq-tax-row sub">
                  <span>&minus; FICA (7.65%)</span>
                  <span>&minus;{fmtMoney(vestVal * fica)}</span>
                </div>
                <div className="eq-tax-row total">
                  <span>Lands in your brokerage</span>
                  <span className="eq-tax-v">{fmtMoney(vestVal * (1 - fed - st - fica))}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* Takeaways */}
      <section className="eq-section">
        <div className="sec-hd">
          <h2>Three takeaways.</h2>
        </div>
        <ol className="eq-takeaways">
          <li>
            <strong>Treat base salary as the floor.</strong> The sign-on and RSU numbers on your offer
            are potential &mdash; not guaranteed. Only the base is reliably in your account every two weeks.
          </li>
          <li>
            <strong>The 1-year cliff is a lock-in.</strong> You get $0 of equity if you leave before
            month 12. After the cliff, small quarterly amounts make leaving progressively less painful.
          </li>
          <li>
            <strong>Diversify out of company stock.</strong> Once shares vest, you can sell them. Most
            financial planners recommend selling at vest and buying an index fund &mdash; you already
            have plenty of exposure to your employer&rsquo;s success through your paycheck.
          </li>
        </ol>
      </section>
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// LAYOFF HISTORY SCREEN
// ────────────────────────────────────────────────────────────────────────────

const LAYOFF_EVENTS = [
  {
    date: "Aug 2022",
    pct: "20%",
    count: "~1,300",
    teams: ["Hardware (Spectacles, original team)", "Enterprise sales", "Pixy drone team"],
    sev: "12 weeks base + 2 weeks per year worked + accelerated vesting through Dec 2022",
    notes: "CEO cited a \"challenging\" macro environment. The hardware cuts were particularly deep — entire product lines shuttered.",
    tone: "major",
  },
  {
    date: "Feb 2023",
    pct: "10%",
    count: "~500",
    teams: ["Content moderation", "Music/sound infra", "Central eng platform"],
    sev: "10 weeks base + 2 weeks per year worked + 6 months of health coverage",
    notes: "Part of a broader tech-wide wave. Focused on \"consolidation\" rather than bad performance — most affected employees had strong reviews.",
    tone: "moderate",
  },
  {
    date: "Jun 2024",
    pct: "5%",
    count: "~250",
    teams: ["Managers only (flattening the org)", "Product managers"],
    sev: "10 weeks base + 2 weeks per year worked",
    notes: "Targeted \"layers of management\" rather than individual contributors. New grad engineers largely untouched.",
    tone: "moderate",
  },
];

// Map a percent string like "20%" to a severity tone.
function layoffTone(pctStr) {
  const n = parseFloat(String(pctStr || "").replace("%", ""));
  return Number.isFinite(n) && n >= 15 ? "major" : "moderate";
}

function LayoffScreen({ onBack }) {
  // Prefer the AI-generated layoffs; fall back to the Snap demo set if empty.
  const events = (BRIEF.layoffs && BRIEF.layoffs.length)
    ? BRIEF.layoffs.map((e) => ({
        date: e.date,
        pct: e.pct,
        count: e.approxCount,
        teams: e.teams || [],
        notes: e.notes,
        tone: layoffTone(e.pct),
      }))
    : LAYOFF_EVENTS;

  const roundsWord = ["zero", "one", "two", "three", "four", "five", "six"][events.length] || events.length;

  return (
    <ScreenShell
      eyebrow="Stability flag"
      title={`${cap(String(roundsWord))} recent layoff ${events.length === 1 ? "round" : "rounds"} at ${OFFER.company}.`}
      lede={`${OFFER.company} has reduced headcount ${events.length === 1 ? "once" : roundsWord + " times"} recently. None of this means the offer is bad — it means you should know what you're walking into, and negotiate accordingly. These are AI-generated estimates from public reporting.`}
      onBack={onBack}
    >
      {/* Stats strip */}
      <div className="lo-stats">
        <div className="lo-stat">
          <div className="lo-stat-v">{events.length}</div>
          <div className="lo-stat-l">recent layoff<br/>{events.length === 1 ? "round" : "rounds"}</div>
        </div>
        <div className="lo-stat">
          <div className="lo-stat-v">{events[0] ? (events[0].pct || "—") : "—"}</div>
          <div className="lo-stat-l">largest single<br/>round</div>
        </div>
        <div className="lo-stat">
          <div className="lo-stat-v">{events[0] ? events[0].date : "—"}</div>
          <div className="lo-stat-l">most recent<br/>round</div>
        </div>
        <div className="lo-stat">
          <div className="lo-stat-v">AI</div>
          <div className="lo-stat-l">estimated from<br/>public reporting</div>
        </div>
      </div>

      {/* Timeline */}
      <section className="eq-section">
        <div className="sec-hd">
          <h2>The timeline.</h2>
          <p>Each round hit different parts of the company. Here&rsquo;s what was cut and what signal it sends.</p>
        </div>
        <ol className="lo-timeline">
          {events.map((e, i) => (
            <li key={i} className={"lo-event tone-" + e.tone}>
              <div className="lo-event-rail">
                <div className="lo-event-dot" aria-hidden="true" />
                {i < events.length - 1 && <div className="lo-event-line" aria-hidden="true" />}
              </div>
              <div className="lo-event-card">
                <div className="lo-event-hd">
                  <div>
                    <div className="lo-event-date">{e.date}</div>
                    <h3>{e.pct || "Some"} of workforce{e.count ? " · " + e.count + " employees" : ""}</h3>
                  </div>
                  <div className={"lo-event-chip chip-" + e.tone}>
                    {e.tone === "major" ? "Major" : "Moderate"}
                  </div>
                </div>
                {e.teams.length > 0 && (
                  <div className="lo-event-grid">
                    <div>
                      <div className="lo-event-lbl">Teams hit hardest</div>
                      <ul className="lo-event-list">
                        {e.teams.map((t, j) => <li key={j}>{t}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
                {e.notes && (
                  <div className="lo-event-notes">
                    <div className="lo-event-lbl">What this signals</div>
                    <p>{e.notes}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What this means for you */}
      <section className="eq-section lo-means">
        <div className="sec-hd">
          <h2>What this means for you as a new hire.</h2>
        </div>
        <div className="lo-means-grid">
          <div className="lo-mean-card">
            <div className="lo-mean-n">01</div>
            <h3>You are a risk employee.</h3>
            <p>&ldquo;Last in, first out&rdquo; isn&rsquo;t formal policy, but it is a real pattern. In a
               round, newer hires with less visibility are statistically more exposed than people with
               2+ years of track record.</p>
          </div>
          <div className="lo-mean-card">
            <div className="lo-mean-n">02</div>
            <h3>Cash &gt; unvested RSUs.</h3>
            <p>If you&rsquo;re cut in month 11, you lose the entire 1-year cliff. Dollars are in your
               account; unvested shares evaporate. Lean on this when you negotiate.</p>
          </div>
          <div className="lo-mean-card">
            <div className="lo-mean-n">03</div>
            <h3>Ask for acceleration.</h3>
            <p>A clause that vests 3&ndash;12 months of RSUs if you&rsquo;re laid off without cause is
               a real safety net. Many companies will add it. You just have to ask in writing.</p>
          </div>
        </div>
      </section>

      {/* Negotiation hooks */}
      <section className="eq-section lo-hooks">
        <div className="card-eyebrow">Three things to ask for</div>
        <h2>Specific asks this history earns you.</h2>
        <ul className="lo-hook-list">
          <li>
            <div className="lo-hook-ask">
              <span className="lo-hook-k">Ask for</span>
              A larger sign-on bonus ({fmtMoney(Math.round(OFFER.signOn * 1.4))} vs {fmtMoney(OFFER.signOn)})
            </div>
            <div className="lo-hook-why">
              Sign-on is <strong>cash in 30 days</strong>. Even with a clawback period, it&rsquo;s
              more reliable than 4 years of RSUs.
            </div>
          </li>
          <li>
            <div className="lo-hook-ask">
              <span className="lo-hook-k">Ask for</span>
              Written severance: 4 weeks base + 2 weeks per year
            </div>
            <div className="lo-hook-why">
              Matches what most tech companies pay in layoffs. Putting it in your offer letter
              means it&rsquo;s a contract, not a company policy they can revise.
            </div>
          </li>
          <li>
            <div className="lo-hook-ask">
              <span className="lo-hook-k">Ask for</span>
              6-month equity acceleration on no-cause termination
            </div>
            <div className="lo-hook-why">
              Caps your downside on the RSU side. If you&rsquo;re let go at month 11, you still vest
              6 months&rsquo; worth instead of $0.
            </div>
          </li>
        </ul>
      </section>
    </ScreenShell>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NEGOTIATION EMAIL SCREEN
// ────────────────────────────────────────────────────────────────────────────

// Counter targets derived from the offer.
const COUNTER_BASE = () => Math.round((OFFER.base * 1.09) / 1000) * 1000;
const COUNTER_SIGNON = () => Math.round((OFFER.signOn * 1.4) / 1000) * 1000;

function buildEmailSections() {
  const city = (OFFER.location || "").split(",")[0].trim() || "the office";
  const role = OFFER.role || "this role";
  return [
  {
    key: "opening",
    label: "Opening",
    always: true,
    body: "Hi [Recruiter],\n\nThanks so much for the offer — I'm genuinely excited about the team and the work you're doing. Before I sign, I had a few quick questions I'd love to clarify in writing.",
  },
  {
    key: "refresh",
    label: "Refresh grants",
    default: true,
    body: `1. Refresh grants. What's the typical cadence and size of refresh grants for ${role} after the initial vesting period begins to ramp down?`,
  },
  {
    key: "acceleration",
    label: "Equity acceleration",
    default: true,
    body: "2. Equity acceleration. In the event of a layoff, does any portion of unvested RSUs accelerate? I'm asking because I want to understand the downside honestly.",
  },
  {
    key: "relo",
    label: "Relocation package",
    default: true,
    body: `3. Relocation. Is there a relocation package available for the move to ${city}? If so, could you share the details (cash component, temporary housing, any clawback)?`,
  },
  {
    key: "severance",
    label: "Severance policy",
    default: true,
    body: "4. Severance. Is there a written severance policy I could see a copy of?",
  },
  {
    key: "counter_base",
    label: "Counter: higher base",
    default: true,
    body: `One ask on the comp itself: given the weight of the equity portion in this package relative to base, would there be room to move the base closer to ${fmtMoney(COUNTER_BASE())}? That would put the guaranteed portion more in line with roles I've been considering, and I'd be ready to sign this week.`,
  },
  {
    key: "counter_signon",
    label: "Counter: larger sign-on",
    default: false,
    body: `One ask on the comp: given the equity weight in this package, would there be flexibility to increase the sign-on bonus to ${fmtMoney(COUNTER_SIGNON())}? Sign-on is cash on a known timeline, which matters more to me than the same dollar amount in RSUs that vest over four years.`,
  },
  {
    key: "closing",
    label: "Closing",
    always: true,
    body: "Thanks again — I really appreciate you working through these with me.\n\nBest,\n[Your name]",
  },
  ];
}

function NegotiationScreen({ onBack }) {
  const EMAIL_SECTIONS = uM(() => buildEmailSections(), []);
  const [enabled, setEnabled] = uS(() => {
    const s = {};
    EMAIL_SECTIONS.forEach((sec) => { s[sec.key] = sec.always || sec.default; });
    return s;
  });
  const [copied, setCopied] = uS(false);
  const [viewMode, setViewMode] = uS("guided"); // guided | plain

  const emailText = uM(() => {
    return EMAIL_SECTIONS
      .filter((s) => enabled[s.key])
      .map((s) => s.body)
      .join("\n\n");
  }, [enabled, EMAIL_SECTIONS]);

  const wordCount = emailText.trim().split(/\s+/).length;

  const copy = () => {
    navigator.clipboard?.writeText(emailText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => setCopied(true));
  };

  return (
    <ScreenShell
      eyebrow="Drafted for you"
      title="Your negotiation email."
      lede="Pre-written based on your specific offer and what we flagged. Toggle sections on or off to match your style. When you&rsquo;re ready, copy the whole thing and send."
      onBack={onBack}
    >
      <div className="neg-layout">
        {/* Left rail: toggles */}
        <aside className="neg-controls">
          <div className="neg-ctrl-group">
            <div className="neg-ctrl-label">Questions to include</div>
            {EMAIL_SECTIONS.filter((s) => !s.always && s.key.startsWith("") && !s.key.startsWith("counter")).map((s) => (
              <label key={s.key} className="neg-check">
                <input
                  type="checkbox"
                  checked={enabled[s.key]}
                  onChange={(e) => setEnabled({ ...enabled, [s.key]: e.target.checked })}
                />
                <span className="neg-check-box" aria-hidden="true" />
                <span className="neg-check-lbl">{s.label}</span>
              </label>
            ))}
          </div>
          <div className="neg-ctrl-group">
            <div className="neg-ctrl-label">Counter-offer ask</div>
            <label className="neg-radio">
              <input
                type="radio" name="counter" checked={enabled.counter_base}
                onChange={() => setEnabled({ ...enabled, counter_base: true, counter_signon: false })}
              />
              <span className="neg-radio-dot" aria-hidden="true" />
              <span>Counter on base<br/><em>{fmtK(OFFER.base)} → {fmtK(COUNTER_BASE())}</em></span>
            </label>
            <label className="neg-radio">
              <input
                type="radio" name="counter" checked={enabled.counter_signon}
                onChange={() => setEnabled({ ...enabled, counter_base: false, counter_signon: true })}
              />
              <span className="neg-radio-dot" aria-hidden="true" />
              <span>Counter on sign-on<br/><em>{fmtK(OFFER.signOn)} → {fmtK(COUNTER_SIGNON())}</em></span>
            </label>
            <label className="neg-radio">
              <input
                type="radio" name="counter"
                checked={!enabled.counter_base && !enabled.counter_signon}
                onChange={() => setEnabled({ ...enabled, counter_base: false, counter_signon: false })}
              />
              <span className="neg-radio-dot" aria-hidden="true" />
              <span>No counter-offer<br/><em>Just ask the questions</em></span>
            </label>
          </div>
          <div className="neg-ctrl-group">
            <div className="neg-ctrl-label">View</div>
            <div className="neg-toggle">
              <button
                className={viewMode === "guided" ? "on" : ""}
                onClick={() => setViewMode("guided")}
              >Annotated</button>
              <button
                className={viewMode === "plain" ? "on" : ""}
                onClick={() => setViewMode("plain")}
              >Plain text</button>
            </div>
          </div>
        </aside>

        {/* Email preview */}
        <div className="neg-preview">
          <div className="neg-meta">
            <div><span className="meta-k">To</span> recruiter@{BRIEF.companyDomain || "company.com"}</div>
            <div><span className="meta-k">From</span> you@email.com</div>
            <div><span className="meta-k">Subject</span> Following up on my offer — a few questions</div>
          </div>

          {viewMode === "plain" ? (
            <pre className="neg-body">{emailText}</pre>
          ) : (
            <div className="neg-annotated">
              {EMAIL_SECTIONS.filter((s) => enabled[s.key]).map((s) => (
                <div key={s.key} className="neg-chunk">
                  <div className="neg-chunk-lbl">{s.label}</div>
                  <pre className="neg-chunk-body">{s.body}</pre>
                  {NEG_NOTES[s.key] && (
                    <div className="neg-note">
                      <span className="neg-note-k">Why this line:</span> {NEG_NOTES[s.key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="neg-footer">
            <div className="neg-stats">
              <span>{wordCount} words</span>
              <span>&middot;</span>
              <span>Reads in ~{Math.max(1, Math.round(wordCount / 200))} min</span>
            </div>
            <div className="neg-actions">
              <button className="btn btn-ghost" onClick={() => alert("Would open in your email client")}>
                Open in email
              </button>
              <button className="btn btn-primary" onClick={copy}>
                {copied ? "✓ Copied" : "Copy full email"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <section className="eq-section neg-tips">
        <div className="sec-hd">
          <h2>Before you hit send.</h2>
        </div>
        <ul className="neg-tips-list">
          <li>
            <strong>Replace the placeholders.</strong> &ldquo;[Recruiter]&rdquo; and &ldquo;[Your name]&rdquo;
            are placeholders &mdash; swap in your recruiter&rsquo;s real name and yours before sending.
          </li>
          <li>
            <strong>Send Tue&ndash;Thu morning.</strong> Your recruiter is more likely to reply quickly
            when they&rsquo;re not catching up from a weekend or winding down for one.
          </li>
          <li>
            <strong>Don&rsquo;t apologize.</strong> You&rsquo;re asking reasonable questions about a
            six-figure life decision. This email is already polite &mdash; you don&rsquo;t need to soften it further.
          </li>
          <li>
            <strong>Your counter number is a ceiling.</strong> Expect to land 40&ndash;70% of the gap
            between the offer and your counter. That&rsquo;s still real money.
          </li>
        </ul>
      </section>
    </ScreenShell>
  );
}

const NEG_NOTES = {
  refresh: "Frames this as a forward-looking question, not a complaint. Signals you're thinking about year 2+.",
  acceleration: "Names the layoffs without dwelling. \"Understand the downside honestly\" is a grownup phrase — not naïve, not accusatory.",
  relo: "Asks for specifics, not vibes. Getting cash amounts in writing means they can't drift later.",
  severance: "Simplest ask here. Many companies have policies they just don't advertise — you only find out by asking.",
  counter_base: "Specific number, specific reason, specific timeline. Removes ambiguity on both sides.",
  counter_signon: "Good alternative when base is locked by level bands. Sign-on is usually more flexible.",
};

Object.assign(window, { ScreenShell, EquityScreen, LayoffScreen, NegotiationScreen });
