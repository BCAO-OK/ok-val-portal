import React, { useEffect, useState } from "react";

export default function Quizzes() {
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [error, setError] = useState("");

  const startGeneralQuiz = () => {
    alert("Step 3: Hook this to open the quiz modal (General Knowledge).");
  };

  const startDomainQuiz = () => {
    if (!domain) {
      alert("Select a domain first.");
      return;
    }

    alert(`Step 3: Hook this to open the quiz modal (Domain ID: ${domain}).`);
  };

  useEffect(() => {
    let mounted = true;

    async function loadDomains() {
      setLoadingDomains(true);
      setError("");

      try {
        const res = await fetch("/api/quiz/domains");
        const data = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error?.message || "Failed to load domains.");
        }

        if (!mounted) return;

        setDomains(data.domains || []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Failed to load domains.");
      } finally {
        if (!mounted) return;
        setLoadingDomains(false);
      }
    }

    loadDomains();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ margin: "0 0 12px" }}>Quizzes</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* General Knowledge */}
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
            General Knowledge
          </h2>
          <p
            style={{
              margin: "0 0 12px",
              opacity: 0.85,
              lineHeight: 1.4,
            }}
          >
            Full random 25-question quiz pulled from the question bank.
          </p>

          <button
            onClick={startGeneralQuiz}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Start General Quiz (25)
          </button>
        </section>

        {/* Domain Quiz */}
        <section
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: 14,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>By Domain</h2>
          <p
            style={{
              margin: "0 0 12px",
              opacity: 0.85,
              lineHeight: 1.4,
            }}
          >
            Select a domain and take a random 25-question quiz from that domain only.
          </p>

          <label
            style={{
              display: "block",
              fontSize: 13,
              marginBottom: 6,
              opacity: 0.9,
            }}
          >
            Domain
          </label>

          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={loadingDomains}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(0,0,0,0.25)",
              color: "inherit",
              marginBottom: 12,
            }}
          >
            <option value="">
              {loadingDomains ? "Loading domains..." : "Select a domain"}
            </option>

            {domains.map((d) => (
              <option key={d.domain_id} value={d.domain_id}>
                {d.domain_label}
              </option>
            ))}
          </select>

          {error ? (
            <div
              style={{
                marginBottom: 10,
                color: "#ffb4b4",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            onClick={startDomainQuiz}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Start Domain Quiz (25)
          </button>
        </section>
      </div>
    </div>
  );
}