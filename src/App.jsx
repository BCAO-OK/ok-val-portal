import React, { useEffect, useState } from "react";
import {
  SignedIn,
  SignedOut,
  SignIn,
  UserButton,
  useAuth,
} from "@clerk/clerk-react";

function Dashboard() {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }

        if (!cancelled) {
          setData(json.data);
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

  return (
    <div>
      <h1 style={{ margin: "0 0 12px" }}>Dashboard</h1>
      <div>Status: {status}</div>
      {error && <pre style={{ color: "crimson" }}>{error}</pre>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
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
        }}
      >
        <div style={{ fontWeight: 800 }}>OK-VAL</div>
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