import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  Target, TrendingUp, TrendingDown, PackageCheck, CalendarDays, Gauge,
  Settings2, ClipboardList, CalendarRange, FlaskConical, History, FileBarChart2,
  LayoutDashboard, Sun, Moon, Plus, Trash2, Download, RotateCcw, AlertTriangle,
  CheckCircle2, Info, Layers, Percent, ListChecks, HelpCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { kvGetAll, kvSet } from "./lib/dashboardStorage";

/* ============================== HELPERS ============================== */

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
  "Agosto","Setembro","Outubro","Novembro","Dezembro"];

const fmt = (n, d = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const daysInMonth = (month, year) => new Date(year, month, 0).getDate();

const uid = () => Math.random().toString(36).slice(2, 10);

// Mediana em vez de média simples: usada para estimar o "programado" de um dia
// típico (planejadoDiario). A média aritmética é muito sensível a dias fora
// da curva (ex.: um dia pontual com programado bem acima do normal), o que
// distorceria a projeção dos dias restantes. A mediana reflete melhor o que
// costuma ser programado em um dia comum.
function mediana(valores) {
  const nums = valores.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const meio = Math.floor(nums.length / 2);
  return nums.length % 2 !== 0 ? nums[meio] : (nums[meio - 1] + nums[meio]) / 2;
}

/* ============================== LINHAS DE PRODUÇÃO ============================== */

const LINHAS = [
  { nome: "G.A", metaTotal: 8000, diasPlanejados: 22, mediaBase: 360, oeeAtual: 68 },
  { nome: "Grostoli", metaTotal: 6000, diasPlanejados: 22, mediaBase: 270, oeeAtual: 72 },
  { nome: "Boleado", metaTotal: 9000, diasPlanejados: 22, mediaBase: 410, oeeAtual: 65 },
  { nome: "Coxinha TCH", metaTotal: 7000, diasPlanejados: 22, mediaBase: 320, oeeAtual: 70 },
  { nome: "Pão de Queijo TCH", metaTotal: 5000, diasPlanejados: 22, mediaBase: 230, oeeAtual: 60 },
  { nome: "Pré-Assados", metaTotal: 6500, diasPlanejados: 22, mediaBase: 300, oeeAtual: 75 },
  { nome: "Pastel", metaTotal: 5500, diasPlanejados: 22, mediaBase: 250, oeeAtual: 65 },
];
const NOMES_LINHAS = LINHAS.map((l) => l.nome);

/* Lista usada apenas na página de OEE:
   - G.A é dividido em G.A 1 e G.A 2
   - Coxinha TCH e Pão de Queijo TCH são unificadas em uma única "TCH"
   (a produção continua com as linhas originais separadas) */
const NOMES_OEE = [
  "G.A 1", "G.A 2", "Grostoli", "Boleado", "TCH", "Pré-Assados", "Pastel",
];
const OEE_ATUAL_PADRAO = {
  "G.A 1": 68, "G.A 2": 68, "Grostoli": 72, "Boleado": 65,
  "TCH": 65, "Pré-Assados": 75, "Pastel": 65,
};

const VARIACOES = [10, -10, 20, -15, 5, 25, -20, 10, 15, -5, 0, 20, -10, 15];
const OBS_DEMO = [
  "Produção normal","Produção normal","Parada de máquina","Produção normal",
  "Acima do planejado","Falta de matéria-prima","Produção normal","Produção normal",
  "Recorde do dia","Produção normal","Manutenção preventiva","Produção normal",
  "Produção normal","Acima do planejado",
];

function gerarDemoProducoes(linhaCfg) {
  const planejadoDia = Math.round(linhaCfg.metaTotal / linhaCfg.diasPlanejados);
  return VARIACOES.map((v, i) => ({
    id: uid(),
    data: `2026-08-${String(i + 1).padStart(2, "0")}`,
    quantidade: Math.max(linhaCfg.mediaBase + v, 0),
    planejado: planejadoDia,
    observacao: OBS_DEMO[i],
  }));
}

const DEFAULT_META_PERCENTUAL = 97;

function buildDemoState() {
  const producoes = {}, historico = {};
  LINHAS.forEach((l) => {
    producoes[l.nome] = gerarDemoProducoes(l);
    historico[l.nome] = [
      { mes: "Junho", ano: 2026, metaPercentual: DEFAULT_META_PERCENTUAL, mediaAtingidaPercentual: 99.1, diasProdutivos: 22, status: "Atingida" },
      { mes: "Julho", ano: 2026, metaPercentual: DEFAULT_META_PERCENTUAL, mediaAtingidaPercentual: 91.4, diasProdutivos: 23, status: "Não atingida" },
    ];
  });
  return { producoes, historico };
}

const PERIODO_PADRAO = { mes: 8, ano: 2026, diasProdutivosPlanejados: 22, diasProdutivosRestantes: 8 };

const DEFAULT_OEE_DIAS = 14;
const DEFAULT_OEE_META = 85;

/* ============================== THEME ============================== */

const theme = (dark) => ({
  bg: dark ? "bg-slate-950" : "bg-stone-100",
  bgSoft: dark ? "bg-slate-900" : "bg-white",
  panel: dark ? "bg-slate-900 border-slate-800" : "bg-white border-stone-300",
  panelHead: dark ? "border-slate-800" : "border-stone-200",
  text: dark ? "text-slate-100" : "text-slate-900",
  textMuted: dark ? "text-slate-400" : "text-slate-500",
  border: dark ? "border-slate-800" : "border-stone-300",
  well: "bg-slate-950",
  wellText: "text-amber-400",
  input: dark
    ? "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-600"
    : "bg-white border-stone-300 text-slate-900 placeholder-stone-400",
  sidebar: dark ? "bg-slate-900 border-slate-800" : "bg-slate-900 border-slate-900",
});

const STATUS = {
  verde: { label: "Dentro do planejado", ring: "ring-emerald-500", bg: "bg-emerald-500", text: "text-emerald-500", soft: "bg-emerald-500/10", icon: CheckCircle2 },
  amarelo: { label: "Atenção", ring: "ring-amber-500", bg: "bg-amber-500", text: "text-amber-500", soft: "bg-amber-500/10", icon: AlertTriangle },
  vermelho: { label: "Risco", ring: "ring-rose-500", bg: "bg-rose-500", text: "text-rose-500", soft: "bg-rose-500/10", icon: AlertTriangle },
  cinza: { label: "Aguardando lançamentos", ring: "ring-slate-500", bg: "bg-slate-500", text: "text-slate-400", soft: "bg-slate-500/10", icon: HelpCircle },
};

/* ============================== SMALL UI PIECES ============================== */

function SegmentedBar({ pct, colorClass }) {
  const total = 24;
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * total);
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-2.5 flex-1 rounded-[1px] ${i < filled ? colorClass : "bg-slate-700/30"}`} />
      ))}
    </div>
  );
}

function Kpi({ t, label, value, unit, sub, accent = "text-amber-400", icon: Icon }) {
  return (
    <div className={`rounded border ${t.panel} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>{label}</span>
        {Icon && <Icon size={15} className={t.textMuted} />}
      </div>
      <div className={`${t.well} rounded px-3 py-2.5`}>
        <div className="flex items-baseline gap-1.5">
          <span className={`font-mono text-2xl md:text-[26px] font-bold tabular-nums ${accent} tracking-tight`}>{value}</span>
          {unit && <span className="font-mono text-[11px] text-slate-500 uppercase">{unit}</span>}
        </div>
      </div>
      {sub && <div className={`text-xs ${t.textMuted}`}>{sub}</div>}
    </div>
  );
}

function Panel({ t, title, icon: Icon, right, children, className = "" }) {
  return (
    <div className={`rounded border ${t.panel} ${className}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${t.panelHead}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-amber-500" />}
          <h3 className={`text-xs font-bold uppercase tracking-widest ${t.textMuted}`}>{title}</h3>
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ t, label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${t.textMuted}`}>{label}</span>
      {children}
    </label>
  );
}

const inputCls = (t) =>
  `${t.input} border rounded px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-amber-500/60`;

/* ============================== CALC ENGINE (meta mensal) ============================== */

/*
 * Modelo: a meta é uma % mensal (ex.: 97%). Cada dia lançado tem uma
 * produção planejada (un/dia — vem do lançamento, ou cai no planejadoDiario
 * padrão da linha). A "Média atual" e o "Necessário por dia" são calculados
 * SEMPRE ponderados por volume (soma de unidades ÷ soma de planejado), nunca
 * como média simples dos % de cada dia — assim um dia com planejado grande
 * (ex.: 561 un) pesa proporcionalmente mais do que um dia com planejado
 * pequeno (ex.: 106 un), em vez de todo dia valer "1 dia" igual.
 *
 * "Necessário por dia" (em unidades):
 *   planejadoTotalMes = planejado já realizado + planejado estimado p/ os dias restantes
 *   produçãoNecessáriaTotal = meta% × planejadoTotalMes
 *   produçãoNecessáriaRestante = produçãoNecessáriaTotal − produção já realizada
 *   necessário/dia (un) = produçãoNecessáriaRestante ÷ dias restantes
 */
function computeCalc(meta, producoesInput) {
  const producoes = producoesInput || [];
  {
    const metaPercentual = Number(meta.metaPercentual || 0);

    // "Produção planejada por dia" não é mais configurada manualmente — o dashboard
    // deriva esse valor da própria produção lançada, servindo apenas de referência
    // para dias sem programado e para estimar os dias restantes. Usa a MEDIANA
    // (não a média) dos dias já programados: assim um dia pontual fora da curva
    // (ex.: um programado excepcionalmente alto por um pedido grande) não puxa
    // a estimativa de "dia típico" pra cima e não distorce a projeção dos dias
    // que ainda faltam.
    const planejadoAcumulado = producoes.reduce((s, p) => s + Number(p.planejado || 0), 0);
    const valoresPlanejados = producoes.map((p) => Number(p.planejado || 0)).filter((v) => v > 0);
    const diasComPlanejado = valoresPlanejados.length;
    const planejadoDiario = mediana(valoresPlanejados);

    const producaoAcumulada = producoes.reduce((s, p) => s + Number(p.quantidade || 0), 0);
    const diasRealizados = producoes.length;
    const diasRestantes = Math.max(Number(meta.diasProdutivosRestantes) || 0, 0);
    const diasTotais = diasRealizados + diasRestantes;

    const percentuaisDiarios = producoes.map((p) => {
      const planejadoDia = Number(p.planejado || 0) || planejadoDiario;
      return planejadoDia > 0 ? (Number(p.quantidade || 0) / planejadoDia) * 100 : 0;
    });
    const somaPercentuais = percentuaisDiarios.reduce((s, v) => s + v, 0);

    // "Média atual" ponderada por volume: produção acumulada ÷ planejado acumulado.
    // Isso evita que um dia com planejado muito maior (ex.: 561 un) tenha o mesmo peso
    // de um dia com planejado pequeno (ex.: 106 un) na hora de calcular a aderência —
    // um dia grande fora da meta pesa mais do que um dia pequeno fora da meta.
    const percentualMedioAtual = planejadoAcumulado > 0 ? (producaoAcumulada / planejadoAcumulado) * 100 : 0;

    const pontosConquistados = somaPercentuais;
    const pontosNecessarios = metaPercentual * diasTotais;
    const pontosQueFaltam = pontosNecessarios - pontosConquistados;

    // Cálculo do "necessário por dia" 100% em unidades (não usa a média de %):
    const planejadoRestanteEstimado = planejadoDiario * diasRestantes;
    const planejadoTotalMes = planejadoAcumulado + planejadoRestanteEstimado;

    // Sem nenhum lançamento com "programado" preenchido ainda, não existe base
    // nenhuma para calcular quanto falta — planejadoTotalMes fica 0 e a conta
    // "necessário por dia" degeneraria para 0 (parecendo "meta já garantida"
    // sem ter sido produzida uma única unidade). Nesse caso sinalizamos que
    // ainda não há dados, em vez de inventar um resultado.
    const semDados = planejadoTotalMes <= 0;

    const producaoNecessariaTotal = (metaPercentual / 100) * planejadoTotalMes;
    const producaoNecessariaRestante = producaoNecessariaTotal - producaoAcumulada;
    const unidadesNecessariasPorDia = !semDados && diasRestantes > 0 ? Math.max(producaoNecessariaRestante / diasRestantes, 0) : 0;
    const percentualNecessarioPorDia = !semDados && planejadoDiario > 0 ? (unidadesNecessariasPorDia / planejadoDiario) * 100 : 0;

    // "Quanto estou devendo": déficit acumulado até agora (planejado - realizado)
    const deficitAcumuladoUnidades = planejadoAcumulado - producaoAcumulada;
    const deficitAcumuladoPercentual = metaPercentual - percentualMedioAtual;

    // Projeção final também ponderada por volume: assume que a aderência ponderada
    // atual (percentualMedioAtual) se mantém nos dias restantes, aplicada sobre o
    // planejado estimado desses dias — e não sobre uma média simples de %.
    const producaoProjetadaRestante = (percentualMedioAtual / 100) * planejadoRestanteEstimado;
    const producaoProjetadaTotal = producaoAcumulada + producaoProjetadaRestante;
    const projecaoPercentualFinal = !semDados && planejadoTotalMes > 0
      ? (producaoProjetadaTotal / planejadoTotalMes) * 100
      : percentualMedioAtual;
    const faltaProjecaoPercentual = metaPercentual - projecaoPercentualFinal;

    let status = "verde";
    if (semDados) {
      status = "cinza";
    } else if (producaoNecessariaRestante <= 0) {
      status = "verde";
    } else if (diasRestantes <= 0) {
      status = "vermelho";
    } else if (percentualNecessarioPorDia <= percentualMedioAtual || diasRealizados === 0) {
      status = "verde";
    } else if (percentualNecessarioPorDia <= percentualMedioAtual + 10) {
      status = "amarelo";
    } else {
      status = "vermelho";
    }

    return {
      planejadoDiario, metaPercentual, semDados,
      producaoAcumulada, planejadoAcumulado, diasRealizados, diasRestantes, diasTotais,
      percentualMedioAtual, pontosConquistados, pontosNecessarios, pontosQueFaltam,
      planejadoRestanteEstimado, planejadoTotalMes, producaoNecessariaTotal, producaoNecessariaRestante,
      percentualNecessarioPorDia, unidadesNecessariasPorDia,
      deficitAcumuladoUnidades, deficitAcumuladoPercentual,
      projecaoPercentualFinal, faltaProjecaoPercentual, status,
    };
  }
}

function useCalc(meta, producoesInput) {
  const producoes = producoesInput || [];
  return useMemo(() => computeCalc(meta, producoes), [meta, producoes]);
}

function buildAlerts(calc, meta) {
  const alerts = [];
  if (calc.semDados) {
    alerts.push({ level: "cinza", text: `Ainda não há lançamentos com produção programada nesta linha neste mês. Assim que houver lançamentos, o dashboard calcula automaticamente quanto falta para fechar em ${fmt(calc.metaPercentual, 1)}%.` });
    return alerts;
  }
  if (calc.producaoNecessariaRestante <= 0) {
    alerts.push({ level: "verde", text: `Meta mensal de ${fmt(calc.metaPercentual, 1)}% já garantida — produção acumulada já cobre o necessário.` });
  } else if (calc.diasRestantes <= 0) {
    alerts.push({ level: "vermelho", text: `Não há mais dias produtivos restantes cadastrados e a meta de ${fmt(calc.metaPercentual, 1)}% ainda não foi atingida.` });
  } else if (calc.percentualNecessarioPorDia <= calc.percentualMedioAtual) {
    alerts.push({ level: "verde", text: `No ritmo atual (${fmt(calc.percentualMedioAtual, 1)}%/dia) a meta de ${fmt(calc.metaPercentual, 1)}% será atingida.` });
  } else {
    alerts.push({ level: calc.status === "vermelho" ? "vermelho" : "amarelo",
      text: `Será necessário produzir em média ${fmt(calc.percentualNecessarioPorDia, 1)}% por dia (${fmt(calc.unidadesNecessariasPorDia)} un/dia) nos ${fmt(calc.diasRestantes)} dias restantes para fechar em ${fmt(calc.metaPercentual, 1)}%.` });
  }
  if (calc.deficitAcumuladoUnidades > 0) {
    alerts.push({ level: "amarelo", text: `Déficit acumulado até agora: ${fmt(calc.deficitAcumuladoUnidades)} unidades (${fmt(calc.deficitAcumuladoPercentual, 1)} p.p. abaixo da meta).` });
  }
  if (calc.status === "vermelho" && calc.producaoNecessariaRestante > 0 && calc.diasRestantes > 0) {
    alerts.push({ level: "vermelho", text: `O % necessário por dia (${fmt(calc.percentualNecessarioPorDia, 1)}%) está bem acima do ritmo atual — risco de não atingir a meta de ${fmt(meta.metaPercentual, 1)}%.` });
  }
  return alerts;
}

/* ============================== APP ============================== */

const NAV = [
  { id: "visao-geral", label: "Visão Geral da Produção", icon: Layers },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "meta", label: "Configuração da Meta", icon: Target },
  { id: "lancamento", label: "Lançamento de Produção", icon: ClipboardList },
  { id: "calendario", label: "Calendário", icon: CalendarRange },
  { id: "simulador", label: 'Simulador "E Se?"', icon: FlaskConical },
  { id: "historico", label: "Histórico", icon: History },
  { id: "oee", label: "OEE por Linha", icon: Percent },
  { id: "roteiro", label: "Roteiro da Qualidade", icon: ListChecks },
  { id: "relatorios", label: "Relatórios", icon: FileBarChart2 },
  { id: "config", label: "Configurações", icon: Settings2 },
];

export default function App() {
  const [dark, setDark] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [linhaAtiva, setLinhaAtiva] = useState(NOMES_LINHAS[0]);
  const initial = useMemo(buildDemoState, []);
  const [producoesAll, setProducoesAll] = useState(initial.producoes);
  const [historicoAll] = useState(initial.historico);
  const [oee, setOee] = useState(() => {
    const porLinha = {};
    NOMES_OEE.forEach((nome) => {
      porLinha[nome] = {
        atual: OEE_ATUAL_PADRAO[nome] ?? 65,
        meta: DEFAULT_OEE_META,
        dias: DEFAULT_OEE_DIAS,
      };
    });
    return { porLinha };
  });
  const [roteiroCfg, setRoteiroCfg] = useState(DEFAULT_ROTEIRO);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [metaGlobalPercentual, setMetaGlobalPercentual] = useState(DEFAULT_META_PERCENTUAL);
  const [periodoGlobal, setPeriodoGlobal] = useState(PERIODO_PADRAO);
  const [supervisorNome, setSupervisorNome] = useState("");

  const t = theme(dark);
  // Meta% e período/dias produtivos são globais — valem para todas as linhas.
  const meta = useMemo(
    () => ({ ...periodoGlobal, metaPercentual: metaGlobalPercentual }),
    [periodoGlobal, metaGlobalPercentual]
  );
  // Fallback defensivo: se a linha ativa não existir ainda nos dados salvos
  // (ex.: dado salvo antes dessa linha ter sido criada), usa uma lista vazia
  // em vez de deixar o app quebrar/travar naquela linha.
  const producoes = producoesAll[linhaAtiva] || [];
  const calc = useCalc(meta, producoes);
  const alerts = buildAlerts(calc, meta);
  const oeeLinhas = useMemo(() => calcOeeLinhas(oee), [oee]);
  const roteiroResumo = useMemo(() => calcRoteiro(roteiroCfg), [roteiroCfg]);

  const setProducoes = (updater) =>
    setProducoesAll((all) => ({ ...all, [linhaAtiva]: typeof updater === "function" ? updater(all[linhaAtiva] || []) : updater }));

  /* ====================== persistência via Supabase ======================
   * Todo o estado do dashboard é salvo numa única tabela "dashboard_kv"
   * (chave/valor em JSON) — veja schema.sql. Sempre faz merge com os
   * dados padrão (initial), nunca substitui por completo, para que uma
   * linha nova (ou dado ainda não salvo) nunca deixe o app travado.
   */
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const dados = await kvGetAll();
      if (cancelado) return;
      if (dados === null) {
        // Supabase não respondeu (offline, não configurado, etc.) — segue
        // com os dados de demonstração em memória, sem travar o app.
        setLoadError("Não foi possível conectar ao Supabase. Verifique a configuração (veja .env.example) — os dados abaixo são apenas locais e não serão salvos.");
        setLoaded(true);
        return;
      }
      if (dados.producoes_all) setProducoesAll((prev) => ({ ...initial.producoes, ...dados.producoes_all }));
      if (dados.oee) setOee((prev) => ({ porLinha: { ...prev.porLinha, ...(dados.oee.porLinha || {}) } }));
      if (dados.roteiro_qualidade) setRoteiroCfg((prev) => ({ ...prev, ...dados.roteiro_qualidade }));
      if (dados.tema_dark !== undefined) setDark(dados.tema_dark);
      if (dados.linha_ativa && NOMES_LINHAS.includes(dados.linha_ativa)) setLinhaAtiva(dados.linha_ativa);
      if (dados.meta_global_percentual !== undefined) setMetaGlobalPercentual(dados.meta_global_percentual);
      if (dados.periodo_global) setPeriodoGlobal((prev) => ({ ...PERIODO_PADRAO, ...dados.periodo_global }));
      if (dados.supervisor_nome !== undefined) setSupervisorNome(dados.supervisor_nome);
      setLoaded(true);
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => { if (loaded) kvSet("meta_global_percentual", metaGlobalPercentual); }, [metaGlobalPercentual, loaded]);
  useEffect(() => { if (loaded) kvSet("periodo_global", periodoGlobal); }, [periodoGlobal, loaded]);
  useEffect(() => { if (loaded) kvSet("supervisor_nome", supervisorNome); }, [supervisorNome, loaded]);
  useEffect(() => { if (loaded) kvSet("producoes_all", producoesAll); }, [producoesAll, loaded]);
  useEffect(() => { if (loaded) kvSet("oee", oee); }, [oee, loaded]);
  useEffect(() => { if (loaded) kvSet("roteiro_qualidade", roteiroCfg); }, [roteiroCfg, loaded]);
  useEffect(() => { if (loaded) kvSet("tema_dark", dark); }, [dark, loaded]);
  useEffect(() => { if (loaded) kvSet("linha_ativa", linhaAtiva); }, [linhaAtiva, loaded]);

  const resetDemo = () => {
    const fresh = buildDemoState();
    setProducoesAll(fresh.producoes);
    setMetaGlobalPercentual(DEFAULT_META_PERCENTUAL);
    setPeriodoGlobal(PERIODO_PADRAO);
    setRoteiroCfg(DEFAULT_ROTEIRO);
    const porLinha = {};
    NOMES_OEE.forEach((nome) => {
      porLinha[nome] = {
        atual: OEE_ATUAL_PADRAO[nome] ?? 65,
        meta: DEFAULT_OEE_META,
        dias: DEFAULT_OEE_DIAS,
      };
    });
    setOee({ porLinha });
  };

  const LinhaSelector = (
    <Field t={t} label="Linha de produção">
      <select className={inputCls(t)} value={linhaAtiva} onChange={(e) => setLinhaAtiva(e.target.value)}>
        {NOMES_LINHAS.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </Field>
  );

  if (!loaded) {
    return (
      <div className={`min-h-screen w-full ${t.bg} ${t.text} flex items-center justify-center font-sans`}>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Gauge size={16} className="text-amber-400 animate-pulse" /> Carregando dados do Supabase…
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full ${t.bg} ${t.text} flex font-sans`}>
      {loadError && (
        <div className="fixed top-0 inset-x-0 z-50 bg-rose-600 text-white text-xs font-semibold text-center py-1.5 px-3">
          {loadError}
        </div>
      )}
      <aside className={`hidden md:flex flex-col w-60 shrink-0 border-r ${t.sidebar} text-slate-100`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="bg-white rounded-md px-3 py-2.5 inline-block max-w-full">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Grupo Doce D'ocê" className="h-9 w-auto max-w-full object-contain" />
          </div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Painel de produção · multi-linhas</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button key={n.id} onClick={() => setPage(n.id)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left border-l-2 transition-colors ${
                  active ? "border-amber-400 bg-slate-800/70 text-amber-300 font-semibold" : "border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"
                }`}>
                <Icon size={16} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 text-[11px] text-slate-500">
          {MESES[meta.mes - 1]}/{meta.ano} · dados de demonstração
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-30">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-slate-100 border-b border-slate-800">
          <div className="bg-white rounded px-2.5 py-1.5">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Grupo Doce D'ocê" className="h-6 w-auto max-w-[220px] object-contain" />
          </div>
          <button onClick={() => setNavOpen((v) => !v)} className="text-slate-300 text-xs uppercase tracking-wide border border-slate-700 rounded px-2 py-1">Menu</button>
        </div>
        {navOpen && (
          <div className="bg-slate-900 border-b border-slate-800">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = page === n.id;
              return (
                <button key={n.id} onClick={() => { setPage(n.id); setNavOpen(false); }}
                  className={`w-full flex items-center gap-3 px-5 py-3 text-sm text-left border-l-2 ${active ? "border-amber-400 text-amber-300 bg-slate-800/70" : "border-transparent text-slate-400"}`}>
                  <Icon size={16} />
                  {n.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <main className="flex-1 min-w-0 pt-16 md:pt-0">
        <header className={`flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b ${t.border}`}>
          <div>
            <h1 className="text-lg font-bold tracking-tight">{NAV.find((n) => n.id === page)?.label}</h1>
            <p className={`text-xs ${t.textMuted} mt-0.5`}>{page === "oee" || page === "visao-geral" ? "visão de todas as linhas" : `linha: ${linhaAtiva}`}</p>
          </div>
          <div className="flex items-end gap-3">
            {page !== "oee" && page !== "visao-geral" && <div className="w-48"><Layers size={0} />{LinhaSelector}</div>}
            <button onClick={() => setDark((d) => !d)}
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-3 py-2 h-[38px]`}>
              {dark ? <Sun size={14} /> : <Moon size={14} />}
              {dark ? "Claro" : "Escuro"}
            </button>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {page === "visao-geral" && (
            <VisaoGeralProducao t={t} meta={meta} producoesAll={producoesAll} setPage={setPage} setLinhaAtiva={setLinhaAtiva} />
          )}
          {page === "dashboard" && (
            <Dashboard
              t={t} meta={meta} calc={calc} alerts={alerts} producoes={producoes} supervisorNome={supervisorNome}
              oeeLinhas={oeeLinhas} roteiroResumo={roteiroResumo} setPage={setPage}
            />
          )}
          {page === "meta" && (
            <MetaConfig
              t={t} calc={calc}
              metaGlobalPercentual={metaGlobalPercentual}
              setMetaGlobalPercentual={setMetaGlobalPercentual}
              periodoGlobal={periodoGlobal}
              setPeriodoGlobal={setPeriodoGlobal}
            />
          )}
          {page === "lancamento" && <Lancamento t={t} producoes={producoes} setProducoes={setProducoes} meta={meta} calc={calc} />}
          {page === "calendario" && <Calendario t={t} meta={meta} producoes={producoes} calc={calc} />}
          {page === "simulador" && <Simulador t={t} meta={meta} calc={calc} />}
          {page === "historico" && <Historico t={t} historico={historicoAll[linhaAtiva] || []} />}
          {page === "oee" && <OeePorLinha t={t} oee={oee} setOee={setOee} />}
          {page === "roteiro" && <RoteiroQualidade t={t} cfg={roteiroCfg} setCfg={setRoteiroCfg} />}
          {page === "relatorios" && <Relatorios t={t} meta={meta} producoes={producoes} calc={calc} linha={linhaAtiva} />}
          {page === "config" && (
            <ConfigPage
              t={t} dark={dark} setDark={setDark} resetDemo={resetDemo}
              supervisorNome={supervisorNome} setSupervisorNome={setSupervisorNome}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ============================== VISÃO GERAL DA PRODUÇÃO ============================== */

function VisaoGeralProducao({ t, meta, producoesAll, setPage, setLinhaAtiva }) {
  const linhas = useMemo(
    () => NOMES_LINHAS.map((nome) => ({ nome, calc: computeCalc(meta, producoesAll[nome] || []) })),
    [meta, producoesAll]
  );

  const irParaDashboard = (nome) => {
    if (setLinhaAtiva) setLinhaAtiva(nome);
    if (setPage) setPage("dashboard");
  };

  return (
    <div className="flex flex-col gap-5">
      <p className={`text-xs ${t.textMuted}`}>
        Aderência atual e déficit acumulado de cada linha, considerando a meta mensal de {fmt(meta.metaPercentual, 1)}% em {MESES[meta.mes - 1]}/{meta.ano}.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {linhas.map(({ nome, calc }) => {
          const S = STATUS[calc.status];
          const SIcon = S.icon;
          return (
            <button
              key={nome}
              onClick={() => irParaDashboard(nome)}
              className={`text-left rounded border ${t.panel} p-4 flex flex-col gap-3 hover:ring-1 hover:ring-amber-500/50 transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight">{nome}</h3>
                <span className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${S.text}`}>
                  <SIcon size={13} /> {S.label}
                </span>
              </div>

              <div className={`${t.well} rounded px-3 py-2.5`}>
                <div className={`text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1`}>Aderência atual</div>
                {calc.semDados ? (
                  <span className="font-mono text-xl font-bold text-slate-500">—</span>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-2xl font-bold tabular-nums ${t.wellText} tracking-tight`}>
                      {fmt(calc.percentualMedioAtual, 1)}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 uppercase">% da meta ({fmt(calc.metaPercentual, 1)}%)</span>
                  </div>
                )}
              </div>

              <div>
                <div className={`text-[10px] font-semibold uppercase tracking-widest ${t.textMuted} mb-1`}>Déficit acumulado</div>
                {calc.semDados ? (
                  <span className="font-mono text-sm text-slate-500">—</span>
                ) : calc.deficitAcumuladoUnidades > 0 ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold text-rose-500">{fmt(calc.deficitAcumuladoUnidades)}</span>
                    <span className={`text-xs ${t.textMuted}`}>un ({fmt(calc.deficitAcumuladoPercentual, 1)} p.p.)</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-lg font-bold text-emerald-500">0</span>
                    <span className={`text-xs ${t.textMuted}`}>sem déficit — dentro ou acima do planejado</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== DASHBOARD ============================== */

function Dashboard({ t, meta, calc, alerts, producoes, supervisorNome, oeeLinhas, roteiroResumo, setPage }) {
  const St = STATUS[calc.status];
  const StIcon = St.icon;

  const oeeResumo = useMemo(() => {
    if (!oeeLinhas || oeeLinhas.length === 0) return null;
    const mediaAtual = oeeLinhas.reduce((s, l) => s + l.atual, 0) / oeeLinhas.length;
    const mediaMeta = oeeLinhas.reduce((s, l) => s + l.meta, 0) / oeeLinhas.length;
    const contagem = { verde: 0, amarelo: 0, vermelho: 0 };
    oeeLinhas.forEach((l) => { contagem[l.nivel] = (contagem[l.nivel] || 0) + 1; });
    const piorNivel = contagem.vermelho > 0 ? "vermelho" : contagem.amarelo > 0 ? "amarelo" : "verde";
    return { mediaAtual, mediaMeta, contagem, piorNivel, total: oeeLinhas.length };
  }, [oeeLinhas]);

  const chartData = useMemo(() => {
    const sorted = [...producoes].sort((a, b) => a.data.localeCompare(b.data));
    let somaPercentuais = 0;
    return sorted.map((p, i) => {
      const planejadoDia = Number(p.planejado || 0) || calc.planejadoDiario;
      const percentualDia = planejadoDia > 0 ? (Number(p.quantidade || 0) / planejadoDia) * 100 : 0;
      somaPercentuais += percentualDia;
      return {
        dia: fmtDate(p.data).slice(0, 5),
        producaoDia: p.quantidade,
        percentualDia: +percentualDia.toFixed(1),
        percentual: +(somaPercentuais / (i + 1)).toFixed(1),
        MetaMensal: calc.metaPercentual,
      };
    });
  }, [producoes, calc.planejadoDiario, calc.metaPercentual]);

  return (
    <div className="flex flex-col gap-5">
      {supervisorNome && supervisorNome.trim() && (
        <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${t.textMuted}`}>
          <Gauge size={13} className="text-amber-400" />
          Supervisor de Produção, {supervisorNome.trim()}
        </div>
      )}
      <div className={`rounded border ${t.border} ${St.soft} px-4 py-3 flex items-center gap-3`}>
        <StIcon size={20} className={St.text} />
        <div>
          <div className={`text-sm font-bold ${St.text}`}>{St.label.toUpperCase()}</div>
          <div className={`text-xs ${t.textMuted}`}>
            {calc.semDados
              ? "Ainda não há lançamentos com produção programada nesta linha neste mês."
              : calc.producaoNecessariaRestante <= 0 ? "Meta mensal já garantida." : `Necessário ${fmt(calc.percentualNecessarioPorDia, 1)}%/dia (${fmt(calc.unidadesNecessariasPorDia)} un/dia) · média atual de ${fmt(calc.percentualMedioAtual, 1)}%/dia`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`rounded border ${t.panel} p-4`}>
          <div className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted} mb-2`}>Quanto preciso produzir por dia daqui pra frente?</div>
          {calc.semDados ? (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-500">—</span>
              <span className="text-xs text-slate-500 font-mono uppercase">aguardando lançamentos</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-amber-400">{fmt(calc.percentualNecessarioPorDia, 1)}%</span>
              <span className="text-xs text-slate-500 font-mono uppercase">{fmt(calc.unidadesNecessariasPorDia)} un/dia · {calc.diasRestantes} dias restantes</span>
            </div>
          )}
        </div>
        <div className={`rounded border ${t.panel} p-4`}>
          <div className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted} mb-2`}>No ritmo atual, vou atingir a meta?</div>
          {calc.semDados ? (
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-500">—</span>
              <span className="text-xs text-slate-500 font-mono uppercase">sem dados suficientes ainda</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-3xl font-bold ${calc.faltaProjecaoPercentual <= 0 ? "text-emerald-500" : "text-rose-500"}`}>{fmt(calc.projecaoPercentualFinal, 1)}%</span>
              <span className="text-xs text-slate-500 font-mono uppercase">projetado de {fmt(calc.metaPercentual, 1)}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className={`rounded border ${t.panel} p-4 col-span-2 lg:col-span-1 flex flex-col gap-3`}>
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>Meta do mês</span>
          <div className={`${t.well} rounded px-3 py-2.5`}>
            <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">{fmt(meta.metaPercentual, 1)}%</span>
          </div>
          <SegmentedBar pct={calc.percentualMedioAtual} colorClass={St.bg} />
          <span className={`text-xs ${t.textMuted}`}>aderência {fmt(calc.percentualMedioAtual, 1)}% / meta {fmt(meta.metaPercentual, 1)}%</span>
        </div>
        <Kpi t={t} label="Produzido até agora" value={fmt(calc.producaoAcumulada)} unit="un" icon={PackageCheck} sub={`${fmt(calc.percentualMedioAtual, 1)}% de aderência`} />
        <Kpi t={t} label="Déficit acumulado" value={calc.deficitAcumuladoUnidades <= 0 ? "0" : fmt(calc.deficitAcumuladoUnidades)} unit={calc.deficitAcumuladoUnidades <= 0 ? "" : "un"}
          icon={Target} accent={calc.deficitAcumuladoUnidades <= 0 ? "text-emerald-400" : "text-amber-400"} sub={calc.deficitAcumuladoUnidades <= 0 ? "SEM DÉFICIT" : `${fmt(calc.deficitAcumuladoPercentual, 1)} p.p. abaixo`} />
        <Kpi t={t} label="Dias produtivos restantes" value={fmt(calc.diasRestantes)} unit="dias" icon={CalendarDays} sub={`${fmt(calc.diasRealizados)} dias já realizados`} />
        <Kpi t={t} label="Necessário por dia" value={calc.semDados ? "—" : fmt(calc.percentualNecessarioPorDia, 1)} unit={calc.semDados ? "" : "%/dia"} icon={TrendingUp} sub={calc.semDados ? "aguardando lançamentos" : `${fmt(calc.unidadesNecessariasPorDia)} un/dia para bater a meta`} />
        <Kpi t={t} label="Aderência atual" value={calc.semDados ? "—" : fmt(calc.percentualMedioAtual, 1)} unit={calc.semDados ? "" : "%"} icon={calc.percentualMedioAtual >= calc.percentualNecessarioPorDia ? TrendingUp : TrendingDown}
          accent={calc.semDados ? "text-slate-500" : calc.percentualMedioAtual >= calc.percentualNecessarioPorDia ? "text-emerald-400" : "text-rose-400"} sub={calc.semDados ? "sem lançamentos ainda" : `ponderada por volume · vs. ${fmt(calc.percentualNecessarioPorDia, 1)}% necessário`} />
      </div>

      <Panel t={t} title="Projeção de produção" icon={FlaskConical}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
          {[
            ["Produção atual", fmt(calc.producaoAcumulada)],
            ["Média diária atual (%)", calc.semDados ? "—" : `${fmt(calc.percentualMedioAtual, 1)}%`],
            ["Dias restantes", fmt(calc.diasRestantes)],
            ["Projeção final (%)", calc.semDados ? "—" : `${fmt(calc.projecaoPercentualFinal, 1)}%`],
            [calc.faltaProjecaoPercentual <= 0 ? "Excedente projetado" : "Falta projetada", calc.semDados ? "—" : `${fmt(Math.abs(calc.faltaProjecaoPercentual), 1)} p.p.`],
          ].map(([l, v]) => (
            <div key={l}>
              <div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>{l}</div>
              <div className="font-mono text-lg font-bold">{v}</div>
            </div>
          ))}
        </div>
        {calc.semDados ? (
          <div className="text-sm font-semibold flex items-center gap-2 text-slate-400">
            <HelpCircle size={16} />
            Ainda não há lançamentos com produção programada nesta linha neste mês — a projeção aparece assim que houver dados.
          </div>
        ) : (
          <div className={`text-sm font-semibold flex items-center gap-2 ${calc.faltaProjecaoPercentual <= 0 ? "text-emerald-500" : "text-rose-500"}`}>
            {calc.faltaProjecaoPercentual <= 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {calc.faltaProjecaoPercentual <= 0
              ? `Meta provavelmente será atingida (excedente de ${fmt(Math.abs(calc.faltaProjecaoPercentual), 1)} p.p.)`
              : `Meta provavelmente não será atingida no ritmo atual (faltam ${fmt(calc.faltaProjecaoPercentual, 1)} p.p.)`}
          </div>
        )}
      </Panel>

      <Panel t={t} title="Alertas" icon={AlertTriangle}>
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => {
            const s = STATUS[a.level];
            const Icon = s.icon;
            return (
              <div key={i} className={`flex items-start gap-2 text-sm rounded px-3 py-2 ${s.soft}`}>
                <Icon size={15} className={`${s.text} mt-0.5 shrink-0`} />
                <span>{a.text}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {oeeResumo && (
          <button
            onClick={() => setPage?.("oee")}
            className={`text-left rounded border ${t.panel} p-4 hover:ring-1 hover:ring-amber-400/40 transition-shadow cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Percent size={15} className={t.textMuted} />
                <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>OEE por linha</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS[oeeResumo.piorNivel].soft} ${STATUS[oeeResumo.piorNivel].text}`}>
                {STATUS[oeeResumo.piorNivel].label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-amber-400">{fmt(oeeResumo.mediaAtual, 1)}%</span>
              <span className={`text-xs ${t.textMuted}`}>média atual · meta média {fmt(oeeResumo.mediaMeta, 1)}%</span>
            </div>
            <div className={`text-xs ${t.textMuted} mt-2`}>
              {oeeResumo.contagem.vermelho > 0 && <span className="text-rose-500 font-semibold">{oeeResumo.contagem.vermelho} em risco</span>}
              {oeeResumo.contagem.vermelho > 0 && (oeeResumo.contagem.amarelo > 0 || oeeResumo.contagem.verde > 0) && " · "}
              {oeeResumo.contagem.amarelo > 0 && <span className="text-amber-500 font-semibold">{oeeResumo.contagem.amarelo} atenção</span>}
              {oeeResumo.contagem.amarelo > 0 && oeeResumo.contagem.verde > 0 && " · "}
              {oeeResumo.contagem.verde > 0 && <span className="text-emerald-500 font-semibold">{oeeResumo.contagem.verde} ok</span>}
              {" "}de {oeeResumo.total} linhas · ver detalhes →
            </div>
          </button>
        )}

        <button
          onClick={() => setPage?.("roteiro")}
          className={`text-left rounded border ${t.panel} p-4 hover:ring-1 hover:ring-amber-400/40 transition-shadow cursor-pointer`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className={t.textMuted} />
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>Roteiro da qualidade</span>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS[roteiroResumo.status].soft} ${STATUS[roteiroResumo.status].text}`}>
              {STATUS[roteiroResumo.status].label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-amber-400">{fmt(roteiroResumo.notaMediaAtual, 1)}%</span>
            <span className={`text-xs ${t.textMuted}`}>nota média · meta {fmt(roteiroResumo.meta, 1)}%</span>
          </div>
          <div className={`text-xs ${t.textMuted} mt-2`}>
            {fmt(roteiroResumo.feitos)} feitos · {fmt(roteiroResumo.restantes)} restantes · ver detalhes →
          </div>
        </button>
      </div>

      <Panel t={t} title="Programado x realizado por dia" icon={ClipboardList}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Programado</th><th className="py-2 pr-3">Realizado</th><th className="py-2 pr-3">Diferença</th><th className="py-2 pr-3">%</th>
              </tr>
            </thead>
            <tbody>
              {[...producoes].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 8).map((p) => {
                const planejado = Number(p.planejado || 0) || calc.planejadoDiario;
                const diff = p.quantidade - planejado;
                const pct = planejado > 0 ? (p.quantidade / planejado) * 100 : 0;
                return (
                  <tr key={p.id} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-mono">{fmtDate(p.data)}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(planejado)}</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-amber-500">{fmt(p.quantidade)}</td>
                    <td className={`py-2 pr-3 font-mono font-semibold ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{diff >= 0 ? "+" : ""}{fmt(diff)}</td>
                    <td className="py-2 pr-3 font-mono">{fmt(pct, 1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel t={t} title="Média acumulada de % x meta" icon={FileBarChart2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="MetaMensal" name="Meta" stroke="#64748b" strokeDasharray="4 3" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="percentual" name="Média acumulada" stroke="#f59e0b" dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel t={t} title="% do dia (realizado ÷ planejado)" icon={FileBarChart2}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip />
                <ReferenceLine y={calc.metaPercentual} stroke="#10b981" strokeDasharray="4 3" />
                <Bar dataKey="percentualDia" name="% do dia" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel t={t} title="Produção diária (unidades)" icon={FileBarChart2} className="xl:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <ReferenceLine y={calc.planejadoDiario} stroke="#64748b" strokeDasharray="4 3" />
                <Bar dataKey="producaoDia" name="Produção" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================== META CONFIG ============================== */

function MetaConfig({ t, calc, metaGlobalPercentual, setMetaGlobalPercentual, periodoGlobal, setPeriodoGlobal }) {
  const [form, setForm] = useState(periodoGlobal);
  const [metaGlobalForm, setMetaGlobalForm] = useState(metaGlobalPercentual);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(periodoGlobal), [periodoGlobal]);
  useEffect(() => setMetaGlobalForm(metaGlobalPercentual), [metaGlobalPercentual]);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setMetaGlobalPercentual(Number(metaGlobalForm) || 0);
    setPeriodoGlobal({
      diasProdutivosPlanejados: Number(form.diasProdutivosPlanejados) || 0,
      diasProdutivosRestantes: Number(form.diasProdutivosRestantes) || 0,
      mes: Number(form.mes), ano: Number(form.ano),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Panel t={t} title="Meta mensal (aplicada a todas as linhas)" icon={Target}>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Field t={t} label="Meta mensal de aderência (%)">
            <input type="number" step="0.1" className={inputCls(t)} value={metaGlobalForm} onChange={(e) => setMetaGlobalForm(e.target.value)} />
          </Field>
          <div className={`${t.well} rounded px-3 py-2.5 h-fit`}>
            <span className={`text-[10px] uppercase tracking-wide ${t.wellText}`}>Aplicada a todas as 7 linhas</span>
          </div>
        </div>
        <p className={`text-xs ${t.textMuted} mt-3`}>
          Essa é a única meta do sistema: um percentual de aderência ao plano de produção (ex.: 97%), igual para todas as linhas. A aderência é calculada pela soma da produção real dividida pela soma do programado (não pela média simples dos % de cada dia), então um dia com programado maior pesa proporcionalmente mais no resultado do mês.
        </p>
      </Panel>

      <Panel t={t} title="Período e dias produtivos (aplicado a todas as linhas)" icon={CalendarRange}>
        <div className="grid grid-cols-2 gap-4">
          <Field t={t} label="Mês">
            <select className={inputCls(t)} value={form.mes} onChange={(e) => upd("mes", e.target.value)}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
          <Field t={t} label="Ano"><input type="number" className={inputCls(t)} value={form.ano} onChange={(e) => upd("ano", e.target.value)} /></Field>
          <Field t={t} label="Dias produtivos planejados"><input type="number" className={inputCls(t)} value={form.diasProdutivosPlanejados} onChange={(e) => upd("diasProdutivosPlanejados", e.target.value)} /></Field>
          <Field t={t} label="Dias produtivos já realizados (linha atual)"><input type="number" className={inputCls(t)} value={calc.diasRealizados} disabled /></Field>
          <Field t={t} label="Dias produtivos restantes"><input type="number" className={inputCls(t)} value={form.diasProdutivosRestantes} onChange={(e) => upd("diasProdutivosRestantes", e.target.value)} /></Field>
        </div>
        <p className={`text-xs ${t.textMuted} mt-3`}>
          Mês, ano e dias produtivos (planejados/restantes) valem para todas as linhas — assim como a meta, é o mesmo calendário de produção para a fábrica inteira. "Dias produtivos já realizados" é o único valor que varia por linha, pois depende de quantos lançamentos já foram feitos naquela linha especificamente. A produção planejada por dia (em unidades) não é configurada aqui — ela é obtida automaticamente a partir do "Programado do dia" informado em cada lançamento de produção.
        </p>
        <div className="flex items-center gap-3 mt-5">
          <button onClick={save} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2 transition-colors">Salvar</button>
          {saved && <span className="text-emerald-500 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={14} /> Salvo</span>}
        </div>
      </Panel>
    </div>
  );
}

/* ============================== LANÇAMENTO ============================== */

function Lancamento({ t, producoes, setProducoes, meta, calc }) {
  const [form, setForm] = useState({
    data: `${meta.ano}-${String(meta.mes).padStart(2, "0")}-01`,
    planejado: Math.round(calc.planejadoDiario) || "",
    quantidade: "", observacao: "",
  });

  const add = () => {
    if (!form.data || !form.quantidade) return;
    setProducoes((p) => [...p, { id: uid(), ...form, quantidade: Number(form.quantidade), planejado: Number(form.planejado) || 0 }]);
    setForm((f) => ({ ...f, quantidade: "", observacao: "" }));
  };
  const remove = (id) => setProducoes((p) => p.filter((x) => x.id !== id));
  const sorted = [...producoes].sort((a, b) => a.data.localeCompare(b.data));
  const total = sorted.reduce((s, p) => s + Number(p.quantidade || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Registrar produção do dia" icon={Plus}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <Field t={t} label="Data"><input type="date" className={inputCls(t)} value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></Field>
          <Field t={t} label="Programado do dia"><input type="number" className={inputCls(t)} placeholder="0" value={form.planejado} onChange={(e) => setForm((f) => ({ ...f, planejado: e.target.value }))} /></Field>
          <Field t={t} label="Quantidade produzida"><input type="number" className={inputCls(t)} placeholder="0" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} /></Field>
          <Field t={t} label="Observação"><input className={inputCls(t)} placeholder="Opcional" value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} /></Field>
          <button onClick={add} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2.5 flex items-center justify-center gap-1.5">
            <Plus size={15} /> Lançar
          </button>
        </div>
      </Panel>

      <Panel t={t} title={`Produção lançada (${sorted.length} dias · total ${fmt(total)} un.)`} icon={ClipboardList}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Data</th><th className="py-2 pr-3">Programado</th><th className="py-2 pr-3">Realizado</th><th className="py-2 pr-3">%</th><th className="py-2 pr-3">Observação</th><th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const planejado = Number(p.planejado || 0);
                const pct = planejado > 0 ? (p.quantidade / planejado) * 100 : null;
                return (
                  <tr key={p.id} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-mono">{fmtDate(p.data)}</td>
                    <td className="py-2 pr-3 font-mono">{planejado > 0 ? fmt(planejado) : "—"}</td>
                    <td className="py-2 pr-3 font-mono font-semibold text-amber-500">{fmt(p.quantidade)}</td>
                    <td className={`py-2 pr-3 font-mono font-semibold ${pct === null ? t.textMuted : pct >= 100 ? "text-emerald-500" : "text-rose-500"}`}>{pct === null ? "—" : `${fmt(pct, 1)}%`}</td>
                    <td className={`py-2 pr-3 ${t.textMuted}`}>{p.observacao || "—"}</td>
                    <td className="py-2 pr-3 text-right"><button onClick={() => remove(p.id)} className="text-rose-500 hover:text-rose-400"><Trash2 size={14} /></button></td>
                  </tr>
                );
              })}
              {sorted.length === 0 && <tr><td colSpan={6} className={`py-6 text-center ${t.textMuted}`}>Nenhum lançamento ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ============================== CALENDÁRIO ============================== */

function Calendario({ t, meta, producoes, calc }) {
  const total = daysInMonth(meta.mes, meta.ano);
  const byDate = useMemo(() => {
    const m = {};
    producoes.forEach((p) => {
      if (!m[p.data]) m[p.data] = { real: 0, planejado: 0 };
      m[p.data].real += Number(p.quantidade || 0);
      m[p.data].planejado += Number(p.planejado || 0);
    });
    return m;
  }, [producoes]);
  const firstWeekday = new Date(meta.ano, meta.mes - 1, 1).getDay();
  const cells = Array.from({ length: firstWeekday }).map(() => null).concat(Array.from({ length: total }, (_, i) => i + 1));

  return (
    <Panel t={t} title={`Calendário de produção — ${MESES[meta.mes - 1]} ${meta.ano}`} icon={CalendarRange}>
      <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d) => <div key={d} className={`text-[10px] font-bold uppercase tracking-wide ${t.textMuted}`}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const iso = `${meta.ano}-${String(meta.mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayData = byDate[iso];
          const real = dayData ? dayData.real : undefined;
          const planejado = dayData && dayData.planejado > 0 ? dayData.planejado : calc.planejadoDiario;
          const diff = real !== undefined ? real - planejado : null;
          const status = real === undefined ? null : diff >= 0 ? "verde" : diff >= -planejado * 0.15 ? "amarelo" : "vermelho";
          const s = status ? STATUS[status] : null;
          return (
            <div key={i} className={`rounded border ${t.border} p-1.5 min-h-[72px] flex flex-col justify-between ${real !== undefined ? "" : "opacity-50"}`}>
              <div className="text-[11px] font-mono font-semibold">{day}</div>
              {real !== undefined ? (
                <div className="flex flex-col gap-0.5">
                  <div className="text-[10px] font-mono">{fmt(real)}</div>
                  <div className={`text-[10px] font-mono font-semibold ${s.text}`}>{diff >= 0 ? "+" : ""}{fmt(diff)}</div>
                </div>
              ) : <div className={`text-[10px] font-mono ${t.textMuted}`}>plan. {fmt(planejado)}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-4 mt-4 text-xs">
        {Object.entries(STATUS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${v.bg}`} /><span className={t.textMuted}>{v.label}</span></div>
        ))}
      </div>
    </Panel>
  );
}

/* ============================== SIMULADOR ============================== */

function Simulador({ t, meta, calc }) {
  const [pctDia, setPctDia] = useState(+calc.percentualNecessarioPorDia.toFixed(1));
  const [dias, setDias] = useState(calc.diasRestantes);
  const unidadesPorDia = (pctDia / 100) * calc.planejadoDiario;
  const producaoAdicional = unidadesPorDia * dias;
  const diasTotaisSimulados = calc.diasRealizados + dias;
  const pontosSimulados = calc.pontosConquistados + pctDia * dias;
  const mediaFinalSimulada = diasTotaisSimulados > 0 ? pontosSimulados / diasTotaisSimulados : 0;
  const diff = mediaFinalSimulada - meta.metaPercentual;
  const atingida = diff >= 0;

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <Panel t={t} title='Simulador "E se?"' icon={FlaskConical} right={<span className={`text-[10px] ${t.textMuted} uppercase tracking-wide`}>Não altera dados reais</span>}>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <Field t={t} label="Se eu produzir (%/dia)"><input type="number" step="0.1" className={inputCls(t)} value={pctDia} onChange={(e) => setPctDia(Number(e.target.value) || 0)} /></Field>
          <Field t={t} label="Nos próximos (dias)"><input type="number" className={inputCls(t)} value={dias} onChange={(e) => setDias(Number(e.target.value) || 0)} /></Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[["Média atual", `${fmt(calc.percentualMedioAtual, 1)}%`], ["Equivalente em unidades/dia", fmt(unidadesPorDia)], ["Produção adicional (un)", fmt(producaoAdicional)], ["Meta", `${fmt(meta.metaPercentual, 1)}%`]].map(([l, v]) => (
            <div key={l}><div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>{l}</div><div className="font-mono text-lg font-bold">{v}</div></div>
          ))}
        </div>
        <div className={`rounded px-4 py-3 flex items-center gap-2 text-sm font-semibold ${atingida ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
          {atingida ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {atingida
            ? `Média final projetada de ${fmt(mediaFinalSimulada, 1)}% — meta batida (${fmt(Math.abs(diff), 1)} p.p. acima)`
            : `Média final projetada de ${fmt(mediaFinalSimulada, 1)}% — faltariam ${fmt(Math.abs(diff), 1)} p.p.`}
        </div>
      </Panel>
    </div>
  );
}

/* ============================== HISTÓRICO ============================== */

function Historico({ t, historico }) {
  return (
    <Panel t={t} title="Histórico mensal" icon={History}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
              <th className="py-2 pr-3">Mês</th><th className="py-2 pr-3">Meta (%)</th><th className="py-2 pr-3">Média atingida (%)</th><th className="py-2 pr-3">Diferença (p.p.)</th><th className="py-2 pr-3">Dias produtivos</th><th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {historico.map((h) => {
              const diff = h.mediaAtingidaPercentual - h.metaPercentual;
              const ok = h.status === "Atingida";
              return (
                <tr key={`${h.mes}-${h.ano}`} className={`border-b ${t.panelHead}`}>
                  <td className="py-2 pr-3 font-semibold">{h.mes}/{h.ano}</td>
                  <td className="py-2 pr-3 font-mono">{fmt(h.metaPercentual, 1)}%</td>
                  <td className="py-2 pr-3 font-mono">{fmt(h.mediaAtingidaPercentual, 1)}%</td>
                  <td className={`py-2 pr-3 font-mono font-semibold ${diff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{diff >= 0 ? "+" : ""}{fmt(diff, 1)} p.p.</td>
                  <td className="py-2 pr-3 font-mono">{h.diasProdutivos}</td>
                  <td className="py-2 pr-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>{h.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ============================== OEE POR LINHA ============================== */

function calcOeeLinhas(oee) {
  return NOMES_OEE.map((nome) => {
    const dados = oee.porLinha[nome] || { atual: 0, meta: 0, dias: DEFAULT_OEE_DIAS };
    const atual = Number(dados.atual || 0);
    const meta = Number(dados.meta || 0);
    const diasRestantes = Number(dados.dias || 0);
    // "atual" conta como a referência de hoje (1 dia); o restante da meta
    // precisa ser fechado nos dias que faltam.
    const diasTotais = 1 + diasRestantes;

    const pontosConquistados = atual * 1;
    const pontosNecessarios = meta * diasTotais;
    const pontosQueFaltam = pontosNecessarios - pontosConquistados;
    const mediaNecessariaRestante = diasRestantes > 0 ? pontosQueFaltam / diasRestantes : 0;

    let nivel = "verde";
    if (pontosQueFaltam <= 0) {
      nivel = "verde";
    } else if (diasRestantes <= 0) {
      nivel = "vermelho";
    } else if (mediaNecessariaRestante > 100) {
      nivel = "vermelho";
    } else if (mediaNecessariaRestante <= atual) {
      nivel = "verde";
    } else {
      const gap = mediaNecessariaRestante - atual;
      nivel = gap > 7 ? "vermelho" : gap > 3 ? "amarelo" : "verde";
    }

    return { nome, atual, meta, diasRestantes, diasTotais, pontosConquistados, pontosNecessarios, pontosQueFaltam, mediaNecessariaRestante, nivel };
  });
}

function OeePorLinha({ t, oee, setOee }) {
  const updLinha = (linha, campo, v) =>
    setOee((o) => ({ ...o, porLinha: { ...o.porLinha, [linha]: { ...o.porLinha[linha], [campo]: v === "" ? "" : Number(v) } } }));

  const linhas = useMemo(() => calcOeeLinhas(oee), [oee]);

  const chartData = linhas.map((l) => ({ linha: l.nome, Atual: l.atual, Meta: l.meta }));

  const [linhaDetalhe, setLinhaDetalhe] = useState(NOMES_OEE[0]);
  const detalhe = linhas.find((l) => l.nome === linhaDetalhe) || linhas[0];

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Controle de OEE por linha" icon={Percent}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left border-b ${t.border} ${t.textMuted} text-[11px] uppercase tracking-wide`}>
                <th className="py-2 pr-3">Linha</th>
                <th className="py-2 pr-3">OEE atual (%)</th>
                <th className="py-2 pr-3">Meta OEE (%)</th>
                <th className="py-2 pr-3">Dias restantes</th>
                <th className="py-2 pr-3">OEE médio necessário no restante</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const S = STATUS[l.nivel];
                return (
                  <tr key={l.nome} className={`border-b ${t.panelHead}`}>
                    <td className="py-2 pr-3 font-semibold">{l.nome}</td>
                    <td className="py-2 pr-3">
                      <input type="number" step="0.1" className={`${inputCls(t)} w-24`} value={l.atual} onChange={(e) => updLinha(l.nome, "atual", e.target.value)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" step="0.1" className={`${inputCls(t)} w-24`} value={l.meta} onChange={(e) => updLinha(l.nome, "meta", e.target.value)} />
                    </td>
                    <td className="py-2 pr-3">
                      <input type="number" className={`${inputCls(t)} w-24`} value={l.diasRestantes} onChange={(e) => updLinha(l.nome, "dias", e.target.value)} />
                    </td>
                    <td className="py-2 pr-3 font-mono font-semibold text-amber-400">
                      {l.pontosQueFaltam <= 0 ? "meta atingida" : l.diasRestantes <= 0 ? "sem dias restantes" : `${fmt(l.mediaNecessariaRestante, 2)}%`}
                    </td>
                    <td className="py-2 pr-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${S.soft} ${S.text}`}>{S.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={`text-xs ${t.textMuted} mt-3`}>
          "OEE médio necessário no restante" é a média que a linha precisa manter em todos os dias restantes (não é um valor que sobe dia a dia) para fechar o período na meta. O valor "OEE atual" conta como a referência de hoje; a diferença até a meta é distribuída pelos dias restantes.
        </p>
      </Panel>

      <Panel t={t} title="Detalhe da linha" icon={FlaskConical}
        right={
          <select className={`${inputCls(t)} w-48`} value={linhaDetalhe} onChange={(e) => setLinhaDetalhe(e.target.value)}>
            {NOMES_OEE.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        }>
        {detalhe.pontosQueFaltam <= 0 ? (
          <div className="rounded bg-emerald-500/10 text-emerald-500 text-sm font-semibold px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} /> A meta de OEE de {linhaDetalhe} já foi atingida.
          </div>
        ) : detalhe.diasRestantes <= 0 ? (
          <div className="rounded bg-rose-500/10 text-rose-500 text-sm font-semibold px-4 py-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Não há dias restantes cadastrados para {linhaDetalhe} — informe quantos dias ainda faltam no período.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <Kpi t={t} label="Dias restantes" value={fmt(detalhe.diasRestantes)} unit="dias" icon={CalendarDays} sub="a partir de hoje" />
              <Kpi t={t} label="OEE atual (hoje)" value={fmt(detalhe.atual, 2)} unit="%" icon={CheckCircle2} />
              <Kpi t={t} label="Pontos necessários no total" value={fmt(detalhe.pontosNecessarios, 2)} icon={Target} sub={`meta ${fmt(detalhe.meta, 2)}% × ${fmt(detalhe.diasTotais)} dias (hoje + restantes)`} />
              <Kpi t={t} label="Pontos que faltam" value={fmt(detalhe.pontosQueFaltam, 2)} icon={TrendingUp} accent="text-amber-400" />
            </div>
            <div className={`rounded border ${t.border} ${STATUS[detalhe.nivel].soft} p-5 flex flex-col gap-2`}>
              <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>OEE médio que {linhaDetalhe} precisa manter em cada dia restante</span>
              <div className="flex items-baseline gap-3">
                <span className={`font-mono text-4xl font-bold ${STATUS[detalhe.nivel].text}`}>{fmt(detalhe.mediaNecessariaRestante, 2)}%</span>
                <span className={`text-sm ${t.textMuted}`}>em cada um dos {fmt(detalhe.diasRestantes)} dias restantes</span>
              </div>
            </div>
          </>
        )}
      </Panel>

      <Panel t={t} title="OEE atual x meta, por linha" icon={FileBarChart2}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="linha" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Atual" fill="#64748b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Meta" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

/* ============================== RELATÓRIOS ============================== */

function Relatorios({ t, meta, producoes, calc, linha }) {
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      ["Relatório de produção", linha, `${MESES[meta.mes - 1]}/${meta.ano}`], [],
      ["Meta mensal (%)", meta.metaPercentual],
      ["Produção planejada por dia — mediana dos lançamentos (un)", +calc.planejadoDiario.toFixed(2)],
      ["Produção acumulada (un)", calc.producaoAcumulada],
      ["Déficit acumulado (un)", calc.deficitAcumuladoUnidades],
      ["Média atual (%)", +calc.percentualMedioAtual.toFixed(2)],
      ["Dias produtivos restantes", calc.diasRestantes],
      ["Necessário por dia (%)", +calc.percentualNecessarioPorDia.toFixed(2)],
      ["Necessário por dia (un)", +calc.unidadesNecessariasPorDia.toFixed(2)],
      ["Projeção final (%)", +calc.projecaoPercentualFinal.toFixed(2)],
      ["Diferença para a meta (p.p.)", +calc.faltaProjecaoPercentual.toFixed(2)],
      ["Status", STATUS[calc.status].label],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), "Resumo");
    const lanc = [["Data", "Quantidade", "Observação"], ...[...producoes].sort((a, b) => a.data.localeCompare(b.data)).map((p) => [fmtDate(p.data), p.quantidade, p.observacao])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lanc), "Lançamentos");
    XLSX.writeFile(wb, `relatorio-${linha}-${MESES[meta.mes - 1]}-${meta.ano}.xlsx`);
  };
  const exportPdf = () => window.print();

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title={`Relatório mensal — ${linha}`} icon={FileBarChart2}
        right={
          <div className="flex gap-2 print:hidden">
            <button onClick={exportExcel} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-3 py-1.5`}><Download size={13} /> Excel</button>
            <button onClick={exportPdf} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-3 py-1.5`}><Download size={13} /> PDF</button>
          </div>
        }>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Meta", `${fmt(meta.metaPercentual, 1)}%`], ["Produção acumulada", fmt(calc.producaoAcumulada)], ["Média atual", `${fmt(calc.percentualMedioAtual, 1)}%`], ["Dias produtivos", fmt(calc.diasRealizados)],
            ["Necessário/dia (%)", `${fmt(calc.percentualNecessarioPorDia, 1)}%`], ["Necessário/dia (un)", fmt(calc.unidadesNecessariasPorDia)],
            ["Resultado projetado", calc.faltaProjecaoPercentual <= 0 ? "Meta atingida" : `Falta ${fmt(calc.faltaProjecaoPercentual, 1)} p.p.`], ["Status", STATUS[calc.status].label],
          ].map(([l, v]) => (
            <div key={l}><div className={`text-[10px] uppercase tracking-wide ${t.textMuted}`}>{l}</div><div className="font-mono text-base font-bold">{v}</div></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ============================== ROTEIRO DA QUALIDADE ============================== */

const DEFAULT_ROTEIRO = {
  meta: 93,
  notaMediaAtual: 86.87,
  feitos: 5,
  restantes: 8,
};

function calcRoteiro(cfg) {
  const meta = Number(cfg.meta || 0);
  const notaMediaAtual = Number(cfg.notaMediaAtual || 0);
  const feitos = Number(cfg.feitos || 0);
  const restantes = Number(cfg.restantes || 0);
  const totalRoteiros = feitos + restantes;
  const pontosConquistados = notaMediaAtual * feitos;
  const pontosNecessarios = meta * totalRoteiros;
  const pontosQueFaltam = pontosNecessarios - pontosConquistados;
  const mediaNecessariaRestantes = restantes > 0 ? pontosQueFaltam / restantes : 0;

  let status = "verde";
  let mensagem = "";
  if (pontosQueFaltam <= 0) {
    status = "verde";
    mensagem = "Meta já atingida considerando os roteiros já feitos.";
  } else if (restantes <= 0) {
    status = "vermelho";
    mensagem = "Não há roteiros restantes cadastrados para fechar a meta — informe quantos roteiros ainda faltam ser feitos.";
  } else if (mediaNecessariaRestantes > 100) {
    status = "vermelho";
    mensagem = "Matematicamente impossível de atingir com os roteiros restantes informados — a nota necessária passaria de 100%. Aumente os roteiros restantes ou revise a meta.";
  } else if (mediaNecessariaRestantes <= notaMediaAtual) {
    status = "verde";
    mensagem = "No ritmo de notas atual, a meta será atingida.";
  } else {
    status = "amarelo";
    mensagem = "A nota média vai precisar melhorar nos roteiros restantes para fechar a meta.";
  }

  return { meta, notaMediaAtual, feitos, restantes, totalRoteiros, pontosConquistados, pontosNecessarios, pontosQueFaltam, mediaNecessariaRestantes, status, mensagem };
}

function RoteiroQualidade({ t, cfg, setCfg }) {
  const upd = (k, v) => setCfg((c) => ({ ...c, [k]: v === "" ? "" : Number(v) }));
  const c = useMemo(() => calcRoteiro(cfg), [cfg]);
  const S = STATUS[c.status];
  const SIcon = S.icon;

  return (
    <div className="flex flex-col gap-4">
      <Panel t={t} title="Configuração do roteiro" icon={ListChecks}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field t={t} label="Meta (%)"><input type="number" step="0.01" className={inputCls(t)} value={cfg.meta} onChange={(e) => upd("meta", e.target.value)} /></Field>
          <Field t={t} label="Nota média atual (%)"><input type="number" step="0.01" className={inputCls(t)} value={cfg.notaMediaAtual} onChange={(e) => upd("notaMediaAtual", e.target.value)} /></Field>
          <Field t={t} label="Roteiros já feitos"><input type="number" className={inputCls(t)} value={cfg.feitos} onChange={(e) => upd("feitos", e.target.value)} /></Field>
          <Field t={t} label="Roteiros restantes"><input type="number" className={inputCls(t)} value={cfg.restantes} onChange={(e) => upd("restantes", e.target.value)} /></Field>
        </div>
        <p className={`text-xs ${t.textMuted} mt-3`}>
          "Nota média atual" é a média das notas dos roteiros já feitos. "Roteiros restantes" é quanto ainda falta fazer — não precisa ser todo dia, então não depende de prazo em dias.
        </p>
      </Panel>

      <div className={`rounded border ${t.border} ${S.soft} px-4 py-3 flex items-center gap-3`}>
        <SIcon size={20} className={S.text} />
        <div>
          <div className={`text-sm font-bold ${S.text}`}>{S.label.toUpperCase()}</div>
          <div className={`text-xs ${t.textMuted}`}>{c.mensagem}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi t={t} label="Total de roteiros" value={fmt(c.totalRoteiros)} unit="roteiros" icon={ClipboardList} sub={`${fmt(c.feitos)} feitos + ${fmt(c.restantes)} restantes`} />
        <Kpi t={t} label="Pontos já conquistados" value={fmt(c.pontosConquistados, 2)} icon={CheckCircle2} sub={`nota média ${fmt(c.notaMediaAtual, 2)}% × ${fmt(c.feitos)} feitos`} />
        <Kpi t={t} label="Pontos necessários no total" value={fmt(c.pontosNecessarios, 2)} icon={Target} sub={`meta ${fmt(c.meta, 2)}% × ${fmt(c.totalRoteiros)} roteiros`} />
        <Kpi t={t} label="Pontos que faltam" value={fmt(c.pontosQueFaltam, 2)} icon={TrendingUp} accent={c.pontosQueFaltam <= 0 ? "text-emerald-400" : "text-amber-400"} />
      </div>

      <Panel t={t} title="Média necessária nos roteiros restantes" icon={FlaskConical}>
        <div className={`rounded border ${t.border} ${S.soft} p-5 flex flex-col gap-2`}>
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${t.textMuted}`}>Nota média que você precisa tirar em cada roteiro restante</span>
          <div className="flex items-baseline gap-3">
            <span className={`font-mono text-4xl font-bold ${S.text}`}>
              {c.pontosQueFaltam <= 0 || c.restantes <= 0 ? "—" : `${fmt(c.mediaNecessariaRestantes, 2)}%`}
            </span>
            {c.pontosQueFaltam > 0 && c.restantes > 0 && <span className={`text-sm ${t.textMuted}`}>em cada um dos {fmt(c.restantes)} roteiros que faltam</span>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ============================== CONFIG ============================== */

function ConfigPage({ t, dark, setDark, resetDemo, supervisorNome, setSupervisorNome }) {
  const [saved, setSaved] = useState(false);
  const salvarSupervisor = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <Panel t={t} title="Supervisor de produção" icon={ClipboardList}>
        <Field t={t} label="Nome do supervisor">
          <input
            className={inputCls(t)}
            placeholder="Ex.: João Silva"
            value={supervisorNome}
            onChange={(e) => setSupervisorNome(e.target.value)}
          />
        </Field>
        <p className={`text-xs ${t.textMuted} mt-3`}>
          Esse nome aparece na Dashboard como "Supervisor de Produção, [Nome]".
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={salvarSupervisor} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2 transition-colors">Salvar</button>
          {saved && <span className="text-emerald-500 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={14} /> Salvo</span>}
        </div>
      </Panel>
      <Panel t={t} title="Aparência" icon={Settings2}>
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-semibold">Tema</div><div className={`text-xs ${t.textMuted}`}>Alterne entre modo claro e escuro.</div></div>
          <button onClick={() => setDark((d) => !d)} className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold uppercase tracking-wide rounded px-4 py-2 flex items-center gap-2">
            {dark ? <Sun size={15} /> : <Moon size={15} />} {dark ? "Modo claro" : "Modo escuro"}
          </button>
        </div>
      </Panel>
      <Panel t={t} title="Dados de demonstração" icon={RotateCcw}>
        <div className="flex items-center justify-between">
          <div><div className="text-sm font-semibold">Restaurar dados de exemplo (todas as linhas)</div><div className={`text-xs ${t.textMuted}`}>Reseta metas, lançamentos, perdas e OEE de todas as linhas.</div></div>
          <button onClick={resetDemo} className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide border ${t.border} rounded px-4 py-2`}><RotateCcw size={14} /> Restaurar</button>
        </div>
      </Panel>
      <Panel t={t} title="Sobre" icon={Info}>
        <p className={`text-sm ${t.textMuted}`}>
          Painel multi-linhas: G.A, Grostoli, Boleado, Coxinha TCH, Pão de Queijo TCH, Pré-Assados e Pastel. Na página de OEE, G.A é acompanhada separadamente como G.A 1 e G.A 2, e Coxinha TCH + Pão de Queijo TCH são acompanhadas em conjunto como TCH. Dados salvos localmente no navegador.
        </p>
      </Panel>
    </div>
  );
}
