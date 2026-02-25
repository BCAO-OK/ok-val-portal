export function getRoleCodes(me) {
  // Support both shapes:
  // 1) New /api/me: me.data.global_role_code + me.data.membership_role_code
  // 2) Old /api/me: me.roles[] (array of role objects)
  const d = me?.data || me || {};

  const codes = [];

  // New shape
  if (d.global_role_code) codes.push(String(d.global_role_code).toLowerCase());
  if (d.membership_role_code) codes.push(String(d.membership_role_code).toLowerCase());

  // Old shape fallback
  const rolesArr = Array.isArray(d?.roles) ? d.roles : [];
  for (const r of rolesArr) {
    const c = String(r?.role_code || "").toLowerCase();
    if (c) codes.push(c);
  }

  // Deduplicate
  return Array.from(new Set(codes)).filter(Boolean);
}

export function isAdmin(me) {
  const codes = getRoleCodes(me);
  // System admin is global; assessor/director are org-scoped approvers
  return (
    codes.includes("system_admin") ||
    codes.includes("assessor") ||
    codes.includes("director") ||
    codes.includes("admin")
  );
}

export function canEditQuestions(me) {
  const codes = getRoleCodes(me);
  return (
    codes.includes("system_admin") ||
    codes.includes("assessor") ||
    codes.includes("director") ||
    codes.includes("admin") ||
    codes.includes("db_admin") ||
    codes.includes("db_editor")
  );
}
