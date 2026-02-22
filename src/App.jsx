import React, { useEffect, useMemo, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

function pillStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  };
}

function cardStyle() {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
  };
}

function Dashboard() {
  const { getToken } = useAuth();
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("loading");
        setError("");

        const token = await getToken();
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        if (!cancelled) {
          setMe(json.data);
          setStatus("ok");
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e.message || e));
          setStatus("error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const roleCodes = useMemo(() => {
    const arr = Array.isArray(me?.roles) ? me.roles : [];
    return arr.map((r) => String(r?.role_code || "").toLowerCase()).filter(Boolean);
  }, [me]);

  const isSystemAdmin = roleCodes.includes("system_admin");

  if (status === "loading") {
    return (
      <div style={cardStyle()}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Dashboard</div>
        <div style={{ opacity: 0.8 }}>Loading your profile…</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ ...cardStyle(), borderColor: "rgba(255,0,0,0.25)" }}>
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Dashboard</div>
        <div style={{ ...pillStyle(), borderColor: "rgba(255,0,0,0.35)", background: "rgba(255,0,0,0.10)" }}>
          Status: error
        </div>
        <div style={{ marginTop: 12, color: "#ff5a5a", fontWeight: 800 }}>{error}</div>
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>
          If this keeps happening, it’s usually a token/env mismatch or the user isn’t provisioned in Neon.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header card */}
      <div style={cardStyle()}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>Dashboard</div>
            <div style={{ opacity: 0.8 }}>
              Welcome, <span style={{ fontWeight: 900 }}>{me?.display_name}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={pillStyle()}>Status: ok</span>
            {isSystemAdmin ? (
              <span
                style={{
                  ...pillStyle(),
                  borderColor: "rgba(0,255,170,0.25)",
                  background: "rgba(0,255,170,0.10)",
                }}
              >
                System Admin
              </span>
            ) : (
              <span style={pillStyle()}>User</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...cardStyle(), padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>Email</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{me?.email}</div>
          </div>
          <div style={{ ...cardStyle(), padding: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>Roles</div>
            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Array.isArray(me?.roles) ? me.roles : []).map((r, idx) => (
                <span key={idx} style={pillStyle()}>
                  {r.role_code}
                </span>
              ))}
              {!Array.isArray(me?.roles) || me.roles.length === 0 ? <span style={pillStyle()}>none</span> : null}
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Take a Quiz</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>
            Start a session and get immediate feedback + an end-of-session review.
          </div>
          <button
            type="button"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
            onClick={() => alert("Next step: wire quiz route")}
          >
            Start Quiz →
          </button>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>My Progress</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>
            Domain proficiency breakdown (average over all attempts).
          </div>
          <button
            type="button"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
            onClick={() => alert("Next step: wire progress route")}
          >
            View Progress →
          </button>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Question Library</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>
            Browse and search questions by category/domain (read-only unless editor+).
          </div>
          <button
            type="button"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
            onClick={() => alert("Next step: wire library route")}
          >
            Open Library →
          </button>
        </div>

        <div style={cardStyle()}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>Admin</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 12 }}>
            Manage users, roles, and question governance.
          </div>

          {isSystemAdmin ? (
            <button
              type="button"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(0,255,170,0.25)",
                background: "rgba(0,255,170,0.10)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              onClick={() => alert("Next step: wire admin route")}
            >
              Open Admin →
            </button>
          ) : (
            <div style={{ ...pillStyle(), opacity: 0.8 }}>Not authorized</div>
          )}
        </div>
      </div>

      {/* Debug collapse-ish */}
      <div style={{ ...cardStyle(), opacity: 0.9 }}>
        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900, marginBottom: 8 }}>Debug</div>
        <pre style={{ margin: 0, overflowX: "auto" }}>{JSON.stringify(me, null, 2)}</pre>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 0.5 }}>OK-VAL</div>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <main style={{ marginTop: 24 }}>
        <SignedOut>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ margin: "0 0 12px" }}>Sign in</h1>
            <SignIn />
          </div>
        </SignedOut>

        <SignedIn>
          <Dashboard />
        </SignedIn>
      </main>
    </div>
  );
}