import React, { useEffect, useRef, useState } from 'react';
import { X, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DemandaComAlerta, DemandaPayload, DemandaStatus } from '../types/demanda.ts';
import {
  adicionarDiasIso,
  formatarCnpj,
  gerarCnpjValido,
  limparCnpj,
  validarCnpj,
} from '../utils/demandaUtils.ts';

const RASCUNHO_KEY = 'radar_demandas_modal_rascunho';

interface DemandaModalProps {
  aberto: boolean;
  demandaEdicao: DemandaComAlerta | null;
  salvando: boolean;
  erroExterno: string | null;
  aoFechar: () => void;
  aoSalvar: (payload: DemandaPayload, id?: string) => Promise<void>;
  aoAutoSalvarEdicao: (payload: DemandaPayload, id: string) => Promise<boolean>;
}

export function DemandaModal({
  aberto,
  demandaEdicao,
  salvando,
  erroExterno,
  aoFechar,
  aoSalvar,
  aoAutoSalvarEdicao,
}: DemandaModalProps) {
  const [razaoSocial, setRazaoSocial] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [prazo, setPrazo] = useState(adicionarDiasIso(2));
  const [status, setStatus] = useState<DemandaStatus>('andamento');
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [estadoAutoSave, setEstadoAutoSave] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso');

  const inicializadoRef = useRef(false);
  const ultimoSnapshotRef = useRef('');

  useEffect(() => {
    if (!aberto) {
      inicializadoRef.current = false;
      setEstadoAutoSave('ocioso');
      return;
    }

    setErroLocal(null);
    if (demandaEdicao) {
      const cnpjFmt = formatarCnpj(demandaEdicao.cnpj);
      setRazaoSocial(demandaEdicao.razaoSocial);
      setCnpj(cnpjFmt);
      setTitulo(demandaEdicao.titulo);
      setDescricao(demandaEdicao.descricao);
      setResponsavel(demandaEdicao.responsavel);
      setPrazo(demandaEdicao.prazo);
      setStatus(demandaEdicao.status);
      ultimoSnapshotRef.current = JSON.stringify({
        razaoSocial: demandaEdicao.razaoSocial.trim(),
        cnpj: cnpjFmt,
        titulo: demandaEdicao.titulo.trim(),
        descricao: demandaEdicao.descricao.trim(),
        responsavel: demandaEdicao.responsavel.trim() || 'Equipe Operacional',
        prazo: demandaEdicao.prazo,
        status: demandaEdicao.status,
      });
      inicializadoRef.current = true;
    } else {
      let carregado = false;
      try {
        const salvo = localStorage.getItem(RASCUNHO_KEY);
        if (salvo) {
          const parsed = JSON.parse(salvo);
          setRazaoSocial(parsed.razaoSocial || '');
          setCnpj(parsed.cnpj || '');
          setTitulo(parsed.titulo || '');
          setDescricao(parsed.descricao || '');
          setResponsavel(parsed.responsavel || '');
          setPrazo(parsed.prazo || adicionarDiasIso(2));
          setStatus(parsed.status === 'concluido' ? 'concluido' : 'andamento');
          carregado = true;
        }
      } catch {
        // Ignora rascunho inválido
      }
      if (!carregado) {
        setRazaoSocial('');
        setCnpj('');
        setTitulo('');
        setDescricao('');
        setResponsavel('');
        setPrazo(adicionarDiasIso(2));
        setStatus('andamento');
      }
      inicializadoRef.current = true;
    }
  }, [aberto, demandaEdicao]);

  // Auto-save do rascunho no cadastro novo
  useEffect(() => {
    if (!aberto || demandaEdicao || !inicializadoRef.current) return;
    try {
      localStorage.setItem(
        RASCUNHO_KEY,
        JSON.stringify({ razaoSocial, cnpj, titulo, descricao, responsavel, prazo, status })
      );
    } catch {
      // Ignora erro de quota
    }
  }, [aberto, demandaEdicao, razaoSocial, cnpj, titulo, descricao, responsavel, prazo, status]);

  // Auto-save em tempo real durante a edição de uma demanda existente
  useEffect(() => {
    if (!aberto || !demandaEdicao || !inicializadoRef.current) return;

    const payload: DemandaPayload = {
      razaoSocial: razaoSocial.trim(),
      cnpj: formatarCnpj(cnpj),
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      responsavel: responsavel.trim() || 'Equipe Operacional',
      prazo,
      status,
    };

    const snapshotAtual = JSON.stringify(payload);
    if (snapshotAtual === ultimoSnapshotRef.current) return;

    const valido =
      payload.razaoSocial.length >= 2 &&
      validarCnpj(payload.cnpj) &&
      payload.titulo.length >= 3 &&
      Boolean(payload.prazo);

    if (!valido) return;

    const timer = setTimeout(async () => {
      setEstadoAutoSave('salvando');
      const ok = await aoAutoSalvarEdicao(payload, demandaEdicao.id);
      if (ok) {
        ultimoSnapshotRef.current = snapshotAtual;
        setEstadoAutoSave('salvo');
      } else {
        setEstadoAutoSave('ocioso');
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    aberto,
    demandaEdicao,
    razaoSocial,
    cnpj,
    titulo,
    descricao,
    responsavel,
    prazo,
    status,
    aoAutoSalvarEdicao,
  ]);

  if (!aberto) return null;

  const cnpjLimpo = limparCnpj(cnpj);
  const cnpjValido = cnpjLimpo.length === 14 && validarCnpj(cnpj);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroLocal(null);

    if (razaoSocial.trim().length < 2) {
      setErroLocal('Informe a Razão Social da empresa.');
      return;
    }
    if (!validarCnpj(cnpj)) {
      setErroLocal('CNPJ inválido. Digite 14 dígitos válidos ou clique em "Gerar CNPJ".');
      return;
    }
    if (titulo.trim().length < 3) {
      setErroLocal('Informe o título da demanda.');
      return;
    }
    if (!prazo) {
      setErroLocal('Insira a data de vencimento.');
      return;
    }

    const payload: DemandaPayload = {
      razaoSocial: razaoSocial.trim(),
      cnpj: formatarCnpj(cnpj),
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      responsavel: responsavel.trim() || 'Equipe Operacional',
      prazo,
      status,
    };

    if (!demandaEdicao) {
      try {
        localStorage.removeItem(RASCUNHO_KEY);
      } catch {
        // Ignora
      }
    }

    await aoSalvar(payload, demandaEdicao?.id);
  };

  const mensagemErro = erroLocal || erroExterno;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-demanda-titulo"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4 rounded-t-3xl">
          <div>
            <h2 id="modal-demanda-titulo" className="text-base font-bold text-slate-900">
              {demandaEdicao ? 'Editar Demanda' : 'Nova Demanda Empresarial'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {demandaEdicao
                ? 'Qualquer alteração válida é salva automaticamente.'
                : 'O rascunho e o cadastro são salvos automaticamente.'}
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar janela"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {mensagemErro && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <span>{mensagemErro}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="razao-social" className="block text-xs font-semibold text-slate-700">
                Razão Social *
              </label>
              <input
                id="razao-social"
                type="text"
                required
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex.: Horizonte Logística e Transportes Ltda."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="cnpj" className="block text-xs font-semibold text-slate-700">
                  CNPJ *
                </label>
                <button
                  type="button"
                  onClick={() => setCnpj(gerarCnpjValido())}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                >
                  <RefreshCw className="h-3 w-3" />
                  Gerar CNPJ válido
                </button>
              </div>
              <input
                id="cnpj"
                type="text"
                required
                value={cnpj}
                onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
              />
              {cnpjLimpo.length === 14 && (
                <p
                  className={`mt-1 text-xs font-medium ${
                    cnpjValido ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {cnpjValido ? '✓ CNPJ válido' : '✕ Dígitos verificadores inválidos'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="responsavel" className="block text-xs font-semibold text-slate-700">
                Responsável
              </label>
              <input
                id="responsavel"
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Ex.: Mariana Alencar"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="titulo-demanda" className="block text-xs font-semibold text-slate-700">
              Título da Demanda *
            </label>
            <input
              id="titulo-demanda"
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Entrega da DCTFWeb e conferência de INSS"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
            />
          </div>

          <div>
            <label htmlFor="descricao-demanda" className="block text-xs font-semibold text-slate-700">
              Observações
            </label>
            <textarea
              id="descricao-demanda"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes operacionais ou número de protocolo..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prazo-demanda" className="block text-xs font-semibold text-slate-700">
                Inserir Vencimento *
              </label>
              <input
                id="prazo-demanda"
                type="date"
                required
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 font-mono text-sm tabular-nums text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(-1))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(0))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(2))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  +2 dias
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(5))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  +5 dias
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(15))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  +15 dias
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700">Situação *</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setStatus('andamento')}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                    status === 'andamento'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Em Andamento
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('concluido')}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                    status === 'concluido'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Concluída
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Demandas concluídas ficam em verde; em andamento próximas do prazo tremem e piscam.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-xs">
              {demandaEdicao && estadoAutoSave === 'salvando' && (
                <span className="text-slate-400">Salvando automaticamente...</span>
              )}
              {demandaEdicao && estadoAutoSave === 'salvo' && (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Salvo automaticamente
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={aoFechar}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 shadow-2xs"
              >
                {demandaEdicao ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {salvando
                  ? 'Salvando...'
                  : demandaEdicao
                    ? 'Salvar e Fechar'
                    : 'Cadastrar Demanda'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
