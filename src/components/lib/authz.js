export function getRoleCodes(me) {
  const roles = Array.isArray(me?.roles) ? me.roles : [];
  return roles
    .map((r) => String(r?.role_code || "").toLowerCase())
    .filter(Boolean);
}

export function isAdmin(me) {
  const codes = getRoleCodes(me);
  return codes.includes("system_admin") || codes.includes("admin");
}

export function canEditQuestions(me) {
  const codes = getRoleCodes(me);
  return (
    codes.includes("system_admin") ||
    codes.includes("admin") ||
    codes.includes("db_admin") ||
    codes.includes("db_editor")
  );
}