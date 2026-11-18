import React from 'react';
import { LogIn, ShieldCheck, Layers, Loader2 } from 'lucide-react';

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
      <header className="relative z-10 border-b border-slate-100 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Layers className="h-5 w-5" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900">
              Radar de Demandas
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-slate-900">
            Acesso Compartilhado da Equipe
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Entre com sua conta Google para visualizar, cadastrar e atualizar demandas em tempo real. Tudo fica salvo na nuvem e aparece instantaneamente para todos os usuários.
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
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-500/25 transition-all hover:shadow-md hover:shadow-blue-500/30 disabled:opacity-60"
          >
            {entrando || carregandoAuth ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {carregandoAuth ? 'Verificando sessão...' : 'Conectando...'}
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Entrar com Google
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
