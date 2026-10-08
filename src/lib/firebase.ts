import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserWorkspaceData } from '../shared/types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Workspace OAuth Scopes (Least Privilege: Gmail Send for Formal Invitations)
export const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

export const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the OAuth access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

/**
 * Initialize auth state listener and manage in-memory OAuth access token.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign-In popup requesting the configured Gmail scope and caching the OAuth access token in memory.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

/**
 * Encodes a UTF-8 string into standard Base64.
 */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Encodes a UTF-8 string into Base64URL format required by the Gmail API `raw` field.
 */
function utf8ToBase64Url(str: string): string {
  return utf8ToBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Wraps a base64 string at 76 characters per line per RFC 2045 MIME specification.
 */
function wrapBase64Lines(b64: string): string {
  const clean = b64.replace(/^data:image\/png;base64,/, '').replace(/\s+/g, '');
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 76) {
    chunks.push(clean.slice(i, i + 76));
  }
  return chunks.join('\r\n');
}

export interface SendGmailInvitationParams {
  accessToken: string;
  toEmail: string;
  guestName?: string;
  subject: string;
  textBody: string;
  pngBase64: string;
  pngFilename: string;
}

/**
 * Sends a formal invitation email with the generated PNG invitation card attached via the Gmail REST API.
 */
export async function sendGmailInvitationWithPng(
  params: SendGmailInvitationParams
): Promise<{ id: string; threadId: string }> {
  const { accessToken, toEmail, guestName, subject, textBody, pngBase64, pngFilename } = params;
  const boundary = `planease_inv_${Date.now().toString(36)}`;
  const encodedSubject = `=?UTF-8?B?${utf8ToBase64(subject)}?=`;
  const cleanRecipient = guestName
    ? `"${guestName.replace(/"/g, '')}" <${toEmail.trim()}>`
    : toEmail.trim();

  const htmlBody = `
    <div style="font-family: Georgia, serif; color: #1f1714; line-height: 1.6; max-width: 600px;">
      <p style="white-space: pre-line; font-size: 15px;">${textBody
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</p>
      <hr style="border: none; border-top: 1px solid #d6d3d1; margin: 20px 0;" />
      <p style="font-size: 12px; color: #78716c;">
        Please find your personalized Formal Invitation Card attached as a PNG image (<strong>${pngFilename}</strong>).
      </p>
    </div>
  `.trim();

  const altBoundary = `planease_alt_${Date.now().toString(36)}`;

  const mimeLines = [
    `To: ${cleanRecipient}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64Lines(utf8ToBase64(textBody)),
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64Lines(utf8ToBase64(htmlBody)),
    '',
    `--${altBoundary}--`,
    '',
    `--${boundary}`,
    `Content-Type: image/png; name="${pngFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${pngFilename}"`,
    '',
    wrapBase64Lines(pngBase64),
    '',
    `--${boundary}--`,
  ];

  const rawMessage = mimeLines.join('\r\n');
  const rawBase64Url = utf8ToBase64Url(rawMessage);

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawBase64Url }),
    }
  );

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    const errMsg =
      errJson?.error?.message || `Gmail API error (${response.status}): Failed to send email`;
    throw new Error(errMsg);
  }

  return response.json();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot as required
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function sanitizeUid(uid: string): string {
  const clean = uid.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return clean.length > 0 && SAFE_ID_REGEX.test(clean) ? clean : 'user_default';
}

export async function syncFirebaseUserProfile(
  uid: string,
  name: string,
  identifier: string
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  const safeUid = sanitizeUid(uid);
  const path = `users/${safeUid}`;
  const ref = doc(db, 'users', safeUid);

  const safeName = (name || 'PlanEase User').trim().slice(0, 120) || 'PlanEase User';
  const safeIdentifier = (identifier || 'user@planease.app').trim().slice(0, 180);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        name: safeName,
        identifier: safeIdentifier,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      await setDoc(ref, {
        ownerId: safeUid,
        name: safeName,
        identifier: safeIdentifier,
        createdAt: existingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadFirestoreWorkspace(uid: string): Promise<UserWorkspaceData | null> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return null;
  const safeUid = sanitizeUid(uid);
  const path = `workspaces/${safeUid}`;
  const ref = doc(db, 'workspaces', safeUid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data && typeof data.payloadJson === 'string') {
      return JSON.parse(data.payloadJson) as UserWorkspaceData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveFirestoreWorkspace(
  uid: string,
  workspace: UserWorkspaceData
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return;
  const safeUid = sanitizeUid(uid);
  const path = `workspaces/${safeUid}`;
  const ref = doc(db, 'workspaces', safeUid);

  const payloadJson = JSON.stringify(workspace).slice(0, 899000);
  const allowedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
  const currency = allowedCurrencies.includes(workspace.currency) ? workspace.currency : 'INR';
  const theme = workspace.theme === 'dark' ? 'dark' : 'light';

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        ownerId: safeUid,
        currency,
        theme,
        payloadJson,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      await setDoc(ref, {
        ownerId: safeUid,
        currency,
        theme,
        payloadJson,
        createdAt: existingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export { signInWithPopup, signOut };
