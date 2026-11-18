import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Pencil,
  RotateCcw,
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
      <div className="overflow-hidden rounded-xl border border-[#e8d5da] bg-white/75 backdrop-blur-[1.5px]">
        <div className="divide-y divide-[#f2e6e9]">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex items-center justify-between gap-4 px-6 py-4">
              <div className="space-y-2">
                <div className="h-4 w-56 animate-pulse rounded bg-[#ebd8dd]" />
                <div className="h-3 w-36 animate-pulse rounded bg-[#f5ebee]" />
              </div>
              <div className="h-4 w-48 animate-pulse rounded bg-[#f5ebee]" />
              <div className="h-4 w-28 animate-pulse rounded bg-[#f5ebee]" />
              <div className="h-8 w-24 animate-pulse rounded bg-[#f5ebee]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (demandas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[#e8d5da] bg-white/75 px-6 py-16 text-center backdrop-blur-[1.5px]">
        <Clock className="h-9 w-9 text-[#9c7b84]" />
        <h3 className="mt-3 text-base font-semibold text-[#2b0b13]">
          Nenhuma demanda encontrada
        </h3>
        <p className="mt-1 max-w-md text-sm text-[#6e4c55]">
          Ajuste a busca por Razão Social ou CNPJ, altere o filtro de situação ou cadastre uma nova demanda com vencimento.
        </p>
        <button
          type="button"
          onClick={aoAbrirNova}
          className="mt-5 rounded-lg bg-[#5e1024] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#490b1b] whitespace-nowrap"
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
      className="rounded-xl border border-[#e8d5da] bg-white/75 backdrop-blur-[1.5px]"
    >
      <div role="rowgroup" className="hidden lg:block">
        <div
          role="row"
          className="grid grid-cols-12 items-center gap-4 rounded-t-xl border-b border-[#e8d5da] bg-[#f7eef0]/90 px-5 py-3.5 text-xs font-medium text-[#5b353f]"
        >
          <div role="columnheader" className="col-span-3">
            Empresa · Razão Social e CNPJ
          </div>
          <div role="columnheader" className="col-span-3">
            Demanda
          </div>
          <div role="columnheader" className="col-span-2">
            Vencimento
          </div>
          <div role="columnheader" className="col-span-1">
            Prazo
          </div>
          <div role="columnheader" className="col-span-1">
            Situação
          </div>
          <div role="columnheader" className="col-span-2 text-right">
            Ações
          </div>
        </div>
      </div>

      <div role="rowgroup" className="space-y-1.5 p-2">
        {demandas.map((demanda) => {
          const isConcluido = demanda.status === 'concluido';
          const isVermelhoForte = demanda.alerta === 'vermelho_forte';
          const isVermelhoFraco = demanda.alerta === 'vermelho_fraco';
          const ocupada = atualizandoId === demanda.id;
          const editandoData = editandoVencimentoId === demanda.id;

          const rowAnimationClass = isConcluido
            ? 'bg-emerald-50/95 hover:bg-emerald-100/90 border border-emerald-200'
            : isVermelhoForte
              ? 'row-blink-strong rounded-lg'
              : isVermelhoFraco
                ? 'row-blink-soft rounded-lg'
                : 'bg-white/70 hover:bg-[#fcf6f7] border border-[#f0e1e5]';

          return (
            <div
              key={demanda.id}
              role="row"
              className={`grid grid-cols-1 items-center gap-3 rounded-lg px-4 py-3.5 text-sm transition-colors lg:grid-cols-12 lg:gap-4 ${rowAnimationClass}`}
            >
              <div role="cell" className="lg:col-span-3">
                <div
                  className={`font-medium ${
                    isConcluido ? 'text-emerald-950' : 'text-[#2b0b13]'
                  }`}
                >
                  {demanda.razaoSocial}
                </div>
                <div
                  className={`mt-0.5 font-mono text-xs tabular-nums ${
                    isConcluido ? 'text-emerald-700' : 'text-[#6e4c55]'
                  }`}
                >
                  {demanda.cnpj}
                </div>
              </div>

              <div role="cell" className="min-w-0 lg:col-span-3">
                <div
                  className={`font-medium ${
                    isConcluido ? 'text-emerald-950' : 'text-[#2b0b13]'
                  }`}
                >
                  {demanda.titulo}
                </div>
                <div
                  className={`mt-0.5 flex items-center gap-1.5 text-xs ${
                    isConcluido ? 'text-emerald-700' : 'text-[#6e4c55]'
                  }`}
                >
                  <span className="truncate">{demanda.responsavel}</span>
                  {demanda.descricao && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{demanda.descricao}</span>
                    </>
                  )}
                </div>
              </div>

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
                    className="h-8 rounded-md border border-[#d4b6bf] bg-white px-2 font-mono text-xs tabular-nums text-[#2b0b13] focus:border-[#5e1024] focus:outline-none"
                    aria-label={`Inserir vencimento para ${demanda.titulo}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditandoVencimentoId(demanda.id)}
                    title="Clique para inserir ou alterar vencimento"
                    className={`group inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                      isConcluido
                        ? 'border-emerald-300 bg-emerald-100/80 font-medium text-emerald-900 hover:bg-emerald-200/70'
                        : isVermelhoForte
                          ? 'border-red-300 bg-red-50/90 font-semibold text-red-900 hover:bg-red-100'
                          : isVermelhoFraco
                            ? 'border-rose-200 bg-rose-50/80 font-semibold text-rose-800 hover:bg-rose-100'
                            : 'border-[#e4cfd5] bg-white text-[#4a202b] hover:border-[#c9a3ae] hover:bg-[#faf2f4]'
                    }`}
                  >
                    <Calendar className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" />
                    <span>{formatarDataPtBr(demanda.prazo)}</span>
                  </button>
                )}
              </div>

              <div role="cell" className="whitespace-nowrap lg:col-span-1">
                {isVermelhoForte && (
                  <div className="flex items-center gap-2 text-red-800">
                    <span
                      className="dot-blink-strong inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <div className="flex items-center gap-1 text-xs font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-700" />
                      <span>{demanda.alertaLabel}</span>
                    </div>
                  </div>
                )}

                {isVermelhoFraco && (
                  <div className="flex items-center gap-2 text-rose-800">
                    <span
                      className="dot-blink-soft inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold">{demanda.alertaLabel}</span>
                  </div>
                )}

                {!isVermelhoForte && !isVermelhoFraco && (
                  <span
                    className={`text-xs ${
                      isConcluido ? 'font-medium text-emerald-800' : 'text-[#6e4c55]'
                    }`}
                  >
                    {isConcluido ? 'Concluída' : demanda.alertaLabel}
                  </span>
                )}
              </div>

              <div role="cell" className="whitespace-nowrap lg:col-span-1">
                {isConcluido ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    Concluída
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4a202b]">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#7f3447]" />
                    Andamento
                  </span>
                )}
              </div>

              <div role="cell" className="flex items-center justify-end gap-1.5 whitespace-nowrap lg:col-span-2">
                <button
                  type="button"
                  disabled={ocupada}
                  onClick={() => aoAlternarStatus(demanda)}
                  className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${
                    isConcluido
                      ? 'border-[#e4cfd5] bg-white text-[#4a202b] hover:bg-[#faf2f4]'
                      : 'border-emerald-700/20 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  }`}
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
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#e4cfd5] bg-white text-[#5b353f] transition-colors hover:bg-[#faf2f4] hover:text-[#2b0b13]"
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
                      className="inline-flex h-8 items-center rounded-md bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700 whitespace-nowrap"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmarExclusaoId(null)}
                      className="inline-flex h-8 items-center rounded-md border border-[#e4cfd5] bg-white px-2 text-xs text-[#5b353f] hover:bg-[#faf2f4]"
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
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#e4cfd5] bg-white text-[#6e4c55] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
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
