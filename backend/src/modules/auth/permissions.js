export const ROLE_GROUPS = Object.freeze({
  authenticatedRead: Object.freeze(["admin", "hq_user", "operations_staff", "viewer"]),
  operationalManage: Object.freeze(["admin", "hq_user", "operations_staff"]),
  requestRead: Object.freeze(["admin", "hq_user"]),
  requestStatusEdit: Object.freeze(["admin", "hq_user"]),
  requestProcess: Object.freeze(["hq_user"]),
  adminOnly: Object.freeze(["admin"]),
});
