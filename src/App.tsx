import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  CalendarPlus,
  CheckCircle2,
  LogOut,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { auth, googleProvider } from './firebase.ts';
import type {
  Demanda,
  DemandaComAlerta,
  DemandaPayload,
  DemandasMeta,
  DemandaStatus,
} from './types/demanda.ts';
import {
  adicionarDiasIso,
  dataHojeIsoLocal,
  enriquecerDemanda,
  formatarCnpj,
  gerarCnpjValido,
  limparCnpj,
  validarCnpj,
} from './utils/demandaUtils.ts';
import {
  alternarStatusFirestore,
  assinarDemandasEmTempoReal,
  atualizarVencimentoFirestore,
  criarDemandaFirestore,
  editarDemandaFirestore,
  excluirDemandaFirestore,
  garantirPerfilUsuario,
  semearDemandasIniciaisSeVazio,
} from './services/demandasFirestore.ts';
import { DemandasTable } from './components/DemandasTable.tsx';
import { DemandaModal } from './components/DemandaModal.tsx';
import { ApiExplorerView } from './components/ApiExplorerView.tsx';
import { AccountingBackground } from './components/AccountingBackground.tsx';
import { AuthGate } from './components/AuthGate.tsx';

type AbaAtiva = 'demandas' | 'api';
type FiltroStatus = 'todos' | DemandaStatus;

const RAPIDA_RASCUNHO_KEY = 'radar_demandas_rapida_rascunho';

export default function App() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [entrando, setEntrando] = useState(false);
  const [erroAuth, setErroAuth] = useState<string | null>(null);
  const [erroFatalFirestore, setErroFatalFirestore] = useState<Error | null>(null);

  const [aba, setAba] = useState<AbaAtiva>('demandas');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');

  const [todasDemandasRaw, setTodasDemandasRaw] = useState<Demanda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [modalAberto, setModalAberto] = useState(false);
  const [demandaEdicao, setDemandaEdicao] = useState<DemandaComAlerta | null>(null);
  const [salvandoModal, setSalvandoModal] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);
  const [avisoSalvo, setAvisoSalvo] = useState<string | null>(null);

  const [rapidaRazao, setRapidaRazao] = useState(() => {
    try {
      const s = localStorage.getItem(RAPIDA_RASCUNHO_KEY);
      return s ? JSON.parse(s).razaoSocial || '' : '';
    } catch {
      return '';
    }
  });
  const [rapidaCnpj, setRapidaCnpj] = useState(() => {
    try {
      const s = localStorage.getItem(RAPIDA_RASCUNHO_KEY);
      return s ? JSON.parse(s).cnpj || '' : '';
    } catch {
      return '';
    }
  });
  const [rapidaTitulo, setRapidaTitulo] = useState(() => {
    try {
      const s = localStorage.getItem(RAPIDA_RASCUNHO_KEY);
      return s ? JSON.parse(s).titulo || '' : '';
    } catch {
      return '';
    }
  });
  const [rapidaVencimento, setRapidaVencimento] = useState(() => {
    try {
      const s = localStorage.getItem(RAPIDA_RASCUNHO_KEY);
      return s ? JSON.parse(s).vencimento || adicionarDiasIso(1) : adicionarDiasIso(1);
    } catch {
      return adicionarDiasIso(1);
    }
  });
  const [salvandoRapida, setSalvandoRapida] = useState(false);
  const [erroRapida, setErroRapida] = useState<string | null>(null);

  const notificarSalvo = useCallback((texto: string) => {
    setAvisoSalvo(texto);
  }, []);

  useEffect(() => {
    if (!avisoSalvo) return;
    const t = setTimeout(() => setAvisoSalvo(null), 2600);
    return () => clearTimeout(t);
  }, [avisoSalvo]);

  useEffect(() => {
    try {
      localStorage.setItem(
        RAPIDA_RASCUNHO_KEY,
        JSON.stringify({
          razaoSocial: rapidaRazao,
          cnpj: rapidaCnpj,
          titulo: rapidaTitulo,
          vencimento: rapidaVencimento,
        })
      );
    } catch {
      // Ignora erro de armazenamento
    }
  }, [rapidaRazao, rapidaCnpj, rapidaTitulo, rapidaVencimento]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaAplicada(busca.trim().toLowerCase());
    }, 180);
    return () => clearTimeout(timer);
  }, [busca]);

  // Monitorar autenticação Google e preparar perfil + assinatura em tempo real
  useEffect(() => {
    let cancelarSnapshot: (() => void) | null = null;
    let ativo = true;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (cancelarSnapshot) {
        cancelarSnapshot();
        cancelarSnapshot = null;
      }

      if (!ativo) return;

      if (!user) {
        setUsuario(null);
        setTodasDemandasRaw([]);
        setCarregando(false);
        setCarregandoAuth(false);
        return;
      }

      setUsuario(user);
      setCarregandoAuth(false);
      setCarregando(true);
      setErroCarga(null);

      try {
        await garantirPerfilUsuario(user);
        await semearDemandasIniciaisSeVazio(user);

        if (!ativo) return;

        cancelarSnapshot = assinarDemandasEmTempoReal(
          (lista) => {
            if (!ativo) return;
            setTodasDemandasRaw(lista);
            setCarregando(false);
            setErroCarga(null);
          },
          (err) => {
            if (!ativo) return;
            setCarregando(false);
            setErroFatalFirestore(err);
          }
        );
      } catch (err) {
        if (!ativo) return;
        setCarregando(false);
        setErroFatalFirestore(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => {
      ativo = false;
      unsubscribeAuth();
      if (cancelarSnapshot) cancelarSnapshot();
    };
  }, []);

  const handleEntrar = async () => {
    setEntrando(true);
    setErroAuth(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      const msg = err instanceof Error ? err.message : '';
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const dominio = typeof window !== 'undefined' ? window.location.hostname : '';
        setErroAuth(
          `Domínio "${dominio}" ainda não autorizado no Firebase Authentication (Settings > Authorized domains).`
        );
      } else if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
        setErroAuth('A janela de login foi fechada antes da conclusão. Tente novamente.');
      } else if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
        setErroAuth('O navegador bloqueou o pop-up de login. Libere os pop-ups para continuar.');
      } else {
        setErroAuth('Não foi possível entrar com sua conta Google. Tente novamente.');
      }
    } finally {
      setEntrando(false);
    }
  };

  const handleSair = async () => {
    await signOut(auth);
  };

  const { demandas, meta } = useMemo(() => {
    const agora = new Date();
    const enriquecidas = todasDemandasRaw.map((d) => enriquecerDemanda(d, agora));

    let andamento = 0;
    let concluido = 0;
    let vermelhoForte = 0;
    let vermelhoFraco = 0;
    let emDia = 0;

    for (const item of enriquecidas) {
      if (item.status === 'concluido') {
        concluido += 1;
      } else {
        andamento += 1;
        if (item.alerta === 'vermelho_forte') vermelhoForte += 1;
        else if (item.alerta === 'vermelho_fraco') vermelhoFraco += 1;
        else emDia += 1;
      }
    }

    const metaCalculada: DemandasMeta = {
      total: enriquecidas.length,
      andamento,
      concluido,
      vermelhoForte,
      vermelhoFraco,
      emDia,
      referenciaHoje: dataHojeIsoLocal(agora),
    };

    let filtradas = enriquecidas;
    if (filtroStatus !== 'todos') {
      filtradas = filtradas.filter((d) => d.status === filtroStatus);
    }

    if (buscaAplicada.length > 0) {
      const buscaDigits = limparCnpj(buscaAplicada);
      filtradas = filtradas.filter((d) => {
        const matchTexto =
          d.razaoSocial.toLowerCase().includes(buscaAplicada) ||
          d.titulo.toLowerCase().includes(buscaAplicada) ||
          d.descricao.toLowerCase().includes(buscaAplicada) ||
          d.responsavel.toLowerCase().includes(buscaAplicada) ||
          d.cnpj.toLowerCase().includes(buscaAplicada);
        const matchDigits =
          buscaDigits.length >= 2 && limparCnpj(d.cnpj).includes(buscaDigits);
        return matchTexto || matchDigits;
      });
    }

    const ordenadas = [...filtradas].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'andamento' ? -1 : 1;
      }
      return a.prazo.localeCompare(b.prazo);
    });

    return { demandas: ordenadas, meta: metaCalculada };
  }, [todasDemandasRaw, filtroStatus, buscaAplicada]);

  const abrirNovaDemanda = () => {
    setDemandaEdicao(null);
    setErroModal(null);
    setModalAberto(true);
  };

  const abrirEdicao = (demanda: DemandaComAlerta) => {
    setDemandaEdicao(demanda);
    setErroModal(null);
    setModalAberto(true);
  };

  const handleSalvarModal = async (payload: DemandaPayload, id?: string) => {
    if (!usuario) return;
    setSalvandoModal(true);
    setErroModal(null);
    try {
      if (id) {
        const atual = todasDemandasRaw.find((d) => d.id === id);
        await editarDemandaFirestore(
          id,
          payload,
          atual?.status ?? 'andamento',
          usuario
        );
      } else {
        await criarDemandaFirestore(payload, usuario);
      }
      setModalAberto(false);
      notificarSalvo(
        id ? 'Alteração salva e sincronizada para todos' : 'Cadastro salvo e sincronizado para todos'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar demanda.';
      if (msg.startsWith('{')) {
        setErroFatalFirestore(err instanceof Error ? err : new Error(msg));
        return;
      }
      setErroModal(msg);
    } finally {
      setSalvandoModal(false);
    }
  };

  const handleAutoSalvarEdicao = useCallback(
    async (payload: DemandaPayload, id: string): Promise<boolean> => {
      if (!usuario) return false;
      try {
        const atual = todasDemandasRaw.find((d) => d.id === id);
        await editarDemandaFirestore(
          id,
          payload,
          atual?.status ?? 'andamento',
          usuario
        );
        setErroModal(null);
        notificarSalvo('Alteração salva para todos');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao salvar alteração.';
        if (msg.startsWith('{')) {
          setErroFatalFirestore(err instanceof Error ? err : new Error(msg));
          return false;
        }
        setErroModal(msg);
        return false;
      }
    },
    [usuario, todasDemandasRaw, notificarSalvo]
  );

  const handleInsercaoRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario) return;
    setErroRapida(null);

    if (rapidaRazao.trim().length < 2) {
      setErroRapida('Informe a Razão Social.');
      return;
    }
    if (!validarCnpj(rapidaCnpj)) {
      setErroRapida('CNPJ inválido. Informe 14 dígitos válidos ou gere um CNPJ.');
      return;
    }
    if (rapidaTitulo.trim().length < 3) {
      setErroRapida('Informe a descrição da demanda.');
      return;
    }
    if (!rapidaVencimento) {
      setErroRapida('Insira a data de vencimento.');
      return;
    }

    setSalvandoRapida(true);
    try {
      await criarDemandaFirestore(
        {
          razaoSocial: rapidaRazao.trim(),
          cnpj: formatarCnpj(rapidaCnpj),
          titulo: rapidaTitulo.trim(),
          prazo: rapidaVencimento,
          status: 'andamento',
        },
        usuario
      );
      setRapidaRazao('');
      setRapidaCnpj('');
      setRapidaTitulo('');
      try {
        localStorage.removeItem(RAPIDA_RASCUNHO_KEY);
      } catch {
        // Ignora
      }
      notificarSalvo('Cadastro salvo e sincronizado para todos');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao inserir demanda.';
      if (msg.startsWith('{')) {
        setErroFatalFirestore(err instanceof Error ? err : new Error(msg));
        return;
      }
      setErroRapida(msg);
    } finally {
      setSalvandoRapida(false);
    }
  };

  const handleAlternarStatus = async (demanda: DemandaComAlerta) => {
    if (!usuario) return;
    setAtualizandoId(demanda.id);
    try {
      const novoStatus = await alternarStatusFirestore(demanda, usuario);
      notificarSalvo(
        novoStatus === 'concluido'
          ? 'Demanda concluída e sincronizada para todos'
          : 'Demanda reaberta e sincronizada para todos'
      );
    } catch (err) {
      setErroFatalFirestore(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setAtualizandoId(null);
    }
  };

  const handleAtualizarVencimento = async (id: string, novoPrazo: string) => {
    if (!usuario) return;
    setAtualizandoId(id);
    try {
      await atualizarVencimentoFirestore(id, novoPrazo, usuario);
      notificarSalvo('Vencimento salvo e sincronizado para todos');
    } catch (err) {
      setErroFatalFirestore(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setAtualizandoId(null);
    }
  };

  const handleExcluir = async (id: string) => {
    setAtualizandoId(id);
    try {
      await excluirDemandaFirestore(id);
      notificarSalvo('Exclusão sincronizada para todos');
    } catch (err) {
      setErroFatalFirestore(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setAtualizandoId(null);
    }
  };

  if (erroFatalFirestore) {
    throw erroFatalFirestore;
  }

  if (carregandoAuth || !usuario) {
    return (
      <AuthGate
        carregandoAuth={carregandoAuth}
        entrando={entrando}
        erroAuth={erroAuth}
        aoEntrar={handleEntrar}
      />
    );
  }

  return (
    <div className="relative min-h-screen bg-[#faf4f5] text-[#2b0b13]">
      <AccountingBackground />

      <header className="relative z-10 border-b border-[#5b1427] bg-[#3b0a17] text-[#fdf7f8]">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setAba('demandas');
            }}
            className="font-display text-base font-bold tracking-tight text-[#fdf7f8] whitespace-nowrap shrink-0"
          >
            Radar de Demandas
          </a>

          <nav className="flex items-center gap-6 text-sm font-medium" aria-label="Navegação">
            <button
              type="button"
              onClick={() => setAba('demandas')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                aba === 'demandas'
                  ? 'border-b-2 border-[#f4d0d8] text-white'
                  : 'text-[#d9b3bc] hover:text-white'
              }`}
            >
              Demandas
            </button>
            <button
              type="button"
              onClick={() => setAba('api')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
                aba === 'api'
                  ? 'border-b-2 border-[#f4d0d8] text-white'
                  : 'text-[#d9b3bc] hover:text-white'
              }`}
            >
              API REST
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={abrirNovaDemanda}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#fdf4f6] px-4 text-xs font-semibold text-[#3b0a17] transition-colors hover:bg-[#f6dfe4] whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nova Demanda
            </button>

            <span className="hidden text-xs text-[#e8ccd3] md:inline truncate max-w-[180px]">
              {usuario.displayName || usuario.email}
            </span>

            <button
              type="button"
              onClick={handleSair}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#6e2438] px-3 text-xs font-medium text-[#f4d0d8] transition-colors hover:bg-[#4e1021] hover:text-white whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1320px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
        {aba === 'demandas' ? (
          <>
            <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#2b0b13] text-balance">
                  Controle de Demandas Empresariais
                </h1>
                <p className="mt-1 text-sm text-[#6e4c55]">
                  Acompanhe obrigações por Razão Social e CNPJ. Toda alteração fica salva na nuvem e aparece automaticamente para todos.
                </p>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[#e8d5da] overflow-hidden rounded-xl border border-[#e8d5da] bg-white/75 backdrop-blur-[1.5px]">
                <button
                  type="button"
                  onClick={() => setFiltroStatus('todos')}
                  className="px-4 py-2.5 text-left transition-colors hover:bg-[#faf2f4]"
                >
                  <div className="text-[11px] font-medium text-[#6e4c55]">Total</div>
                  <div className="font-mono text-lg font-semibold tabular-nums text-[#2b0b13]">
                    {meta.total}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus('andamento')}
                  className="px-4 py-2.5 text-left transition-colors hover:bg-[#faf2f4]"
                >
                  <div className="text-[11px] font-medium text-[#6e4c55]">Andamento</div>
                  <div className="font-mono text-lg font-semibold tabular-nums text-[#5e1024]">
                    {meta.andamento}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroStatus('concluido')}
                  className="px-4 py-2.5 text-left transition-colors hover:bg-[#faf2f4]"
                >
                  <div className="text-[11px] font-medium text-[#6e4c55]">Concluídas</div>
                  <div className="font-mono text-lg font-semibold tabular-nums text-emerald-700">
                    {meta.concluido}
                  </div>
                </button>
              </div>
            </section>

            <section
              aria-label="Inserir demanda e vencimento rápido"
              className="rounded-xl border border-[#e8d5da] bg-white/75 p-4 backdrop-blur-[1.5px]"
            >
              <form
                onSubmit={handleInsercaoRapida}
                className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
              >
                <div className="md:col-span-3">
                  <label htmlFor="rapida-razao" className="block text-xs font-medium text-[#4a202b]">
                    Razão Social
                  </label>
                  <input
                    id="rapida-razao"
                    type="text"
                    value={rapidaRazao}
                    onChange={(e) => setRapidaRazao(e.target.value)}
                    placeholder="Nome da empresa..."
                    className="mt-1 h-10 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="rapida-cnpj" className="block text-xs font-medium text-[#4a202b]">
                      CNPJ
                    </label>
                    <button
                      type="button"
                      onClick={() => setRapidaCnpj(gerarCnpjValido())}
                      className="text-[11px] font-medium text-[#6e162e] hover:text-[#3b0a17]"
                    >
                      Gerar válido
                    </button>
                  </div>
                  <input
                    id="rapida-cnpj"
                    type="text"
                    value={rapidaCnpj}
                    onChange={(e) => setRapidaCnpj(formatarCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00"
                    className="mt-1 h-10 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 font-mono text-sm tabular-nums text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="rapida-titulo" className="block text-xs font-medium text-[#4a202b]">
                    Demanda
                  </label>
                  <input
                    id="rapida-titulo"
                    type="text"
                    value={rapidaTitulo}
                    onChange={(e) => setRapidaTitulo(e.target.value)}
                    placeholder="Ex.: Entrega de guia fiscal..."
                    className="mt-1 h-10 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-3 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="rapida-vencimento"
                    className="block text-xs font-medium text-[#4a202b]"
                  >
                    Inserir Vencimento
                  </label>
                  <input
                    id="rapida-vencimento"
                    type="date"
                    value={rapidaVencimento}
                    onChange={(e) => setRapidaVencimento(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#e4cfd5] bg-[#fdfafb] px-2.5 font-mono text-xs tabular-nums text-[#2b0b13] focus:border-[#5e1024] focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    type="submit"
                    disabled={salvandoRapida}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#5e1024] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#490b1b] disabled:opacity-50 whitespace-nowrap"
                  >
                    <CalendarPlus className="h-4 w-4 shrink-0" />
                    <span>{salvandoRapida ? '...' : 'Inserir'}</span>
                  </button>
                </div>
              </form>

              {erroRapida && (
                <p className="mt-2 text-xs font-medium text-red-700">{erroRapida}</p>
              )}
            </section>

            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center rounded-lg border border-[#e8d5da] bg-[#f3e7ea] p-1"
                  role="group"
                  aria-label="Filtrar por situação"
                >
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('todos')}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filtroStatus === 'todos'
                        ? 'bg-[#5e1024] text-white shadow-xs'
                        : 'text-[#5b353f] hover:text-[#2b0b13]'
                    }`}
                  >
                    Todas ({meta.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('andamento')}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filtroStatus === 'andamento'
                        ? 'bg-[#5e1024] text-white shadow-xs'
                        : 'text-[#5b353f] hover:text-[#2b0b13]'
                    }`}
                  >
                    Em Andamento ({meta.andamento})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('concluido')}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      filtroStatus === 'concluido'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-[#5b353f] hover:text-[#2b0b13]'
                    }`}
                  >
                    Concluídas ({meta.concluido})
                  </button>
                </div>

                {avisoSalvo && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {avisoSalvo}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-80 sm:flex-initial">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d6872]" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar Razão Social, CNPJ ou demanda..."
                    className="h-10 w-full rounded-lg border border-[#e8d5da] bg-white/90 pl-9 pr-8 text-sm text-[#2b0b13] placeholder:text-[#9c7b84] focus:border-[#5e1024] focus:bg-white focus:outline-none"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      aria-label="Limpar busca"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8d6872] hover:text-[#2b0b13]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </section>

            {erroCarga ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-white/90 px-6 py-12 text-center backdrop-blur-[2px]">
                <p className="text-sm font-medium text-red-800">{erroCarga}</p>
              </div>
            ) : (
              <DemandasTable
                demandas={demandas}
                carregando={carregando}
                atualizandoId={atualizandoId}
                aoAlternarStatus={handleAlternarStatus}
                aoAtualizarVencimento={handleAtualizarVencimento}
                aoEditar={abrirEdicao}
                aoExcluir={handleExcluir}
                aoAbrirNova={abrirNovaDemanda}
              />
            )}
          </>
        ) : (
          <ApiExplorerView />
        )}
      </main>

      <DemandaModal
        aberto={modalAberto}
        demandaEdicao={demandaEdicao}
        salvando={salvandoModal}
        erroExterno={erroModal}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={handleSalvarModal}
        aoAutoSalvarEdicao={handleAutoSalvarEdicao}
      />
    </div>
  );
}
