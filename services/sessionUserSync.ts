import { User } from '../types';
import { normalizeUserPermissions } from './permissions';

const permissionsEqual = (left: User, right: User): boolean => {
  const leftPermissions = normalizeUserPermissions(left).permissions;
  const rightPermissions = normalizeUserPermissions(right).permissions;
  if (leftPermissions.length !== rightPermissions.length) return false;
  return leftPermissions.every((permission, index) => permission === rightPermissions[index]);
};

export const isSameUserAccessState = (left: User | null | undefined, right: User | null | undefined): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.id !== right.id) return false;
  if (left.role !== right.role) return false;
  return permissionsEqual(left, right);
};

export const resolveSyncedCurrentUser = (
  currentUser: User | null | undefined,
  fetchedUsers: User[] | null | undefined,
): User | null => {
  if (!currentUser) return null;

  const users = Array.isArray(fetchedUsers) ? fetchedUsers : [];
  const matchedById = users.find((user) => user.id === currentUser.id);
  const matchedByUsername = users.find((user) => user.username === currentUser.username);
  const matchedUser = matchedById || matchedByUsername;

  if (!matchedUser) {
    return currentUser;
  }

  return normalizeUserPermissions(matchedUser);
};
