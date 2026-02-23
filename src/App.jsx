import React, { useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

import OkValLogo from "./components/OkValLogo";


const NAVY = "#0B1B3A"; // sidebar navy
const BG = "#0A0C10"; // overall dark background
const SURFACE = "rgba(255,255,255,0.055)";
const SURFACE_2 = "rgba(255,255,255,0.075)";
const BORDER = "rgba(255,255,255,0.10)";
const TEXT_DIM = "rgba(255,255,255,0.72)";
const TEXT_DIM_2 = "rgba(255,255,255,0.58)";

const CONTENT_MAX = 1720;
const PAGE_PAD_X = "clamp(14px, 2.2vw, 40px)";
const PAGE_PAD_Y = "clamp(12px, 1.6vw, 24px)";

function useIsMobile(breakpointPx = 980) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpointPx;
  });

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < breakpointPx);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);

  return isMobile;
}

// For dashboard layout specifically (not the sidebar/drawer breakpoint)
function useIsNarrowDashboard(breakpointPx = 1200) {
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpointPx;
  });

  useEffect(() => {
    function onResize() {
      setIsNarrow(window.innerWidth < breakpointPx);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);

  return isNarrow;
}

function Icon({ name }) {
  const common = {
    width: 32,
    height: 32,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    );
  }
  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 10v10h14V10" />
      </svg>
    );
  }
  if (name === "book") {
    return (
      <svg {...common}>
        <path d="M4 19a2 2 0 0 0 2 2h12" />
        <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5z" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...common}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg {...common}>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-7" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
      </svg>
    );
  }
  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v6h-6" />
      </svg>
    );
  }
  if (name === "dot") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 20h.01" />
      <path d="M12 4h.01" />
      <path d="M4 12h.01" />
      <path d="M20 12h.01" />
    </svg>
  );
}

function Pill({ children, tone = "default" }) {
  const styles =
    {
      default: {
        border: BORDER,
        bg: SURFACE_2,
        color: "rgba(255,255,255,0.86)",
      },
      ok: {
        border: "rgba(0,255,170,0.22)",
        bg: "rgba(0,255,170,0.10)",
        color: "rgba(220,255,245,0.95)",
      },
      warn: {
        border: "rgba(255,199,0,0.24)",
        bg: "rgba(255,199,0,0.10)",
        color: "rgba(255,240,200,0.95)",
      },
      bad: {
        border: "rgba(255,80,80,0.24)",
        bg: "rgba(255,80,80,0.10)",
        color: "rgba(255,220,220,0.95)",
      },
    }[tone] || { border: BORDER, bg: SURFACE_2, color: "rgba(255,255,255,0.86)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        border: `1px solid ${styles.border}`,
        background: styles.bg,
        color: styles.color,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        background: SURFACE,
        borderRadius: 18,
        padding: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.30)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.3 }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 6, fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.4 }}>{subtitle}</div>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
      {children ? <div style={{ marginTop: 14 }}>{children}</div> : null}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, icon }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid rgba(0,255,170,0.25)`,
        background: disabled ? "rgba(255,255,255,0.06)" : "rgba(0,255,170,0.10)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      {icon ? <span style={{ opacity: 0.95, display: "inline-flex" }}>{icon}</span> : null}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, icon, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.90)",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {icon ? <span style={{ opacity: 0.95, display: "inline-flex" }}>{icon}</span> : null}
      {children}
    </button>
  );
}

function SidebarNav({ items, activeKey, onSelect, footer }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 1000,
              letterSpacing: 0.5,
            }}
          >
            <OkValLogo size={26} />
          </div>
          <div>
            <div style={{ fontWeight: 1000, letterSpacing: 0.6 }}>OK-VAL</div>
            <div style={{ marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
              Training + compliance
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 10px 10px" }}>
        <div style={{ height: 1, background: "rgba(255,255,255,0.10)" }} />
      </div>

      <div style={{ padding: 10, overflowY: "auto" }}>
        {items.map((it) => {
          const active = it.key === activeKey;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onSelect(it.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 12,
                border: "1px solid transparent",
                background: active ? "rgba(255,255,255,0.10)" : "transparent",
                color: "rgba(255,255,255,0.92)",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 900,
                letterSpacing: 0.2,
                transition: "background 140ms ease, border 140ms ease",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ opacity: active ? 1 : 0.85, display: "inline-flex" }}>{it.icon}</span>
              <span style={{ flex: 1 }}>{it.label}</span>
              {it.badge ? <span style={{ opacity: 0.9 }}>{it.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {footer ? (
        <div style={{ padding: 12 }}>
          <div style={{ height: 1, background: "rgba(255,255,255,0.10)", marginBottom: 12 }} />
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function DashboardHome({ me, status, error, onRefresh }) {
  const isNarrow = useIsNarrowDashboard(1200);

  const roles = Array.isArray(me?.roles) ? me.roles : [];
  const roleCodes = roles.map((r) => String(r?.role_code || "").toLowerCase()).filter(Boolean);
  const tone = status === "ok" ? "ok" : status === "error" ? "bad" : "warn";

  // Responsive layout:
  // - narrow: single column
  // - wide: 7/5 split
  const gridTemplateColumns = isNarrow ? "1fr" : "repeat(12, 1fr)";
  const leftSpan = isNarrow ? "1 / -1" : "span 7";
  const rightSpan = isNarrow ? "1 / -1" : "span 5";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 1000, letterSpacing: 0.2 }}>Dashboard</div>
          <div style={{ marginTop: 6, fontSize: 13, color: TEXT_DIM }}>
            You’re signed in. Next step: wire pages to real endpoints and role gates.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Pill tone={tone}>
            <Icon name="dot" />
            {status}
          </Pill>
          <GhostButton onClick={onRefresh} icon={<Icon name="refresh" />} ariaLabel="Refresh /api/me">
            Refresh
          </GhostButton>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns }}>
        <div style={{ gridColumn: leftSpan, minWidth: 0 }}>
          <Card
            title="Your profile"
            subtitle="Pulled from /api/me (Clerk token → Vercel function → Neon)."
            right={
              me?.display_name ? (
                <Pill tone="ok">
                  <Icon name="check" /> Connected
                </Pill>
              ) : (
                <Pill tone="warn">
                  <Icon name="dot" /> Pending
                </Pill>
              )
            }
          >
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: isNarrow ? "1fr" : "140px 1fr" }}>
                <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Display name</div>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{me?.display_name || "—"}</div>

                <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Email</div>
                <div style={{ fontSize: 13, fontWeight: 900, overflowWrap: "anywhere" }}>{me?.email || "—"}</div>

                <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>User ID</div>
                <div style={{ fontSize: 13, fontWeight: 900, overflowWrap: "anywhere" }}>{me?.user_id || "—"}</div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {roleCodes.length ? (
                  roleCodes.map((rc) => (
                    <Pill key={rc}>
                      <Icon name="dot" /> {rc}
                    </Pill>
                  ))
                ) : (
                  <Pill tone="warn">
                    <Icon name="dot" /> no roles
                  </Pill>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: rightSpan, minWidth: 0 }}>
          <Card title="Next build targets" subtitle="These are the highest-value UX wins after auth is stable.">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Pill>
                  <Icon name="book" /> Question bank
                </Pill>
                <Pill>
                  <Icon name="check" /> Quizzes
                </Pill>
                <Pill>
                  <Icon name="chart" /> Analytics
                </Pill>
              </div>

              <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                If you want this to feel “real” fast: start with a Questions page that lists domains, shows counts, and
                enforces role-gated add/edit.
              </div>

              <PrimaryButton onClick={() => alert("Next: wire first real page route + endpoint")}>
                Build the first real page →
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </div>

      {status === "error" ? (
        <Card title="Error" subtitle="The /api/me call failed. The most common cause is missing Vercel env vars.">
          <div style={{ color: "rgba(255,220,220,0.95)", fontSize: 13, fontWeight: 900, lineHeight: 1.5 }}>{error}</div>
        </Card>
      ) : null}
    </div>
  );
}

function PlaceholderPage({ title, description }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: 0.2 }}>{title}</div>
      <div style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.5 }}>{description}</div>
      <div style={{ marginTop: 6, color: TEXT_DIM_2, fontSize: 12 }}>
        (This is a placeholder. When you’re ready, we’ll replace it with real pages + endpoints.)
      </div>
    </div>
  );
}

function AppShell() {
  const { getToken } = useAuth();
  const isMobile = useIsMobile(980);

  const [me, setMe] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = useMemo(() => {
    const roles = Array.isArray(me?.roles) ? me.roles : [];
    const roleCodes = roles.map((r) => String(r?.role_code || "").toLowerCase()).filter(Boolean);
    const isAdmin = roleCodes.includes("system_admin") || roleCodes.includes("admin");

    const base = [
      { key: "dashboard", label: "Dashboard", icon: <Icon name="home" /> },
      { key: "questions", label: "Question Bank", icon: <Icon name="book" /> },
      { key: "quizzes", label: "Quizzes", icon: <Icon name="check" /> },
      { key: "reports", label: "Reports", icon: <Icon name="chart" /> },
    ];

    if (isAdmin) base.push({ key: "admin", label: "Admin", icon: <Icon name="shield" /> });
    return base;
  }, [me]);

  async function loadMe() {
    try {
      setStatus("loading");
      setError("");

      const token = await getToken();
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();

      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setMe(json.data);
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setStatus("loading");
        setError("");

        const token = await getToken();
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);

        if (!cancelled) {
          setMe(json.data);
          setStatus("ok");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(String(e?.message || e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  function selectPage(key) {
    setActive(key);
    if (isMobile) setSidebarOpen(false);
  }

  const content = (() => {
    if (active === "dashboard") return <DashboardHome me={me} status={status} error={error} onRefresh={loadMe} />;
    if (active === "questions")
      return (
        <PlaceholderPage
          title="Question Bank"
          description="Browse domains, add/edit questions (role-gated), and manage activation status."
        />
      );
    if (active === "quizzes")
      return (
        <PlaceholderPage
          title="Quizzes"
          description="Start a quiz session, get immediate feedback, and record domain proficiency."
        />
      );
    if (active === "reports")
      return (
        <PlaceholderPage
          title="Reports"
          description="Proficiency breakdown by domain and role-based reporting views."
        />
      );
    if (active === "admin")
      return (
        <PlaceholderPage
          title="Admin"
          description="User role management and audit-friendly configuration (admin only)."
        />
      );
    return null;
  })();

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "white" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::selection { background: rgba(0,255,170,0.22); }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.20); }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "280px 1fr", minHeight: "100vh" }}>
        {!isMobile ? (
          <aside
            style={{
              background: NAVY,
              borderRight: "1px solid rgba(255,255,255,0.10)",
              position: "sticky",
              top: 0,
              height: "100vh",
            }}
          >
            <SidebarNav
              items={navItems}
              activeKey={active}
              onSelect={selectPage}
              footer={
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", fontWeight: 900 }}>Signed in</div>
                    <UserButton />
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>{me?.display_name || me?.email || "—"}</div>
                </div>
              }
            />
          </aside>
        ) : null}

        <div style={{ minWidth: 0 }}>
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              backdropFilter: "blur(10px)",
              background: "rgba(10,12,16,0.70)",
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: CONTENT_MAX,
                margin: "0 auto",
                padding: `${PAGE_PAD_Y} ${PAGE_PAD_X}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isMobile ? (
                  <GhostButton onClick={() => setSidebarOpen(true)} icon={<Icon name="menu" />} ariaLabel="Open navigation" />
                ) : null}

                <div style={{ display: "grid" }}>
                  <div style={{ fontWeight: 1000, letterSpacing: 0.4 }}>OK-VAL</div>
                  <div style={{ fontSize: 12, color: TEXT_DIM_2 }}>
                    {active === "dashboard" ? "Overview" : navItems.find((x) => x.key === active)?.label || ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Pill tone={status === "ok" ? "ok" : status === "error" ? "bad" : "warn"}>
                  <Icon name="dot" /> {status}
                </Pill>
                <UserButton />
              </div>
            </div>
          </header>

          <main style={{ width: "100%", maxWidth: CONTENT_MAX, margin: "0 auto", padding: `${PAGE_PAD_Y} ${PAGE_PAD_X}` }}>
            <div
              style={{
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 22,
                padding: 16,
              }}
            >
              {content}
            </div>
          </main>
        </div>

        {isMobile && sidebarOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 60,
              display: "flex",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 300,
                maxWidth: "85vw",
                background: NAVY,
                borderRight: "1px solid rgba(255,255,255,0.12)",
                height: "100%",
              }}
            >
              <SidebarNav
                items={navItems}
                activeKey={active}
                onSelect={selectPage}
                footer={
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", fontWeight: 900 }}>Signed in</div>
                      <UserButton />
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>{me?.display_name || me?.email || "—"}</div>
                  </div>
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div
          style={{
            minHeight: "100vh",
            background: BG,
            color: "white",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 22,
              padding: 18,
              boxShadow: "0 20px 60px rgba(0,0,0,0.40)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 1000, letterSpacing: 0.3 }}>OK-VAL</div>
                <div style={{ marginTop: 6, color: TEXT_DIM, fontSize: 13, lineHeight: 1.4 }}>
                  Sign in to access training, quizzes, and role-based tools.
                </div>
              </div>
              <Pill tone="warn">
                <Icon name="dot" /> Signed out
              </Pill>
            </div>

            <div style={{ marginTop: 14 }}>
              <SignIn />
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.45 }}>
              If you ever see a blank page, check Vercel env vars first (publishable key) and then the browser console.
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <AppShell />
      </SignedIn>
    </>
  );
}