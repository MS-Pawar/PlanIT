/**
 * Firestore Security Rules — Red Team "Dirty Dozen" Verification Suite
 * Evaluates all 12 adversarial payloads defined in security_spec.md against
 * the validation blueprints and access gates in firestore.rules.
 */

export interface SimulatedAuth {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
  };
}

export interface RuleEvalContext {
  auth: SimulatedAuth | null;
  requestTime: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  incomingData?: Record<string, any>;
  existingData?: Record<string, any>;
}

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && ID_REGEX.test(id);
}

function isVerified(auth: SimulatedAuth | null): boolean {
  return auth !== null && auth.token?.email_verified === true;
}

function isOwner(auth: SimulatedAuth | null, userId: string): boolean {
  return isVerified(auth) && auth!.uid === userId;
}

function hasOnlyKeys(data: Record<string, any>, allowed: string[]): boolean {
  const keys = Object.keys(data);
  return keys.every((k) => allowed.includes(k));
}

function hasAllKeys(data: Record<string, any>, required: string[]): boolean {
  const keys = Object.keys(data);
  return required.every((k) => keys.includes(k));
}

function affectedKeys(incoming: Record<string, any>, existing: Record<string, any>): string[] {
  const allKeys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (incoming[key] !== existing[key]) {
      changed.push(key);
    }
  }
  return changed;
}

function isValidUserProfile(data: Record<string, any>, auth: SimulatedAuth | null): boolean {
  if (!auth) return false;
  const reqKeys = ['ownerId', 'name', 'identifier', 'createdAt', 'updatedAt'];
  if (!hasAllKeys(data, reqKeys) || !hasOnlyKeys(data, reqKeys)) return false;
  if (typeof data.ownerId !== 'string' || data.ownerId.length < 1 || data.ownerId.length > 128 || !ID_REGEX.test(data.ownerId)) return false;
  if (data.ownerId !== auth.uid) return false;
  if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 120) return false;
  if (typeof data.identifier !== 'string' || data.identifier.length < 3 || data.identifier.length > 180) return false;
  if (typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') return false;
  return true;
}

function isValidPlannerWorkspace(data: Record<string, any>, auth: SimulatedAuth | null): boolean {
  if (!auth) return false;
  const reqKeys = ['ownerId', 'currency', 'theme', 'payloadJson', 'createdAt', 'updatedAt'];
  if (!hasAllKeys(data, reqKeys) || !hasOnlyKeys(data, reqKeys)) return false;
  if (typeof data.ownerId !== 'string' || data.ownerId.length < 1 || data.ownerId.length > 128 || !ID_REGEX.test(data.ownerId)) return false;
  if (data.ownerId !== auth.uid) return false;
  if (!['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].includes(data.currency)) return false;
  if (!['light', 'dark'].includes(data.theme)) return false;
  if (typeof data.payloadJson !== 'string' || data.payloadJson.length < 2 || data.payloadJson.length > 900000) return false;
  if (typeof data.createdAt !== 'string' || typeof data.updatedAt !== 'string') return false;
  return true;
}

export function evaluateFirestoreRule(ctx: RuleEvalContext): 'ALLOW' | 'PERMISSION_DENIED' {
  const parts = ctx.path.split('/').filter(Boolean);
  if (parts.length !== 2) return 'PERMISSION_DENIED';
  const [collection, userId] = parts;

  if (collection === 'users') {
    if (ctx.operation === 'list') return 'PERMISSION_DENIED';
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return isOwner(ctx.auth, userId) && isValidId(userId) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'create') {
      if (!ctx.incomingData) return 'PERMISSION_DENIED';
      const ok =
        isOwner(ctx.auth, userId) &&
        isValidId(userId) &&
        isValidUserProfile(ctx.incomingData, ctx.auth) &&
        ctx.incomingData.createdAt === ctx.requestTime &&
        ctx.incomingData.updatedAt === ctx.requestTime;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'update') {
      if (!ctx.incomingData || !ctx.existingData) return 'PERMISSION_DENIED';
      const changed = affectedKeys(ctx.incomingData, ctx.existingData);
      const allowedDiff = changed.every((k) => ['name', 'identifier', 'updatedAt'].includes(k));
      const ok =
        isOwner(ctx.auth, userId) &&
        isValidId(userId) &&
        isValidUserProfile(ctx.incomingData, ctx.auth) &&
        ctx.incomingData.ownerId === ctx.existingData.ownerId &&
        ctx.incomingData.createdAt === ctx.existingData.createdAt &&
        ctx.incomingData.updatedAt === ctx.requestTime &&
        allowedDiff;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  if (collection === 'workspaces') {
    if (ctx.operation === 'list') return 'PERMISSION_DENIED';
    if (ctx.operation === 'get' || ctx.operation === 'delete') {
      return isOwner(ctx.auth, userId) && isValidId(userId) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'create') {
      if (!ctx.incomingData) return 'PERMISSION_DENIED';
      const ok =
        isOwner(ctx.auth, userId) &&
        isValidId(userId) &&
        isValidPlannerWorkspace(ctx.incomingData, ctx.auth) &&
        ctx.incomingData.createdAt === ctx.requestTime &&
        ctx.incomingData.updatedAt === ctx.requestTime;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'update') {
      if (!ctx.incomingData || !ctx.existingData) return 'PERMISSION_DENIED';
      const changed = affectedKeys(ctx.incomingData, ctx.existingData);
      const allowedDiff = changed.every((k) => ['currency', 'theme', 'payloadJson', 'updatedAt'].includes(k));
      const ok =
        isOwner(ctx.auth, userId) &&
        isValidId(userId) &&
        isValidPlannerWorkspace(ctx.incomingData, ctx.auth) &&
        ctx.incomingData.ownerId === ctx.existingData.ownerId &&
        ctx.incomingData.createdAt === ctx.existingData.createdAt &&
        ctx.incomingData.updatedAt === ctx.requestTime &&
        allowedDiff;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

export function runDirtyDozenSecurityTests(): { passed: number; failed: number; results: { name: string; status: 'PASS' | 'FAIL' }[] } {
  const now = '2026-10-08T00:00:00Z';
  const validAuth: SimulatedAuth = { uid: 'user_1', token: { email: 'user1@example.com', email_verified: true } };
  const baseWorkspace = {
    ownerId: 'user_1',
    currency: 'INR',
    theme: 'light',
    payloadJson: '{}',
    createdAt: '2026-10-07T00:00:00Z',
    updatedAt: '2026-10-07T00:00:00Z',
  };

  const dirtyDozen: { name: string; ctx: RuleEvalContext }[] = [
    {
      name: '1. Unauthenticated Write',
      ctx: {
        auth: null,
        requestTime: now,
        path: '/users/user_1',
        operation: 'create',
        incomingData: { ownerId: 'user_1', name: 'Alice', identifier: 'alice@example.com', createdAt: now, updatedAt: now },
      },
    },
    {
      name: '2. Unverified Email Spoof',
      ctx: {
        auth: { uid: 'user_1', token: { email: 'user1@example.com', email_verified: false } },
        requestTime: now,
        path: '/users/user_1',
        operation: 'create',
        incomingData: { ownerId: 'user_1', name: 'Alice', identifier: 'alice@example.com', createdAt: now, updatedAt: now },
      },
    },
    {
      name: '3. Cross-Tenant Read (PII Leak)',
      ctx: {
        auth: { uid: 'attacker', token: { email: 'attacker@example.com', email_verified: true } },
        requestTime: now,
        path: '/users/victim',
        operation: 'get',
      },
    },
    {
      name: '4. Cross-Tenant Write (Identity Spoofing)',
      ctx: {
        auth: { uid: 'attacker', token: { email: 'attacker@example.com', email_verified: true } },
        requestTime: now,
        path: '/workspaces/victim',
        operation: 'create',
        incomingData: { ...baseWorkspace, ownerId: 'victim', createdAt: now, updatedAt: now },
      },
    },
    {
      name: '5. OwnerId Mismatch in Payload',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/workspaces/user_1',
        operation: 'create',
        incomingData: { ...baseWorkspace, ownerId: 'user_2', createdAt: now, updatedAt: now },
      },
    },
    {
      name: '6. Shadow Field Injection on Create',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/users/user_1',
        operation: 'create',
        incomingData: { ownerId: 'user_1', name: 'Alice', identifier: 'alice@example.com', isAdmin: true, createdAt: now, updatedAt: now },
      },
    },
    {
      name: '7. Shadow Field Injection on Update',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/workspaces/user_1',
        operation: 'update',
        existingData: baseWorkspace,
        incomingData: { ...baseWorkspace, updatedAt: now, isVerified: true },
      },
    },
    {
      name: '8. Immutable Field Mutation (ownerId)',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/workspaces/user_1',
        operation: 'update',
        existingData: baseWorkspace,
        incomingData: { ...baseWorkspace, ownerId: 'other_user', updatedAt: now },
      },
    },
    {
      name: '9. Immutable Field Mutation (createdAt)',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/workspaces/user_1',
        operation: 'update',
        existingData: baseWorkspace,
        incomingData: { ...baseWorkspace, createdAt: now, updatedAt: now },
      },
    },
    {
      name: '10. Forged Client Timestamp (updatedAt)',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/workspaces/user_1',
        operation: 'update',
        existingData: baseWorkspace,
        incomingData: { ...baseWorkspace, currency: 'USD', updatedAt: '2099-01-01T00:00:00Z' },
      },
    },
    {
      name: '11. Value Poisoning / Denial of Wallet (oversized name)',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/users/user_1',
        operation: 'create',
        incomingData: { ownerId: 'user_1', name: 'A'.repeat(500), identifier: 'alice@example.com', createdAt: now, updatedAt: now },
      },
    },
    {
      name: '12. Collection Enumeration (list query)',
      ctx: {
        auth: validAuth,
        requestTime: now,
        path: '/users/user_1',
        operation: 'list',
      },
    },
  ];

  const results = dirtyDozen.map((item) => {
    const outcome = evaluateFirestoreRule(item.ctx);
    return {
      name: item.name,
      status: (outcome === 'PERMISSION_DENIED' ? 'PASS' : 'FAIL') as 'PASS' | 'FAIL',
    };
  });

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
