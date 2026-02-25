// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, GhostButton, Icon, Pill, TEXT_DIM, TEXT_DIM_2 } from "../components/ui/UI";
import { apiFetch } from "../lib/api";

function asErrorString(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e?.message) return String(e.message);
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export default function Dashboard({ getToken }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [meResp, setMeResp] = useState(null); // { ok, data }
  const [orgs, setOrgs] = useState([]);

  const me = meResp?.data || null;

  const activeOrgId = useMemo(() => {
    return (
      me?.active_organization_id ||
      me?.organization_id ||
      null
    );
  }, [me]);

  const activeOrgName = useMemo(() => {
    return (
      me?.active_organization?.organization_name ||
      me?.organization?.organization_name ||
      null
    );
  }, [me]);

  const roleBadges = useMemo(() => {
    const out = [];
    if (me?.global_role_code) out.push(String(me.global_role_code).toLowerCase());
    if (me?.membership_role_code) out.push(String(me.membership_role_code).toLowerCase());
    // Back-compat: if your old /api/me still returns roles array somewhere
    if (Array.isArray(me?.roles)) {
      for (const r of me.roles) {
        const c = String(r?.role_code || "").toLowerCase();
        if (c) out.push(c);
      }
    }
    return Array.from(new Set(out));
  }, [me]);

  const pendingRequest = me?.pending_request || null;

  // Show request panel ONLY if user has no org assigned AND no pending request
  const shouldShowOrgRequestPanel = !activeOrgId && !pendingRequest;

  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [requestState, setRequestState] = useState({ status: "idle", error: "", ok: "" });

  async function loadAll() {
    try {
      setLoading(true);
      setErr("");

      const [meR, orgR] = await Promise.all([
        apiFetch(getToken, "/api/me"),
        apiFetch(getToken, "/api/organizations"),
      ]);

      setMeResp(meR || null);
      setOrgs(orgR?.data || []);

      // Default org selection (first org)
      const firstOrgId = (orgR?.data || [])[0]?.organization_id || "";
      setSelectedOrgId((prev) => prev || firstOrgId);

      setLoading(false);
    } catch (e) {
      setLoading(false);
      setErr(asErrorString(e));
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitOrgRequest() {
    try {
      setRequestState({ status: "working", error: "", ok: "" });

      if (!selectedOrgId) {
        setRequestState({ status: "error", error: "Select an organization first.", ok: "" });
        return;
      }

      await apiFetch(getToken, "/api/org-requests", {
        method: "POST",
        body: JSON.stringify({ requested_organization_id: selectedOrgId }),
      });

      setRequestState({ status: "ok", error: "", ok: "Request submitted." });

      // Refresh /api/me so pending_request shows immediately
      await loadAll();
    } catch (e) {
      // If user is already assigned, treat as OK and refresh (this prevents “lockout loops”)
      const msg = asErrorString(e);
      if (msg.toLowerCase().includes("already belongs to an organization")) {
        setRequestState({ status: "ok", error: "", ok: "You already belong to an organization." });
        await loadAll();
        return;
      }

      setRequestState({ status: "error", error: msg, ok: "" });
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>Overview</div>
          <div style={{ marginTop: 6, fontSize: 13, color: TEXT_DIM, lineHeight: 1.45 }}>
            Authenticated status + role snapshot. This page helps diagnose token/role/org issues quickly.
          </div>
        </div>

        <GhostButton onClick={loadAll} icon={<Icon name="refresh" />} ariaLabel="Refresh /api/me">
          Refresh /api/me
        </GhostButton>
      </div>

      <Card title="Me" subtitle="Data returned from /api/me">
        {loading ? (
          <Pill tone="warn">
            <Icon name="dot" /> Loading…
          </Pill>
        ) : err ? (
          <div style={{ display: "grid", gap: 10 }}>
            <Pill tone="bad">
              <Icon name="dot" /> Failed to load
            </Pill>
            <div style={{ fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.5 }}>{err}</div>
          </div>
        ) : !me ? (
          <Pill tone="bad">
            <Icon name="dot" /> No /api/me data
          </Pill>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill tone="ok">
                <Icon name="dot" /> ok
              </Pill>
              <Pill>
                <Icon name="dot" /> {me.email || "—"}
              </Pill>
              <Pill>
                <Icon name="dot" /> {me.display_name || "—"}
              </Pill>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Roles</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {roleBadges.length ? (
                  roleBadges.map((c) => (
                    <Pill key={c}>
                      <Icon name="dot" /> {c}
                    </Pill>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: TEXT_DIM }}>No roles reported.</div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Active organization</div>
              {activeOrgId ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <Pill>
                    <Icon name="dot" /> {activeOrgName || activeOrgId}
                  </Pill>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                  No active organization set.
                </div>
              )}
            </div>

            {pendingRequest ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Pending request</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone="warn">
                    <Icon name="dot" /> {pendingRequest.status}
                  </Pill>
                  <Pill>
                    <Icon name="dot" /> {pendingRequest.requested_organization_id}
                  </Pill>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {/* Organization access request panel */}
      <Card
        title="Organization access"
        subtitle="Select your organization and submit a request. An Assessor/Director (or System Admin) will approve it."
      >
        {!shouldShowOrgRequestPanel ? (
          <div style={{ display: "grid", gap: 10 }}>
            <Pill tone="ok">
              <Icon name="dot" /> You already have organization access.
            </Pill>
            {activeOrgName ? (
              <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                Active org: <span style={{ color: "white" }}>{activeOrgName}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
            <div>
              <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900, marginBottom: 6 }}>
                Organization
              </div>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(0,0,0,0.25)",
                  color: "white",
                  outline: "none",
                }}
              >
                {(orgs || []).map((o) => (
                  <option key={o.organization_id} value={o.organization_id}>
                    {o.organization_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <GhostButton
                onClick={submitOrgRequest}
                icon={<Icon name="check" />}
                ariaLabel="Request access"
                disabled={requestState.status === "working"}
              >
                {requestState.status === "working" ? "Working…" : "Request access"}
              </GhostButton>

              {requestState.status === "ok" ? (
                <Pill tone="ok">
                  <Icon name="dot" /> {requestState.ok || "Done"}
                </Pill>
              ) : null}

              {requestState.status === "error" ? (
                <Pill tone="bad">
                  <Icon name="dot" /> {requestState.error}
                </Pill>
              ) : null}
            </div>

            <div style={{ fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.45 }}>
              Note: If you accidentally request the wrong org, we’ll add “Cancel request” next.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
