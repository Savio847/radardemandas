import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase.ts';
import type {
  Demanda,
  DemandaPayload,
  DemandaStatus,
} from '../types/demanda.ts';
import {
  adicionarDiasIso,
  formatarCnpj,
  gerarCnpjValido,
  validarCnpj,
} from '../utils/demandaUtils.ts';

export const WORKSPACE_ID = 'principal' as const;

// Constantes espelhadas de firebase-blueprint.json
export const BLUEPRINT_LIMITS = {
  MAX_RAZAO_SOCIAL: 180,
  MIN_RAZAO_SOCIAL: 2,
  MAX_TITULO: 220,
  MIN_TITULO: 3,
  MAX_DESCRICAO: 1000,
  MAX_RESPONSAVEL: 120,
  MAX_USER_NAME: 120,
  CNPJ_LENGTH: 18,
  CNPJ_PATTERN: /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/,
  PRAZO_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
} as const;

function truncarTexto(valor: string, max: number): string {
  return valor.trim().slice(0, max);
}

function nomeUsuario(user: User): string {
  const bruto = user.displayName || user.email?.split('@')[0] || 'Usuário da Equipe';
  return truncarTexto(bruto, BLUEPRINT_LIMITS.MAX_USER_NAME) || 'Usuário da Equipe';
}

function normalizarTimestampIso(valor: unknown, fallbackIso: string): string {
  if (valor instanceof Timestamp) {
    return valor.toDate().toISOString();
  }
  if (valor && typeof valor === 'object' && 'toDate' in valor && typeof (valor as { toDate: () => Date }).toDate === 'function') {
    return (valor as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof valor === 'string') {
    return valor;
  }
  return fallbackIso;
}

function validarPayloadDemanda(payload: DemandaPayload): {
  razaoSocial: string;
  cnpj: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: DemandaStatus;
} {
  const razaoSocial = truncarTexto(payload.razaoSocial || '', BLUEPRINT_LIMITS.MAX_RAZAO_SOCIAL);
  const cnpj = formatarCnpj(payload.cnpj || '');
  const titulo = truncarTexto(payload.titulo || '', BLUEPRINT_LIMITS.MAX_TITULO);
  const descricao = truncarTexto(payload.descricao || '', BLUEPRINT_LIMITS.MAX_DESCRICAO);
  const responsavel =
    truncarTexto(payload.responsavel || '', BLUEPRINT_LIMITS.MAX_RESPONSAVEL) ||
    'Equipe Operacional';
  const prazo = (payload.prazo || '').trim();
  const status: DemandaStatus =
    payload.status === 'concluido'
      ? 'concluido'
      : payload.status === 'pendente'
        ? 'pendente'
        : 'andamento';

  if (razaoSocial.length < BLUEPRINT_LIMITS.MIN_RAZAO_SOCIAL) {
    throw new Error('Informe a Razão Social da empresa (mínimo 2 caracteres).');
  }
  if (!BLUEPRINT_LIMITS.CNPJ_PATTERN.test(cnpj) || !validarCnpj(cnpj)) {
    throw new Error('CNPJ inválido. Informe 14 dígitos válidos.');
  }
  if (titulo.length < BLUEPRINT_LIMITS.MIN_TITULO) {
    throw new Error('Informe o título da demanda (mínimo 3 caracteres).');
  }
  if (!BLUEPRINT_LIMITS.PRAZO_PATTERN.test(prazo)) {
    throw new Error('Prazo inválido. Use o formato YYYY-MM-DD.');
  }

  return { razaoSocial, cnpj, titulo, descricao, responsavel, prazo, status };
}

export async function garantirPerfilUsuario(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const displayName = nomeUsuario(user);
  const email = (user.email || '').trim().toLowerCase().slice(0, 254);
  const isAdminEmail = email === 'consilcontabilidade.expedicao@gmail.com';

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName,
        role: isAdminEmail ? 'admin' : 'member',
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email,
        displayName,
        atualizadoEm: serverTimestamp(),
      });
    }
  } catch (error) {
    console.warn('Aviso: Perfil do usuário já configurado ou permissão restrita para users/{uid}:', error);
  }
}

export async function semearDemandasIniciaisSeVazio(user: User): Promise<void> {
  const colRef = collection(db, 'demandas');
  const q = query(colRef, where('workspaceId', '==', WORKSPACE_ID), limit(1));

  try {
    const existing = await getDocs(q);
    if (!existing.empty) {
      return;
    }

    const agora = new Date();
    const criadoPorNome = nomeUsuario(user);
    const batch = writeBatch(db);

    const sementes: Array<{
      id: string;
      razaoSocial: string;
      cnpj: string;
      titulo: string;
      descricao: string;
      responsavel: string;
      prazo: string;
      status: DemandaStatus;
    }> = [
      {
        id: 'dem-001',
        razaoSocial: 'Horizonte Logística e Transportes Ltda.',
        cnpj: gerarCnpjValido('112223330001'),
        titulo: 'Entrega da DCTFWeb e conferência de INSS',
        descricao: 'Fechamento fiscal mensal com validação de guias previdenciárias e DARF.',
        responsavel: 'Mariana Alencar',
        prazo: adicionarDiasIso(-1, agora),
        status: 'andamento',
      },
      {
        id: 'dem-002',
        razaoSocial: 'Vértice Engenharia e Obras S.A.',
        cnpj: gerarCnpjValido('245891200001'),
        titulo: 'Renovação do Alvará de Funcionamento Municipal',
        descricao: 'Protocolar laudo de vistoria atualizado junto à prefeitura e pagar taxa anual.',
        responsavel: 'Ricardo Nogueira',
        prazo: adicionarDiasIso(1, agora),
        status: 'andamento',
      },
      {
        id: 'dem-003',
        razaoSocial: 'Atlântico Tecnologia e Sistemas Ltda.',
        cnpj: gerarCnpjValido('489203150001'),
        titulo: 'Emissão de Certidão Negativa de Débitos Federais',
        descricao: 'Regularização cadastral para renovação de contrato corporativo.',
        responsavel: 'Lucas Mendonça',
        prazo: adicionarDiasIso(4, agora),
        status: 'andamento',
      },
      {
        id: 'dem-004',
        razaoSocial: 'Norte Sul Distribuidora Farmacêutica Ltda.',
        cnpj: gerarCnpjValido('632184900001'),
        titulo: 'Atualização de Licença Sanitária ANVISA',
        descricao: 'Conferência documental do responsável técnico e envio eletrônico.',
        responsavel: 'Rafael Teixeira',
        prazo: adicionarDiasIso(15, agora),
        status: 'andamento',
      },
      {
        id: 'dem-005',
        razaoSocial: 'Estrela do Sul Metalúrgica Ltda.',
        cnpj: gerarCnpjValido('829301440001'),
        titulo: 'Fechamento de Folha de Pagamento e eSocial',
        descricao: 'Transmissão dos eventos periódicos S-1200 e S-1210 e emissão de holerites.',
        responsavel: 'Camila Ferreira',
        prazo: adicionarDiasIso(1, agora),
        status: 'concluido',
      },
    ];

    for (const item of sementes) {
      const ref = doc(db, 'demandas', item.id);
      batch.set(ref, {
        workspaceId: WORKSPACE_ID,
        razaoSocial: item.razaoSocial,
        cnpj: item.cnpj,
        titulo: item.titulo,
        descricao: item.descricao,
        responsavel: item.responsavel,
        prazo: item.prazo,
        status: item.status,
        ownerId: user.uid,
        criadoPorNome,
        atualizadoPorUid: user.uid,
        atualizadoPorNome: criadoPorNome,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
        concluidoEm: item.status === 'concluido' ? serverTimestamp() : null,
      });
    }

    await batch.commit();
  } catch (error) {
    console.warn('Aviso ao verificar/semear demandas iniciais:', error);
  }
}

export function assinarDemandasEmTempoReal(
  aoAtualizar: (demandas: Demanda[]) => void,
  aoFalhar: (erro: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'demandas'), where('workspaceId', '==', WORKSPACE_ID));

  return onSnapshot(
    q,
    (snapshot) => {
      const agoraIso = new Date().toISOString();
      const lista: Demanda[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data({ serverTimestamps: 'estimate' });
        const rawStatus = d.status;
        const status: DemandaStatus =
          rawStatus === 'concluido'
            ? 'concluido'
            : rawStatus === 'pendente'
              ? 'pendente'
              : 'andamento';
        return {
          id: docSnap.id,
          razaoSocial: typeof d.razaoSocial === 'string' ? d.razaoSocial : '',
          cnpj: typeof d.cnpj === 'string' ? d.cnpj : '',
          titulo: typeof d.titulo === 'string' ? d.titulo : '',
          descricao: typeof d.descricao === 'string' ? d.descricao : '',
          responsavel: typeof d.responsavel === 'string' ? d.responsavel : 'Equipe Operacional',
          prazo: typeof d.prazo === 'string' ? d.prazo : '',
          status,
          criadoEm: normalizarTimestampIso(d.criadoEm, agoraIso),
          concluidoEm:
            d.concluidoEm === null || d.concluidoEm === undefined
              ? null
              : normalizarTimestampIso(d.concluidoEm, agoraIso),
        };
      });
      aoAtualizar(lista);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'demandas');
      } catch (wrapped) {
        aoFalhar(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function criarDemandaFirestore(
  payload: DemandaPayload,
  user: User
): Promise<string> {
  const validado = validarPayloadDemanda(payload);
  const id = `dem-${crypto.randomUUID().slice(0, 8)}`;
  const path = `demandas/${id}`;
  const autor = nomeUsuario(user);

  try {
    await setDoc(doc(db, 'demandas', id), {
      workspaceId: WORKSPACE_ID,
      razaoSocial: validado.razaoSocial,
      cnpj: validado.cnpj,
      titulo: validado.titulo,
      descricao: validado.descricao,
      responsavel: validado.responsavel,
      prazo: validado.prazo,
      status: validado.status,
      ownerId: user.uid,
      criadoPorNome: autor,
      atualizadoPorUid: user.uid,
      atualizadoPorNome: autor,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
      concluidoEm: validado.status === 'concluido' ? serverTimestamp() : null,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function atualizarVencimentoFirestore(
  id: string,
  novoPrazo: string,
  user: User
): Promise<void> {
  const prazoLimpo = novoPrazo.trim();
  if (!BLUEPRINT_LIMITS.PRAZO_PATTERN.test(prazoLimpo)) {
    throw new Error('Prazo inválido. Use o formato YYYY-MM-DD.');
  }

  const path = `demandas/${id}`;
  try {
    await updateDoc(doc(db, 'demandas', id), {
      prazo: prazoLimpo,
      atualizadoPorUid: user.uid,
      atualizadoPorNome: nomeUsuario(user),
      atualizadoEm: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function alternarStatusFirestore(
  demanda: Demanda,
  user: User
): Promise<DemandaStatus> {
  const novoStatus: DemandaStatus =
    demanda.status === 'andamento' ? 'concluido' : 'andamento';
  const path = `demandas/${demanda.id}`;

  try {
    await updateDoc(doc(db, 'demandas', demanda.id), {
      status: novoStatus,
      concluidoEm: novoStatus === 'concluido' ? serverTimestamp() : null,
      atualizadoPorUid: user.uid,
      atualizadoPorNome: nomeUsuario(user),
      atualizadoEm: serverTimestamp(),
    });
    return novoStatus;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function editarDemandaFirestore(
  id: string,
  payload: DemandaPayload,
  statusAnterior: DemandaStatus,
  user: User
): Promise<void> {
  const validado = validarPayloadDemanda(payload);
  const path = `demandas/${id}`;

  const updateBody: Record<string, unknown> = {
    razaoSocial: validado.razaoSocial,
    cnpj: validado.cnpj,
    titulo: validado.titulo,
    descricao: validado.descricao,
    responsavel: validado.responsavel,
    prazo: validado.prazo,
    status: validado.status,
    atualizadoPorUid: user.uid,
    atualizadoPorNome: nomeUsuario(user),
    atualizadoEm: serverTimestamp(),
  };

  if (statusAnterior === 'andamento' && validado.status === 'concluido') {
    updateBody.concluidoEm = serverTimestamp();
  } else if (statusAnterior === 'concluido' && validado.status === 'andamento') {
    updateBody.concluidoEm = null;
  }

  try {
    await updateDoc(doc(db, 'demandas', id), updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function excluirDemandaFirestore(id: string): Promise<void> {
  const path = `demandas/${id}`;
  try {
    await deleteDoc(doc(db, 'demandas', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
