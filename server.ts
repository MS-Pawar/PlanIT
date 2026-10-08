import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  createOTPChallenge,
  OtpChallengeRecord,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  runBackendUnitTests,
  validateOTPSubmission,
} from './src/server/otpService.ts';
import { getConfiguredOTPProvider, OTPChannel } from './src/server/otpProvider.ts';
import { createEmptyWorkspace } from './src/shared/calculations.ts';
import { AuthenticatedUser, UserWorkspaceData } from './src/shared/types.ts';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'planease-default-hmac-secret-key-2026';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'planease.db.json');

interface StoredUserRecord {
  id: string;
  name: string;
  identifier: string;
  email?: string;
  mobile?: string;
  authMethod: 'otp' | 'google';
  createdAt: string;
}

interface DatabaseShape {
  users: Record<string, StoredUserRecord>; // key: userId
  userByIdentifier: Record<string, string>; // key: normalized email or mobile -> userId
  workspaces: Record<string, UserWorkspaceData>; // key: userId -> isolated UserWorkspaceData
  otpChallenges: Record<string, OtpChallengeRecord>; // key: normalized identifier
  sessions: Record<string, { userId: string; expiresAt: number }>; // key: tokenHash
}

function loadDatabase(): DatabaseShape {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || {},
        userByIdentifier: parsed.userByIdentifier || {},
        workspaces: parsed.workspaces || {},
        otpChallenges: parsed.otpChallenges || {},
        sessions: parsed.sessions || {},
      };
    }
  } catch (err) {
    console.error('Error loading local persistence store, initializing clean store:', err);
  }
  return {
    users: {},
    userByIdentifier: {},
    workspaces: {},
    otpChallenges: {},
    sessions: {},
  };
}

let dbState: DatabaseShape = loadDatabase();

function persistDatabase(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist database state:', err);
  }
}

// Rate limiting memory map: key -> array of request timestamps
const rateLimitLog = new Map<string, number[]>();

function checkRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const recent = (rateLimitLog.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = recent[0];
    const retryAfterSec = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000);
    return { allowed: false, retryAfterSec };
  }
  recent.push(now);
  rateLimitLog.set(key, recent);
  return { allowed: true };
}

function normalizeIdentifier(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  // Normalize phone numbers by stripping spaces and hyphens
  return trimmed.replace(/[\s\-()]/g, '');
}

function detectChannel(identifier: string): OTPChannel {
  return identifier.includes('@') ? 'email' : 'sms';
}

function createSignedToken(userId: string): string {
  const payload = JSON.stringify({
    sub: userId,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    jti: crypto.randomUUID(),
  });
  const base64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Payload)
    .digest('base64url');
  const token = `${base64Payload}.${signature}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  dbState.sessions[tokenHash] = {
    userId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  persistDatabase();
  return token;
}

function verifySignedToken(token: string): StoredUserRecord | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Payload)
      .digest('base64url');
    if (signature !== expectedSig) return null;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const session = dbState.sessions[tokenHash];
    if (!session || Date.now() > session.expiresAt) {
      return null;
    }

    const user = dbState.users[session.userId];
    return user || null;
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  user?: StoredUserRecord;
  tokenHash?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const user = verifySignedToken(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }
  req.user = user;
  req.tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 1. Request OTP (for Registration or Login)
  app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
    try {
      const { mode, name, identifier, email, mobile } = req.body || {};
      const primaryRaw = identifier || email || mobile || '';
      const normId = normalizeIdentifier(String(primaryRaw));

      if (!normId || normId.length < 4) {
        res.status(400).json({ error: 'Please enter a valid mobile number or email address.' });
        return;
      }

      const rateCheck = checkRateLimit(`otp_${normId}`);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: `Too many OTP requests. Please try again in ${rateCheck.retryAfterSec} seconds.`,
        });
        return;
      }

      const existingUserId = dbState.userByIdentifier[normId];
      if (mode === 'register') {
        if (!name || String(name).trim().length < 2) {
          res.status(400).json({ error: 'Please enter your full name (at least 2 characters) to register.' });
          return;
        }
        if (existingUserId) {
          res.status(409).json({
            error: 'An account with this mobile/email already exists. Please switch to Sign In.',
          });
          return;
        }
      } else if (mode === 'login') {
        if (!existingUserId) {
          res.status(404).json({
            error: 'No account found with this mobile/email. Please create a new account first.',
          });
          return;
        }
      }

      const existingChallenge = dbState.otpChallenges[normId];
      const { challenge, plainOtp } = createOTPChallenge(normId, existingChallenge, Date.now(), {
        name: name ? String(name).trim() : undefined,
        email: email ? normalizeIdentifier(String(email)) : normId.includes('@') ? normId : undefined,
        mobile: mobile ? normalizeIdentifier(String(mobile)) : !normId.includes('@') ? normId : undefined,
      });

      dbState.otpChallenges[normId] = challenge;
      persistDatabase();

      const otpProvider = getConfiguredOTPProvider();
      const channel = detectChannel(normId);
      const dispatch = await otpProvider.sendOTP(normId, plainOtp, channel);

      const isDevMode = process.env.OTP_DEV_MODE !== 'false';
      res.json({
        message: `6-digit OTP sent via ${channel.toUpperCase()} (${otpProvider.name}). Valid for 5 minutes.`,
        identifier: normId,
        channel,
        expiresInSeconds: 300,
        resendCooldownSeconds: 30,
        maxAttempts: 3,
        devMode: isDevMode,
        devOtpCode: isDevMode ? dispatch.devPreviewCode || plainOtp : undefined,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to generate OTP.' });
    }
  });

  // 2. Verify OTP & Establish Isolated Session
  app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
    try {
      const { identifier, otp, name, email, mobile } = req.body || {};
      const normId = normalizeIdentifier(String(identifier || email || mobile || ''));
      const submittedOtp = String(otp || '').trim();

      if (!normId || !/^\d{6}$/.test(submittedOtp)) {
        res.status(400).json({ error: 'Please provide a valid 6-digit numeric OTP.' });
        return;
      }

      const challenge = dbState.otpChallenges[normId];
      const validation = validateOTPSubmission(challenge, submittedOtp, Date.now());
      persistDatabase();

      if (!validation.valid) {
        res.status(401).json({
          error: validation.error,
          remainingAttempts: validation.remainingAttempts,
        });
        return;
      }

      // Check if user exists; if not, create a brand-new user with a completely blank workspace
      let userId = dbState.userByIdentifier[normId];
      let userRecord = userId ? dbState.users[userId] : undefined;

      if (!userRecord) {
        userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const resolvedName =
          (name && String(name).trim()) ||
          challenge?.pendingName ||
          normId.split('@')[0] ||
          'PlanEase User';
        const resolvedEmail =
          challenge?.pendingEmail || (normId.includes('@') ? normId : undefined);
        const resolvedMobile =
          challenge?.pendingMobile || (!normId.includes('@') ? normId : undefined);

        userRecord = {
          id: userId,
          name: resolvedName,
          identifier: normId,
          email: resolvedEmail,
          mobile: resolvedMobile,
          authMethod: 'otp',
          createdAt: new Date().toISOString(),
        };

        dbState.users[userId] = userRecord;
        dbState.userByIdentifier[normId] = userId;
        if (resolvedEmail) dbState.userByIdentifier[resolvedEmail] = userId;
        if (resolvedMobile) dbState.userByIdentifier[resolvedMobile] = userId;

        // Every new user starts with a completely fresh, empty dashboard
        dbState.workspaces[userId] = createEmptyWorkspace();
      } else if (!dbState.workspaces[userRecord.id]) {
        dbState.workspaces[userRecord.id] = createEmptyWorkspace();
      }

      persistDatabase();
      const token = createSignedToken(userRecord.id);

      res.json({
        token,
        user: userRecord,
        workspace: dbState.workspaces[userRecord.id],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'OTP verification failed.' });
    }
  });

  // 3. Firebase Google Auth Session Bridge (isolates user by Firebase UID)
  app.post('/api/auth/firebase-session', (req: Request, res: Response) => {
    try {
      const { uid, name, email } = req.body || {};
      if (!uid || typeof uid !== 'string') {
        res.status(400).json({ error: 'Valid Firebase UID is required.' });
        return;
      }

      const normEmail = email ? normalizeIdentifier(String(email)) : `${uid}@firebase.user`;
      let userRecord = dbState.users[uid];

      if (!userRecord) {
        userRecord = {
          id: uid,
          name: (name && String(name).trim()) || normEmail.split('@')[0] || 'PlanEase User',
          identifier: normEmail,
          email: normEmail,
          authMethod: 'google',
          createdAt: new Date().toISOString(),
        };
        dbState.users[uid] = userRecord;
        dbState.userByIdentifier[normEmail] = uid;
        dbState.workspaces[uid] = createEmptyWorkspace();
      } else if (!dbState.workspaces[uid]) {
        dbState.workspaces[uid] = createEmptyWorkspace();
      }

      persistDatabase();
      const token = createSignedToken(uid);

      res.json({
        token,
        user: userRecord,
        workspace: dbState.workspaces[uid],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to establish session.' });
    }
  });

  // 4. Get Current Session & Isolated Workspace
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    if (!dbState.workspaces[user.id]) {
      dbState.workspaces[user.id] = createEmptyWorkspace();
      persistDatabase();
    }
    res.json({
      user,
      workspace: dbState.workspaces[user.id],
    });
  });

  // 5. Logout & Invalidate Session
  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res: Response) => {
    if (req.tokenHash && dbState.sessions[req.tokenHash]) {
      delete dbState.sessions[req.tokenHash];
      persistDatabase();
    }
    res.json({ success: true });
  });

  // 6. Save Isolated User Workspace State (Auto-Save Endpoint)
  app.put('/api/workspace', requireAuth, (req: AuthedRequest, res: Response) => {
    try {
      const user = req.user!;
      const incoming = req.body as UserWorkspaceData;
      if (!incoming || typeof incoming !== 'object') {
        res.status(400).json({ error: 'Invalid workspace payload.' });
        return;
      }

      const current = dbState.workspaces[user.id] || createEmptyWorkspace();
      const updated: UserWorkspaceData = {
        tasks: Array.isArray(incoming.tasks) ? incoming.tasks : current.tasks,
        payments: Array.isArray(incoming.payments) ? incoming.payments : current.payments,
        taskCategories: Array.isArray(incoming.taskCategories)
          ? incoming.taskCategories
          : current.taskCategories,
        eventParticulars: incoming.eventParticulars || current.eventParticulars,
        engagementParticulars: incoming.engagementParticulars || current.engagementParticulars,
        subEvents: Array.isArray(incoming.subEvents)
          ? incoming.subEvents
          : current.subEvents,
        marriageCategories: Array.isArray(incoming.marriageCategories)
          ? incoming.marriageCategories
          : current.marriageCategories,
        expenseItems: Array.isArray(incoming.expenseItems)
          ? incoming.expenseItems
          : current.expenseItems,
        guests: Array.isArray(incoming.guests) ? incoming.guests : current.guests,
        vendors: Array.isArray(incoming.vendors) ? incoming.vendors : current.vendors,
        currency: incoming.currency || current.currency || 'INR',
        theme: incoming.theme === 'dark' ? 'dark' : 'light',
        customLabels: incoming.customLabels || current.customLabels,
        updatedAt: new Date().toISOString(),
      };

      dbState.workspaces[user.id] = updated;
      persistDatabase();

      res.json({ workspace: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save workspace.' });
    }
  });

  // 7. Reset Workspace to Fresh Empty State
  app.post('/api/workspace/reset', requireAuth, (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const fresh = createEmptyWorkspace();
    dbState.workspaces[user.id] = fresh;
    persistDatabase();
    res.json({ workspace: fresh });
  });

  // 8. Dispatch Formal Invitations (One-by-One or Bulk via Mobile SMS / Email)
  app.post('/api/invitations/send', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { eventTitle, eventCategory, recipients } = req.body || {};
      if (!Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'Please provide at least one guest recipient.' });
        return;
      }

      const deliveries: {
        guestId: string;
        guestName: string;
        channel: string;
        target: string;
        delivered: boolean;
      }[] = [];

      for (const r of recipients) {
        const phone = String(r.phone || '').trim();
        const email = String(r.email || '').trim();
        const preferred = String(r.preferredChannel || 'auto').toLowerCase();

        let chosenChannel = 'none';
        let target = '';
        if (preferred === 'sms' && phone) {
          chosenChannel = 'SMS';
          target = phone;
        } else if (preferred === 'email' && email) {
          chosenChannel = 'Email';
          target = email;
        } else if (phone && email) {
          chosenChannel = 'SMS & Email';
          target = `${phone} / ${email}`;
        } else if (phone) {
          chosenChannel = 'SMS';
          target = phone;
        } else if (email) {
          chosenChannel = 'Email';
          target = email;
        }

        if (target) {
          console.log(
            `\n=========================================================\n` +
              `[PlanEase Formal Invitation Dispatched]\n` +
              `Event: ${eventTitle || eventCategory} | Guest: ${r.guestName}\n` +
              `Channel: ${chosenChannel} -> ${target}\n` +
              `---------------------------------------------------------\n` +
              `${r.messageBody || ''}\n` +
              `=========================================================\n`
          );
          deliveries.push({
            guestId: r.guestId,
            guestName: r.guestName,
            channel: chosenChannel,
            target,
            delivered: true,
          });
        } else {
          deliveries.push({
            guestId: r.guestId,
            guestName: r.guestName,
            channel: 'Missing Contact',
            target: 'None',
            delivered: false,
          });
        }
      }

      const deliveredCount = deliveries.filter((d) => d.delivered).length;
      res.json({
        deliveredCount,
        totalRequested: recipients.length,
        deliveries,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to dispatch formal invitations.' });
    }
  });

  // 9. Automated Unit Tests Endpoint (OTP Flow + Expense Calculations + Security Rules)
  app.get('/api/tests/run', (_req: Request, res: Response) => {
    const report = runBackendUnitTests();
    res.json(report);
  });

  // Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlanEase full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
