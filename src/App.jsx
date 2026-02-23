import React, { useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

import OkValLogo from "./components/OkValLogo";

export default function App() {
  return (
    <>
      <SignedOut>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
          }}
        >
          <div style={{ maxWidth: 420, width: "100%" }}>
            <SignIn />
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <MainLayout />
      </SignedIn>
    </>
  );
}

/* ---------------- Main Layout ---------------- */

function MainLayout() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
      }}
    >
      <SidebarNav />
      <div style={{ flex: 1, padding: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          Welcome to OK-VAL
        </h1>
      </div>
    </div>
  );
}

/* ---------------- Sidebar ---------------- */

function SidebarNav() {
  return (
    <div
      style={{
        width: 260,
        background: "#0f172a",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Top Brand Section */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 30,
          }}
        >
          {/* Logo Container */}
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
            }}
          >
            <OkValLogo size={26} />
          </div>

          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: 0.5,
              }}
            >
              OK-VAL
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
              }}
            >
              Assessment Training
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <NavItem label="Dashboard" />
        <NavItem label="Quizzes" />
        <NavItem label="Reports" />
        <NavItem label="Administration" />
      </div>

      {/* Bottom User Section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 16,
        }}
      >
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          Signed in
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}

/* ---------------- Sidebar Item ---------------- */

function NavItem({ label }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        marginBottom: 6,
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 500,
        color: "#cbd5e1",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
    >
      {label}
    </div>
  );
}