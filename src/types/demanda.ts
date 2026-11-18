export type DemandaStatus = 'andamento' | 'concluido';

export type AlertaPiscar = 'vermelho_forte' | 'vermelho_fraco' | 'nenhum';

export interface Demanda {
  id: string;
  razaoSocial: string;
  cnpj: string;
  titulo: string;
  descricao: string;
  responsavel: string;
  prazo: string; // YYYY-MM-DD
  status: DemandaStatus;
  criadoEm: string;
  concluidoEm: string | null;
}

export interface DemandaComAlerta extends Demanda {
  diasRestantes: number;
  alerta: AlertaPiscar;
  alertaLabel: string;
}

export interface DemandasMeta {
  total: number;
  andamento: number;
  concluido: number;
  vermelhoForte: number;
  vermelhoFraco: number;
  emDia: number;
  referenciaHoje: string;
}

export interface DemandasResponse {
  data: DemandaComAlerta[];
  meta: DemandasMeta;
}

export interface DemandaPayload {
  razaoSocial: string;
  cnpj: string;
  titulo: string;
  descricao?: string;
  responsavel?: string;
  prazo: string;
  status?: DemandaStatus;
}
