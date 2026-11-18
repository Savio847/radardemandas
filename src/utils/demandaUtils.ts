import type { AlertaPiscar, Demanda, DemandaComAlerta } from '../types/demanda.ts';

export function limparCnpj(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 14);
}

export function formatarCnpj(valor: string): string {
  const digits = limparCnpj(valor);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function validarCnpj(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcularDigito = (base: string, pesos: number[]): number => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) {
      soma += Number(base[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const digito1 = calcularDigito(cnpj.slice(0, 12), pesos1);
  const digito2 = calcularDigito(cnpj.slice(0, 12) + String(digito1), pesos2);

  return cnpj.endsWith(`${digito1}${digito2}`);
}

export function gerarCnpjValido(seedBase?: string): string {
  const base =
    seedBase && /^\d{12}$/.test(seedBase)
      ? seedBase
      : `${Math.floor(10000000 + Math.random() * 89999999)}0001`;

  const calcularDigito = (str: string, pesos: number[]): number => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) {
      soma += Number(str[i]) * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcularDigito(base + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return formatarCnpj(`${base}${d1}${d2}`);
}

export function dataHojeIsoLocal(refDate: Date = new Date()): string {
  const ano = refDate.getFullYear();
  const mes = String(refDate.getMonth() + 1).padStart(2, '0');
  const dia = String(refDate.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function adicionarDiasIso(dias: number, refDate: Date = new Date()): string {
  const copia = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  copia.setDate(copia.getDate() + dias);
  return dataHojeIsoLocal(copia);
}

export function calcularDiasRestantes(prazoIso: string, refDate: Date = new Date()): number {
  const [ano, mes, dia] = prazoIso.split('-').map(Number);
  if (!ano || !mes || !dia) return 0;
  const alvoUtc = Date.UTC(ano, mes - 1, dia);
  const hojeUtc = Date.UTC(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  return Math.round((alvoUtc - hojeUtc) / (1000 * 60 * 60 * 24));
}

export function classificarAlerta(
  status: Demanda['status'],
  diasRestantes: number
): { alerta: AlertaPiscar; alertaLabel: string } {
  if (status === 'concluido') {
    return {
      alerta: 'nenhum',
      alertaLabel: 'Concluída',
    };
  }

  // Vencida: passou da data → vermelho
  if (diasRestantes < 0) {
    const atraso = Math.abs(diasRestantes);
    return {
      alerta: 'vermelho_forte',
      alertaLabel: atraso === 1 ? 'Vencida há 1 dia' : `Vencida há ${atraso} dias`,
    };
  }

  // Vence hoje → amarelo (ainda não venceu)
  if (diasRestantes === 0) {
    return {
      alerta: 'vermelho_fraco',
      alertaLabel: 'Vence hoje',
    };
  }

  // Ainda dentro do prazo → amarelo
  return {
    alerta: 'vermelho_fraco',
    alertaLabel: diasRestantes === 1 ? 'Vence amanhã' : `Vence em ${diasRestantes} dias`,
  };
}

export function enriquecerDemanda(demanda: Demanda, refDate: Date = new Date()): DemandaComAlerta {
  const diasRestantes = calcularDiasRestantes(demanda.prazo, refDate);
  const { alerta, alertaLabel } = classificarAlerta(demanda.status, diasRestantes);
  return {
    ...demanda,
    diasRestantes,
    alerta,
    alertaLabel,
  };
}

export function formatarDataPtBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}
