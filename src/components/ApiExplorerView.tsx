import React, { useState } from 'react';
import { Play, Copy, Check, Terminal, Code2 } from 'lucide-react';
import { auth } from '../firebase.ts';

interface EndpointExemplo {
  id: string;
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  caminho: string;
  descricao: string;
  bodyExemplo?: string;
}

const ENDPOINTS: EndpointExemplo[] = [
  {
    id: 'list-all',
    metodo: 'GET',
    caminho: '/api/demandas',
    descricao: 'Lista todas as demandas da nuvem com razão social, CNPJ, prazo, dias restantes e nível de alerta.',
  },
  {
    id: 'list-andamento',
    metodo: 'GET',
    caminho: '/api/demandas?status=andamento',
    descricao: 'Filtra somente demandas em andamento (inclui alerta vermelho_forte ou vermelho_fraco).',
  },
  {
    id: 'list-concluido',
    metodo: 'GET',
    caminho: '/api/demandas?status=concluido',
    descricao: 'Filtra somente demandas concluídas (sem alertas de vencimento).',
  },
  {
    id: 'list-criticas',
    metodo: 'GET',
    caminho: '/api/demandas?status=andamento&alerta=vermelho_forte',
    descricao: 'Filtra demandas em andamento vencidas ou com até 2 dias para vencer.',
  },
  {
    id: 'create',
    metodo: 'POST',
    caminho: '/api/demandas',
    descricao: 'Cadastra uma nova demanda na nuvem validando CNPJ (14 dígitos), razão social e data de prazo.',
    bodyExemplo: JSON.stringify(
      {
        razaoSocial: 'Nova Empresa Exemplo Ltda.',
        cnpj: '11.444.777/0001-61',
        titulo: 'Envio de obrigações acessórias',
        responsavel: 'Mariana Alencar',
        prazo: '2026-11-18',
        status: 'andamento',
      },
      null,
      2
    ),
  },
  {
    id: 'patch',
    metodo: 'PATCH',
    caminho: '/api/demandas/:id',
    descricao: 'Atualiza parcialmente uma demanda (ex.: concluir ou reabrir, alterar prazo) propagando para todos.',
    bodyExemplo: JSON.stringify({ status: 'concluido' }, null, 2),
  },
  {
    id: 'delete',
    metodo: 'DELETE',
    caminho: '/api/demandas/:id',
    descricao: 'Remove uma demanda definitivamente do banco compartilhado.',
  },
];

export function ApiExplorerView() {
  const [endpointSelecionado, setEndpointSelecionado] = useState<string>('/api/demandas?status=andamento');
  const [respostaJson, setRespostaJson] = useState<string | null>(null);
  const [statusHttp, setStatusHttp] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const testarGet = async (caminho: string) => {
    setEndpointSelecionado(caminho);
    setCarregando(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(caminho, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setStatusHttp(res.status);
      const data = await res.json();
      setRespostaJson(JSON.stringify(data, null, 2));
    } catch (err) {
      setStatusHttp(500);
      setRespostaJson(
        JSON.stringify(
          { error: err instanceof Error ? err.message : 'Falha na requisição.' },
          null,
          2
        )
      );
    } finally {
      setCarregando(false);
    }
  };

  const copiarCurl = (item: EndpointExemplo) => {
    const authHeader = '-H "Authorization: Bearer SEU_TOKEN_FIREBASE"';
    const cmd = item.bodyExemplo
      ? `curl -X ${item.metodo} "${origin}${item.caminho}" ${authHeader} -H "Content-Type: application/json" -d '${item.bodyExemplo.replace(/\n/g, ' ')}'`
      : `curl "${origin}${item.caminho}" ${authHeader}`;
    navigator.clipboard?.writeText(cmd);
    setCopiadoId(item.id);
    setTimeout(() => setCopiadoId(null), 1800);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Endpoints da API REST (Firebase Firestore)
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Base URL ativa: <span className="font-mono text-blue-600">{origin}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600">
              <Terminal className="h-3.5 w-3.5" />
              REST API
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {ENDPOINTS.map((item) => (
              <div key={item.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 font-mono text-xs">
                    <span
                      className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                        item.metodo === 'GET'
                          ? 'bg-blue-50 text-blue-600'
                          : item.metodo === 'POST'
                            ? 'bg-emerald-50 text-emerald-600'
                            : item.metodo === 'PATCH'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {item.metodo}
                    </span>
                    <span className="font-semibold text-slate-800">{item.caminho}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copiarCurl(item)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      {copiadoId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                          cURL
                        </>
                      )}
                    </button>

                    {item.metodo === 'GET' && (
                      <button
                        type="button"
                        onClick={() => testarGet(item.caminho)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700 transition-all shadow-xs"
                      >
                        <Play className="h-3 w-3" />
                        Testar
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-slate-500">{item.descricao}</p>

                {item.bodyExemplo && (
                  <pre className="mt-2.5 overflow-x-auto rounded-xl border border-slate-200/70 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800">
                    {item.bodyExemplo}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Resposta em Tempo Real</h3>
              <p className="mt-0.5 font-mono text-xs text-slate-400 truncate max-w-[260px]">
                {endpointSelecionado}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusHttp !== null && (
                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                    statusHttp >= 200 && statusHttp < 300
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  HTTP {statusHttp}
                </span>
              )}
              <button
                type="button"
                onClick={() => testarGet(endpointSelecionado)}
                disabled={carregando}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <Play className="h-3 w-3 text-slate-600" />
                {carregando ? 'Consultando...' : 'Executar'}
              </button>
            </div>
          </div>

          <div className="p-4">
            {respostaJson ? (
              <pre className="max-h-[520px] overflow-auto rounded-xl border border-slate-900 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-400">
                {respostaJson}
              </pre>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
                <Code2 className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs text-slate-500">
                  Clique em <strong>Testar</strong> ao lado de qualquer endpoint para inspecionar a resposta em JSON.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
