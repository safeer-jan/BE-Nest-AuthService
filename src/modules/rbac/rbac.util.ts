import { Role } from './entities/role.entity';

export function flattenRoleNames(roles: Role[]): string[] {
  return roles.map((r) => r.name);
}

/** Union of all permissions across a user's roles, deduplicated. */
export function flattenPermissionNames(roles: Role[]): string[] {
  const names = new Set<string>();
  for (const role of roles) {
    for (const permission of role.permissions ?? []) {
      names.add(permission.name);
    }
  }
  return [...names];
}
