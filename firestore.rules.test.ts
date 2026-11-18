/**
 * Testes de contrato de segurança (Dirty Dozen) para firestore.rules.
 * Verifica os 12 cenários adversariais documentados em security_spec.md.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  targetPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read/write on demandas',
    targetPath: '/demandas/dem-001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified admin email spoof attack',
    targetPath: '/demandas/dem-001',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unconstrained list query without workspaceId == principal',
    targetPath: '/demandas',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow ghost field injection on create',
    targetPath: '/demandas/dem-ghost',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { isApproved: true },
  },
  {
    id: 5,
    name: 'ID poisoning with oversized/invalid document ID',
    targetPath: '/demandas/invalid$id$' + 'a'.repeat(130),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Owner UID spoofing on create',
    targetPath: '/demandas/dem-spoof',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'victim-uid' },
  },
  {
    id: 7,
    name: 'Immutable ownerId/criadoEm mutation on update',
    targetPath: '/demandas/dem-001',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'attacker-uid' },
  },
  {
    id: 8,
    name: 'Client-forged criadoEm timestamp bypassing request.time',
    targetPath: '/demandas/dem-time',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { criadoEm: '2020-01-01T00:00:00Z' },
  },
  {
    id: 9,
    name: 'Resource exhaustion oversized string payload',
    targetPath: '/demandas/dem-big',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { titulo: 'X'.repeat(5000) },
  },
  {
    id: 10,
    name: 'Malformed CNPJ or prazo string bypassing regex guards',
    targetPath: '/demandas/dem-regex',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { cnpj: 'invalid', prazo: '17/11/2026' },
  },
  {
    id: 11,
    name: 'Cross-user PII read on /users/{otherUid}',
    targetPath: '/users/other-uid',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-assigned admin role privilege escalation on /users/{uid}',
    targetPath: '/users/attacker-uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { role: 'admin' },
  },
];
