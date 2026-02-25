import React from "react";
import { Card, GhostButton, Icon, Pill, TEXT_DIM, TEXT_DIM_2, useIsNarrowDashboard } from "../components/ui/UI";
import { getRoleCodes } from "../lib/authz";

export default function Dashboard({ me, status, error, onRefresh }) {
  const isNarrow = useIsNarrowDashboard(1200);
  const roleCodes = getRoleCodes(me);

  const leftSpan = isNarrow ? "1 / -1" : "span 2";
  const rightSpan = isNarrow ? "1 / -1" : "span 1";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 1000, letterSpacing: 0.2 }}>Overview</div>
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
                {me?.email ? <Pill><Icon name="dot" /> {me.email}</Pill> : null}
                {me?.display_name ? <Pill><Icon name="dot" /> {me.display_name}</Pill> : null}
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
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: rightSpan, minWidth: 0 }}>
          <Card title="Next build targets" subtitle="Highest-value UX wins after auth is stable.">
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Pill><Icon name="book" /> Question bank</Pill>
                <Pill><Icon name="check" /> Quizzes</Pill>
                <Pill><Icon name="chart" /> Analytics</Pill>
              </div>
              <div style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>
                Next: break Questions into smaller components (list + editor modal) and add real pagination totals.
              </div>
            </div>
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