import { describe, expect, it } from 'vitest';
import { User } from '../types';
import {
  ALL_PERMISSION_KEYS,
  getEffectivePermissions,
  getRoleDefaultPermissions,
  hasActionAccess,
  hasPageAccess,
  normalizeUserPermissions,
} from './permissions';

const makeUser = (overrides: Partial<User>): User => ({
  id: overrides.id || 'u1',
  username: overrides.username || 'user1',
  role: overrides.role || 'staff',
  permissions: overrides.permissions || [],
  password: overrides.password,
  createdAt: overrides.createdAt,
});

describe('permissions service', () => {
  it('falls back to role defaults when permissions are missing/empty', () => {
    const user = makeUser({ role: 'staff', permissions: [] });
    const effective = getEffectivePermissions(user);
    const roleDefaults = getRoleDefaultPermissions('staff');

    expect(effective).toEqual(roleDefaults);
    expect(effective).toContain('page:payments');
    expect(effective).toContain('action:tasks.write');
    expect(effective).not.toContain('page:users');
    expect(effective).not.toContain('action:tasks.delete');
  });

  it('always grants full permissions for super_admin', () => {
    const superAdmin = makeUser({ role: 'super_admin', permissions: [] });

    expect(getEffectivePermissions(superAdmin)).toEqual(ALL_PERMISSION_KEYS);
    expect(hasPageAccess(superAdmin, 'users')).toBe(true);
    expect(hasActionAccess(superAdmin, 'permissions.write')).toBe(true);
  });

  it('normalizes legacy "all" permission to full access', () => {
    const user = makeUser({ role: 'viewer', permissions: ['all' as any] });
    const normalized = normalizeUserPermissions(user);

    expect(normalized.permissions).toEqual(ALL_PERMISSION_KEYS);
    expect(hasPageAccess(normalized, 'income')).toBe(true);
    expect(hasActionAccess(normalized, 'users.write')).toBe(true);
  });

  it('drops unknown permission keys and keeps known ones', () => {
    const user = makeUser({
      role: 'viewer',
      permissions: ['action:tasks.write', 'action:unknown', 'page:unknown', 'junk' as any],
    });

    const effective = getEffectivePermissions(user);

    expect(effective).toContain('action:tasks.write');
    expect(effective).not.toContain('action:unknown' as any);
    expect(effective).not.toContain('page:unknown' as any);
  });

  it('falls back to role defaults when all provided keys are invalid', () => {
    const user = makeUser({
      role: 'viewer',
      permissions: ['action:unknown', 'page:unknown', 'junk' as any],
    });

    const effective = getEffectivePermissions(user);

    expect(effective).toEqual(getRoleDefaultPermissions('viewer'));
    expect(hasPageAccess(user, 'dashboard')).toBe(true);
    expect(hasPageAccess(user, 'payments')).toBe(false);
  });

  it('uses permissions as source of truth even when role usually allows more', () => {
    const user = makeUser({
      role: 'admin',
      permissions: ['page:dashboard', 'action:clients.write'],
    });

    expect(hasPageAccess(user, 'dashboard')).toBe(true);
    expect(hasPageAccess(user, 'payments')).toBe(false);
    expect(hasActionAccess(user, 'clients.write')).toBe(true);
    expect(hasActionAccess(user, 'orders.delete')).toBe(false);
  });
});
