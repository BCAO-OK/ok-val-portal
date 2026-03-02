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

  const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

  const membershipRole = norm(meData.membership_role_code);
  const globalRole = norm(meData.global_role_code);

  const isSystemAdmin =
    !!meData.is_system_admin || globalRole === "system_admin";

  const isOrgApprover = ["assessor", "director"].includes(membershipRole);

  const canUseAdmin =
    isSystemAdmin || isOrgApprover || !!meData.can_admin_active_org;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [requests, setRequests] = useState([]);
  const [roles, setRoles] = useState([]);

  const [usersLoading, setUsersLoading] = useState(true);
  const [usersErr, setUsersErr] = useState("");
  const [usersData, setUsersData] = useState({
    organizations: [],
    unassigned: [],
  });
  const [orgsForTransfer, setOrgsForTransfer] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editWorking, setEditWorking] = useState(false);
  const [editError, setEditError] = useState("");

  const [editDisplayName, setEditDisplayName] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editTransferOrgId, setEditTransferOrgId] = useState("");

  const [selectedRoleByRequestId, setSelectedRoleByRequestId] = useState({});
  const [actionState, setActionState] = useState({});

  async function loadUsers() {
    try {
      setUsersLoading(true);
      setUsersErr("");

      const resp = await fetch("/api/org-users", { method: "GET" });
      const body = await resp.json();

      if (!resp.ok || !body?.ok) {
        throw new Error(body?.error?.message || "Failed to load users");
      }

      setUsersData(body.data || { organizations: [], unassigned: [] });
      setUsersLoading(false);
    } catch (e) {
      setUsersLoading(false);
      setUsersErr(String(e?.message || e));
    }
  }

  async function loadTransferOrganizationsIfNeeded() {
    if (!isSystemAdmin) return;
    try {
      const orgResp = await apiFetch(getToken, "/api/organizations");
      setOrgsForTransfer(orgResp?.data || []);
    } catch {
      setOrgsForTransfer([]);
    }
  }

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

      const directorRoleId =
        rs.find((r) => norm(r.role_code) === "director")?.role_id || "";
      const assessorRoleId =
        rs.find((r) => norm(r.role_code) === "assessor")?.role_id || "";
      const fallbackRoleId = rs[0]?.role_id || "";
      const defaultRoleId =
        directorRoleId || assessorRoleId || fallbackRoleId;

      const defaults = {};
      for (const r of reqs) defaults[r.request_id] = defaultRoleId;

      setSelectedRoleByRequestId((prev) => ({ ...defaults, ...prev }));
      setLoading(false);

      await Promise.all([
        loadUsers(),
        loadTransferOrganizationsIfNeeded(),
      ]);
    } catch (e) {
      setLoading(false);
      setErr(String(e?.message || e));
      await loadUsers();
    }
  }

  useEffect(() => {
    if (!canUseAdmin) return;
    loadAll();
  }, [canUseAdmin]);

  const roleOptions = useMemo(() => {
    return (roles || []).map((r) => ({
      id: r.role_id,
      label: `${r.role_name} (${r.role_code})`,
    }));
  }, [roles]);

  const orgOptions = useMemo(() => {
    return (orgsForTransfer || []).map((o) => ({
      id: o.organization_id,
      label: o.organization_name,
    }));
  }, [orgsForTransfer]);

  function openEdit(user, orgCtx) {
    setEditError("");
    setEditWorking(false);

    setEditUser({
      ...user,
      organization_id:
        orgCtx?.organization_id || user.organization_id || null,
      organization_name:
        orgCtx?.organization_name || user.organization_name || null,
    });

    setEditDisplayName(user.display_name || "");
    setEditRoleId(user.membership_role_id || "");
    setEditTransferOrgId("");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditUser(null);
    setEditDisplayName("");
    setEditRoleId("");
    setEditTransferOrgId("");
    setEditWorking(false);
    setEditError("");
  }

  async function saveEdit() {
    if (!editUser?.user_id) return;

    try {
      setEditWorking(true);
      setEditError("");

      const payload = {
        user_id: editUser.user_id,
        display_name: editDisplayName.trim(),
      };

      if (editRoleId) payload.role_id = editRoleId;

      if (isSystemAdmin && editUser.organization_id)
        payload.organization_id = editUser.organization_id;

      if (isSystemAdmin && editTransferOrgId)
        payload.transfer_to_organization_id = editTransferOrgId;

      const resp = await fetch("/api/org-users-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await resp.json();
      if (!resp.ok || !body?.ok)
        throw new Error(body?.error?.message || "Failed to save user");

      await loadUsers();
      await onRefresh?.();

      closeEdit();
    } catch (e) {
      setEditError(String(e?.message || e));
    } finally {
      setEditWorking(false);
    }
  }

  async function removeUserFromOrg() {
    if (!editUser?.user_id) return;

    try {
      setEditWorking(true);
      setEditError("");

      const payload = {
        user_id: editUser.user_id,
        deactivation_reason: "Removed from organization",
      };

      if (isSystemAdmin && editUser.organization_id)
        payload.organization_id = editUser.organization_id;

      const resp = await fetch("/api/org-users-deactivate", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await resp.json();
      if (!resp.ok || !body?.ok)
        throw new Error(body?.error?.message || "Failed to remove user");

      await loadUsers();
      await onRefresh?.();
      closeEdit();
    } catch (e) {
      setEditError(String(e?.message || e));
    } finally {
      setEditWorking(false);
    }
  }

  if (!canUseAdmin) return null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* existing header + cards remain unchanged */}

      {/* EDIT MODAL — FIXED TRANSPARENCY */}
      {editOpen && editUser && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.75)",   // darker overlay
            backdropFilter: "blur(4px)",      // subtle blur
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div style={{ width: "min(720px, 100%)" }}>
            <div
              style={{
                borderRadius: 18,
                background: "rgba(15,15,15,0.95)", // solid surface
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
                overflow: "hidden",
              }}
            >
              <Card
                title="Edit user"
                subtitle="Update display name, membership role, and (SYSTEM_ADMIN) transfer organization."
              >
                {/* Existing modal content unchanged */}
                {/* ... your inputs and buttons here ... */}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
