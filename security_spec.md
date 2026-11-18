# Security Specification — Radar de Demandas (Firestore)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path is denied (`allow read, write: if false`).
2. **Verified Identity**: All reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every single-document ID (`userId`, `demandaId`) must pass `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, length `1..128`).
4. **PII Isolation (`users/{userId}`)**: Email and user profile data are readable/writable only by `isOwner(userId)` or `isAdmin()`. Self-created profiles must have `role == 'member'` and `uid == request.auth.uid`; users cannot escalate their own `role`.
5. **Workspace Query Isolation (`demandas/{demandaId}`)**:
   - `allow list` never uses `get()` or `exists()` and explicitly requires `resource.data.workspaceId == 'principal'`.
   - Every `Demanda` document must declare exact allowed/required keys (15 fields), exact types, strict `.size()` limits, valid CNPJ regex `^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$`, valid ISO date regex `^\d{4}-\d{2}-\d{2}$`, and `status in ['andamento', 'concluido']`.
6. **Immutability & Temporal Integrity**:
   - `ownerId`, `workspaceId`, and `criadoEm` are immutable after creation.
   - `criadoEm == request.time` on create; `atualizadoEm == request.time` on create and update.
   - `concluidoEm` is `null` when `status == 'andamento'` and equals `request.time` when transitioning to `'concluido'`.
   - `atualizadoPorUid` must match `request.auth.uid` on every create/update.
7. **Action-Based Updates**: Every update matches an explicit allowed key-set via `incoming().diff(existing()).affectedKeys().hasOnly(...)` and runs `isValidDemanda(incoming())`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `auth = null` reading/creating `/demandas/dem-001` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: `auth = { uid: 'u1', token: { email: 'consilcontabilidade.expedicao@gmail.com', email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Blanket List Without Workspace Filter**: Querying `collection('demandas')` without `where('workspaceId', '==', 'principal')` -> `PERMISSION_DENIED`.
4. **Shadow / Ghost Field Injection**: Creating/updating a `Demanda` with an extra field `{ isApproved: true }` -> `PERMISSION_DENIED`.
5. **ID Poisoning**: Creating `/demandas/` with an ID > 128 chars or containing invalid symbols (`bad$id`) -> `PERMISSION_DENIED`.
6. **Owner Spoofing on Create**: Creating a `Demanda` with `ownerId: 'another-uid'` -> `PERMISSION_DENIED`.
7. **Owner / CreatedAt Mutation on Update**: Updating a `Demanda` to alter `ownerId` or `criadoEm` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery**: Creating a `Demanda` with a client-supplied `criadoEm` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Resource Exhaustion (1MB String)**: Creating/updating a `Demanda` with `titulo` or `descricao` > max length -> `PERMISSION_DENIED`.
10. **Invalid CNPJ / Prazo Format**: Sending `cnpj: "123"` or `prazo: "17/11/2026"` -> `PERMISSION_DENIED`.
11. **PII Cross-User Read**: User `u2` attempting `getDoc(doc(db, 'users', 'u1'))` -> `PERMISSION_DENIED`.
12. **Self Privilege Escalation**: User `u2` creating or updating `/users/u2` with `role: 'admin'` -> `PERMISSION_DENIED`.
