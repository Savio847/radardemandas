import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type {
  Demanda,
  DemandaComAlerta,
  DemandaPayload,
  DemandasMeta,
  DemandaStatus,
} from './src/types/demanda.ts';
import {
  dataHojeIsoLocal,
  enriquecerDemanda,
  formatarCnpj,
  limparCnpj,
  validarCnpj,
} from './src/utils/demandaUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ID = 'principal';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

function carregarFirebaseConfig(): FirebaseAppletConfig {
  const candidatos = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(__dirname, 'firebase-applet-config.json'),
    path.join(__dirname, '..', 'firebase-applet-config.json'),
  ];
  for (const cfgPath of candidatos) {
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      return JSON.parse(raw) as FirebaseAppletConfig;
    }
  }
  throw new Error('Arquivo firebase-applet-config.json não encontrado.');
}

const firebaseConfig = carregarFirebaseConfig();
const FIRESTORE_DOCUMENTS_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
const FIRESTORE_DOC_PREFIX = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

type FirestoreValue =
  | { stringValue: string }
  | { timestampValue: string }
  | { nullValue: null };

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
}

function lerCampoString(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  const val = fields?.[key];
  if (val && 'stringValue' in val && typeof val.stringValue === 'string') {
    return val.stringValue;
  }
  return '';
}

function lerCampoTimestamp(
  fields: Record<string, FirestoreValue> | undefined,
  key: string
): string | null {
  const val = fields?.[key];
  if (!val) return null;
  if ('timestampValue' in val && typeof val.timestampValue === 'string') {
    return val.timestampValue;
  }
  if ('nullValue' in val) {
    return null;
  }
  return null;
}

function documentoParaDemanda(docObj: FirestoreDocument): Demanda | null {
  if (!docObj.name || !docObj.fields) return null;
  const id = docObj.name.split('/').pop() || '';
  if (!id) return null;
  const statusRaw = lerCampoString(docObj.fields, 'status');
  const status: DemandaStatus = statusRaw === 'concluido' ? 'concluido' : 'andamento';

  return {
    id,
    razaoSocial: lerCampoString(docObj.fields, 'razaoSocial'),
    cnpj: lerCampoString(docObj.fields, 'cnpj'),
    titulo: lerCampoString(docObj.fields, 'titulo'),
    descricao: lerCampoString(docObj.fields, 'descricao'),
    responsavel: lerCampoString(docObj.fields, 'responsavel') || 'Equipe Operacional',
    prazo: lerCampoString(docObj.fields, 'prazo'),
    status,
    criadoEm: lerCampoTimestamp(docObj.fields, 'criadoEm') || new Date().toISOString(),
    concluidoEm: lerCampoTimestamp(docObj.fields, 'concluidoEm'),
  };
}

function extrairTokenBearer(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function extrairContextoUsuarioDoJwt(token: string): { uid: string; nome: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      user_id?: string;
      sub?: string;
      name?: string;
      email?: string;
    };
    const uid = payload.user_id || payload.sub;
    if (!uid) return null;
    const nome = (payload.name || payload.email?.split('@')[0] || 'API').slice(0, 120);
    return { uid, nome };
  } catch {
    return null;
  }
}

async function firestoreListDemandas(token: string): Promise<Demanda[]> {
  const res = await fetch(`${FIRESTORE_DOCUMENTS_BASE}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'demandas' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'workspaceId' },
            op: 'EQUAL',
            value: { stringValue: WORKSPACE_ID },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore (${res.status}): ${errText}`);
  }

  const rows = (await res.json()) as Array<{ document?: FirestoreDocument }>;
  const lista: Demanda[] = [];
  for (const row of rows) {
    if (row.document) {
      const parsed = documentoParaDemanda(row.document);
      if (parsed) lista.push(parsed);
    }
  }
  return lista;
}

async function firestoreGetDemanda(id: string, token: string): Promise<Demanda | null> {
  const res = await fetch(`${FIRESTORE_DOCUMENTS_BASE}/demandas/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore (${res.status}): ${errText}`);
  }
  const docObj = (await res.json()) as FirestoreDocument;
  return documentoParaDemanda(docObj);
}

function isIsoDate(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function calcularMeta(todasEnriquecidas: DemandaComAlerta[]): DemandasMeta {
  let andamento = 0;
  let concluido = 0;
  let vermelhoForte = 0;
  let vermelhoFraco = 0;
  let emDia = 0;

  for (const item of todasEnriquecidas) {
    if (item.status === 'concluido') {
      concluido += 1;
    } else {
      andamento += 1;
      if (item.alerta === 'vermelho_forte') vermelhoForte += 1;
      else if (item.alerta === 'vermelho_fraco') vermelhoFraco += 1;
      else emDia += 1;
    }
  }

  return {
    total: todasEnriquecidas.length,
    andamento,
    concluido,
    vermelhoForte,
    vermelhoFraco,
    emDia,
    referenciaHoje: dataHojeIsoLocal(),
  };
}

function ordenarDemandas(lista: DemandaComAlerta[]): DemandaComAlerta[] {
  return [...lista].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'andamento' ? -1 : 1;
    }
    return a.prazo.localeCompare(b.prazo);
  });
}

export function criarApiApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      storage: 'firestore',
      databaseId: firebaseConfig.firestoreDatabaseId,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/demandas', async (req, res) => {
    const token = extrairTokenBearer(req);
    if (!token) {
      res.status(401).json({
        error: 'Autenticação necessária. Envie Authorization: Bearer <token_firebase>.',
      });
      return;
    }

    try {
      const statusParam = typeof req.query.status === 'string' ? req.query.status : 'todos';
      const alertaParam = typeof req.query.alerta === 'string' ? req.query.alerta : 'todos';
      const buscaParam = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const cnpjParam = typeof req.query.cnpj === 'string' ? limparCnpj(req.query.cnpj) : '';

      const agora = new Date();
      const brutas = await firestoreListDemandas(token);
      const todasEnriquecidas = brutas.map((d) => enriquecerDemanda(d, agora));
      const meta = calcularMeta(todasEnriquecidas);

      let filtradas = todasEnriquecidas;

      if (statusParam === 'andamento' || statusParam === 'concluido') {
        filtradas = filtradas.filter((d) => d.status === statusParam);
      }

      if (
        alertaParam === 'vermelho_forte' ||
        alertaParam === 'vermelho_fraco' ||
        alertaParam === 'nenhum'
      ) {
        filtradas = filtradas.filter((d) => d.alerta === alertaParam);
      }

      if (cnpjParam.length > 0) {
        filtradas = filtradas.filter((d) => limparCnpj(d.cnpj).includes(cnpjParam));
      }

      if (buscaParam.length > 0) {
        const buscaDigits = limparCnpj(buscaParam);
        filtradas = filtradas.filter((d) => {
          const matchTexto =
            d.razaoSocial.toLowerCase().includes(buscaParam) ||
            d.titulo.toLowerCase().includes(buscaParam) ||
            d.descricao.toLowerCase().includes(buscaParam) ||
            d.responsavel.toLowerCase().includes(buscaParam) ||
            d.cnpj.toLowerCase().includes(buscaParam);
          const matchDigits = buscaDigits.length >= 2 && limparCnpj(d.cnpj).includes(buscaDigits);
          return matchTexto || matchDigits;
        });
      }

      res.json({
        data: ordenarDemandas(filtradas),
        meta,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao consultar o Firestore.',
      });
    }
  });

  app.get('/api/demandas/:id', async (req, res) => {
    const token = extrairTokenBearer(req);
    if (!token) {
      res.status(401).json({
        error: 'Autenticação necessária. Envie Authorization: Bearer <token_firebase>.',
      });
      return;
    }

    try {
      const encontrada = await firestoreGetDemanda(req.params.id, token);
      if (!encontrada) {
        res.status(404).json({ error: 'Demanda não encontrada.' });
        return;
      }
      res.json({ data: enriquecerDemanda(encontrada) });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao consultar o Firestore.',
      });
    }
  });

  app.post('/api/demandas', async (req, res) => {
    const token = extrairTokenBearer(req);
    const userCtx = token ? extrairContextoUsuarioDoJwt(token) : null;
    if (!token || !userCtx) {
      res.status(401).json({
        error: 'Autenticação necessária. Envie Authorization: Bearer <token_firebase>.',
      });
      return;
    }

    const body = req.body as Partial<DemandaPayload>;
    const razaoSocial = typeof body.razaoSocial === 'string' ? body.razaoSocial.trim().slice(0, 180) : '';
    const cnpjRaw = typeof body.cnpj === 'string' ? body.cnpj : '';
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim().slice(0, 220) : '';
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim().slice(0, 1000) : '';
    const responsavel =
      (typeof body.responsavel === 'string' ? body.responsavel.trim().slice(0, 120) : '') ||
      'Equipe Operacional';
    const prazo = body.prazo;
    const status: DemandaStatus = body.status === 'concluido' ? 'concluido' : 'andamento';

    if (razaoSocial.length < 2) {
      res.status(400).json({ error: 'Informe a Razão Social da empresa.' });
      return;
    }
    if (!validarCnpj(cnpjRaw)) {
      res.status(400).json({ error: 'CNPJ inválido. Informe 14 dígitos válidos.' });
      return;
    }
    if (titulo.length < 3) {
      res.status(400).json({ error: 'Informe o título ou descrição resumida da demanda.' });
      return;
    }
    if (!isIsoDate(prazo)) {
      res.status(400).json({ error: 'Prazo inválido. Use o formato YYYY-MM-DD.' });
      return;
    }

    const id = `dem-${crypto.randomUUID().slice(0, 8)}`;
    const cnpj = formatarCnpj(cnpjRaw);
    const docName = `${FIRESTORE_DOC_PREFIX}/demandas/${id}`;

    const fieldTransforms: Array<{ fieldPath: string; setToServerValue: 'REQUEST_TIME' }> = [
      { fieldPath: 'criadoEm', setToServerValue: 'REQUEST_TIME' },
      { fieldPath: 'atualizadoEm', setToServerValue: 'REQUEST_TIME' },
    ];
    if (status === 'concluido') {
      fieldTransforms.push({ fieldPath: 'concluidoEm', setToServerValue: 'REQUEST_TIME' });
    }

    const fields: Record<string, FirestoreValue> = {
      workspaceId: { stringValue: WORKSPACE_ID },
      razaoSocial: { stringValue: razaoSocial },
      cnpj: { stringValue: cnpj },
      titulo: { stringValue: titulo },
      descricao: { stringValue: descricao },
      responsavel: { stringValue: responsavel },
      prazo: { stringValue: prazo },
      status: { stringValue: status },
      ownerId: { stringValue: userCtx.uid },
      criadoPorNome: { stringValue: userCtx.nome },
      atualizadoPorUid: { stringValue: userCtx.uid },
      atualizadoPorNome: { stringValue: userCtx.nome },
    };
    if (status === 'andamento') {
      fields.concluidoEm = { nullValue: null };
    }

    try {
      const commitRes = await fetch(`${FIRESTORE_DOCUMENTS_BASE}:commit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          writes: [
            {
              update: { name: docName, fields },
              currentDocument: { exists: false },
              updateTransforms: fieldTransforms,
            },
          ],
        }),
      });

      if (!commitRes.ok) {
        const errText = await commitRes.text();
        res.status(commitRes.status).json({ error: errText });
        return;
      }

      const criada = await firestoreGetDemanda(id, token);
      if (!criada) {
        res.status(201).json({
          data: enriquecerDemanda({
            id,
            razaoSocial,
            cnpj,
            titulo,
            descricao,
            responsavel,
            prazo,
            status,
            criadoEm: new Date().toISOString(),
            concluidoEm: status === 'concluido' ? new Date().toISOString() : null,
          }),
        });
        return;
      }
      res.status(201).json({ data: enriquecerDemanda(criada) });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao salvar no Firestore.',
      });
    }
  });

  app.patch('/api/demandas/:id', async (req, res) => {
    const token = extrairTokenBearer(req);
    const userCtx = token ? extrairContextoUsuarioDoJwt(token) : null;
    if (!token || !userCtx) {
      res.status(401).json({
        error: 'Autenticação necessária. Envie Authorization: Bearer <token_firebase>.',
      });
      return;
    }

    try {
      const atual = await firestoreGetDemanda(req.params.id, token);
      if (!atual) {
        res.status(404).json({ error: 'Demanda não encontrada.' });
        return;
      }

      const body = req.body as Partial<DemandaPayload>;
      const fields: Record<string, FirestoreValue> = {
        atualizadoPorUid: { stringValue: userCtx.uid },
        atualizadoPorNome: { stringValue: userCtx.nome },
      };
      const maskPaths = ['atualizadoPorUid', 'atualizadoPorNome', 'atualizadoEm'];
      const transforms: Array<{ fieldPath: string; setToServerValue: 'REQUEST_TIME' }> = [
        { fieldPath: 'atualizadoEm', setToServerValue: 'REQUEST_TIME' },
      ];

      if (body.razaoSocial !== undefined) {
        if (typeof body.razaoSocial !== 'string' || body.razaoSocial.trim().length < 2) {
          res.status(400).json({ error: 'Razão Social inválida.' });
          return;
        }
        fields.razaoSocial = { stringValue: body.razaoSocial.trim().slice(0, 180) };
        maskPaths.push('razaoSocial');
      }

      if (body.cnpj !== undefined) {
        if (typeof body.cnpj !== 'string' || !validarCnpj(body.cnpj)) {
          res.status(400).json({ error: 'CNPJ inválido. Informe 14 dígitos válidos.' });
          return;
        }
        fields.cnpj = { stringValue: formatarCnpj(body.cnpj) };
        maskPaths.push('cnpj');
      }

      if (body.titulo !== undefined) {
        if (typeof body.titulo !== 'string' || body.titulo.trim().length < 3) {
          res.status(400).json({ error: 'Título da demanda inválido.' });
          return;
        }
        fields.titulo = { stringValue: body.titulo.trim().slice(0, 220) };
        maskPaths.push('titulo');
      }

      if (body.descricao !== undefined && typeof body.descricao === 'string') {
        fields.descricao = { stringValue: body.descricao.trim().slice(0, 1000) };
        maskPaths.push('descricao');
      }

      if (
        body.responsavel !== undefined &&
        typeof body.responsavel === 'string' &&
        body.responsavel.trim().length > 0
      ) {
        fields.responsavel = { stringValue: body.responsavel.trim().slice(0, 120) };
        maskPaths.push('responsavel');
      }

      if (body.prazo !== undefined) {
        if (!isIsoDate(body.prazo)) {
          res.status(400).json({ error: 'Prazo inválido. Use o formato YYYY-MM-DD.' });
          return;
        }
        fields.prazo = { stringValue: body.prazo };
        maskPaths.push('prazo');
      }

      if (body.status !== undefined) {
        if (body.status !== 'andamento' && body.status !== 'concluido') {
          res.status(400).json({ error: 'Status deve ser "andamento" ou "concluido".' });
          return;
        }
        fields.status = { stringValue: body.status };
        maskPaths.push('status');

        if (atual.status === 'andamento' && body.status === 'concluido') {
          transforms.push({ fieldPath: 'concluidoEm', setToServerValue: 'REQUEST_TIME' });
          maskPaths.push('concluidoEm');
        } else if (atual.status === 'concluido' && body.status === 'andamento') {
          fields.concluidoEm = { nullValue: null };
          maskPaths.push('concluidoEm');
        }
      }

      const docName = `${FIRESTORE_DOC_PREFIX}/demandas/${req.params.id}`;
      const commitRes = await fetch(`${FIRESTORE_DOCUMENTS_BASE}:commit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          writes: [
            {
              update: { name: docName, fields },
              updateMask: { fieldPaths: maskPaths },
              currentDocument: { exists: true },
              updateTransforms: transforms,
            },
          ],
        }),
      });

      if (!commitRes.ok) {
        const errText = await commitRes.text();
        res.status(commitRes.status).json({ error: errText });
        return;
      }

      const atualizada = await firestoreGetDemanda(req.params.id, token);
      res.json({ data: atualizada ? enriquecerDemanda(atualizada) : null });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao atualizar no Firestore.',
      });
    }
  });

  app.delete('/api/demandas/:id', async (req, res) => {
    const token = extrairTokenBearer(req);
    if (!token) {
      res.status(401).json({
        error: 'Autenticação necessária. Envie Authorization: Bearer <token_firebase>.',
      });
      return;
    }

    try {
      const delRes = await fetch(
        `${FIRESTORE_DOCUMENTS_BASE}/demandas/${encodeURIComponent(req.params.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!delRes.ok) {
        const errText = await delRes.text();
        res.status(delRes.status).json({ error: errText });
        return;
      }

      res.json({ ok: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Falha ao remover no Firestore.',
      });
    }
  });

  return app;
}
