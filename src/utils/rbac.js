const ACTIONS = ['read', 'create', 'update', 'delete'];

export function mergeRolePermissions(roles = [], assignedRoleNames = []) {
  return roles
    .filter((role) => assignedRoleNames.includes(role.name))
    .reduce((merged, role) => {
      Object.entries(role.permissions || {}).forEach(([area, actions]) => {
        merged[area] = merged[area] || {};
        ACTIONS.forEach((action) => {
          merged[area][action] = !!merged[area][action] || !!actions?.[action];
        });
      });
      return merged;
    }, {});
}

export function hasPermission(user, roles = [], area, action = 'read') {
  if (user?.isAdmin || user?.roles?.includes('Super Admin')) return true;
  const permissions = mergeRolePermissions(roles, user?.roles || []);
  return !!permissions?.[area]?.[action];
}
