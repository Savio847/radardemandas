import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Code2,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
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

  const handleImprimirRelatorio = () => {
    window.print();
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
    <div className="relative min-h-screen bg-[#f4f7fb] text-slate-800">
      {/* Header Superior Moderno */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur-xs print:hidden">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo e Nome do Sistema */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setAba('demandas');
              }}
              className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
            >
              Radar de Demandas
            </a>
          </div>

          {/* Navegação entre Abas */}
          <nav className="flex items-center gap-2 rounded-xl bg-slate-100/80 p-1 text-xs font-semibold" aria-label="Navegação">
            <button
              type="button"
              onClick={() => setAba('demandas')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all whitespace-nowrap ${
                aba === 'demandas'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Demandas</span>
            </button>
            <button
              type="button"
              onClick={() => setAba('api')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all whitespace-nowrap ${
                aba === 'api'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>API REST</span>
            </button>
          </nav>

          {/* Ações do Topo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImprimirRelatorio}
              title="Imprimir relatório das tarefas listadas"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 shadow-2xs"
            >
              <Printer className="h-4 w-4 text-slate-500" />
              <span>Imprimir Relatório</span>
            </button>

            <button
              type="button"
              onClick={abrirNovaDemanda}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-all whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Demanda</span>
            </button>

            <span className="hidden text-xs text-slate-500 font-medium md:inline truncate max-w-[180px]">
              {usuario.displayName || usuario.email}
            </span>

            <button
              type="button"
              onClick={handleSair}
              title="Sair da conta"
              aria-label="Sair da conta"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 shadow-2xs"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="relative z-10 mx-auto max-w-[1320px] space-y-6 px-4 py-7 sm:px-6 lg:px-8">
        {aba === 'demandas' ? (
          <>
            {/* Cabeçalho exclusivo para o Relatório de Tarefas na Impressão */}
            <div className="hidden print:block border-b border-slate-300 pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                      <Layers className="h-4 w-4" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">
                      Radar de Demandas · Relatório de Tarefas
                    </h1>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Filtro: <strong className="text-slate-800">{filtroStatus === 'todos' ? 'Todas as Tarefas' : filtroStatus === 'andamento' ? 'Tarefas em Andamento' : 'Tarefas Concluídas'}</strong>
                    {buscaAplicada ? ` · Termo pesquisado: "${buscaAplicada}"` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-600 space-y-0.5">
                  <div>Data de emissão: <strong>{new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
                  <div>Emitido por: <strong>{usuario.displayName || usuario.email}</strong></div>
                  <div className="font-semibold text-slate-800">Total no relatório: {demandas.length} {demandas.length === 1 ? 'tarefa' : 'tarefas'}</div>
                </div>
              </div>
            </div>

            {/* Seção 1: Cabeçalho & Cards de Resumo / Filtros de Status */}
            <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between print:hidden">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
                  Controle de Demandas Empresariais
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Acompanhe obrigações por Razão Social e CNPJ. Toda alteração fica salva na nuvem e aparece automaticamente para todos.
                </p>
              </div>

              {/* Cards de Métricas no Estilo do Design System */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFiltroStatus('todos')}
                  className={`rounded-2xl border p-4 text-left transition-all shadow-xs ${
                    filtroStatus === 'todos'
                      ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Total</span>
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold tabular-nums text-slate-900">
                    {meta.total}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroStatus('andamento')}
                  className={`rounded-2xl border p-4 text-left transition-all shadow-xs ${
                    filtroStatus === 'andamento'
                      ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Andamento</span>
                    <Clock className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-600">
                    {meta.andamento}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFiltroStatus('concluido')}
                  className={`rounded-2xl border p-4 text-left transition-all shadow-xs ${
                    filtroStatus === 'concluido'
                      ? 'border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                      : 'border-slate-100 bg-white hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Concluídas</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold tabular-nums text-emerald-600">
                    {meta.concluido}
                  </div>
                </button>
              </div>
            </section>

            {/* Seção 2: Inserir Demanda e Vencimento Rápido */}
            <section
              aria-label="Inserir demanda e vencimento rápido"
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs print:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Inserir Demanda e Vencimento Rápido
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={abrirNovaDemanda}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Formulário detalhado →
                </button>
              </div>

              <form
                onSubmit={handleInsercaoRapida}
                className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end"
              >
                <div className="md:col-span-3">
                  <label htmlFor="rapida-razao" className="block text-xs font-semibold text-slate-700">
                    Razão Social
                  </label>
                  <input
                    id="rapida-razao"
                    type="text"
                    value={rapidaRazao}
                    onChange={(e) => setRapidaRazao(e.target.value)}
                    placeholder="Nome da empresa..."
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
                  />
                </div>

                <div className="md:col-span-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="rapida-cnpj" className="block text-xs font-semibold text-slate-700">
                      CNPJ
                    </label>
                    <button
                      type="button"
                      onClick={() => setRapidaCnpj(gerarCnpjValido())}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
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
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-mono text-sm tabular-nums text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
                  />
                </div>

                <div className="md:col-span-3">
                  <label htmlFor="rapida-titulo" className="block text-xs font-semibold text-slate-700">
                    Demanda
                  </label>
                  <input
                    id="rapida-titulo"
                    type="text"
                    value={rapidaTitulo}
                    onChange={(e) => setRapidaTitulo(e.target.value)}
                    placeholder="Ex.: Entrega de guia fiscal..."
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label
                    htmlFor="rapida-vencimento"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Inserir Vencimento
                  </label>
                  <input
                    id="rapida-vencimento"
                    type="date"
                    value={rapidaVencimento}
                    onChange={(e) => setRapidaVencimento(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
                  />
                </div>

                <div className="md:col-span-1">
                  <button
                    type="submit"
                    disabled={salvandoRapida}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    <CalendarPlus className="h-4 w-4 shrink-0" />
                    <span>{salvandoRapida ? '...' : 'Inserir'}</span>
                  </button>
                </div>
              </form>

              {erroRapida && (
                <p className="mt-2 text-xs font-medium text-rose-600">{erroRapida}</p>
              )}
            </section>

            {/* Seção 3: Barra de Filtros por Situação & Campo de Busca */}
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center rounded-xl border border-slate-200/80 bg-white p-1 shadow-2xs"
                  role="group"
                  aria-label="Filtrar por situação"
                >
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('todos')}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      filtroStatus === 'todos'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({meta.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('andamento')}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      filtroStatus === 'andamento'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Em Andamento ({meta.andamento})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('concluido')}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      filtroStatus === 'concluido'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Concluídas ({meta.concluido})
                  </button>
                </div>

                {avisoSalvo && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 animate-in fade-in duration-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {avisoSalvo}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-80 sm:flex-initial">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar Razão Social, CNPJ ou demanda..."
                    className="h-10 w-full rounded-xl border border-slate-200/80 bg-white pl-10 pr-9 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs transition-all"
                  />
                  {busca && (
                    <button
                      type="button"
                      onClick={() => setBusca('')}
                      aria-label="Limpar busca"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleImprimirRelatorio}
                  title="Imprimir relatório das tarefas listadas"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all whitespace-nowrap shrink-0"
                >
                  <Printer className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline">Imprimir Relatório</span>
                </button>
              </div>
            </section>

            {/* Seção 4: Tabela de Demandas */}
            {erroCarga ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-white px-6 py-12 text-center shadow-xs">
                <p className="text-sm font-medium text-rose-700">{erroCarga}</p>
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

      {/* Modal Completo de Cadastro / Edição */}
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
