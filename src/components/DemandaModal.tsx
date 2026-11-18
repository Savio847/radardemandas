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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#24060e]/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-demanda-titulo"
    >
      <div className="w-full max-w-xl rounded-xl border border-[#e8d5da] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e8d5da] bg-[#faf2f4] px-6 py-4 rounded-t-xl">
          <div>
            <h2 id="modal-demanda-titulo" className="text-lg font-semibold text-[#2b0b13]">
              {demandaEdicao ? 'Editar Demanda' : 'Nova Demanda Empresarial'}
            </h2>
            <p className="mt-0.5 text-xs text-[#6e4c55]">
              {demandaEdicao
                ? 'Qualquer alteração válida é salva automaticamente.'
                : 'O rascunho e o cadastro são salvos automaticamente.'}
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#6e4c55] transition-colors hover:bg-[#f0dfe3] hover:text-[#2b0b13]"
            aria-label="Fechar janela"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {mensagemErro && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{mensagemErro}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="razao-social" className="block text-xs font-medium text-[#4a202b]">
                Razão Social *
              </label>
              <input
                id="razao-social"
                type="text"
                required
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex.: Horizonte Logística e Transportes Ltda."
                className="mt-1.5 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 py-2 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="cnpj" className="block text-xs font-medium text-[#4a202b]">
                  CNPJ *
                </label>
                <button
                  type="button"
                  onClick={() => setCnpj(gerarCnpjValido())}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#6e162e] hover:text-[#3b0a17]"
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
                className="mt-1.5 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 py-2 font-mono text-sm tabular-nums text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
              />
              {cnpjLimpo.length === 14 && (
                <p
                  className={`mt-1 text-xs ${
                    cnpjValido ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {cnpjValido ? 'CNPJ válido' : 'Dígitos verificadores inválidos'}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="responsavel" className="block text-xs font-medium text-[#4a202b]">
                Responsável
              </label>
              <input
                id="responsavel"
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Ex.: Mariana Alencar"
                className="mt-1.5 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 py-2 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="titulo-demanda" className="block text-xs font-medium text-[#4a202b]">
              Título da Demanda *
            </label>
            <input
              id="titulo-demanda"
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Entrega da DCTFWeb e conferência de INSS"
              className="mt-1.5 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 py-2 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="descricao-demanda" className="block text-xs font-medium text-[#4a202b]">
              Observações
            </label>
            <textarea
              id="descricao-demanda"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes operacionais ou número de protocolo..."
              className="mt-1.5 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 py-2 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prazo-demanda" className="block text-xs font-medium text-[#4a202b]">
                Inserir Vencimento *
              </label>
              <input
                id="prazo-demanda"
                type="date"
                required
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 py-2 font-mono text-sm tabular-nums text-[#2b0b13] focus:border-[#5e1024] focus:bg-white focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(-1))}
                  className="rounded-md border border-[#e4cfd5] bg-[#faf2f4] px-2 py-1 text-[11px] font-medium text-[#4a202b] hover:bg-[#f2e2e6]"
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(0))}
                  className="rounded-md border border-[#e4cfd5] bg-[#faf2f4] px-2 py-1 text-[11px] font-medium text-[#4a202b] hover:bg-[#f2e2e6]"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(2))}
                  className="rounded-md border border-[#e4cfd5] bg-[#faf2f4] px-2 py-1 text-[11px] font-medium text-[#4a202b] hover:bg-[#f2e2e6]"
                >
                  +2 dias
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(5))}
                  className="rounded-md border border-[#e4cfd5] bg-[#faf2f4] px-2 py-1 text-[11px] font-medium text-[#4a202b] hover:bg-[#f2e2e6]"
                >
                  +5 dias
                </button>
                <button
                  type="button"
                  onClick={() => setPrazo(adicionarDiasIso(15))}
                  className="rounded-md border border-[#e4cfd5] bg-[#faf2f4] px-2 py-1 text-[11px] font-medium text-[#4a202b] hover:bg-[#f2e2e6]"
                >
                  +15 dias
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#4a202b]">Situação *</span>
              <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg border border-[#e8d5da] bg-[#f3e7ea] p-1">
                <button
                  type="button"
                  onClick={() => setStatus('andamento')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    status === 'andamento'
                      ? 'bg-[#5e1024] text-white shadow-xs'
                      : 'text-[#5b353f] hover:text-[#2b0b13]'
                  }`}
                >
                  Em Andamento
                </button>
                <button
                  type="button"
                  onClick={() => setStatus('concluido')}
                  className={`rounded-md px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    status === 'concluido'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-[#5b353f] hover:text-[#2b0b13]'
                  }`}
                >
                  Concluída
                </button>
              </div>
              <p className="mt-2 text-xs text-[#6e4c55]">
                Demandas concluídas ficam em verde; em andamento próximas do prazo tremem e piscam.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#e8d5da] pt-4">
            <div className="text-xs">
              {demandaEdicao && estadoAutoSave === 'salvando' && (
                <span className="text-[#6e4c55]">Salvando automaticamente...</span>
              )}
              {demandaEdicao && estadoAutoSave === 'salvo' && (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Salvo automaticamente
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={aoFechar}
                className="rounded-lg border border-[#e4cfd5] bg-white px-4 py-2 text-sm font-medium text-[#4a202b] transition-colors hover:bg-[#faf2f4] whitespace-nowrap shrink-0"
              >
                {demandaEdicao ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-[#5e1024] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#490b1b] disabled:opacity-50 whitespace-nowrap shrink-0"
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
