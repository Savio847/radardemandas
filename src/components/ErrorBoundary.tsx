import React from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, LogOut, ExternalLink, Copy, Check } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.ts';
import firebaseConfig from '../../firebase-applet-config.json';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
  isDailyReadQuotaError: boolean;
  isPermissionError: boolean;
  copiedRule: boolean;
}

const REGRAS_FIRESTORE = `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Permite que qualquer usuário autenticado com Google acesse as coleções
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

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
      isPermissionError: false,
      copiedRule: false,
    };
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
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
    const isPermissionError =
      parsedMessage.includes('Missing or insufficient permissions') ||
      parsedMessage.includes('permission-denied') ||
      parsedMessage.includes('insufficient permissions');

    return {
      hasError: true,
      message: parsedMessage,
      isQuotaError,
      isDailyReadQuotaError,
      isPermissionError,
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Erro capturado pelo ErrorBoundary:', error);
  }

  handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (e) {
      console.error('Erro ao deslogar:', e);
      window.location.reload();
    }
  };

  handleCopyRule = () => {
    navigator.clipboard.writeText(REGRAS_FIRESTORE);
    this.setState({ copiedRule: true });
    setTimeout(() => this.setState({ copiedRule: false }), 2000);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const firestoreRulesUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/rules`;
    const upgradeUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] px-4 py-8 font-sans text-slate-800">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl sm:p-8">
          {this.state.isPermissionError ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    Autorização Necessária no Firebase
                  </h1>
                  <p className="text-xs text-slate-500">
                    Outros usuários do Google precisam de liberação nas Regras do Firestore
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  O Firebase Firestore bloqueou a consulta em tempo real (
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-rose-600">
                    Missing or insufficient permissions
                  </code>
                  ) porque as <strong>Regras de Segurança na nuvem</strong> ainda estão restritas.
                </p>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Regra recomendada para permitir a equipe:</span>
                    <button
                      type="button"
                      onClick={this.handleCopyRule}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      {this.state.copiedRule ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar Regra</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-200">
                    {REGRAS_FIRESTORE}
                  </pre>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <p><strong>Como resolver no Firebase Console:</strong></p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Abra o link abaixo das Regras do seu banco Firestore.</li>
                    <li>Cole o código acima na aba <strong>Regras (Rules)</strong>.</li>
                    <li>Clique no botão azul <strong>Publicar (Publish)</strong>.</li>
                  </ol>
                </div>

                <div className="pt-1">
                  <a
                    href={firestoreRulesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <span>Abrir Regras do Firestore no Firebase Console</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Já publiquei, recarregar
                </button>
                <button
                  type="button"
                  onClick={this.handleSignOut}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <LogOut className="h-4 w-4" />
                  Trocar de Conta Google
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg font-bold text-slate-900">
                    {this.state.isQuotaError
                      ? 'Limite diário do banco de dados atingido'
                      : 'Não foi possível concluir a operação'}
                  </h1>

                  {this.state.isQuotaError ? (
                    <div className="mt-2 space-y-2 text-sm text-slate-600">
                      <p>
                        A cota gratuita diária do Firestore foi excedida e será reiniciada no próximo dia. Consulte os limites na coluna <strong>Spark</strong> (seção <strong>Enterprise edition</strong>) em{' '}
                        <a
                          href="https://firebase.google.com/pricing#cloud-firestore"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-blue-600 underline"
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
                            className="break-all font-medium text-blue-600 underline"
                          >
                            Console do Firestore
                          </a>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 break-words text-sm text-slate-600">
                      {this.state.message || 'Ocorreu uma falha inesperada de comunicação com a nuvem.'}
                    </p>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Recarregar Sistema
                    </button>
                    <button
                      type="button"
                      onClick={this.handleSignOut}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair / Trocar de Conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}
