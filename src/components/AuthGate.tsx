import React from 'react';
import { LogIn, ShieldCheck, Sparkles, Layers } from 'lucide-react';

interface AuthGateProps {
  carregandoAuth: boolean;
  entrando: boolean;
  erroAuth: string | null;
  aoEntrar: () => Promise<void>;
}

export function AuthGate({
  carregandoAuth,
  entrando,
  erroAuth,
  aoEntrar,
}: AuthGateProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-[#f4f7fb] text-slate-800">
      <header className="relative z-10 border-b border-slate-100 bg-white">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900">
              Radar Demandas
            </span>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Painel Corporativo
          </span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-slate-900">
            Acesso ao Radar de Demandas
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Conecte sua conta Google corporativa para sincronizar prazos, alertas tributários e gerenciar demandas empresariais em tempo real.
          </p>

          {erroAuth && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
              {erroAuth}
            </div>
          )}

          <button
            type="button"
            disabled={carregandoAuth || entrando}
            onClick={aoEntrar}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/30 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {carregandoAuth
              ? 'Verificando sessão...'
              : entrando
                ? 'Conectando...'
                : 'Entrar com Google'}
          </button>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
            Ambiente seguro com Firebase Firestore Multi-tenant
          </div>
        </div>
      </main>
    </div>
  );
}
