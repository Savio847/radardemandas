import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
  isDailyReadQuotaError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isQuotaError: false,
      isDailyReadQuotaError: false,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    let parsedMessage = raw;
    try {
      const json = JSON.parse(raw) as { error?: string };
      if (json && typeof json.error === 'string') {
        parsedMessage = json.error;
      }
    } catch {
      // Mantém mensagem original
    }

    const isDailyReadQuotaError = parsedMessage.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    );
    const isQuotaError = isDailyReadQuotaError || parsedMessage.includes('Quota exceeded.');

    return {
      hasError: true,
      message: parsedMessage,
      isQuotaError,
      isDailyReadQuotaError,
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Erro capturado pelo ErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const upgradeUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf4f5] px-4 text-[#2b0b13]">
        <div className="w-full max-w-lg rounded-xl border border-[#e8d5da] bg-white p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[#5e1024]" />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-lg font-bold text-[#2b0b13]">
                {this.state.isQuotaError
                  ? 'Limite diário do banco de dados atingido'
                  : 'Não foi possível concluir a operação'}
              </h1>

              {this.state.isQuotaError ? (
                <div className="mt-2 space-y-2 text-sm text-[#5b353f]">
                  <p>
                    A cota gratuita diária do Firestore foi excedida e será reiniciada no próximo dia. Consulte os limites na coluna <strong>Spark</strong> (seção <strong>Enterprise edition</strong>) em{' '}
                    <a
                      href="https://firebase.google.com/pricing#cloud-firestore"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-[#5e1024] underline"
                    >
                      firebase.google.com/pricing
                    </a>
                    .
                  </p>
                  {this.state.isDailyReadQuotaError && (
                    <p>
                      Para ampliar o limite imediatamente, acesse:{' '}
                      <a
                        href={upgradeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-medium text-[#5e1024] underline"
                      >
                        Console do Firestore
                      </a>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 break-words text-sm text-[#5b353f]">
                  {this.state.message || 'Ocorreu uma falha inesperada de comunicação com a nuvem.'}
                </p>
              )}

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#5e1024] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#490b1b]"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar Sistema
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
