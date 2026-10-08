# PlanEase Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document in `/users/{userId}` and `/workspaces/{userId}` belongs exclusively to `userId`. A user can only read, create, update, or delete a document where `userId == request.auth.uid` AND `data.ownerId == request.auth.uid`.
2. **Verified Identity**: All read/write operations require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
3. **No List Scraping**: Listing `/users` or `/workspaces` collections is strictly forbidden (`allow list: if false;`). Clients only fetch their own document by ID.
4. **Strict Schema & Key Whitelisting**: Documents must contain all required keys and only allowed keys (`hasAll` + `hasOnly`). Shadow fields are rejected on both create and update.
5. **Immutability & Temporal Integrity**: `ownerId` and `createdAt` are immutable after creation. `createdAt` (on create) and `updatedAt` (on create and update) must equal `request.time`.
6. **Volumetric Bounds**: Every string field enforces strict `.size()` bounds matching `firebase-blueprint.json`, and path IDs enforce `isValidId(userId)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/users/user_1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'user_1', token: { email_verified: false } }`, creating `/users/user_1` -> `PERMISSION_DENIED`.
3. **Cross-Tenant Read (PII Leak)**: `auth.uid = 'attacker'`, reading `/users/victim` -> `PERMISSION_DENIED`.
4. **Cross-Tenant Write (Identity Spoofing)**: `auth.uid = 'attacker'`, writing `/workspaces/victim` -> `PERMISSION_DENIED`.
5. **OwnerId Mismatch in Payload**: `auth.uid = 'user_1'`, creating `/workspaces/user_1` with `ownerId: 'user_2'` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection on Create**: Creating `/users/user_1` with extra field `isAdmin: true` -> `PERMISSION_DENIED`.
7. **Shadow Field Injection on Update**: Updating `/workspaces/user_1` with extra field `hacked: true` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation (`ownerId`)**: Updating `/workspaces/user_1` changing `ownerId` to `'other'` -> `PERMISSION_DENIED`.
9. **Immutable Field Mutation (`createdAt`)**: Updating `/workspaces/user_1` changing `createdAt` -> `PERMISSION_DENIED`.
10. **Forged Client Timestamp (`updatedAt`)**: Updating `/workspaces/user_1` with a past/future timestamp not equal to `request.time` -> `PERMISSION_DENIED`.
11. **Value Poisoning / Denial of Wallet**: Updating `/users/user_1` with `name` of length 5000 chars (exceeding 120 max) -> `PERMISSION_DENIED`.
12. **Collection Enumeration (`list` query)**: Executing a collection `list` query on `/users` or `/workspaces` -> `PERMISSION_DENIED`.
