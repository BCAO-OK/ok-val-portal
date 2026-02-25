import React, { useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

import OkValLogo from "./components/OkValLogo";

/**
 * OK-VAL App Shell (modernized)
 * - Dark app background
 * - Navy sidebar navigation
 * - Responsive (mobile drawer)
 * - Role-aware nav (Admin shows only if app admin roles)
 * - Still uses /api/me with Clerk token
 */

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

const BRAND_BLUE = "#60a5fa";
const BRAND_FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"';
const BRAND_LETTER_SPACING = 0.8;

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

function BrandWordmark({ size = 18 }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 0,
        fontFamily: BRAND_FONT_STACK,
        fontWeight: 950,
        letterSpacing: BRAND_LETTER_SPACING,
        lineHeight: 1,
      }}
    >
      <span style={{ color: "white", fontSize: size }}>OK</span>
      <span style={{ color: BRAND_BLUE, fontSize: size }}>VAL</span>
    </div>
  );
}

function Icon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
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

  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }
  if (name === "x") {
    return (
      <svg {...common}>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </svg>
    );
  }
  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    );
  }
  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
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

function Pill({ children, tone = "neutral" }) {
  const styles =
    {
      neutral: { border: BORDER, bg: SURFACE_2, color: "rgba(255,255,255,0.86)" },
      ok: { border: "rgba(0,255,170,0.24)", bg: "rgba(0,255,170,0.10)", color: "rgba(220,255,245,0.95)" },
      warn: { border: "rgba(255,199,0,0.24)", bg: "rgba(255,199,0,0.10)", color: "rgba(255,240,200,0.95)" },
      bad: { border: "rgba(255,80,80,0.24)", bg: "rgba(255,80,80,0.10)", color: "rgba(255,220,220,0.95)" },
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
      {icon ? <span style={{ display: "inline-flex" }}>{icon}</span> : null}
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, disabled, icon, ariaLabel }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        background: "rgba(255,255,255,0.03)",
        color: "rgba(255,255,255,0.86)",
        fontWeight: 850,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {icon ? <span style={{ display: "inline-flex" }}>{icon}</span> : null}
      {children}
    </button>
  );
}

function SidebarNav({ items, activeKey, onSelect, footer }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "100%" }}>
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, display: "grid", placeItems: "center" }}>
            <OkValLogo size={44} />
          </div>
          <div style={{ minWidth: 0 }}>
            <BrandWordmark size={20} />
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
              Oklahoma Valuation Portal
            </div>
          </div>
        </div>
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
                gap: 12,
                padding: "10px 12px",
                borderRadius: 14,
                border: active ? "1px solid rgba(96,165,250,0.35)" : "1px solid transparent",
                background: active ? "rgba(96,165,250,0.12)" : "transparent",
                color: active ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.84)",
                cursor: "pointer",
                textAlign: "left",
                fontWeight: active ? 950 : 850,
                letterSpacing: 0.2,
                marginBottom: 6,
              }}
            >
              <span style={{ display: "inline-flex", opacity: active ? 1 : 0.86 }}>{it.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
              <span style={{ opacity: 0.5 }}>›</span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.10)" }}>{footer}</div>
    </div>
  );
}

function Modal({ title, children, onClose, width = 860 }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.62)",
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 14,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          borderRadius: 18,
          border: `1px solid ${BORDER}`,
          background: "rgba(12,15,20,0.96)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.60)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            borderBottom: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 950, letterSpacing: 0.2 }}>{title}</div>
          <GhostButton onClick={onClose} icon={<Icon name="x" />} ariaLabel="Close" />
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text", hint }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: TEXT_DIM_2 }}>{hint}</div> : null}
      </div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.92)",
          outline: "none",
          fontSize: 13,
        }}
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 4, hint }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: TEXT_DIM_2 }}>{hint}</div> : null}
      </div>
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.92)",
          outline: "none",
          fontSize: 13,
          resize: "vertical",
        }}
      />
    </label>
  );
}

function Select({ label, value, onChange, options, hint }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: TEXT_DIM_2 }}>{hint}</div> : null}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.92)",
          outline: "none",
          fontSize: 13,
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Dropdown({ label, value, options, onChange, hint, placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const rootRef = React.useRef(null);

  const selected = useMemo(() => {
    const v = String(value ?? "");
    return (options || []).find((o) => String(o.value) === v) || null;
  }, [options, value]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} style={{ display: "grid", gap: 6, position: "relative" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: TEXT_DIM_2 }}>{hint}</div> : null}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${BORDER}`,
          background: "rgba(255,255,255,0.04)",
          color: "rgba(255,255,255,0.92)",
          outline: "none",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          cursor: "pointer",
        }}
      >
        <span style={{ opacity: selected ? 0.95 : 0.6, flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </button>

      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            marginTop: 0,
            width: "100%",
            maxHeight: 280,
            overflowY: "auto",
            background: "#111827",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
            zIndex: 60,
          }}
        >
          {(options || []).map((o) => {
            const isSelected = String(o.value) === String(value ?? "");
            return (
              <div
                key={String(o.value)}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(String(o.value));
                  setOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.92)",
                  background: isSelected ? "rgba(96,165,250,0.18)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isSelected
                    ? "rgba(96,165,250,0.22)"
                    : "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected ? "rgba(96,165,250,0.18)" : "transparent";
                }}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "grid", gap: 3 }}>
        <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>{label}</div>
        {hint ? <div style={{ fontSize: 11, color: TEXT_DIM_2 }}>{hint}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: `1px solid ${BORDER}`,
          background: checked ? "rgba(0,255,170,0.18)" : "rgba(255,255,255,0.06)",
          position: "relative",
          cursor: "pointer",
        }}
        aria-pressed={checked}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 24 : 3,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: "rgba(255,255,255,0.88)",
            transition: "left 140ms ease",
          }}
        />
      </button>
    </label>
  );
}

/** ✅ FIX: allow system_admin/admin to edit (you were view-only) */
function canEditQuestions(me) {
  const roles = Array.isArray(me?.roles) ? me.roles : [];
  const roleCodes = roles.map((r) => String(r?.role_code || "").toLowerCase()).filter(Boolean);

  // Editors/admins can create/edit/delete questions.
  return (
    roleCodes.includes("system_admin") ||
    roleCodes.includes("admin") ||
    roleCodes.includes("db_admin") ||
    roleCodes.includes("db_editor")
  );
}

function normalizeQuestionId(q) {
  return q?.question_id ?? q?.id ?? q?.questionId ?? q?.questionID;
}

function QuestionBankPage({ me, getToken }) {
  const canEdit = canEditQuestions(me);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  // Filters (server-side)
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [domainId, setDomainId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);

  // Taxonomy options (so we never show UUIDs in the UI)
  const [categoryOptions, setCategoryOptions] = useState([]); // [{value,label}]
  const [domainOptions, setDomainOptions] = useState([]); // [{value,label,category_id}]

  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("create"); // create | edit
  const [draft, setDraft] = useState(() => ({
    question_id: "",
    category_id: "",
    domain_id: "",
    difficulty: "1",
    prompt: "",
    choice_a: "",
    choice_b: "",
    choice_c: "",
    choice_d: "",
    correct_choice_label: "A",
    explanation: "",
    citation_text: "",
    is_active: true,
  }));

  const [confirmDelete, setConfirmDelete] = useState(null);

  async function apiFetch(path, init = {}) {
    const token = await getToken();
    const headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
    const res = await fetch(path, { ...init, headers });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
    return json;
  }

  // Pull categories/domains for dropdowns.
  // We do this by sampling a large page from /api/questions (already returns category/domain names).
  async function loadTaxonomy() {
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "1000");
      params.set("active", "true");

      const json = await apiFetch(`/api/questions?${params.toString()}`);
      const list = json?.data ?? json;

      const rows = Array.isArray(list) ? list : Array.isArray(list?.items) ? list.items : [];

      const catMap = new Map(); // id -> name
      const domMap = new Map(); // id -> {name, category_id}

      for (const r of rows) {
        if (r?.category_id && r?.category_name) catMap.set(String(r.category_id), String(r.category_name));
        if (r?.domain_id && r?.domain_name) {
          domMap.set(String(r.domain_id), { name: String(r.domain_name), category_id: String(r.category_id || "") });
        }
      }

      const cats = Array.from(catMap.entries())
        .map(([id, name]) => ({ value: id, label: name }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const doms = Array.from(domMap.entries())
        .map(([id, v]) => ({ value: id, label: v.name, category_id: v.category_id }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setCategoryOptions(cats);
      setDomainOptions(doms);
    } catch (e) {
      // If taxonomy load fails, we still allow search by prompt/difficulty; dropdowns may be empty.
      console.warn("taxonomy load failed:", e);
    }
  }

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (categoryId) params.set("category_id", categoryId);
      if (domainId) params.set("domain_id", domainId);
      if (difficulty) params.set("difficulty", difficulty);
      params.set("active", activeOnly ? "true" : "false");
      if (unverifiedOnly) params.set("verified", "false");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const json = await apiFetch(`/api/questions?${params.toString()}`);

      const data = json?.data ?? json;
      const list = data?.items ?? data?.questions ?? data?.rows ?? data; // api returns {ok,true,data:[...]}
      const rows = Array.isArray(list) ? list : [];

      setItems(rows);
      // API does not currently return an authoritative total. We'll show the loaded count.
      setTotal(rows.length);
    } catch (e) {
      setErr(String(e?.message || e));
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, domainId, difficulty, activeOnly, unverifiedOnly]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, domainId, difficulty, activeOnly, unverifiedOnly]);

  // When category changes, clear domain if it no longer fits.
  useEffect(() => {
    if (!domainId) return;
    const d = domainOptions.find((x) => x.value === domainId);
    if (d && categoryId && d.category_id !== categoryId) setDomainId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  const filteredDomainOptions = useMemo(() => {
    const base = domainOptions;
    const doms = categoryId ? base.filter((d) => d.category_id === categoryId) : base;
    return [{ value: "", label: "All" }, ...doms.map((d) => ({ value: d.value, label: d.label }))];
  }, [domainOptions, categoryId]);

  const categoryFilterOptions = useMemo(() => {
    return [{ value: "", label: "All" }, ...categoryOptions];
  }, [categoryOptions]);

  function openCreate() {
    setEditorMode("create");
    setDraft({
      question_id: "",
      category_id: categoryId || "",
      domain_id: domainId || "",
      difficulty: difficulty || "1",
      prompt: "",
      choice_a: "",
      choice_b: "",
      choice_c: "",
      choice_d: "",
      correct_choice_label: "A",
      explanation: "",
      citation_text: "",
      is_active: true,
      is_verified: false,
    });
    setEditorOpen(true);
  }

  function openEdit(q) {
    const id = normalizeQuestionId(q);
    const choices = Array.isArray(q?.choices) ? q.choices : [];
    const byLabel = new Map(choices.map((c) => [String(c.choice_label || "").toUpperCase(), c]));

    setEditorMode("edit");
    setDraft({
      question_id: id ? String(id) : "",
      category_id: q?.category_id ? String(q.category_id) : "",
      domain_id: q?.domain_id ? String(q.domain_id) : "",
      difficulty: String(q?.difficulty ?? "1"),
      prompt: q?.prompt ?? "",
      choice_a: (byLabel.get("A")?.choice_text ?? "").toString(),
      choice_b: (byLabel.get("B")?.choice_text ?? "").toString(),
      choice_c: (byLabel.get("C")?.choice_text ?? "").toString(),
      choice_d: (byLabel.get("D")?.choice_text ?? "").toString(),
      correct_choice_label: String(q?.correct_choice_label ?? "A").toUpperCase(),
      explanation: q?.explanation ?? "",
      citation_text: q?.citation_text ?? "",
      is_active: q?.is_active ?? true,
      is_verified: q?.is_verified ?? false,
    });
    setEditorOpen(true);
  }

  function validateDraft(d) {
    const required = [
      ["category_id", "Category"],
      ["domain_id", "Domain"],
      ["prompt", "Prompt"],
      ["choice_a", "Choice A"],
      ["choice_b", "Choice B"],
      ["choice_c", "Choice C"],
      ["choice_d", "Choice D"],
      ["correct_choice_label", "Correct choice"],
      ["explanation", "Explanation"],
      ["citation_text", "Citation"],
    ];
    for (const [k, label] of required) if (!String(d?.[k] ?? "").trim()) return `${label} is required.`;
    if (!["1", "2", "3"].includes(String(d?.difficulty ?? ""))) return "Difficulty must be 1, 2, or 3.";
    if (!["A", "B", "C", "D"].includes(String(d?.correct_choice_label ?? "").toUpperCase()))
      return "Correct choice must be A, B, C, or D.";
    return "";
  }

  async function saveDraft() {
    try {
      const v = validateDraft(draft);
      if (v) throw new Error(v);
      if (!canEdit) throw new Error("You do not have permission to create or edit questions.");

      setLoading(true);
      setErr("");

      const correct = String(draft.correct_choice_label).toUpperCase();

      const payload = {
        domain_id: String(draft.domain_id).trim(),
        difficulty: Number(draft.difficulty),
        prompt: String(draft.prompt).trim(),
        explanation: String(draft.explanation).trim(),
        citation_text: String(draft.citation_text).trim(),
        is_active: Boolean(draft.is_active),
        is_verified: Boolean(draft.is_verified),
        correct_choice_label: correct,
        choices: [
          { choice_label: "A", choice_text: String(draft.choice_a).trim() },
          { choice_label: "B", choice_text: String(draft.choice_b).trim() },
          { choice_label: "C", choice_text: String(draft.choice_c).trim() },
          { choice_label: "D", choice_text: String(draft.choice_d).trim() },
        ],
      };

      if (editorMode === "create") {
        await apiFetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const id = draft?.question_id;
        if (!id) throw new Error("Missing question id.");
        await apiFetch(`/api/questions/${encodeURIComponent(String(id))}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setEditorOpen(false);
      await load();
      await loadTaxonomy();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function doDelete(q) {
    try {
      if (!canEdit) throw new Error("You do not have permission to delete questions.");
      const id = normalizeQuestionId(q);
      if (!id) throw new Error("Missing question id.");

      setLoading(true);
      setErr("");
      await apiFetch(`/api/questions/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const showingFrom = items.length ? (page - 1) * pageSize + 1 : 0;
  const showingTo = items.length ? (page - 1) * pageSize + items.length : 0;

  const categoryEditorOptions = useMemo(() => {
    return [{ value: "", label: "Select…" }, ...categoryOptions];
  }, [categoryOptions]);

  const domainEditorOptions = useMemo(() => {
    const doms = draft.category_id ? domainOptions.filter((d) => d.category_id === draft.category_id) : domainOptions;

    return [{ value: "", label: "Select…" }, ...doms.map((d) => ({ value: d.value, label: d.label }))];
  }, [domainOptions, draft.category_id]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 1000, letterSpacing: 0.2 }}>Question Bank</div>
          <div style={{ marginTop: 6, fontSize: 13, color: TEXT_DIM, lineHeight: 1.45 }}>
            View, create, edit, and delete questions in the database. Changes are role-gated and audit-friendly.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {canEdit ? (
            <PrimaryButton onClick={openCreate} icon={<Icon name="plus" />}>
              New question
            </PrimaryButton>
          ) : (
            <Pill tone="warn">
              <Icon name="dot" /> View-only
            </Pill>
          )}
          <GhostButton onClick={load} icon={<Icon name="refresh" />} ariaLabel="Refresh questions">
            Refresh
          </GhostButton>
        </div>
      </div>

      <Card title="Filters" subtitle="Search by prompt. Filter by category/domain/difficulty. (Server-side filters.)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <Input label="Search prompt" value={search} onChange={setSearch} placeholder="e.g., homestead exemption" />
          <Dropdown label="Category" value={categoryId} onChange={setCategoryId} options={categoryFilterOptions} />
          <Dropdown label="Domain" value={domainId} onChange={setDomainId} options={filteredDomainOptions} />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: "", label: "All" },
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
            ]}
          />
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <Toggle label="Active only" checked={activeOnly} onChange={setActiveOnly} hint="Hide inactive questions" />
          <Toggle
            label="Unverified only"
            checked={unverifiedOnly}
            onChange={setUnverifiedOnly}
            hint="Show questions flagged as not verified"
          />
        </div>
      </Card>

      {err ? (
        <Card title="Error" subtitle="The last request failed.">
          <div style={{ color: "rgba(255,220,220,0.95)", fontSize: 13, fontWeight: 900, lineHeight: 1.5 }}>{err}</div>
        </Card>
      ) : null}

      <Card
        title="Questions"
        subtitle={
          loading
            ? "Loading…"
            : `${items.length} loaded • showing ${showingFrom}–${showingTo} (page ${page}) • total shown: ${total}`
        }
        right={
          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              ariaLabel="Previous page"
            >
              Prev
            </GhostButton>
            <GhostButton onClick={() => setPage((p) => p + 1)} disabled={loading || items.length < pageSize} ariaLabel="Next page">
              Next
            </GhostButton>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          {items.length ? (
            items.map((q) => {
              const id = normalizeQuestionId(q);
              const title = q?.prompt ? String(q.prompt).slice(0, 140) : "(no prompt)";
              const badge = q?.is_verified ? <Pill tone="ok">Verified</Pill> : <Pill tone="warn">Unverified</Pill>;

              return (
                <div
                  key={String(id || title)}
                  style={{
                    border: `1px solid rgba(255,255,255,0.10)`,
                    borderRadius: 16,
                    padding: 12,
                    background: "rgba(255,255,255,0.03)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 950, lineHeight: 1.35 }}>{title}</div>
                      <div style={{ marginTop: 6, color: TEXT_DIM_2, fontSize: 12, lineHeight: 1.4 }}>
                        {q?.category_name ? `${q.category_name} • ` : ""}
                        {q?.domain_name ? `${q.domain_name} • ` : ""}
                        Difficulty {q?.difficulty ?? "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {badge}
                      {q?.is_active ? <Pill tone="ok">Active</Pill> : <Pill tone="bad">Inactive</Pill>}
                      {canEdit ? (
                        <>
                          <GhostButton onClick={() => openEdit(q)} icon={<Icon name="edit" />} ariaLabel="Edit question">
                            Edit
                          </GhostButton>
                          <GhostButton
                            onClick={() => setConfirmDelete(q)}
                            icon={<Icon name="trash" />}
                            ariaLabel="Delete question"
                          >
                            Delete
                          </GhostButton>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, color: TEXT_DIM, fontWeight: 850 }}>Explanation</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.86)", lineHeight: 1.45 }}>
                      {q?.explanation ? String(q.explanation) : "—"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12, color: TEXT_DIM, fontWeight: 850 }}>Citation</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.86)", lineHeight: 1.45 }}>
                      {q?.citation_text ? String(q.citation_text) : "—"}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ color: TEXT_DIM, fontSize: 13 }}>No questions found.</div>
          )}
        </div>
      </Card>

      {editorOpen ? (
        <Modal
          title={editorMode === "create" ? "New Question" : "Edit Question"}
          onClose={() => setEditorOpen(false)}
          width={980}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <Dropdown
                label="Category"
                value={draft.category_id}
                onChange={(v) => setDraft((d) => ({ ...d, category_id: v }))}
                options={categoryEditorOptions}
              />
              <Dropdown
                label="Domain"
                value={draft.domain_id}
                onChange={(v) => setDraft((d) => ({ ...d, domain_id: v }))}
                options={domainEditorOptions}
              />
              <Select
                label="Difficulty"
                value={draft.difficulty}
                onChange={(v) => setDraft((d) => ({ ...d, difficulty: v }))}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
              />
              <Select
                label="Correct choice"
                value={draft.correct_choice_label}
                onChange={(v) => setDraft((d) => ({ ...d, correct_choice_label: v }))}
                options={[
                  { value: "A", label: "A" },
                  { value: "B", label: "B" },
                  { value: "C", label: "C" },
                  { value: "D", label: "D" },
                ]}
              />
            </div>

            <Input
              label="Prompt"
              value={draft.prompt}
              onChange={(v) => setDraft((d) => ({ ...d, prompt: v }))}
              placeholder="Question prompt…"
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <Input label="Choice A" value={draft.choice_a} onChange={(v) => setDraft((d) => ({ ...d, choice_a: v }))} />
              <Input label="Choice B" value={draft.choice_b} onChange={(v) => setDraft((d) => ({ ...d, choice_b: v }))} />
              <Input label="Choice C" value={draft.choice_c} onChange={(v) => setDraft((d) => ({ ...d, choice_c: v }))} />
              <Input label="Choice D" value={draft.choice_d} onChange={(v) => setDraft((d) => ({ ...d, choice_d: v }))} />
            </div>

            <TextArea
              label="Explanation"
              value={draft.explanation}
              onChange={(v) => setDraft((d) => ({ ...d, explanation: v }))}
              placeholder="Explain why the correct answer is correct…"
              rows={4}
            />

            <TextArea
              label="Citation"
              value={draft.citation_text}
              onChange={(v) => setDraft((d) => ({ ...d, citation_text: v }))}
              placeholder="Cite Oklahoma Constitution / Title 68 / OTC 710 / AG / case law…"
              rows={3}
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <Toggle
                label="Active"
                checked={Boolean(draft.is_active)}
                onChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
                hint="Inactive questions are hidden unless Active only is off."
              />
              <Toggle
                label="Verified"
                checked={Boolean(draft.is_verified)}
                onChange={(v) => setDraft((d) => ({ ...d, is_verified: v }))}
                hint="Used for review workflows; unverified questions can be filtered."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <GhostButton onClick={() => setEditorOpen(false)} ariaLabel="Cancel">
                Cancel
              </GhostButton>
              <PrimaryButton onClick={saveDraft} disabled={loading}>
                {loading ? "Saving…" : "Save"}
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal title="Delete Question" onClose={() => setConfirmDelete(null)} width={720}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.5 }}>
              This will permanently delete the question. This should be rare—prefer marking inactive if you want to preserve auditability.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <GhostButton onClick={() => setConfirmDelete(null)} ariaLabel="Cancel delete">
                Cancel
              </GhostButton>
              <PrimaryButton onClick={() => doDelete(confirmDelete)} disabled={loading} icon={<Icon name="trash" />}>
                {loading ? "Deleting…" : "Delete"}
              </PrimaryButton>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function DashboardHome({ me, status, error, onRefresh }) {
  const isNarrow = useIsNarrowDashboard(1200);

  const roles = Array.isArray(me?.roles) ? me.roles : [];
  const roleCodes = roles.map((r) => String(r?.role_code || "").toLowerCase()).filter(Boolean);

  const leftSpan = isNarrow ? "1 / -1" : "span 2";
  const rightSpan = isNarrow ? "1 / -1" : "span 1";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>Overview</div>
          <div style={{ marginTop: 6, fontSize: 13, color: TEXT_DIM, lineHeight: 1.45 }}>
            Authenticated status + role snapshot. This page helps diagnose env/token/role issues quickly.
          </div>
        </div>
        <GhostButton onClick={onRefresh} icon={<Icon name="refresh" />} ariaLabel="Refresh /api/me">
          Refresh /api/me
        </GhostButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "2fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: leftSpan, minWidth: 0 }}>
          <Card title="Me" subtitle="Data returned from /api/me">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Pill tone={status === "ok" ? "ok" : status === "error" ? "bad" : "warn"}>
                  <Icon name="dot" /> {status}
                </Pill>
                {me?.email ? (
                  <Pill>
                    <Icon name="dot" /> {me.email}
                  </Pill>
                ) : null}
                {me?.display_name ? (
                  <Pill>
                    <Icon name="dot" /> {me.display_name}
                  </Pill>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Roles</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
    if (active === "questions") return <QuestionBankPage me={me} getToken={getToken} />;
    if (active === "quizzes")
      return (
        <PlaceholderPage title="Quizzes" description="Start a quiz session, get immediate feedback, and record domain proficiency." />
      );
    if (active === "reports")
      return <PlaceholderPage title="Reports" description="Proficiency breakdown by domain and role-based reporting views." />;
    if (active === "admin")
      return (
        <PlaceholderPage title="Admin" description="User role management and audit-friendly configuration (admin only)." />
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
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                    {me?.display_name || me?.email || "—"}
                  </div>
                </div>
              }
            />
          </aside>
        ) : null}

        <div style={{ minWidth: 0, display: "grid", gridTemplateRows: "auto 1fr" }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              position: "sticky",
              top: 0,
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {isMobile ? (
                <GhostButton onClick={() => setSidebarOpen(true)} icon={<Icon name="menu" />} ariaLabel="Open menu">
                  Menu
                </GhostButton>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{ width: 36, height: 36, display: "grid", placeItems: "center" }}>
                  <OkValLogo size={34} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <BrandWordmark size={18} />
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", marginTop: 4 }}>
                    {active === "dashboard" ? "Overview" : navItems.find((x) => x.key === active)?.label || ""}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Pill tone={status === "ok" ? "ok" : status === "error" ? "bad" : "warn"}>
                <Icon name="dot" /> {status}
              </Pill>
              <UserButton />
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
                width: 320,
                maxWidth: "88vw",
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
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                      {me?.display_name || me?.email || "—"}
                    </div>
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
                <BrandWordmark size={20} />
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