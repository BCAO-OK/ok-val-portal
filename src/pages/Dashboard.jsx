import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  GhostButton,
  Icon,
  Pill,
  TEXT_DIM,
  TEXT_DIM_2,
  useIsNarrowDashboard,
} from "../components/ui/UI";
import { getRoleCodes } from "../lib/authz";
import { apiFetch } from "../lib/api";

export default function Dashboard({ me, status, error, onRefresh, getToken }) {
  const isNarrow = useIsNarrowDashboard(1200);
  const roleCodes = getRoleCodes(me);

  const leftSpan = isNarrow ? "1 / -1" : "span 2";
  const rightSpan = isNarrow ? "1 / -1" : "span 1";

  // --- Org access UI state ---
  const [orgsStatus, setOrgsStatus] = useState("idle"); // idle | loading | ok | error
  const [orgsError, setOrgsError] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");

  const [reqStatus, setReqStatus] = useState("idle"); // idle | loading | ok | error
  const [reqError, setReqError] = useState("");

  const hasOrg = !!me?.organization;
  const pendingReq = me?.pending_request || null;

  async function loadOrganizations() {
    try {
      setOrgsStatus("loading");
      setOrgsError("");
      const json = await apiFetch(getToken, "/api/organizations");
      const list = json?.data || [];
      setOrgs(list);
      setSelectedOrgId(list?.[0]?.organization_id || "");
      setOrgsStatus("ok");
    } catch (e) {
      setOrgsStatus("error");
      setOrgsError(String(e?.message || e));
    }
  }

  async function submitRequest() {
    if (!selectedOrgId) return;
    try {
      setReqStatus("loading");
      setReqError("");
      await apiFetch(getToken, "/api/org-requests", {
        method: "POST",
        body: ({ requested_organization_id: selectedOrgId }),
      });
      setReqStatus("ok");
      await onRefresh?.(); // refresh /api/me so pending_request appears
    } catch (e) {
      setReqStatus("error");
      setReqError(String(e?.message || e));
    }
  }

  // Load organizations only when needed (user not assigned + no pending request)
  useEffect(() => {
    if (status !== "ok") return;
    if (hasOrg) return;
    if (pendingReq) return;
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, hasOrg, pendingReq]);

  const orgOptions = useMemo(() => {
    return (orgs || []).map((o) => ({
      id: o.organization_id,
      label: `${o.organization_name}${o.organization_type_name ? ` (${o.organization_type_name})` : ""}`,
    }));
  }, [orgs]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>
            Overview
          </div>
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

              {/* Organization info (if assigned) */}
              {me?.organization ? (
                <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Organization</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill>
                      <Icon name="dot" /> {me.organization.organization_name}
                    </Pill>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: rightSpan, minWidth: 0 }}>
          <Card title="Organization access" subtitle="Request access to your county/organization.">
            {/* Assigned */}
            {hasOrg ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Pill tone="ok">
                  <Icon name="dot" /> Assigned: {me.organization.organization_name}
                </Pill>
                <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                  You’re already assigned to an organization.
                </div>
              </div>
            ) : null}

            {/* Pending */}
            {!hasOrg && pendingReq ? (
              <div style={{ display: "grid", gap: 10 }}>
                <Pill tone="warn">
                  <Icon name="dot" /> Pending approval
                </Pill>
                <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                  Your request is awaiting approval.
                </div>
              </div>
            ) : null}

            {/* Request form */}
            {!hasOrg && !pendingReq ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                  Select your organization and submit a request. An Assessor/Director (or System Admin) will approve it.
                </div>

                {orgsStatus === "loading" ? (
                  <Pill tone="warn">
                    <Icon name="dot" /> Loading organizations…
                  </Pill>
                ) : null}

                {orgsStatus === "error" ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    <Pill tone="bad">
                      <Icon name="dot" /> Failed to load organizations
                    </Pill>
                    <div style={{ fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.5 }}>{orgsError}</div>
                    <GhostButton onClick={loadOrganizations} icon={<Icon name="refresh" />} ariaLabel="Retry load orgs">
                      Retry
                    </GhostButton>
                  </div>
                ) : null}

                {orgsStatus === "ok" ? (
                  <>
                    <label style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontSize: 12, color: TEXT_DIM_2, fontWeight: 900 }}>Organization</div>
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
                        {orgOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <GhostButton
                        onClick={submitRequest}
                        icon={<Icon name="check" />}
                        ariaLabel="Request access"
                        disabled={!selectedOrgId || reqStatus === "loading"}
                      >
                        {reqStatus === "loading" ? "Submitting…" : "Request access"}
                      </GhostButton>

                      {reqStatus === "ok" ? (
                        <Pill tone="ok">
                          <Icon name="dot" /> Submitted
                        </Pill>
                      ) : null}

                      {reqStatus === "error" ? (
                        <Pill tone="bad">
                          <Icon name="dot" /> {reqError}
                        </Pill>
                      ) : null}
                    </div>

                    <div style={{ fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.45 }}>
                      Note: If you accidentally request the wrong org, we’ll add “Cancel request” next.
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      {status === "error" ? (
        <Card title="Error" subtitle="The /api/me call failed. Most common cause is missing Vercel env vars.">
          <div style={{ color: "rgba(255,220,220,0.95)", fontSize: 13, fontWeight: 900, lineHeight: 1.5 }}>
            {error}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
