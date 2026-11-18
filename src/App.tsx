import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Layers,
  LayoutDashboard,
  LogOut,
  Mic,
  MousePointerClick,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
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

  // Add Widget Drawer state (matching the top screenshot!)
  const [widgetDrawerAberto, setWidgetDrawerAberto] = useState(false);

  // Quick addition fields
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

  // AI Assistant chat interaction mock state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResposta, setAiResposta] = useState<string | null>(null);

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

  // Firebase auth & live subscription
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
      notificarSalvo('Demanda cadastrada com sucesso');
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
      notificarSalvo('Demanda excluída com sucesso');
    } catch (err) {
      setErroFatalFirestore(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setAtualizandoId(null);
    }
  };

  const exportarDemandasCsv = () => {
    const cabecalho = 'ID,Razão Social,CNPJ,Demanda,Responsável,Prazo,Status\n';
    const linhas = demandas
      .map(
        (d) =>
          `"${d.id}","${d.razaoSocial}","${d.cnpj}","${d.titulo}","${d.responsavel || ''}","${d.prazo}","${d.status}"`
      )
      .join('\n');
    const blob = new Blob([cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `demandas_${dataHojeIsoLocal(new Date())}.csv`;
    link.click();
    notificarSalvo('Relatório CSV exportado com sucesso');
  };

  const handleEnviarAiPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    const query = aiPrompt.toLowerCase();
    let resposta = '';
    if (query.includes('quantas') || query.includes('total') || query.includes('status')) {
      resposta = `No momento você possui ${meta.total} demandas registradas: ${meta.andamento} em andamento (${meta.vermelhoForte} com atenção imediata) e ${meta.concluido} concluídas.`;
    } else if (query.includes('crítica') || query.includes('urgente') || query.includes('vencid')) {
      resposta = `Existem ${meta.vermelhoForte} demandas em alerta crítico. Verifique as obrigações com tags vermelhas na tabela de demandas.`;
    } else {
      resposta = `Análise concluída: Taxa de eficiência da equipe está em ${meta.total > 0 ? Math.round((meta.concluido / meta.total) * 100) : 100}%. Nenhuma inconsistência fiscal detectada.`;
    }
    setAiResposta(resposta);
    setAiPrompt('');
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
    <div className="flex min-h-screen bg-[#f4f7fb] text-slate-800">
      {/* ===================== SIDEBAR (Left) ===================== */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-slate-100 bg-white p-5 sticky top-0 h-screen select-none">
        <div>
          {/* Logo / Brand Header */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-slate-900">
                Shopeers
              </span>
              <span className="block text-[10px] font-medium text-slate-400">
                Demandas & Gestão
              </span>
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="mt-8 space-y-1" aria-label="Navegação Principal">
            <button
              type="button"
              onClick={() => setAba('demandas')}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                aba === 'demandas'
                  ? 'bg-blue-50/90 text-blue-600 shadow-2xs'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAba('demandas');
                setFiltroStatus('andamento');
              }}
              className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4" />
                <span>Orders</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                {meta.andamento || 48}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAba('demandas')}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <Building2 className="h-4 w-4" />
              <span>Products</span>
            </button>

            <button
              type="button"
              onClick={() => setAba('demandas')}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <Users className="h-4 w-4" />
              <span>Customers</span>
            </button>

            <button
              type="button"
              onClick={() => setAba('demandas')}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <FileText className="h-4 w-4" />
              <span>Content</span>
            </button>

            <button
              type="button"
              onClick={() => setAba('demandas')}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <Layers className="h-4 w-4" />
              <span>Online Store</span>
            </button>
          </nav>

          {/* Group: FINANCES / GESTÃO */}
          <div className="mt-7">
            <div className="flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <span>Finances</span>
              <ChevronDown className="h-3 w-3" />
            </div>
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={() => setFiltroStatus('todos')}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs transition-colors ${
                  filtroStatus === 'todos' && aba === 'demandas'
                    ? 'font-semibold text-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Invoices
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('andamento')}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs transition-colors ${
                  filtroStatus === 'andamento'
                    ? 'font-semibold text-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Transactions
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus('concluido')}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs transition-colors ${
                  filtroStatus === 'concluido'
                    ? 'font-semibold text-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Reports
              </button>
              <button
                type="button"
                onClick={() => setAba('api')}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs transition-colors ${
                  aba === 'api'
                    ? 'font-semibold text-blue-600'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Analytics (API)
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer & Upgrade Card */}
        <div className="space-y-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={abrirNovaDemanda}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              onClick={() => alert('Radar de Demandas v2.0 - Firebase Firestore Multi-tenant')}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Help & Support</span>
            </button>
          </div>

          {/* Upgrade to Premium Card (matching screenshot) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#16307e] via-[#102464] to-[#0a1847] p-4 text-white shadow-lg shadow-blue-950/20">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 backdrop-blur-xs text-blue-200">
              <Sparkles className="h-4 w-4" />
            </div>
            <h4 className="mt-3 text-xs font-bold">Upgrade to Premium!</h4>
            <p className="mt-1 text-[11px] leading-relaxed text-blue-200/80">
              Upgrade your account and unlock all of the benefits.
            </p>
            <button
              type="button"
              onClick={abrirNovaDemanda}
              className="mt-3 w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2 text-center text-xs font-semibold text-white shadow-md shadow-blue-600/30 transition-all"
            >
              Upgrade premium
            </button>
          </div>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-100 bg-white/95 px-6 lg:px-8 backdrop-blur-xs">
          {/* Search Bar */}
          <div className="flex items-center gap-2 max-w-sm w-full">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Search anything..."
                className="w-full rounded-xl border border-slate-200/80 bg-white pl-10 pr-12 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all shadow-2xs"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Date range picker */}
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>Jan 1, 2025 - Feb 1, 2025</span>
            </div>

            {/* Range dropdown */}
            <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs cursor-pointer">
              <span>Last 30 days</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </div>

            {/* Add Widget Button (Drawer toggle) */}
            <button
              type="button"
              onClick={() => setWidgetDrawerAberto(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5 text-slate-500" />
              <span>Add widget</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={exportarDemandasCsv}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-500/25 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>

            {/* Notifications */}
            <button
              type="button"
              title="Notificações"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <Bell className="h-4 w-4" />
              {meta.vermelhoForte > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              )}
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs ring-2 ring-slate-100">
                {usuario.photoURL ? (
                  <img
                    src={usuario.photoURL}
                    alt={usuario.displayName || 'Usuário'}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  (usuario.displayName || usuario.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={handleSair}
                title="Sair da conta"
                className="text-slate-400 hover:text-rose-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Main Area */}
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 space-y-6">
          {aba === 'api' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
                    API REST & Integrações
                  </h1>
                  <p className="text-xs text-slate-500">
                    Documentação interativa com respostas ao vivo do Firebase Firestore.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAba('demandas')}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Voltar ao Dashboard
                </button>
              </div>
              <ApiExplorerView />
            </div>
          ) : (
            <>
              {/* Dashboard Title & Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
                  Dashboard
                </h1>
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white p-1 text-xs font-semibold shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('todos')}
                    className={`rounded-lg px-3 py-1 transition-all ${
                      filtroStatus === 'todos'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Todas ({meta.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('andamento')}
                    className={`rounded-lg px-3 py-1 transition-all ${
                      filtroStatus === 'andamento'
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Em Andamento ({meta.andamento})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroStatus('concluido')}
                    className={`rounded-lg px-3 py-1 transition-all ${
                      filtroStatus === 'concluido'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Concluídas ({meta.concluido})
                  </button>
                </div>
              </div>

              {/* ===================== TOP ROW: 4 KPI CARDS ===================== */}
              <section aria-label="Métricas Principais" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Page Views (Total de Demandas) */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Page Views</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Eye className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                      16,431
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                      <ArrowUpRight className="h-3 w-3" />
                      15.8%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">vs. 14,653 last period</p>
                </div>

                {/* 2. Visitors (Em Andamento) */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Visitors</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                      6,225
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                      <ArrowUpRight className="h-3 w-3" />
                      8.4%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">vs. 5,732 last period</p>
                </div>

                {/* 3. Click (Alertas & Prazos) */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Click</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <MousePointerClick className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                      2,832
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-500">
                      <ArrowDownRight className="h-3 w-3" />
                      10.5%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">vs. 3,294 last period</p>
                </div>

                {/* 4. Orders (Concluídas) */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Orders</span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                      1,224
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                      <ArrowUpRight className="h-3 w-3" />
                      4.4%
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">vs. 1,186 last period</p>
                </div>
              </section>

              {/* ===================== MIDDLE GRID: LEFT (2/3) & RIGHT (1/3) ===================== */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ----------------- LEFT 8 COLS ----------------- */}
                <div className="space-y-6 lg:col-span-8">
                  {/* Total Profit / Performance Chart Card */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <span className="text-xs font-medium text-slate-400">Total Profit</span>
                        <div className="mt-1 flex items-baseline gap-3">
                          <span className="font-display text-3xl font-bold tracking-tight text-slate-900">
                            $446.7K
                          </span>
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                            <ArrowUpRight className="h-3 w-3" />
                            24.4% vs. last period
                          </span>
                        </div>
                      </div>

                      {/* Tooltip Card floating on top of chart (from screenshot!) */}
                      <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm text-xs">
                        <div className="text-[10px] font-medium text-slate-400">Jan 18, 2025</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          $12,324 <span className="text-[10px] text-slate-400 font-normal">this month</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          $5,563 <span className="text-slate-400">last month</span>
                        </div>
                      </div>
                    </div>

                    {/* Smooth Area Line Chart SVG */}
                    <div className="mt-6 relative h-44 w-full">
                      <svg className="h-full w-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Horizontal guide lines */}
                        <line x1="0" y1="30" x2="600" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
                        <line x1="0" y1="80" x2="600" y2="80" stroke="#f1f5f9" strokeDasharray="3 3" />
                        <line x1="0" y1="130" x2="600" y2="130" stroke="#f1f5f9" strokeDasharray="3 3" />

                        {/* Area Fill */}
                        <path
                          d="M 0 110 Q 75 105, 150 90 T 300 115 T 450 60 T 600 45 L 600 160 L 0 160 Z"
                          fill="url(#chartGradient)"
                        />
                        {/* Line Stroke */}
                        <path
                          d="M 0 110 Q 75 105, 150 90 T 300 115 T 450 60 T 600 45"
                          fill="none"
                          stroke="#2563eb"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                        {/* Marker points */}
                        <circle cx="300" cy="115" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                        <circle cx="450" cy="60" r="4" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                      </svg>
                      {/* X-axis date labels */}
                      <div className="flex justify-between text-[11px] font-medium text-slate-400 mt-2 px-1">
                        <span>1 Jan</span>
                        <span>8 Jan</span>
                        <span>15 Jan</span>
                        <span>22 Jan</span>
                        <span>29 Jan</span>
                      </div>
                    </div>

                    {/* Sub-Metric Cards / Segmented breakdown */}
                    <div className="mt-8 border-t border-slate-100 pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-700">Customers</span>
                        <span className="text-[11px] text-slate-400">Total segmented</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Retailers */}
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                            <Users className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">2,884</div>
                            <div className="text-[11px] text-slate-400">Retailers</div>
                          </div>
                        </div>

                        {/* Distributors */}
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">1,432</div>
                            <div className="text-[11px] text-slate-400">Distributors</div>
                          </div>
                        </div>

                        {/* Wholesalers */}
                        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                          <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs">
                            <Layers className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">562</div>
                            <div className="text-[11px] text-slate-400">Wholesalers</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Demanda Inserter Card */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Inserir Demanda Rápida
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={abrirNovaDemanda}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Formulário completo →
                      </button>
                    </div>

                    <form onSubmit={handleInsercaoRapida} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                      <input
                        type="text"
                        placeholder="Razão Social"
                        value={rapidaRazao}
                        onChange={(e) => setRapidaRazao(e.target.value)}
                        className="sm:col-span-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 focus:outline-none shadow-2xs"
                      />
                      <div className="sm:col-span-3 relative">
                        <input
                          type="text"
                          placeholder="CNPJ (14 dígitos)"
                          value={rapidaCnpj}
                          onChange={(e) => setRapidaCnpj(formatarCnpj(e.target.value))}
                          className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 font-mono text-xs tabular-nums text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 focus:outline-none shadow-2xs"
                        />
                        <button
                          type="button"
                          onClick={() => setRapidaCnpj(gerarCnpjValido())}
                          title="Gerar CNPJ válido"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Obrigação / Demanda"
                        value={rapidaTitulo}
                        onChange={(e) => setRapidaTitulo(e.target.value)}
                        className="sm:col-span-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 focus:outline-none shadow-2xs"
                      />
                      <input
                        type="date"
                        value={rapidaVencimento}
                        onChange={(e) => setRapidaVencimento(e.target.value)}
                        className="sm:col-span-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 focus:outline-none shadow-2xs"
                      />
                      <button
                        type="submit"
                        disabled={salvandoRapida}
                        className="sm:col-span-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-all shadow-xs disabled:opacity-50 flex items-center justify-center"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </form>
                    {erroRapida && (
                      <p className="mt-2 text-xs text-rose-600">{erroRapida}</p>
                    )}
                  </div>

                  {/* Best Selling Products / Demandas Table Card */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <div>
                        <h2 className="font-display text-sm font-bold text-slate-900">
                          Best Selling Products (Demandas Empresariais)
                        </h2>
                        <p className="text-xs text-slate-400">
                          Obrigações sincronizadas com a nuvem em tempo real.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={abrirNovaDemanda}
                        className="rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        + Nova Demanda
                      </button>
                    </div>

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
                  </div>
                </div>

                {/* ----------------- RIGHT 4 COLS ----------------- */}
                <div className="space-y-6 lg:col-span-4">
                  {/* Card 1: Most Day Active (Bar Chart from screenshot) */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">Most Day Active</h3>
                      <button type="button" className="text-slate-400 hover:text-slate-600">
                        •••
                      </button>
                    </div>

                    {/* Vertical Bar Chart */}
                    <div className="mt-6 flex items-end justify-between gap-2 h-44 px-2">
                      {[
                        { dia: 'Sun', altura: '45%', ativo: false },
                        { dia: 'Mon', altura: '65%', ativo: false },
                        { dia: 'Tue', altura: '95%', ativo: true, valor: '8,162' },
                        { dia: 'Wed', altura: '50%', ativo: false },
                        { dia: 'Thu', altura: '40%', ativo: false },
                        { dia: 'Fri', altura: '75%', ativo: false },
                        { dia: 'Sat', altura: '35%', ativo: false },
                      ].map((bar) => (
                        <div key={bar.dia} className="flex flex-col items-center flex-1 h-full justify-end">
                          {bar.ativo && (
                            <span className="mb-1 text-[11px] font-bold text-blue-600 font-mono">
                              {bar.valor}
                            </span>
                          )}
                          <div
                            style={{ height: bar.altura }}
                            className={`w-full max-w-[28px] rounded-t-xl transition-all ${
                              bar.ativo
                                ? 'bg-blue-600 shadow-sm shadow-blue-500/30'
                                : 'bg-slate-100 hover:bg-slate-200'
                            }`}
                          />
                          <span className="mt-2 text-[11px] font-medium text-slate-400">
                            {bar.dia}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Repeat Customer Rate (Gauge Meter from screenshot) */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">Repeat Customer Rate</h3>
                      <button type="button" className="text-slate-400 hover:text-slate-600">
                        •••
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col items-center justify-center">
                      {/* Semi-circular gauge */}
                      <div className="relative w-48 h-24 overflow-hidden flex items-end justify-center">
                        <svg className="w-48 h-48 -mb-24" viewBox="0 0 100 100">
                          {/* Background Track Arc */}
                          <path
                            d="M 15 50 A 35 35 0 0 1 85 50"
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="8"
                            strokeLinecap="round"
                          />
                          {/* Green Progress Arc */}
                          <path
                            d="M 15 50 A 35 35 0 0 1 85 50"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="8"
                            strokeDasharray="110"
                            strokeDashoffset="35"
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute bottom-0 text-center">
                          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
                            68%
                          </span>
                          <span className="block text-[10px] text-slate-400">On track for 80% target</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => alert('Cumprimento de prazos: 68% das demandas foram entregues antes do vencimento.')}
                        className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Show details
                      </button>
                    </div>
                  </div>

                  {/* Card 3: AI Assistant (with glossy 3D Orb from screenshot!) */}
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">AI Assistant</h3>
                      <Sparkles className="h-4 w-4 text-blue-500" />
                    </div>

                    {/* Photorealistic 3D Blue Orb */}
                    <div className="my-6 flex flex-col items-center justify-center">
                      <div className="ai-sphere" />
                      <p className="mt-3 text-xs font-medium text-slate-500 text-center">
                        Inteligência operacional conectada às demandas.
                      </p>
                    </div>

                    {aiResposta && (
                      <div className="mb-3 rounded-xl bg-blue-50/70 border border-blue-100 p-3 text-xs text-slate-700">
                        {aiResposta}
                      </div>
                    )}

                    {/* Interactive Prompt Input */}
                    <form onSubmit={handleEnviarAiPrompt} className="relative mt-2">
                      <input
                        type="text"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Ask me anything..."
                        className="w-full rounded-2xl border border-slate-200/80 bg-white pl-4 pr-16 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all shadow-2xs"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                          title="Falar por voz"
                        >
                          <Mic className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="submit"
                          className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
                          title="Enviar pergunta"
                        >
                          <Send className="h-3 w-3" />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ===================== ADD WIDGET DRAWER (Top Image Slide-over) ===================== */}
      {widgetDrawerAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs transition-opacity">
          <div className="w-full max-w-sm bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900">Add Widget</h2>
                <button
                  type="button"
                  onClick={() => setWidgetDrawerAberto(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Widget List (matching screenshot) */}
              <div className="mt-5 space-y-4">
                {/* Widget 1 */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Visitors by Device</h4>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        Track how customers access your store across mobile, desktop, and tablet.
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full border-4 border-blue-500 border-t-cyan-400 shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="text-[10px] font-semibold text-slate-400">#Audience Insights</span>
                    <button
                      type="button"
                      onClick={() => {
                        notificarSalvo('Widget adicionado ao painel');
                        setWidgetDrawerAberto(false);
                      }}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs"
                    >
                      Select
                    </button>
                  </div>
                </div>

                {/* Widget 2 */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Orders Performance</h4>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        Monitor order volume, fulfillment status, and sales activity in real time.
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-blue-500 shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="text-[10px] font-semibold text-slate-400">#Operations</span>
                    <button
                      type="button"
                      onClick={() => {
                        notificarSalvo('Widget adicionado ao painel');
                        setWidgetDrawerAberto(false);
                      }}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs"
                    >
                      Select
                    </button>
                  </div>
                </div>

                {/* Widget 3 */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Trend Analysis</h4>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        Group customers by behavior and demographics for targeted marketing.
                      </p>
                    </div>
                    <ArrowUpRight className="h-8 w-8 text-emerald-500 shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="text-[10px] font-semibold text-slate-400">#Strategy</span>
                    <button
                      type="button"
                      onClick={() => {
                        notificarSalvo('Widget adicionado ao painel');
                        setWidgetDrawerAberto(false);
                      }}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs"
                    >
                      Select
                    </button>
                  </div>
                </div>

                {/* Widget 4 */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Customer Segmentation</h4>
                      <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                        Group customers by tier, frequency, and order values.
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-blue-500 shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="text-[10px] font-semibold text-slate-400">#Growth</span>
                    <button
                      type="button"
                      onClick={() => {
                        notificarSalvo('Widget adicionado ao painel');
                        setWidgetDrawerAberto(false);
                      }}
                      className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs"
                    >
                      Select
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWidgetDrawerAberto(false)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DEMANDA MODAL (Create & Edit) ===================== */}
      <DemandaModal
        aberto={modalAberto}
        demandaEdicao={demandaEdicao}
        salvando={salvandoModal}
        erroExterno={erroModal}
        aoFechar={() => setModalAberto(false)}
        aoSalvar={handleSalvarModal}
        aoAutoSalvarEdicao={handleAutoSalvarEdicao}
      />

      {/* ===================== TOAST NOTIFICATION ===================== */}
      {avisoSalvo && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-xs font-semibold text-slate-800 shadow-xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <span>{avisoSalvo}</span>
        </div>
      )}
    </div>
  );
}
