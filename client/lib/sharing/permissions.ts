// Permission management system for encrypted family sharing.
// Implements role-based access control with granular permissions and inheritance.

import { SharingPermission, SharingKeyMetadata } from "./key-management";

/**
 * Granular permission actions for family sharing
 */
export enum PermissionAction {
  // Photo permissions
  VIEW_PHOTOS = "view_photos",
  DOWNLOAD_PHOTOS = "download_photos",
  UPLOAD_PHOTOS = "upload_photos",
  EDIT_PHOTOS = "edit_photos",
  DELETE_PHOTOS = "delete_photos",

  // Album permissions
  VIEW_ALBUMS = "view_albums",
  CREATE_ALBUMS = "create_albums",
  EDIT_ALBUMS = "edit_albums",
  DELETE_ALBUMS = "delete_albums",
  SHARE_ALBUMS = "share_albums",

  // Member permissions
  INVITE_MEMBERS = "invite_members",
  REMOVE_MEMBERS = "remove_members",
  EDIT_PERMISSIONS = "edit_permissions",

  // Library permissions
  VIEW_LIBRARY = "view_library",
  EDIT_LIBRARY_INFO = "edit_library_info",
  MANAGE_AUTO_SHARE = "manage_auto_share",
  EXPORT_LIBRARY = "export_library",

  // Admin permissions
  VIEW_ACTIVITY = "view_activity",
  MANAGE_SETTINGS = "manage_settings",
  ROTATE_KEYS = "rotate_keys",
  DELETE_LIBRARY = "delete_library",
}

/**
 * Permission scope for context-aware access control
 */
export enum PermissionScope {
  SELF_ONLY = "self_only", // Only user's own content
  FAMILY_SHARED = "family_shared", // Family shared content
  ALL_ACCESS = "all_access", // All library content
}

/**
 * Role-based permission set
 */
export interface RolePermissions {
  role: string;
  name: string;
  description: string;
  permissions: Set<PermissionAction>;
  scope: PermissionScope;
  priority: number; // Higher = more privileged
}

/**
 * Permission context for access evaluation
 */
export interface PermissionContext {
  userId: string;
  keyId: string;
  action: PermissionAction;
  targetUserId?: string; // For actions affecting other users
  resourceId?: string; // For actions affecting specific resources
  metadata?: Record<string, any>;
}

/**
 * Permission evaluation result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: string;
  scope?: PermissionScope;
  conditions?: string[];
}

/**
 * Permission inheritance rule
 */
export interface InheritanceRule {
  fromRole: string;
  toRole: string;
  permissions: PermissionAction[];
  conditions?: (context: PermissionContext) => boolean;
}

/**
 * Permission condition evaluator
 */
export interface PermissionCondition {
  id: string;
  name: string;
  description: string;
  evaluator: (context: PermissionContext) => boolean;
}

/**
 * Family sharing permission manager
 */
export class PermissionManager {
  private roles = new Map<string, RolePermissions>();
  private inheritanceRules: InheritanceRule[] = [];
  private conditions = new Map<string, PermissionCondition>();

  constructor() {
    this.initializeDefaultRoles();
    this.initializeDefaultConditions();
  }

  /**
   * Evaluate if a user has permission for an action
   */
  async evaluatePermission(
    context: PermissionContext,
  ): Promise<PermissionResult> {
    const { userId, keyId, action, targetUserId } = context;

    // Load user's role for this sharing key
    const userRole = await this.getUserRole(keyId, userId);
    if (!userRole) {
      return { allowed: false, reason: "User not found in sharing key" };
    }

    // Get role permissions
    const rolePermissions = this.roles.get(userRole);
    if (!rolePermissions) {
      return { allowed: false, reason: "Role not defined" };
    }

    // Check direct permission
    if (rolePermissions.permissions.has(action)) {
      // Apply permission conditions
      const conditions = this.getApplicableConditions(action);
      for (const condition of conditions) {
        if (!condition.evaluator(context)) {
          return {
            allowed: false,
            reason: `Condition failed: ${condition.name}`,
            scope: rolePermissions.scope,
          };
        }
      }

      // Check scope restrictions
      if (!this.checkScopePermission(rolePermissions.scope, context)) {
        return {
          allowed: false,
          reason: `Scope restriction: ${rolePermissions.scope}`,
          scope: rolePermissions.scope,
        };
      }

      return {
        allowed: true,
        scope: rolePermissions.scope,
        conditions: conditions.map((c) => c.name),
      };
    }

    // Check inherited permissions
    for (const rule of this.inheritanceRules) {
      if (rule.toRole === userRole && rule.permissions.includes(action)) {
        // Verify inheritance conditions
        if (!rule.conditions || rule.conditions(context)) {
          const fromRolePermissions = this.roles.get(rule.fromRole);
          if (
            fromRolePermissions &&
            this.checkScopePermission(fromRolePermissions.scope, context)
          ) {
            return {
              allowed: true,
              requiredRole: rule.fromRole,
              scope: fromRolePermissions.scope,
            };
          }
        }
      }
    }

    return {
      allowed: false,
      reason: "Permission not found in role or inheritance",
      requiredRole: userRole,
    };
  }

  /**
   * Get user's permissions for a sharing key
   */
  async getUserPermissions(
    keyId: string,
    userId: string,
  ): Promise<{
    role: string;
    permissions: Set<PermissionAction>;
    scope: PermissionScope;
  } | null> {
    const userRole = await this.getUserRole(keyId, userId);
    if (!userRole) {
      return null;
    }

    const rolePermissions = this.roles.get(userRole);
    if (!rolePermissions) {
      return null;
    }

    // Combine direct and inherited permissions
    const allPermissions = new Set(rolePermissions.permissions);

    for (const rule of this.inheritanceRules) {
      if (rule.toRole === userRole) {
        const fromRolePermissions = this.roles.get(rule.fromRole);
        if (fromRolePermissions) {
          rule.permissions.forEach((perm) => allPermissions.add(perm));
        }
      }
    }

    return {
      role: userRole,
      permissions: allPermissions,
      scope: rolePermissions.scope,
    };
  }

  /**
   * Update user's role for a sharing key
   */
  async updateUserRole(
    keyId: string,
    userId: string,
    newRole: string,
    updatedBy: string,
  ): Promise<boolean> {
    // Verify updater has admin permissions
    const updaterContext: PermissionContext = {
      userId: updatedBy,
      keyId,
      action: PermissionAction.EDIT_PERMISSIONS,
      targetUserId: userId,
    };

    const updaterResult = await this.evaluatePermission(updaterContext);
    if (!updaterResult.allowed) {
      throw new Error(
        `Insufficient permissions to update user role: ${updaterResult.reason}`,
      );
    }

    // Validate target role exists
    if (!this.roles.has(newRole)) {
      throw new Error(`Target role '${newRole}' not defined`);
    }

    // Update user role in storage
    await this.persistUserRole(keyId, userId, newRole);
    return true;
  }

  /**
   * Create custom role with specific permissions
   */
  async createCustomRole(
    name: string,
    displayName: string,
    description: string,
    permissions: PermissionAction[],
    scope: PermissionScope = PermissionScope.FAMILY_SHARED,
    priority: number = 50,
  ): Promise<RolePermissions> {
    const role: RolePermissions = {
      role: name,
      name: displayName,
      description,
      permissions: new Set(permissions),
      scope,
      priority,
    };

    this.roles.set(name, role);
    return role;
  }

  /**
   * Add permission inheritance rule
   */
  addInheritanceRule(rule: InheritanceRule): void {
    this.inheritanceRules.push(rule);
  }

  /**
   * Add permission condition
   */
  addCondition(condition: PermissionCondition): void {
    this.conditions.set(condition.id, condition);
  }

  /**
   * Get all available roles
   */
  getAvailableRoles(): RolePermissions[] {
    return Array.from(this.roles.values()).sort(
      (a, b) => b.priority - a.priority,
    );
  }

  /**
   * Get role hierarchy for UI display
   */
  getRoleHierarchy(): {
    role: string;
    name: string;
    inheritsFrom: string[];
    permissions: PermissionAction[];
  }[] {
    const hierarchy: {
      role: string;
      name: string;
      inheritsFrom: string[];
      permissions: PermissionAction[];
    }[] = [];

    for (const roleName of Array.from(this.roles.keys())) {
      const role = this.roles.get(roleName);
      if (!role) continue;

      const inheritsFrom = this.inheritanceRules
        .filter((rule) => rule.toRole === roleName)
        .map((rule) => rule.fromRole);

      hierarchy.push({
        role: roleName,
        name: role.name,
        inheritsFrom,
        permissions: Array.from(role.permissions),
      });
    }

    return hierarchy;
  }

  // Private helper methods

  private initializeDefaultRoles(): void {
    // Owner role - full control
    this.roles.set("owner", {
      role: "owner",
      name: "Library Owner",
      description: "Full control over the family library",
      permissions: new Set(Object.values(PermissionAction)),
      scope: PermissionScope.ALL_ACCESS,
      priority: 100,
    });

    // Admin role - almost full control, can't delete library
    this.roles.set("admin", {
      role: "admin",
      name: "Administrator",
      description: "Can manage most aspects of the library",
      permissions: new Set([
        PermissionAction.VIEW_PHOTOS,
        PermissionAction.DOWNLOAD_PHOTOS,
        PermissionAction.UPLOAD_PHOTOS,
        PermissionAction.EDIT_PHOTOS,
        PermissionAction.VIEW_ALBUMS,
        PermissionAction.CREATE_ALBUMS,
        PermissionAction.EDIT_ALBUMS,
        PermissionAction.SHARE_ALBUMS,
        PermissionAction.INVITE_MEMBERS,
        PermissionAction.REMOVE_MEMBERS,
        PermissionAction.EDIT_PERMISSIONS,
        PermissionAction.VIEW_LIBRARY,
        PermissionAction.EDIT_LIBRARY_INFO,
        PermissionAction.MANAGE_AUTO_SHARE,
        PermissionAction.VIEW_ACTIVITY,
        PermissionAction.MANAGE_SETTINGS,
        PermissionAction.ROTATE_KEYS,
      ]),
      scope: PermissionScope.ALL_ACCESS,
      priority: 90,
    });

    // Contributor role - can add and edit content
    this.roles.set("contributor", {
      role: "contributor",
      name: "Contributor",
      description: "Can add and edit photos and albums",
      permissions: new Set([
        PermissionAction.VIEW_PHOTOS,
        PermissionAction.DOWNLOAD_PHOTOS,
        PermissionAction.UPLOAD_PHOTOS,
        PermissionAction.EDIT_PHOTOS,
        PermissionAction.VIEW_ALBUMS,
        PermissionAction.CREATE_ALBUMS,
        PermissionAction.EDIT_ALBUMS,
        PermissionAction.VIEW_LIBRARY,
        PermissionAction.EDIT_LIBRARY_INFO,
      ]),
      scope: PermissionScope.FAMILY_SHARED,
      priority: 60,
    });

    // Viewer role - read-only access
    this.roles.set("viewer", {
      role: "viewer",
      name: "Viewer",
      description: "Can view photos and albums",
      permissions: new Set([
        PermissionAction.VIEW_PHOTOS,
        PermissionAction.VIEW_ALBUMS,
        PermissionAction.VIEW_LIBRARY,
      ]),
      scope: PermissionScope.FAMILY_SHARED,
      priority: 30,
    });

    // Child role - restricted access
    this.roles.set("child", {
      role: "child",
      name: "Child Account",
      description: "Restricted access for family children",
      permissions: new Set([
        PermissionAction.VIEW_PHOTOS,
        PermissionAction.VIEW_ALBUMS,
        PermissionAction.VIEW_LIBRARY,
        PermissionAction.DOWNLOAD_PHOTOS,
      ]),
      scope: PermissionScope.FAMILY_SHARED,
      priority: 20,
    });

    // Set up inheritance rules
    this.inheritanceRules = [
      {
        fromRole: "viewer",
        toRole: "contributor",
        permissions: [
          PermissionAction.DOWNLOAD_PHOTOS,
          PermissionAction.UPLOAD_PHOTOS,
          PermissionAction.EDIT_PHOTOS,
          PermissionAction.CREATE_ALBUMS,
          PermissionAction.EDIT_ALBUMS,
          PermissionAction.EDIT_LIBRARY_INFO,
        ],
      },
      {
        fromRole: "contributor",
        toRole: "admin",
        permissions: [
          PermissionAction.SHARE_ALBUMS,
          PermissionAction.INVITE_MEMBERS,
          PermissionAction.REMOVE_MEMBERS,
          PermissionAction.EDIT_PERMISSIONS,
          PermissionAction.MANAGE_AUTO_SHARE,
          PermissionAction.VIEW_ACTIVITY,
          PermissionAction.MANAGE_SETTINGS,
          PermissionAction.ROTATE_KEYS,
        ],
      },
      {
        fromRole: "admin",
        toRole: "owner",
        permissions: [
          PermissionAction.DELETE_PHOTOS,
          PermissionAction.DELETE_ALBUMS,
          PermissionAction.DELETE_LIBRARY,
          PermissionAction.EXPORT_LIBRARY,
        ],
      },
    ];
  }

  private initializeDefaultConditions(): void {
    // Time-based condition
    this.conditions.set("business_hours", {
      id: "business_hours",
      name: "Business Hours Only",
      description: "Allow access only during business hours (9 AM - 5 PM)",
      evaluator: (context) => {
        const hour = new Date().getHours();
        return hour >= 9 && hour <= 17;
      },
    });

    // Self-only condition
    this.conditions.set("self_only", {
      id: "self_only",
      name: "Self Only",
      description: "Allow actions only on user's own content",
      evaluator: (context) => {
        return !context.targetUserId || context.targetUserId === context.userId;
      },
    });

    // Age restriction condition
    this.conditions.set("age_restriction", {
      id: "age_restriction",
      name: "Age Restriction",
      description: "Restrict sensitive content for minors",
      evaluator: (context) => {
        // This would check user age from profile
        // For now, return true as placeholder
        return true;
      },
    });

    // Device trust condition
    this.conditions.set("trusted_device", {
      id: "trusted_device",
      name: "Trusted Device Only",
      description: "Allow access only from trusted devices",
      evaluator: (context) => {
        // This would check if device is trusted
        // For now, return true as placeholder
        return true;
      },
    });
  }

  private async getUserRole(
    keyId: string,
    userId: string,
  ): Promise<string | null> {
    // This would load user's role from secure storage
    // For now, return a default role based on userId
    if (userId.endsWith("_owner")) {
      return "owner";
    } else if (userId.endsWith("_admin")) {
      return "admin";
    } else if (userId.endsWith("_contributor")) {
      return "contributor";
    } else if (userId.endsWith("_child")) {
      return "child";
    }
    return "viewer";
  }

  private async persistUserRole(
    keyId: string,
    userId: string,
    role: string,
  ): Promise<void> {
    // This would save the user role to secure storage
    // Implementation depends on secure storage API
    console.log(`Persisting role ${role} for user ${userId} in key ${keyId}`);
  }

  private getApplicableConditions(
    action: PermissionAction,
  ): PermissionCondition[] {
    return Array.from(this.conditions.values()).filter((condition) => {
      // Define which conditions apply to which actions
      const actionConditions: Record<PermissionAction, string[]> = {
        [PermissionAction.DELETE_PHOTOS]: ["self_only"],
        [PermissionAction.DELETE_ALBUMS]: ["self_only"],
        [PermissionAction.REMOVE_MEMBERS]: ["self_only"],
        [PermissionAction.EDIT_PERMISSIONS]: ["trusted_device"],
        [PermissionAction.ROTATE_KEYS]: ["trusted_device"],
        [PermissionAction.DELETE_LIBRARY]: ["trusted_device"],
        [PermissionAction.EXPORT_LIBRARY]: ["trusted_device"],
        // Add more mappings as needed
        [PermissionAction.VIEW_PHOTOS]: [],
        [PermissionAction.DOWNLOAD_PHOTOS]: [],
        [PermissionAction.UPLOAD_PHOTOS]: [],
        [PermissionAction.EDIT_PHOTOS]: [],
        [PermissionAction.VIEW_ALBUMS]: [],
        [PermissionAction.CREATE_ALBUMS]: [],
        [PermissionAction.EDIT_ALBUMS]: [],
        [PermissionAction.SHARE_ALBUMS]: [],
        [PermissionAction.INVITE_MEMBERS]: [],
        [PermissionAction.VIEW_LIBRARY]: [],
        [PermissionAction.EDIT_LIBRARY_INFO]: [],
        [PermissionAction.MANAGE_AUTO_SHARE]: [],
        [PermissionAction.VIEW_ACTIVITY]: [],
        [PermissionAction.MANAGE_SETTINGS]: [],
      };

      return actionConditions[action]?.includes(condition.id) || false;
    });
  }

  private checkScopePermission(
    scope: PermissionScope,
    context: PermissionContext,
  ): boolean {
    switch (scope) {
      case PermissionScope.SELF_ONLY:
        return !context.targetUserId || context.targetUserId === context.userId;

      case PermissionScope.FAMILY_SHARED:
        // This would check if the resource is family-shared
        // For now, return true
        return true;

      case PermissionScope.ALL_ACCESS:
        return true;

      default:
        return false;
    }
  }
}

// Global permission manager instance
export const permissionManager = new PermissionManager();

// Convenience functions

/**
 * Check if user has permission for action
 */
export async function hasPermission(
  keyId: string,
  userId: string,
  action: PermissionAction,
  targetUserId?: string,
  resourceId?: string,
): Promise<boolean> {
  const result = await permissionManager.evaluatePermission({
    userId,
    keyId,
    action,
    targetUserId,
    resourceId,
  });
  return result.allowed;
}

/**
 * Get user's role and permissions
 */
export async function getUserPermissions(
  keyId: string,
  userId: string,
): Promise<{
  role: string;
  permissions: Set<PermissionAction>;
  scope: PermissionScope;
} | null> {
  return await permissionManager.getUserPermissions(keyId, userId);
}

/**
 * Update user's role (requires admin permissions)
 */
export async function updateUserRole(
  keyId: string,
  userId: string,
  newRole: string,
  updatedBy: string,
): Promise<boolean> {
  return await permissionManager.updateUserRole(
    keyId,
    userId,
    newRole,
    updatedBy,
  );
}

/**
 * Get available roles for selection
 */
export function getAvailableRoles(): RolePermissions[] {
  return permissionManager.getAvailableRoles();
}

/**
 * Get permission hierarchy for display
 */
export function getPermissionHierarchy(): {
  role: string;
  name: string;
  inheritsFrom: string[];
  permissions: PermissionAction[];
}[] {
  return permissionManager.getRoleHierarchy();
}
