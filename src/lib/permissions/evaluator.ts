import {
  DataScope,
  RoleKey,
  SessionContext,
  SCOPE_HIERARCHY,
  PORTAL_PERMISSIONS,
} from "./types";
import { DEFAULT_ROLES, ALL_PERMISSIONS } from "./registry";

export interface ResolvedPermissions {
  effectivePermissions: Set<string>;
  widestScope: DataScope;
  isSuperAdmin: boolean;
}

/**
 * Resolves permissions and widest data scope across multiple assigned roles.
 * Satisfies requirements:
 * 1. Super Admin always has full access.
 * 2. Multi-role permission aggregation (union of allowed permissions).
 * 3. Scope widening to the most permissive role boundary.
 */
export function resolveUserPermissions(roleKeys: RoleKey[]): ResolvedPermissions {
  const isSuperAdmin = roleKeys.includes("SUPER_ADMIN");

  if (isSuperAdmin) {
    return {
      effectivePermissions: new Set(ALL_PERMISSIONS),
      widestScope: "ORGANIZATION",
      isSuperAdmin: true,
    };
  }

  const effectivePermissions = new Set<string>();
  let widestScope: DataScope = "SELF";
  let highestScopeWeight = 0;

  for (const key of roleKeys) {
    const role = DEFAULT_ROLES[key];
    if (!role) continue;

    // Union permissions
    for (const perm of role.permissions) {
      effectivePermissions.add(perm);
    }

    // Determine widest data scope
    const weight = SCOPE_HIERARCHY[role.defaultScope] || 0;
    if (weight > highestScopeWeight) {
      highestScopeWeight = weight;
      widestScope = role.defaultScope;
    }
  }

  return {
    effectivePermissions,
    widestScope,
    isSuperAdmin: false,
  };
}

/**
 * Checks if a session context holds a specific permission.
 * Super Admin always returns true.
 */
export function hasPermission(
  context: SessionContext | { isSuperAdmin: boolean; effectivePermissions: string[] },
  permission: string
): boolean {
  if (context.isSuperAdmin) {
    return true;
  }
  return context.effectivePermissions.includes(permission);
}

/**
 * Checks explicit portal access permissions:
 * - Admin Portal: 'portal.admin.access'
 * - Employee Portal: 'portal.employee.access'
 * Super Admin bypasses with true.
 */
export function hasPortalAccess(
  context: SessionContext,
  portal: "admin" | "employee"
): boolean {
  if (context.isSuperAdmin) {
    return true;
  }
  if (portal === "admin") {
    return context.effectivePermissions.includes(PORTAL_PERMISSIONS.ADMIN_ACCESS);
  }
  return context.effectivePermissions.includes(PORTAL_PERMISSIONS.EMPLOYEE_ACCESS);
}

/**
 * Checks whether the caller's data scope satisfies or exceeds the required target scope.
 */
export function canAccessDataScope(
  context: SessionContext,
  targetScope: DataScope
): boolean {
  if (context.isSuperAdmin) return true;
  const userWeight = SCOPE_HIERARCHY[context.widestScope] || 0;
  const targetWeight = SCOPE_HIERARCHY[targetScope] || 0;
  return userWeight >= targetWeight;
}

