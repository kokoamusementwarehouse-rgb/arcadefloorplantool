export type UserRole = "ADMIN" | "EDITOR" | "VIEWER";
export type Permission = "manageUsers" | "editVenues" | "editCatalog" | "editLayouts" | "transfer" | "export";
const permissions: Record<UserRole, ReadonlySet<Permission>> = {
  ADMIN: new Set(["manageUsers", "editVenues", "editCatalog", "editLayouts", "transfer", "export"]),
  EDITOR: new Set(["editVenues", "editCatalog", "editLayouts", "transfer", "export"]),
  VIEWER: new Set(["export"]),
};
export const can = (role: UserRole, permission: Permission) => permissions[role].has(permission);
export const roleLabel = (role: UserRole) => role[0] + role.slice(1).toLocaleLowerCase();
