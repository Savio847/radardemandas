import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Pencil,
  RotateCcw,
  Trash2,
  Building2,
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
              <div className="space-y-2">
                <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
              <div className="h-8 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (demandas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Clock className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-800">
          Nenhuma demanda encontrada
        </h3>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Ajuste a busca por Razão Social ou CNPJ, altere o filtro de situação ou cadastre uma nova demanda com vencimento.
        </p>
        <button
          type="button"
          onClick={aoAbrirNova}
          className="mt-5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30 whitespace-nowrap"
        >
          Nova Demanda
        </button>
      </div>
    );
  }

  return (
    <div
      role="table"
      aria-label="Lista de demandas empresariais"
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xs print:border-slate-300 print:shadow-none"
    >
      <div role="rowgroup" className="hidden lg:block print:block">
        <div
          role="row"
          className="grid grid-cols-12 items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 print:border-slate-300 print:bg-slate-100 print:text-slate-700"
        >
          <div role="columnheader" className="col-span-3 print:col-span-3">
            Empresa · Razão Social e CNPJ
          </div>
          <div role="columnheader" className="col-span-3 print:col-span-3">
            Demanda
          </div>
          <div role="columnheader" className="col-span-2 print:col-span-2">
            Vencimento
          </div>
          <div role="columnheader" className="col-span-1 print:col-span-2">
            Prazo
          </div>
          <div role="columnheader" className="col-span-1 print:col-span-2">
            Situação
          </div>
          <div role="columnheader" className="col-span-2 text-right print:hidden">
            Ações
          </div>
        </div>
      </div>

      <div role="rowgroup" className="divide-y divide-slate-100 p-1 print:divide-slate-200">
        {demandas.map((demanda) => {
          const isConcluido = demanda.status === 'concluido';
          const isVermelhoForte = demanda.alerta === 'vermelho_forte';
          const isVermelhoFraco = demanda.alerta === 'vermelho_fraco';
          const ocupada = atualizandoId === demanda.id;
          const editandoData = editandoVencimentoId === demanda.id;

          const rowAnimationClass = isConcluido
            ? 'bg-slate-50/40 hover:bg-slate-50/80 opacity-90 print:bg-transparent print:opacity-100'
            : isVermelhoForte
              ? 'row-blink-strong rounded-xl print:bg-transparent print:border-l-2 print:border-red-600'
              : isVermelhoFraco
                ? 'row-blink-soft rounded-xl print:bg-transparent print:border-l-2 print:border-amber-500'
                : 'hover:bg-slate-50/60 print:bg-transparent';

          return (
            <div
              key={demanda.id}
              role="row"
              className={`grid grid-cols-1 items-center gap-3 rounded-xl px-5 py-3.5 text-sm transition-colors lg:grid-cols-12 print:grid-cols-12 lg:gap-3 print:gap-2 print:py-2 print:border-b print:border-slate-100 ${rowAnimationClass}`}
            >
              {/* Razão Social e CNPJ */}
              <div role="cell" className="flex items-center gap-3 lg:col-span-3 print:col-span-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 font-semibold text-xs print:hidden">
                  {demanda.razaoSocial ? demanda.razaoSocial.charAt(0).toUpperCase() : <Building2 className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div
                    className={`truncate font-medium ${
                      isConcluido ? 'text-slate-500 line-through print:no-underline' : 'text-slate-900'
                    }`}
                  >
                    {demanda.razaoSocial}
                  </div>
                  <div
                    className={`mt-0.5 font-mono text-xs tabular-nums ${
                      isConcluido ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {demanda.cnpj}
                  </div>
                </div>
              </div>

              {/* Demanda, Responsável e Observações */}
              <div role="cell" className="min-w-0 lg:col-span-3 print:col-span-3">
                <div
                  className={`truncate font-medium ${
                    isConcluido ? 'text-slate-500' : 'text-slate-900'
                  }`}
                >
                  {demanda.titulo}
                </div>
                <div
                  className={`mt-0.5 flex items-center gap-1.5 text-xs ${
                    isConcluido ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <span className="truncate">{demanda.responsavel || 'Equipe'}</span>
                  {demanda.descricao && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="truncate max-w-[140px] print:max-w-none">{demanda.descricao}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Vencimento com Edição Rápida */}
              <div role="cell" className="whitespace-nowrap lg:col-span-2 print:col-span-2">
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
                    className="h-8 rounded-lg border border-blue-400 bg-white px-2.5 font-mono text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    aria-label={`Inserir vencimento para ${demanda.titulo}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditandoVencimentoId(demanda.id)}
                    title="Clique para inserir ou alterar vencimento"
                    className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600 shadow-2xs print:border-none print:shadow-none print:p-0"
                  >
                    <Calendar className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-500 print:hidden" />
                    <span>{formatarDataPtBr(demanda.prazo)}</span>
                  </button>
                )}
              </div>

              {/* Prazo / Alertas */}
              <div role="cell" className="whitespace-nowrap overflow-visible lg:col-span-1 print:col-span-2 min-w-0">
                {isVermelhoForte && (
                  <div className="inline-flex items-center gap-1.5 text-rose-700">
                    <span
                      className="dot-blink-strong inline-block h-2 w-2 shrink-0 rounded-full print:hidden"
                      aria-hidden="true"
                    />
                    <div className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 print:hidden" />
                      <span>{demanda.alertaLabel}</span>
                    </div>
                  </div>
                )}

                {isVermelhoFraco && (
                  <div className="inline-flex items-center gap-1.5 text-amber-700">
                    <span
                      className="dot-blink-soft inline-block h-2 w-2 shrink-0 rounded-full print:hidden"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold whitespace-nowrap">{demanda.alertaLabel}</span>
                  </div>
                )}

                {!isVermelhoForte && !isVermelhoFraco && (
                  <span
                    className={`inline-block text-xs whitespace-nowrap ${
                      isConcluido ? 'font-medium text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {isConcluido ? 'Concluída' : demanda.alertaLabel}
                  </span>
                )}
              </div>

              {/* Situação */}
              <div role="cell" className="whitespace-nowrap overflow-visible lg:col-span-1 print:col-span-2 min-w-0">
                {isConcluido ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 whitespace-nowrap print:bg-transparent print:p-0">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 print:hidden" />
                    <span>Concluída</span>
                  </span>
                ) : demanda.status === 'pendente' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600 whitespace-nowrap print:bg-transparent print:p-0">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 print:hidden" />
                    <span>Pendente</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600 whitespace-nowrap print:bg-transparent print:p-0">
                    <Clock className="h-3 w-3 shrink-0 print:hidden" />
                    <span>Andamento</span>
                  </span>
                )}
              </div>

              {/* Ações (ocultadas na impressão) */}
              <div role="cell" className="flex items-center justify-end gap-1.5 whitespace-nowrap lg:col-span-2 print:hidden">
                <button
                  type="button"
                  disabled={ocupada}
                  onClick={() => aoAlternarStatus(demanda)}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-all whitespace-nowrap disabled:opacity-50 ${
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
                  title="Editar demanda"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
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
                      className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-2.5 text-xs font-medium text-white hover:bg-rose-700 whitespace-nowrap shadow-2xs"
                    >
                      Confirmar
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
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
