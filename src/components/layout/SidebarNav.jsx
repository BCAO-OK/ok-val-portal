import React from "react";

export default function SidebarNav({ items, activeKey, onSelect, footer }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "100%" }}>
      <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
        {items.header}
      </div>

      <div style={{ padding: 10, overflowY: "auto" }}>
        {items.nav.map((it) => {
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