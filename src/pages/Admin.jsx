// Admin.jsx (replace entire file)
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  GhostButton,
  Icon,
  Pill,
  TEXT_DIM,
  TEXT_DIM_2,
} from "../components/ui/UI";
import { apiFetch } from "../lib/api";

export default function Admin({ me, getToken, onRefresh }) {
  const meData = me?.data || me || {};

  // Normalize codes so we don't get burned by "ASSESSOR" vs "assessor"
  const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

  const membershipRole = norm(meData.membership_role_code);
  const globalRole = norm(meData.global_role_code);

  // Prefer the explicit boolean from /api/me, but keep a safe fallback
  const isSystemAdmin = !!meData.is_system_admin || globalRole === "system_admin";

  // Your rule: Assessor OR Director in the active org can access Admin
  const isOrgApprover = ["assessor", "director"].includes(membershipRole);

  // If your backend already computed this correctly, allow it too
  const canUseAdmin = isSystemAdmin || isOrgApprover || !!meData.can_admin_active_org;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [requests, setRequests] = useState([]);
  const [roles, setRoles] = useState([]);

  // Per-request selection
  const [selectedRoleByRequestId, setSelectedRoleByRequestId] = useState({});
  const [actionState, setActionState] = useState({}); // requestId -> {status, error}

  async function loadAll() {
    try {
      setLoading(true);
      setErr("");

      const [pending, rolesResp] = await Promise.all([
        apiFetch(getToken, "/api/org-requests-pending"),
        apiFetch(getToken, "/api/roles"),
      ]);

      const reqs = pending?.data || [];
      const rs = rolesResp?.data || [];

      setRequests(reqs);
      setRoles(rs);

      // Default role selection:
      // Prefer director, then assessor, else first available.
      const directorRoleId =
        rs.find((r) => norm(r.role_code) === "director")?.role_id || "";
      const assessorRoleId =
        rs.find((r) => norm(r.role_code) === "assessor")?.role_id || "";
      const fallbackRoleId = rs[0]?.role_id || "";
      const defaultRoleId = directorRoleId || assessorRoleId || fallbackRoleId;

      const defaults = {};
      for (const r of reqs) defaults[r.request_id] = defaultRoleId;

      setSelectedRoleByRequestId((prev) => ({ ...defaults, ...prev }));
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    if (!canUseAdmin) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseAdmin]);

  const roleOptions = useMemo(() => {
    return (roles || []).map((r) => ({
      id: r.role_id,
      label: `${r.role_name} (${r.role_code})`,
      code: norm(r.role_code),
    }));
  }, [roles]);

  async function decide(requestId, decision) {
    try {
      setActionState((s) => ({
        ...s,
        [requestId]: { status: "working", error: "" },
      }));

      const body = { request_id: requestId, decision };

      if (decision === "approve") {
        const approved_role_id = selectedRoleByRequestId[requestId];
        if (!approved_role_id) {
          setActionState((s) => ({
            ...s,
            [requestId]: {
              status: "error",
              error: "Select an approved role first.",
            },
          }));
          return;
        }
        body.approved_role_id = approved_role_id;
      }

      await apiFetch(getToken, "/api/org-requests-decide", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await loadAll();
      await onRefresh?.();

      setActionState((s) => ({
        ...s,
        [requestId]: { status: "ok", error: "" },
      }));
    } catch (e) {
      setActionState((s) => ({
        ...s,
        [requestId]: { status: "error", error: String(e?.message || e) },
      }));
    }
  }

  if (!canUseAdmin) {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <Card
          title="Admin"
          subtitle="Access denied. You must be an Assessor or Director in the active organization."
        >
          <Pill tone="bad">
            <Icon name="dot" /> You need an <b>Assessor</b> or <b>Director</b>{" "}
            membership role for the active organization (or SYSTEM_ADMIN).
          </Pill>

          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: TEXT_DIM_2 }}>
              Debug snapshot:
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>
                <Icon name="dot" /> Global role: {meData.global_role_code || "—"}
              </Pill>
              <Pill>
                <Icon name="dot" /> Active org role:{" "}
                {meData.membership_role_code || "—"}
              </Pill>
              <Pill>
                <Icon name="dot" /> can_admin_active_org:{" "}
                {String(!!meData.can_admin_active_org)}
              </Pill>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
            Admin
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: TEXT_DIM,
              lineHeight: 1.45,
            }}
          >
            Approve organization access requests and manage users within your
            active organization (Assessor/Director).
          </div>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isSystemAdmin ? (
              <Pill tone="ok">
                <Icon name="dot" /> SYSTEM_ADMIN
              </Pill>
            ) : null}

            {meData.membership_role_code ? (
              <Pill tone={isOrgApprover ? "ok" : undefined}>
                <Icon name="dot" /> Active org role: {meData.membership_role_code}
              </Pill>
            ) : null}

            {meData.active_organization?.organization_name ? (
              <Pill>
                <Icon name="dot" /> Active org:{" "}
                {meData.active_organization.organization_name}
              </Pill>
            ) : null}
          </div>
        </div>

        <GhostButton
          onClick={loadAll}
          icon={<Icon name="refresh" />}
          ariaLabel="Refresh admin"
        >
          Refresh
        </GhostButton>
      </div>

      <Card
        title="Pending organization requests"
        subtitle="Assessor/Director can approve requests for their active organization. SYSTEM_ADMIN can approve any."
      >
        {loading ? (
          <Pill tone="warn">
            <Icon name="dot" /> Loading…
          </Pill>
        ) : err ? (
          <div style={{ display: "grid", gap: 10 }}>
            <Pill tone="bad">
              <Icon name="dot" /> Failed to load
            </Pill>
            <div style={{ fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.5 }}>
              {err}
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
            No pending requests.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {requests.map((r) => {
              const state = actionState[r.request_id] || {
                status: "idle",
                error: "",
              };
              const selectedRoleId = selectedRoleByRequestId[r.request_id] || "";

              return (
                <div
                  key={r.request_id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 16,
                    padding: 12,
                    background: "rgba(255,255,255,0.02)",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Pill>
                        <Icon name="dot" /> {r.requester_display_name || "—"}
                      </Pill>
                      <Pill>
                        <Icon name="dot" /> {r.requester_email || "—"}
                      </Pill>
                      <Pill>
                        <Icon name="dot" /> {r.organization_name || "—"}
                      </Pill>
                    </div>

                    <Pill tone="warn">
                      <Icon name="dot" /> pending
                    </Pill>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: TEXT_DIM_2,
                        fontWeight: 900,
                      }}
                    >
                      Approved membership role
                    </div>

                    <select
                      value={selectedRoleId}
                      onChange={(e) =>
                        setSelectedRoleByRequestId((m) => ({
                          ...m,
                          [r.request_id]: e.target.value,
                        }))
                      }
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
                      {roleOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <div style={{ fontSize: 12, color: TEXT_DIM_2, lineHeight: 1.45 }}>
                      This sets the user’s role within the requested organization
                      (membership-scoped).
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <GhostButton
                      onClick={() => decide(r.request_id, "approve")}
                      icon={<Icon name="check" />}
                      ariaLabel="Approve request"
                      disabled={state.status === "working"}
                    >
                      {state.status === "working" ? "Working…" : "Approve"}
                    </GhostButton>

                    <GhostButton
                      onClick={() => decide(r.request_id, "reject")}
                      icon={<Icon name="x" />}
                      ariaLabel="Reject request"
                      disabled={state.status === "working"}
                    >
                      Reject
                    </GhostButton>

                    {state.status === "ok" ? (
                      <Pill tone="ok">
                        <Icon name="dot" /> Done
                      </Pill>
                    ) : null}

                    {state.status === "error" ? (
                      <Pill tone="bad">
                        <Icon name="dot" /> {state.error}
                      </Pill>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
