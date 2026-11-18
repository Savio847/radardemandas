import React from 'react';
import {
  BadgeDollarSign,
  BarChart3,
  BookOpenCheck,
  Calculator,
  Coins,
  FileSpreadsheet,
  FileText,
  Landmark,
  Percent,
  PieChart,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';

interface ObjetoContabil {
  id: string;
  Icone: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  top: string;
  left: string;
  sizeClass: string;
  animClass: string;
  delay: string;
  opacityClass: string;
}

const OBJETOS_CONTABEIS: ObjetoContabil[] = [
  {
    id: 'calc-1',
    Icone: Calculator,
    top: '9%',
    left: '3%',
    sizeClass: 'h-20 w-20',
    animClass: 'accounting-float-a',
    delay: '0s',
    opacityClass: 'opacity-[0.18]',
  },
  {
    id: 'ledger-1',
    Icone: FileSpreadsheet,
    top: '12%',
    left: '82%',
    sizeClass: 'h-24 w-24',
    animClass: 'accounting-float-b',
    delay: '-3s',
    opacityClass: 'opacity-[0.16]',
  },
  {
    id: 'scale-1',
    Icone: Scale,
    top: '36%',
    left: '5%',
    sizeClass: 'h-24 w-24',
    animClass: 'accounting-float-c',
    delay: '-5s',
    opacityClass: 'opacity-[0.17]',
  },
  {
    id: 'receipt-1',
    Icone: Receipt,
    top: '24%',
    left: '44%',
    sizeClass: 'h-16 w-16',
    animClass: 'accounting-float-a',
    delay: '-7s',
    opacityClass: 'opacity-[0.15]',
  },
  {
    id: 'pie-1',
    Icone: PieChart,
    top: '50%',
    left: '86%',
    sizeClass: 'h-24 w-24',
    animClass: 'accounting-float-b',
    delay: '-2s',
    opacityClass: 'opacity-[0.18]',
  },
  {
    id: 'landmark-1',
    Icone: Landmark,
    top: '68%',
    left: '4%',
    sizeClass: 'h-20 w-20',
    animClass: 'accounting-float-b',
    delay: '-6s',
    opacityClass: 'opacity-[0.17]',
  },
  {
    id: 'percent-1',
    Icone: Percent,
    top: '72%',
    left: '38%',
    sizeClass: 'h-16 w-16',
    animClass: 'accounting-float-c',
    delay: '-4s',
    opacityClass: 'opacity-[0.16]',
  },
  {
    id: 'doc-1',
    Icone: FileText,
    top: '15%',
    left: '24%',
    sizeClass: 'h-16 w-16',
    animClass: 'accounting-float-c',
    delay: '-9s',
    opacityClass: 'opacity-[0.15]',
  },
  {
    id: 'trend-1',
    Icone: TrendingUp,
    top: '78%',
    left: '74%',
    sizeClass: 'h-20 w-20',
    animClass: 'accounting-float-a',
    delay: '-5s',
    opacityClass: 'opacity-[0.18]',
  },
  {
    id: 'wallet-1',
    Icone: Wallet,
    top: '44%',
    left: '64%',
    sizeClass: 'h-16 w-16',
    animClass: 'accounting-float-c',
    delay: '-8s',
    opacityClass: 'opacity-[0.15]',
  },
  {
    id: 'coins-1',
    Icone: Coins,
    top: '58%',
    left: '22%',
    sizeClass: 'h-18 w-18',
    animClass: 'accounting-float-a',
    delay: '-10s',
    opacityClass: 'opacity-[0.16]',
  },
  {
    id: 'dollar-1',
    Icone: BadgeDollarSign,
    top: '30%',
    left: '68%',
    sizeClass: 'h-16 w-16',
    animClass: 'accounting-float-b',
    delay: '-1s',
    opacityClass: 'opacity-[0.15]',
  },
  {
    id: 'book-1',
    Icone: BookOpenCheck,
    top: '82%',
    left: '16%',
    sizeClass: 'h-20 w-20',
    animClass: 'accounting-float-c',
    delay: '-11s',
    opacityClass: 'opacity-[0.16]',
  },
  {
    id: 'chart-1',
    Icone: BarChart3,
    top: '18%',
    left: '60%',
    sizeClass: 'h-18 w-18',
    animClass: 'accounting-float-a',
    delay: '-6s',
    opacityClass: 'opacity-[0.15]',
  },
];

export function AccountingBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {OBJETOS_CONTABEIS.map(({ id, Icone, top, left, sizeClass, animClass, delay, opacityClass }) => (
        <div
          key={id}
          style={{ top, left, animationDelay: delay }}
          className={`absolute text-[#6b1229] ${opacityClass} ${animClass}`}
        >
          <Icone className={sizeClass} strokeWidth={1.35} />
        </div>
      ))}
    </div>
  );
}
