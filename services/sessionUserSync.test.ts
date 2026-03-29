import { describe, expect, it } from 'vitest';
import { User } from '../types';
import { isSameUserAccessState, resolveSyncedCurrentUser } from './sessionUserSync';

const makeUser = (overrides: Partial<User>): User => ({
  id: overrides.id || 'u1',
  username: overrides.username || 'user1',
  role: overrides.role || 'staff',
  permissions: overrides.permissions || [],
  password: overrides.password,
  createdAt: overrides.createdAt,
});

describe('sessionUserSync', () => {
  it('compares access state by id, role and normalized permissions', () => {
    const first = makeUser({
      id: 'u1',
      username: 'userA',
      role: 'staff',
      permissions: ['action:tasks.write', 'page:dashboard'],
    });
    const second = makeUser({
      id: 'u1',
      username: 'userB',
      role: 'staff',
      permissions: ['page:dashboard', 'action:tasks.write'],
    });
    const third = makeUser({
      id: 'u1',
      username: 'userA',
      role: 'staff',
      permissions: ['page:dashboard'],
    });

    expect(isSameUserAccessState(first, second)).toBe(true);
    expect(isSameUserAccessState(first, third)).toBe(false);
  });

  it('returns null when there is no current user', () => {
    const synced = resolveSyncedCurrentUser(null, [makeUser({ id: 'u1' })]);
    expect(synced).toBeNull();
  });

  it('syncs user by id even when username changed', () => {
    const currentUser = makeUser({
      id: 'u1',
      username: 'legacy_name',
      role: 'staff',
      permissions: ['page:dashboard'],
    });

    const synced = resolveSyncedCurrentUser(currentUser, [
      makeUser({
        id: 'u1',
        username: 'new_name',
        role: 'staff',
        permissions: ['page:dashboard', 'page:payments'],
      }),
    ]);

    expect(synced?.username).toBe('new_name');
    expect(synced?.permissions).toContain('page:payments');
  });

  it('syncs user by username when id does not match', () => {
    const currentUser = makeUser({
      id: 'local-id',
      username: 'same_user',
      role: 'viewer',
      permissions: ['page:dashboard'],
    });

    const synced = resolveSyncedCurrentUser(currentUser, [
      makeUser({
        id: 'server-id',
        username: 'same_user',
        role: 'staff',
        permissions: ['page:dashboard', 'page:tasks'],
      }),
    ]);

    expect(synced?.id).toBe('server-id');
    expect(synced?.role).toBe('staff');
    expect(synced?.permissions).toContain('page:tasks');
  });

  it('normalizes permissions of matched user', () => {
    const currentUser = makeUser({
      id: 'u1',
      username: 'staff1',
      role: 'staff',
      permissions: [],
    });

    const synced = resolveSyncedCurrentUser(currentUser, [
      makeUser({
        id: 'u1',
        username: 'staff1',
        role: 'viewer',
        permissions: ['all' as any],
      }),
    ]);

    expect(synced?.permissions).toContain('page:income');
    expect(synced?.permissions).toContain('action:permissions.write');
  });

  it('keeps current session user when there is no matching fetched user', () => {
    const currentUser = makeUser({
      id: 'u1',
      username: 'missing_user',
      role: 'staff',
      permissions: ['page:dashboard', 'page:tasks'],
    });

    const synced = resolveSyncedCurrentUser(currentUser, [makeUser({ id: 'u2', username: 'other_user' })]);

    expect(synced).toEqual(currentUser);
  });
});
