// dashboard.jsx — main dashboard layout wiring all sections together

const { useState: useS } = React;

// Recompute Y1 derived numbers in place after OFFER mutates.
// Mirrors the calculation in data.jsx so all downstream cards re-read fresh values.
function recomputeY1FromOffer() {
  const baseGross = OFFER.base;
  const signOnGross = OFFER.signOn;
  const rsuGross = OFFER.rsuYears > 0 ? OFFER.rsuTotal / OFFER.rsuYears : 0;
  const bonusGross = OFFER.base * OFFER.bonusPct;
  const totalGross = baseGross + signOnGross + rsuGross + bonusGross;
  const combinedTax = 0.22 + 0.08 + 0.0765;
  const baseNet = Math.round(baseGross * (1 - combinedTax));
  const signOnNet = Math.round(signOnGross * (1 - combinedTax));
  const rsuNet = Math.round(rsuGross * (1 - combinedTax));
  const bonusNet = Math.round(bonusGross * (1 - combinedTax));
  const RENT_LA_MONTHLY = 2400;
  const rentAnnual = RENT_LA_MONTHLY * 12;
  const afterTax = baseNet + signOnNet + rsuNet + bonusNet;
  Object.assign(Y1, {
    gross: totalGross,
    baseGross, baseNet,
    signOnGross, signOnNet,
    rsuGross, rsuNet,
    bonusGross, bonusNet,
    afterTax,
    rentAnnual,
    rentMonthly: RENT_LA_MONTHLY,
    takeHome: afterTax - rentAnnual,
  });
}

function OfferInput({ onDecoded }) {
  const [text, setText] = useS("");
  const [loading, setLoading] = useS(false);
  const [error, setError] = useS(null);

  const handleDecode = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/parse-offer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerText: text }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to parse offer");
      }
      const parsed = payload.offer;
      Object.assign(OFFER, {
        company:    parsed.company    ?? OFFER.company,
        role:       parsed.role       ?? OFFER.role,
        location:   parsed.location   ?? OFFER.location,
        base:       parsed.baseSalary ?? OFFER.base,
        signOn:     parsed.signOnBonus ?? OFFER.signOn,
        rsuTotal:   parsed.rsuTotal   ?? OFFER.rsuTotal,
        rsuYears:   parsed.rsuVestingYears ?? OFFER.rsuYears,
        bonusPct:   parsed.annualBonusPercent ?? OFFER.bonusPct,
        companyTag: "",
      });
      recomputeY1FromOffer();
      onDecoded();
    } catch (e) {
      setError(e && e.message ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="offer-input">
      <label className="offer-input-label" htmlFor="offer-text">
        Paste your offer letter here
      </label>
      <textarea
        id="offer-text"
        className="offer-input-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the full text of your offer letter, then click Decode…"
        rows={6}
        disabled={loading}
      />
      <div className="offer-input-row">
        <button
          className="offer-input-btn"
          onClick={handleDecode}
          disabled={loading || !text.trim()}
        >
          {loading ? (
            <>
              <span className="offer-input-spinner" aria-hidden="true" />
              Decoding…
            </>
          ) : (
            "Decode"
          )}
        </button>
        {error && <div className="offer-input-error">⚠ {error}</div>}
      </div>
    </section>
  );
}

function WelcomeBanner({ onClose }) {
  return (
    <div className="welcome-banner" role="region" aria-label="Welcome message">
      <div className="welcome-inner">
        <div className="welcome-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
        </div>
        <div className="welcome-copy">
          <strong>First time decoding an offer? You&rsquo;re in the right place.</strong>
          <span className="welcome-sub">Underlined terms have plain-English definitions on hover. Toggle <em>Learn mode</em> to see them inline.</span>
        </div>
        <button className="welcome-close" onClick={onClose} aria-label="Dismiss welcome message">✕</button>
      </div>
    </div>
  );
}

function Header({ learn, onLearn }) {
  const [logoErr, setLogoErr] = useS(false);
  const domain = OFFER.company && OFFER.company.domain;
  const companyName = (OFFER.company && OFFER.company.name) || OFFER.company;

  // Reset error state if the company changes (e.g. after re-parsing a new offer).
  React.useEffect(() => { setLogoErr(false); }, [domain]);

  const showFallback = logoErr || !domain;

  return (
    <header className="site-hd">
      <div className="site-hd-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          {showFallback ? (
            // lucide-react Briefcase fallback — used when the Clearbit logo 404s
            // or the company has no domain yet.
            <svg
              viewBox="0 0 24 24"
              width="48"
              height="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0, color: "var(--ink-60)" }}
            >
              <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          ) : (
            <img
              src={`https://logo.clearbit.com/${domain}`}
              alt={`${companyName} logo`}
              height="48"
              onError={() => setLogoErr(true)}
              style={{
                height: 48,
                width: "auto",
                display: "block",
                flexShrink: 0,
                borderRadius: 8,
                objectFit: "contain",
              }}
            />
          )}
          <span
            style={{
              fontWeight: 600,
              fontSize: 18,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {companyName}
          </span>
        </div>
        <div className="site-hd-title">Your offer, decoded</div>
        <div className="site-hd-actions">
          <button className={"learn-toggle" + (learn ? " on" : "")}
                  onClick={() => onLearn(!learn)}
                  title="Show plain-English definitions inline">
            <span className="learn-toggle-dot" aria-hidden="true">{learn ? "✓" : "i"}</span>
            Learn mode
          </button>
          <div className="site-hd-badge" title="Built for first-gen students navigating their first tech offer">
            <span className="dot" /> First-gen friendly
          </div>
        </div>
      </div>
    </header>
  );
}

function MetaStrip() {
  return (
    <div className="meta-strip">
      <div className="meta-strip-row">
        <div className="meta-co">
          <div className="meta-co-mark" aria-hidden="true">S</div>
          <div>
            <div className="meta-co-name">{OFFER.company} <span className="meta-co-tag">· {OFFER.companyTag}</span></div>
            <div className="meta-co-sub">{OFFER.role} &nbsp;·&nbsp; {OFFER.location}</div>
          </div>
        </div>
        <div className="meta-parsed">
          <span className="meta-parsed-check" aria-hidden="true">✓</span>
          <span>Offer letter parsed · just now</span>
        </div>
      </div>
    </div>
  );
}

function Headline() {
  const says = OFFER.base + OFFER.signOn + OFFER.rsuTotal / OFFER.rsuYears + OFFER.base * OFFER.bonusPct;
  return (
    <section className="headline">
      <div className="headline-eyebrow">Estimated first-year take-home, after taxes &amp; LA rent</div>
      <div className="headline-number">
        <CountUp value={Y1.takeHome} />
      </div>
      <div className="headline-sub">
        The offer says <strong>{fmtMoney(says)}</strong>. Here&rsquo;s what actually lands in your account.
      </div>
      <div className="headline-legend">
        <div className="leg">
          <div className="leg-bar"><span style={{ width: (Y1.afterTax / says) * 100 + "%" }} /></div>
          <div className="leg-row">
            <span>Gross first-year comp</span><span className="leg-val">{fmtMoney(says)}</span>
          </div>
          <div className="leg-row muted">
            <span>− Federal, CA state &amp; FICA (~37.7%)</span>
            <span className="leg-val">−{fmtMoney(says - Y1.afterTax)}</span>
          </div>
          <div className="leg-row muted">
            <span>− LA rent baseline ({fmtMoney(Y1.rentMonthly)}/mo × 12)</span>
            <span className="leg-val">−{fmtMoney(Y1.rentAnnual)}</span>
          </div>
          <div className="leg-row total">
            <span>What actually lands</span>
            <span className="leg-val">{fmtMoney(Y1.takeHome)}</span>
          </div>
        </div>
        <ExplainToggle label="How did we calculate this?">
          <p>
            We take your <JargonTerm term="gross">gross</JargonTerm> first-year comp — base + sign-on + the 25% of your
            RSU grant that vests at the end of year one + your 10% bonus target — and subtract realistic tax
            withholding for a single filer in California (federal 22% effective, CA state ~8%, FICA 7.65%).
          </p>
          <p>
            Then we subtract <strong>{fmtMoney(Y1.rentMonthly)}/month</strong> for rent — a reasonable baseline for
            a modest 1-bedroom in a commutable LA neighborhood. Everything left is your to-spend money:
            groceries, travel, savings, loan payments, the works.
          </p>
          <p className="fine">
            This is an estimate, not tax advice. Your actual number depends on 401(k), health premiums, bonuses
            paid, and where you actually live.
          </p>
        </ExplainToggle>
      </div>
    </section>
  );
}

function BreakdownCards() {
  const items = [
    {
      key: "base",
      label: "Base salary",
      gross: OFFER.base,
      net: Y1.baseNet,
      suffix: "/yr",
      note: <>Paid twice a month. The only piece that&rsquo;s <strong>actually guaranteed</strong> &mdash; everything else has strings attached.</>,
      tone: "steady",
    },
    {
      key: "signon",
      label: "Sign-on bonus",
      gross: OFFER.signOn,
      net: Y1.signOnNet,
      suffix: "",
      note: <>You keep this only if you stay <strong>12+ months</strong>. Leaving early triggers the{" "}
        <JargonTerm term="clawback">clawback</JargonTerm> &mdash; you pay it back.</>,
      tone: "conditional",
    },
    {
      key: "rsu",
      label: "RSUs (year 1)",
      gross: OFFER.rsuTotal / OFFER.rsuYears,
      net: Y1.rsuNet,
      suffix: "",
      note: <>25% of a <strong>{fmtMoney(OFFER.rsuTotal)}</strong>{" "}
        <JargonTerm term="RSU">RSU</JargonTerm> grant, vesting at the 1-year{" "}
        <JargonTerm term="cliff">cliff</JargonTerm>. Value floats with the stock.</>,
      tone: "variable",
    },
  ];

  return (
    <section className="breakdown">
      <div className="sec-hd">
        <h2>The three pieces</h2>
        <p>Your offer isn&rsquo;t one number &mdash; it&rsquo;s three different kinds of money, with very different rules.</p>
      </div>
      <div className="break-grid">
        {items.map((it) => (
          <div key={it.key} className={"break-card tone-" + it.tone}>
            <div className="break-label">
              <span>{it.label}</span>
              <span className={"break-tag tag-" + it.tone}>
                {it.tone === "steady" && "Guaranteed"}
                {it.tone === "conditional" && "Conditional"}
                {it.tone === "variable" && "Variable"}
              </span>
            </div>
            <div className="break-gross">{fmtMoney(it.gross)}{it.suffix}</div>
            <div className="break-net-row">
              <span className="break-net">≈ {fmtMoney(it.net)}</span>
              <span className="break-net-lbl">after tax</span>
            </div>
            <div className="break-note">{it.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EquityCard({ onOpen }) {
  const today = STOCK_HISTORY[STOCK_HISTORY.length - 1][1];
  const peak = Math.max(...STOCK_HISTORY.map((d) => d[1]));
  const pctFromPeak = Math.round(((today - peak) / peak) * 100);

  return (
    <section className="card card-equity">
      <div className="card-hd">
        <div>
          <div className="card-eyebrow">Equity reality check</div>
          <h3>Your RSU value depends on this stock.</h3>
        </div>
        <div className="card-stat">
          <div className="card-stat-v">${today.toFixed(2)}</div>
          <div className="card-stat-l">{pctFromPeak}% from 5-yr peak</div>
        </div>
      </div>
      <StockChart data={STOCK_HISTORY} annotations={STOCK_ANNOTATIONS} />
      <p className="card-body">
        <JargonTerm term="RSUs">RSUs</JargonTerm> are taxed at <JargonTerm term="vest">vest</JargonTerm> as{" "}
        <JargonTerm term="ordinary income">ordinary income</JargonTerm> &mdash; meaning when shares land in
        your account, the IRS treats them exactly like salary. The <strong>{fmtMoney(OFFER.rsuTotal)}</strong>{" "}
        figure on your offer is what {OFFER.company} says the grant is worth <em>today</em>, at today&rsquo;s
        share price. It is <strong>not</strong> what the grant will actually pay out.
      </p>
      <ExplainToggle label="Explain what this really means for me">
        <p>
          Say you&rsquo;re granted 2,000 shares at $15 each &mdash; that&rsquo;s the $30k&rsquo;s worth that lands
          at your 1-year cliff on paper. But when those shares actually vest, they&rsquo;re only worth whatever
          the stock is trading at <em>that day</em>.
        </p>
        <p>
          If the price doubles, great &mdash; your $30k becomes $60k. If it halves, your $30k becomes $15k and
          you still owe taxes on the value at vest. The {fmtMoney(OFFER.rsuTotal)} on your offer letter is a
          target, not a promise.
        </p>
      </ExplainToggle>
      <button className="card-link" onClick={onOpen}>
        See full equity analysis <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function StabilityCard({ onOpen }) {
  return (
    <section className="card card-flag" onClick={onOpen} role="button" tabIndex={0}
             onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}>
      <div className="flag-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="M12 3 L22 20 H2 Z" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinejoin="round" />
          <line x1="12" y1="10" x2="12" y2="15" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" />
          <circle cx="12" cy="17.5" r="0.9" fill="currentColor" />
        </svg>
      </div>
      <div className="flag-body">
        <div className="card-eyebrow">Stability flag</div>
        <h3>{OFFER.company} laid off 20% of staff in 2022, then 10% more in 2023.</h3>
        <p>
          Recent hires are often affected first. Factor this into your negotiation &mdash; sign-on cash is
          more secure than RSUs you haven&rsquo;t vested yet.
        </p>
        <span className="card-link-inline">See layoff history <span aria-hidden="true">→</span></span>
      </div>
    </section>
  );
}

const MISSING_ITEMS = [
  {
    key: "refresh",
    label: "Refresh grant policy",
    why: <>After your initial 4-year RSU grant vests, your equity drops to zero unless the company issues
      a <JargonTerm term="refresh">refresh grant</JargonTerm>. Many top companies refresh annually starting
      year 2 or 3. Ask: &ldquo;What&rsquo;s your typical refresh cadence and size for engineers at my level?&rdquo;</>,
  },
  {
    key: "acceleration",
    label: "Equity acceleration on termination",
    why: <>If the company lays you off, do your next-to-vest shares <JargonTerm term="equity acceleration">
      accelerate</JargonTerm>? Some companies offer 3–12 months of acceleration, especially in a severance
      package. Given the layoff history here, this is worth asking about directly.</>,
  },
  {
    key: "relocation",
    label: "Relocation package details",
    why: <>The offer mentions LA but says nothing about relo. Typical new-grad relo packages are $5k–$15k
      in cash + temporary housing. If you&rsquo;re moving across the country, ask for the specifics in
      writing &mdash; and whether any of it has its own clawback.</>,
  },
  {
    key: "severance",
    label: "Severance policy",
    why: <>What does severance look like if you&rsquo;re let go? Typical tech severance is 2–4 weeks of
      base per year worked, sometimes plus health coverage. A written severance policy is a real safety
      net &mdash; the absence of one is a risk you should price in.</>,
  },
];

function MissingCard() {
  const [openIdx, setOpenIdx] = useS(null);
  return (
    <section className="card card-missing">
      <div className="card-hd-col">
        <div className="card-eyebrow">Things your offer letter didn&rsquo;t mention</div>
        <h3>Four things to ask about before you sign.</h3>
        <p className="card-body">These aren&rsquo;t red flags &mdash; they&rsquo;re <strong>standard things</strong> the
          offer letter is quiet about. Getting them in writing costs you nothing.</p>
      </div>
      <ul className="missing-list">
        {MISSING_ITEMS.map((it, i) => {
          const open = openIdx === i;
          return (
            <li key={it.key} className={"missing-item" + (open ? " open" : "")}>
              <button className="missing-hd" onClick={() => setOpenIdx(open ? null : i)}
                      aria-expanded={open}>
                <span className="missing-check" aria-hidden="true" />
                <span className="missing-label">{it.label}</span>
                <span className="missing-caret" aria-hidden="true">{open ? "−" : "+"}</span>
              </button>
              {open && (
                <div className="missing-body">
                  <div className="missing-why">Why this matters</div>
                  <p>{it.why}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NegotiationCTA({ onOpen }) {
  return (
    <section className="cta" onClick={onOpen} role="button" tabIndex={0}
             onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}>
      <div className="cta-eyebrow">Drafted for you</div>
      <div className="cta-grid">
        <div className="cta-copy">
          <h3>We wrote the negotiation email for you.</h3>
          <p>Personalized to your offer, the stability signals above, and the four open questions. Edit it,
             send it, or use it as a starting point.</p>
        </div>
        <div className="cta-preview">
          <div className="cta-preview-meta">
            <div><span className="meta-k">To</span> sarah.chen@snap.com</div>
            <div><span className="meta-k">Subject</span> Following up on my offer — a few questions</div>
          </div>
          <div className="cta-preview-body">
            <p>Hi Sarah, thanks so much for the offer &mdash; I&rsquo;m genuinely excited about the team.
              Before I sign, I had a few quick questions I&rsquo;d love to clarify&hellip;</p>
            <div className="cta-preview-fade" />
          </div>
        </div>
      </div>
      <div className="cta-actions">
        <span className="cta-btn">Read the full draft <span aria-hidden="true">→</span></span>
        <span className="cta-sub">4 tailored questions · ready to send in under a minute</span>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-ft">
      <div className="site-ft-inner">
        <BrandMark size={14} />
        <div className="site-ft-copy">
          Numbers here are estimates, not tax or legal advice. We don&rsquo;t store your offer letter. Snap Inc. is used as a demo employer only &mdash; we are not affiliated with Snap.
        </div>
      </div>
    </footer>
  );
}

// ── App ─────────────────────────────────────────────────────────────────────

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "forest",
  "density": "regular",
  "headlineScale": "large",
  "dark": false,
  "learn": false,
  "showWelcome": true
}/*EDITMODE-END*/;

const ACCENTS = {
  forest: { accent: "oklch(0.40 0.055 155)", accentSoft: "oklch(0.92 0.03 155)", accentInk: "oklch(0.28 0.05 155)" },
  indigo: { accent: "oklch(0.44 0.09 265)", accentSoft: "oklch(0.93 0.03 265)", accentInk: "oklch(0.32 0.08 265)" },
  clay:   { accent: "oklch(0.50 0.08 50)",  accentSoft: "oklch(0.94 0.03 60)",  accentInk: "oklch(0.36 0.07 50)"  },
  slate:  { accent: "oklch(0.30 0.01 240)", accentSoft: "oklch(0.93 0.005 240)", accentInk: "oklch(0.22 0.01 240)" },
};

function App() {
  const [t, setT] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useS("dashboard"); // dashboard | equity | layoff | negotiation
  const [offerVersion, setOfferVersion] = useS(0); // bump to force dashboard re-render after parseOffer mutates OFFER/Y1

  const acc = ACCENTS[t.accent] || ACCENTS.forest;

  React.useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty("--accent", acc.accent);
    r.style.setProperty("--accent-soft", acc.accentSoft);
    r.style.setProperty("--accent-ink", acc.accentInk);
    r.dataset.density = t.density;
    r.dataset.headline = t.headlineScale;
    r.dataset.mode = t.dark ? "dark" : "light";
    r.dataset.learn = t.learn ? "on" : "off";
  }, [t, acc]);

  // Scroll to top on screen change
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);

  const goBack = () => setScreen("dashboard");

  return (
    <>
      {t.showWelcome && screen === "dashboard" && (
        <WelcomeBanner onClose={() => setT("showWelcome", false)} />
      )}
      <Header learn={t.learn} onLearn={(v) => setT("learn", v)} />
      <main className="page" key={screen}>
        {screen === "dashboard" && (
          <>
            <OfferInput onDecoded={() => setOfferVersion((v) => v + 1)} />
            <div key={offerVersion}>
              <MetaStrip />
              <Headline />
              <BreakdownCards />
              <EquityCard onOpen={() => setScreen("equity")} />
              <StabilityCard onOpen={() => setScreen("layoff")} />
              <MissingCard />
              <NegotiationCTA onOpen={() => setScreen("negotiation")} />
            </div>
          </>
        )}
        {screen === "equity" && <EquityScreen onBack={goBack} />}
        {screen === "layoff" && <LayoffScreen onBack={goBack} />}
        {screen === "negotiation" && <NegotiationScreen onBack={goBack} />}
      </main>
      <Footer />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Palette" />
        <TweakRadio label="Accent" value={t.accent}
                    options={["forest", "indigo", "clay", "slate"]}
                    onChange={(v) => setT("accent", v)} />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setT("dark", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
                    options={["compact", "regular", "airy"]}
                    onChange={(v) => setT("density", v)} />
        <TweakRadio label="Headline" value={t.headlineScale}
                    options={[{ value: "balanced", label: "Balanced" },
                              { value: "large", label: "Large" },
                              { value: "huge", label: "Huge" }]}
                    onChange={(v) => setT("headlineScale", v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
