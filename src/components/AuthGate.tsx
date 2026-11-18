import React from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { AccountingBackground } from './AccountingBackground.tsx';

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
    <div className="relative flex min-h-screen flex-col bg-[#faf4f5] text-[#2b0b13]">
      <AccountingBackground />

      <header className="relative z-10 border-b border-[#5b1427] bg-[#3b0a17] text-[#fdf7f8]">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <span className="font-display text-base font-bold tracking-tight text-[#fdf7f8]">
            Radar de Demandas
          </span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#e8d5da] bg-white/85 p-8 shadow-xl backdrop-blur-[2px]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7eef0] text-[#5e1024]">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-[#2b0b13]">
            Acesso Compartilhado da Equipe
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5b353f]">
            Entre com sua conta Google para visualizar, cadastrar e atualizar demandas em tempo real. Tudo fica salvo na nuvem e aparece instantaneamente para todos os usuários.
          </p>

          {erroAuth && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
              {erroAuth}
            </div>
          )}

          <button
            type="button"
            disabled={carregandoAuth || entrando}
            onClick={aoEntrar}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg bg-[#5e1024] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#490b1b] disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {carregandoAuth
              ? 'Verificando sessão...'
              : entrando
                ? 'Conectando...'
                : 'Entrar com Google'}
          </button>
        </div>
      </main>
    </div>
  );
}
