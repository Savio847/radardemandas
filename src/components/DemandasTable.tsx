import React, { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { DemandaComAlerta } from '../types/demanda.ts';
import { formatarDataPtBr } from '../utils/demandaUtils.ts';

interface DemandasTableProps {
  demandas: DemandaComAlerta[];
  carregando: boolean;
  atualizandoId: string | null;
  aoAlternarStatus: (demanda: DemandaComAlerta) => Promise<void>;
  aoAtualizarVencimento: (id: string, novoPrazo: string) => Promise<void>;
  aoEditar: (demanda: DemandaComAlerta) => void;
  aoExcluir: (id: string) => Promise<void>;
  aoAbrirNova: () => void;
}

export function DemandasTable({
  demandas,
  carregando,
  atualizandoId,
  aoAlternarStatus,
  aoAtualizarVencimento,
  aoEditar,
  aoExcluir,
  aoAbrirNova,
}: DemandasTableProps) {
  const [confirmarExclusaoId, setConfirmarExclusaoId] = useState<string | null>(null);
  const [editandoVencimentoId, setEditandoVencimentoId] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs">
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
                <div className="space-y-1.5">
                  <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
              <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
              <div className="h-8 w-24 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (demandas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Clock className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800">
          Nenhuma demanda encontrada
        </h3>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Ajuste os filtros de busca ou cadastre uma nova obrigação com prazo e responsável.
        </p>
        <button
          type="button"
          onClick={aoAbrirNova}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30"
        >
          <Sparkles className="h-4 w-4" />
          Cadastrar Demanda
        </button>
      </div>
    );
  }

  return (
    <div
      role="table"
      aria-label="Lista de demandas empresariais"
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs"
    >
      <div role="rowgroup" className="hidden lg:block">
        <div
          role="row"
          className="grid grid-cols-12 items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        >
          <div role="columnheader" className="col-span-1">
            ID
          </div>
          <div role="columnheader" className="col-span-3">
            Empresa / Razão Social
          </div>
          <div role="columnheader" className="col-span-3">
            Demanda & Responsável
          </div>
          <div role="columnheader" className="col-span-2">
            Vencimento
          </div>
          <div role="columnheader" className="col-span-1">
            Status
          </div>
          <div role="columnheader" className="col-span-2 text-right">
            Ações
          </div>
        </div>
      </div>

      <div role="rowgroup" className="divide-y divide-slate-100">
        {demandas.map((demanda, index) => {
          const isConcluido = demanda.status === 'concluido';
          const isVermelhoForte = demanda.alerta === 'vermelho_forte';
          const isVermelhoFraco = demanda.alerta === 'vermelho_fraco';
          const ocupada = atualizandoId === demanda.id;
          const editandoData = editandoVencimentoId === demanda.id;

          const rowStateClass = isConcluido
            ? 'bg-slate-50/40 hover:bg-slate-50/80 opacity-90'
            : isVermelhoForte
              ? 'row-blink-strong'
              : isVermelhoFraco
                ? 'row-blink-soft'
                : 'hover:bg-slate-50/70';

          // Visual short ID matching #83009 from the screenshot
          const shortId = `#${(demanda.id || String(index + 1)).replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase() || '830' + (index + 1)}`;

          return (
            <div
              key={demanda.id}
              role="row"
              className={`grid grid-cols-1 items-center gap-3 px-6 py-3.5 text-sm transition-colors lg:grid-cols-12 lg:gap-4 ${rowStateClass}`}
            >
              {/* Short ID */}
              <div role="cell" className="font-mono text-xs font-medium text-slate-400 lg:col-span-1">
                {shortId}
              </div>

              {/* Empresa & CNPJ */}
              <div role="cell" className="flex items-center gap-3 lg:col-span-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-semibold text-xs">
                  {demanda.razaoSocial ? demanda.razaoSocial.charAt(0).toUpperCase() : <Building2 className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className={`truncate font-medium ${isConcluido ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {demanda.razaoSocial}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {demanda.cnpj}
                  </div>
                </div>
              </div>

              {/* Demanda & Responsável */}
              <div role="cell" className="min-w-0 lg:col-span-3">
                <div className={`truncate font-medium ${isConcluido ? 'text-slate-500' : 'text-slate-800'}`}>
                  {demanda.titulo}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="truncate">{demanda.responsavel || 'Equipe'}</span>
                  {demanda.descricao && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[140px]">{demanda.descricao}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Vencimento */}
              <div role="cell" className="whitespace-nowrap lg:col-span-2">
                {editandoData ? (
                  <input
                    type="date"
                    defaultValue={demanda.prazo}
                    autoFocus
                    disabled={ocupada}
                    onChange={async (e) => {
                      const valor = e.target.value;
                      if (valor && valor !== demanda.prazo) {
                        await aoAtualizarVencimento(demanda.id, valor);
                      }
                      setEditandoVencimentoId(null);
                    }}
                    onBlur={() => setEditandoVencimentoId(null)}
                    className="h-8 rounded-lg border border-blue-400 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    aria-label={`Alterar vencimento para ${demanda.titulo}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditandoVencimentoId(demanda.id)}
                    title="Clique para alterar vencimento"
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600 shadow-2xs"
                  >
                    <Calendar className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500" />
                    <span>{formatarDataPtBr(demanda.prazo)}</span>
                  </button>
                )}
              </div>

              {/* Status / Alerta Badge */}
              <div role="cell" className="whitespace-nowrap lg:col-span-1">
                {isConcluido ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluído
                  </span>
                ) : isVermelhoForte ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-600">
                    <AlertTriangle className="h-3 w-3" />
                    {demanda.alertaLabel || 'Crítico'}
                  </span>
                ) : isVermelhoFraco ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <Clock className="h-3 w-3" />
                    {demanda.alertaLabel || 'Atenção'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">
                    <Clock className="h-3 w-3" />
                    Em dia
                  </span>
                )}
              </div>

              {/* Ações */}
              <div role="cell" className="flex items-center justify-end gap-1.5 whitespace-nowrap lg:col-span-2">
                <button
                  type="button"
                  disabled={ocupada}
                  onClick={() => aoAlternarStatus(demanda)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all ${
                    isConcluido
                      ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                  }`}
                  title={isConcluido ? 'Reabrir demanda' : 'Marcar como concluída'}
                >
                  {isConcluido ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reabrir
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluir
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={ocupada}
                  onClick={() => aoEditar(demanda)}
                  aria-label={`Editar demanda ${demanda.titulo}`}
                  title="Editar dados da demanda"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                {confirmarExclusaoId === demanda.id ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={ocupada}
                      onClick={async () => {
                        await aoExcluir(demanda.id);
                        setConfirmarExclusaoId(null);
                      }}
                      className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-2.5 text-xs font-medium text-white hover:bg-rose-700 shadow-2xs"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarExclusaoId(null)}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={ocupada}
                    onClick={() => setConfirmarExclusaoId(demanda.id)}
                    aria-label={`Excluir demanda ${demanda.titulo}`}
                    title="Excluir demanda"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
