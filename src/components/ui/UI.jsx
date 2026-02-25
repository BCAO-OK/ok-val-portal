import React, { useEffect, useMemo, useRef, useState } from "react";

export const NAVY = "#0B1B3A";
export const BG = "#0A0C10";
export const SURFACE = "rgba(255,255,255,0.055)";
export const SURFACE_2 = "rgba(255,255,255,0.075)";
export const BORDER = "rgba(255,255,255,0.10)";
export const TEXT_DIM = "rgba(255,255,255,0.72)";
export const TEXT_DIM_2 = "rgba(255,255,255,0.58)";

export function useIsMobile(breakpointPx = 980) {
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

export function useIsNarrowDashboard(breakpointPx = 1200) {
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

export function Icon({ name }) {
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

  const map = {
    menu: (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    ),
    home: (
      <svg {...common}>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
    book: (
      <svg {...common}>
        <path d="M4 19a2 2 0 0 0 2 2h12" />
        <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5z" />
      </svg>
    ),
    check: (
      <svg {...common}>
        <path d="M20 6L9 17l-5-5" />
      </svg>
    ),
    chart: (
      <svg {...common}>
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-7" />
      </svg>
    ),
    shield: (
      <svg {...common}>
        <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
      </svg>
    ),
    refresh: (
      <svg {...common}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v6h-6" />
      </svg>
    ),
    dot: (
      <svg {...common}>
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    ),
    plus: (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
    x: (
      <svg {...common}>
        <path d="M18 6L6 18" />
        <path d="M6 6l12 12" />
      </svg>
    ),
    trash: (
      <svg {...common}>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    ),
    edit: (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    ),
  };

  return map[name] || map.dot;
}

export function Pill({ children, tone = "neutral" }) {
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

export function Card({ title, subtitle, children, right }) {
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

export function PrimaryButton({ children, onClick, disabled, icon }) {
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

export function GhostButton({ children, onClick, disabled, icon, ariaLabel }) {
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

export function Modal({ title, children, onClose, width = 860 }) {
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

export function Input({ label, value, onChange, placeholder, type = "text", hint }) {
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

export function TextArea({ label, value, onChange, placeholder, rows = 4, hint }) {
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

export function Select({ label, value, onChange, options, hint }) {
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

export function Dropdown({ label, value, options, onChange, hint, placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

export function Toggle({ label, checked, onChange, hint }) {
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