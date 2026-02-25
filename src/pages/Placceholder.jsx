import React from "react";
import { TEXT_DIM, TEXT_DIM_2 } from "../components/ui/UI";

export default function Placeholder({ title, description }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: 0.2 }}>{title}</div>
      <div style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.5 }}>{description}</div>
      <div style={{ marginTop: 6, color: TEXT_DIM_2, fontSize: 12 }}>
        (Placeholder. We’ll replace this with real pages + endpoints.)
      </div>
    </div>
  );
}