import React, { useState } from 'react';
import { Play, Copy, Check } from 'lucide-react';
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
      <div className="space-y-3 lg:col-span-7">
        <div className="rounded-xl border border-[#e8d5da] bg-white/90 backdrop-blur-[2px]">
          <div className="border-b border-[#e8d5da] px-5 py-4">
            <h2 className="text-base font-semibold text-[#2b0b13]">
              Endpoints da API REST (Integrados ao Firestore)
            </h2>
            <p className="mt-1 text-xs text-[#6e4c55]">
              Base URL ativa: <span className="font-mono text-[#4a202b]">{origin}</span>
            </p>
          </div>

          <div className="divide-y divide-[#f2e6e9]">
            {ENDPOINTS.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 font-mono text-xs">
                    <span
                      className={`font-semibold ${
                        item.metodo === 'GET'
                          ? 'text-[#6e162e]'
                          : item.metodo === 'POST'
                            ? 'text-emerald-700'
                            : item.metodo === 'PATCH'
                              ? 'text-amber-700'
                              : 'text-red-700'
                      }`}
                    >
                      {item.metodo}
                    </span>
                    <span className="font-medium text-[#2b0b13]">{item.caminho}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copiarCurl(item)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e4cfd5] bg-white px-2.5 text-xs font-medium text-[#4a202b] hover:bg-[#faf2f4] whitespace-nowrap"
                    >
                      {copiadoId === item.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          cURL
                        </>
                      )}
                    </button>

                    {item.metodo === 'GET' && (
                      <button
                        type="button"
                        onClick={() => testarGet(item.caminho)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#5e1024] px-3 text-xs font-medium text-white hover:bg-[#490b1b] whitespace-nowrap"
                      >
                        <Play className="h-3 w-3" />
                        Testar
                      </button>
                    )}
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-[#6e4c55]">{item.descricao}</p>

                {item.bodyExemplo && (
                  <pre className="mt-2.5 overflow-x-auto rounded-lg border border-[#e8d5da] bg-[#fdfafb] p-3 font-mono text-[11px] leading-relaxed text-[#3b0a17]">
                    {item.bodyExemplo}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="sticky top-6 rounded-xl border border-[#e8d5da] bg-white/90 backdrop-blur-[2px]">
          <div className="flex items-center justify-between border-b border-[#e8d5da] px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-[#2b0b13]">Resposta ao Vivo</h3>
              <p className="mt-0.5 font-mono text-xs text-[#6e4c55] truncate max-w-[260px]">
                {endpointSelecionado}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusHttp !== null && (
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    statusHttp >= 200 && statusHttp < 300 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  HTTP {statusHttp}
                </span>
              )}
              <button
                type="button"
                onClick={() => testarGet(endpointSelecionado)}
                disabled={carregando}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e4cfd5] bg-white px-3 text-xs font-medium text-[#4a202b] hover:bg-[#faf2f4] whitespace-nowrap"
              >
                <Play className="h-3 w-3" />
                {carregando ? 'Consultando...' : 'Executar'}
              </button>
            </div>
          </div>

          <div className="p-4">
            {respostaJson ? (
              <pre className="max-h-[540px] overflow-auto rounded-lg border border-[#4a0e1d] bg-[#24060e] p-4 font-mono text-xs leading-relaxed text-[#fdf2f4]">
                {respostaJson}
              </pre>
            ) : (
              <div className="rounded-lg border border-dashed border-[#d9bcc4] bg-[#faf2f4] px-4 py-12 text-center">
                <p className="text-xs text-[#6e4c55]">
                  Clique em <strong>Testar</strong> ao lado de qualquer endpoint GET para inspecionar o JSON retornado em tempo real diretamente do banco em nuvem.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
