import type {
  AllocationSettings,
  BlueprintRetirementPreset,
  ExposureItem,
} from '../types'
import type { ExposureResult } from './exposure'

/** 資產階段：依「總淨值 ÷ 年生活費」判定 */
export type BlueprintStage =
  | 'unknown'
  | 'accumulate'
  | 'transition10'
  | 'transition15'
  | 'retire'

/** 藍圖代號：73／253／343／333／433 */
export type BlueprintPreset = '73' | '253' | '343' | '333' | '433'

export type BlueprintBucket = 'leveraged' | 'prototype' | 'cash' | 'other'

export interface BlueprintTargets {
  code: BlueprintPreset
  label: string
  leveraged: number
  prototype: number
  cash: number
  description: string
}

export type BlueprintActionSeverity = 'ok' | 'info' | 'warn' | 'urgent'

export interface BlueprintAction {
  id: string
  severity: BlueprintActionSeverity
  title: string
  detail: string
}

export interface BlueprintWeights {
  leveraged: number
  prototype: number
  bond: number
  other: number
  cash: number
}

export interface BlueprintAnalysis {
  stage: BlueprintStage
  stageLabel: string
  stageHint: string
  livingExpenseMultiple: number | null
  targets: BlueprintTargets
  current: BlueprintWeights
  gaps: { leveraged: number; prototype: number; cash: number; other: number }
  actions: BlueprintAction[]
  dipBuy: {
    eligible: boolean
    drawdown: number
    tranchePercent: number
    trancheAmount: number
    maxTranches: number
    note: string
  }
  retirement: {
    eligible: boolean
    peakNetWorth: number
    maxAnnualWithdrawal: number
    suggestedMonthly: number
    withdrawalRate: number
    note: string
  }
  microRebalance: {
    todayGain: number
    trimAmount: number
    note: string
  }
}

const STAGE_LABELS: Record<BlueprintStage, string> = {
  unknown: '尚未判定',
  accumulate: '累積期（未達 10 倍生活費）',
  transition10: '過渡期（10～15 倍生活費）',
  transition15: '接近退休（15～20 倍生活費）',
  retire: '退休期（達 20 倍生活費）',
}

const PRESETS: Record<BlueprintPreset, Omit<BlueprintTargets, 'code'>> = {
  '73': {
    label: '73 配置',
    leveraged: 70,
    prototype: 0,
    cash: 30,
    description: '七成正二、三成現金：累積期全力成長，並保留三成防禦現金',
  },
  '253': {
    label: '253 配置',
    leveraged: 50,
    prototype: 20,
    cash: 30,
    description: '五成正二、二成原型、三成現金',
  },
  '343': {
    label: '343 配置',
    leveraged: 40,
    prototype: 30,
    cash: 30,
    description: '四成正二、三成原型、三成現金',
  },
  '333': {
    label: '333 配置',
    leveraged: 100 / 3,
    prototype: 100 / 3,
    cash: 100 / 3,
    description: '正二、原型、現金各約三分之一（退休期首選）',
  },
  '433': {
    label: '433 配置',
    leveraged: 30,
    prototype: 40,
    cash: 30,
    description: '三成正二、四成原型、三成現金',
  },
}

/** 將持股歸入藍圖桶：正二／原型（含債券 ETF）／其他 */
export function classifyBlueprintBucket(item: ExposureItem): Exclude<BlueprintBucket, 'cash'> {
  if (item.leverage > 1 || item.assetClass === 'leveraged') return 'leveraged'
  if (item.assetClass === 'etf' || item.assetClass === 'bond') return 'prototype'
  return 'other'
}

export function resolveBlueprintStage(
  netWorth: number,
  annualLivingExpense: number,
): { stage: BlueprintStage; multiple: number | null } {
  if (!(annualLivingExpense > 0) || !(netWorth >= 0)) {
    return { stage: 'unknown', multiple: null }
  }
  const multiple = netWorth / annualLivingExpense
  if (multiple < 10) return { stage: 'accumulate', multiple }
  if (multiple < 15) return { stage: 'transition10', multiple }
  if (multiple < 20) return { stage: 'transition15', multiple }
  return { stage: 'retire', multiple }
}

export function targetsForStage(
  stage: BlueprintStage,
  retirementPreset: BlueprintRetirementPreset,
): BlueprintTargets {
  const code: BlueprintPreset =
    stage === 'accumulate' || stage === 'unknown'
      ? '73'
      : stage === 'transition10'
        ? '253'
        : stage === 'transition15'
          ? '343'
          : retirementPreset

  return { code, ...PRESETS[code] }
}

export function summarizeBlueprintWeights(exposure: ExposureResult): BlueprintWeights {
  const base = Math.max(exposure.summary.netWorth, 0)
  let leveraged = 0
  let prototype = 0
  let bond = 0
  let other = 0

  for (const item of exposure.items) {
    const weight = base > 0 ? (item.marketValue / base) * 100 : 0
    const bucket = classifyBlueprintBucket(item)
    if (bucket === 'leveraged') leveraged += weight
    else if (bucket === 'prototype') {
      if (item.assetClass === 'bond') bond += weight
      else prototype += weight
    } else other += weight
  }

  return {
    leveraged,
    prototype: prototype + bond,
    bond,
    other,
    cash: exposure.summary.cashRatio,
  }
}

/**
 * 依藍圖目標，把正二／原型權重依現有市值比例分配到各持股。
 * 若該桶沒有持股，略過（畫面會提醒先建立對應部位）。
 */
export function blueprintTargetWeights(
  exposure: ExposureResult,
  targets: BlueprintTargets,
): Record<string, number> {
  const leveragedItems = exposure.items.filter(
    (item) => classifyBlueprintBucket(item) === 'leveraged',
  )
  const prototypeItems = exposure.items.filter(
    (item) => classifyBlueprintBucket(item) === 'prototype',
  )
  const otherItems = exposure.items.filter(
    (item) => classifyBlueprintBucket(item) === 'other',
  )

  const result: Record<string, number> = {}
  assignProportionally(result, leveragedItems, targets.leveraged)
  assignProportionally(result, prototypeItems, targets.prototype)
  // 藍圖外個股目標設為 0，提醒逐步收斂到正二／原型／現金
  for (const item of otherItems) {
    result[item.symbol.toUpperCase()] = 0
  }
  return result
}

function assignProportionally(
  result: Record<string, number>,
  items: ExposureItem[],
  totalWeight: number,
): void {
  if (items.length === 0 || totalWeight <= 0) return
  const sum = items.reduce((acc, item) => acc + Math.max(item.marketValue, 0), 0)
  if (sum <= 0) {
    const each = Math.round((totalWeight / items.length) * 10) / 10
    for (const item of items) result[item.symbol.toUpperCase()] = each
    return
  }
  for (const item of items) {
    result[item.symbol.toUpperCase()] =
      Math.round((Math.max(item.marketValue, 0) / sum) * totalWeight * 10) / 10
  }
}

const CASH_DEFENSE = 30
const DIP_TRIGGER = 30
const DIP_TRANCHE = 5
const DIP_MAX_TRANCHES = 3
const WEIGHT_TOLERANCE = 3

export function analyzeBlueprint(
  exposure: ExposureResult,
  settings: AllocationSettings,
): BlueprintAnalysis {
  const netWorth = Math.max(exposure.summary.netWorth, 0)
  const living = Math.max(Number(settings.blueprintAnnualLivingExpense) || 0, 0)
  const { stage, multiple } = resolveBlueprintStage(netWorth, living)
  const targets = targetsForStage(stage, settings.blueprintRetirementPreset ?? '333')
  const current = summarizeBlueprintWeights(exposure)
  const gaps = {
    leveraged: targets.leveraged - current.leveraged,
    prototype: targets.prototype - current.prototype,
    cash: targets.cash - current.cash,
    other: current.other,
  }

  const drawdown = Math.max(Number(settings.blueprintMarketDrawdown) || 0, 0)
  const dipEligible = drawdown >= DIP_TRIGGER && current.cash > 0
  const trancheAmount = (DIP_TRANCHE / 100) * netWorth
  const peak =
    Math.max(Number(settings.blueprintPeakNetWorth) || 0, 0) ||
    (stage === 'retire' ? netWorth : 0)
  const withdrawalRate = Math.min(
    Math.max(Number(settings.blueprintWithdrawalRate) || 4, 0),
    10,
  )
  const maxAnnual = (withdrawalRate / 100) * peak
  const todayGain = Math.max(Number(settings.blueprintTodayLeveragedGain) || 0, 0)
  const trimAmount = todayGain > 0 ? todayGain / 3 : 0

  const actions = buildActions({
    stage,
    living,
    targets,
    current,
    gaps,
    dipEligible,
    drawdown,
    trancheAmount,
    maxAnnual,
    peak,
    withdrawalRate,
    netWorth,
    trimAmount,
    todayGain,
  })

  const stageHint =
    stage === 'unknown'
      ? '請先填寫年生活費，系統才能依「生活費倍數」判定你該用哪一套配置'
      : stage === 'accumulate'
        ? '此階段以正二累積為主，務必保留至少三成現金當防禦與加碼金'
        : stage === 'transition10'
          ? '資產已達 10 倍生活費，開始導入原型 ETF，降低單一槓桿依賴'
          : stage === 'transition15'
            ? '接近退休門檻，正二再降、原型再升，維持三成現金不變'
            : '已達退休門檻：可用原型／債券質押創造現金流，絕對不要質押正二'

  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    stageHint,
    livingExpenseMultiple: multiple,
    targets,
    current,
    gaps,
    actions,
    dipBuy: {
      eligible: dipEligible,
      drawdown,
      tranchePercent: DIP_TRANCHE,
      trancheAmount,
      maxTranches: DIP_MAX_TRANCHES,
      note: dipEligible
        ? `大盤自高點已跌 ${formatPct(drawdown)}，可用預留現金分批加碼（每次約 ${DIP_TRANCHE}% 淨值）`
        : `當大盤自高點下跌達 ${DIP_TRIGGER}% 時，三成現金才啟動「下跌加碼」；請在上方更新下跌幅度`,
    },
    retirement: {
      eligible: stage === 'retire',
      peakNetWorth: peak,
      maxAnnualWithdrawal: maxAnnual,
      suggestedMonthly: maxAnnual / 12,
      withdrawalRate,
      note:
        stage === 'retire'
          ? peak > 0
            ? `每年質押借出生活費建議 ≤ 歷史最高點的 ${withdrawalRate}%（約 ${formatMoney(maxAnnual)}／年）`
            : '請填寫金融資產歷史最高點，才能計算安全提領上限'
          : '未達 20 倍生活費前，以累積與配置調整為主，不必急著質押提領',
    },
    microRebalance: {
      todayGain,
      trimAmount,
      note:
        todayGain > 0
          ? `今日正二約賺 ${formatMoney(todayGain)}，可賣出約三分之一（${formatMoney(trimAmount)}）補回現金`
          : '正二上漲獲利時，可把當日獲利的約三分之一賣出補現金（微量動態再平衡）',
    },
  }
}

function buildActions(input: {
  stage: BlueprintStage
  living: number
  targets: BlueprintTargets
  current: BlueprintWeights
  gaps: BlueprintAnalysis['gaps']
  dipEligible: boolean
  drawdown: number
  trancheAmount: number
  maxAnnual: number
  peak: number
  withdrawalRate: number
  netWorth: number
  trimAmount: number
  todayGain: number
}): BlueprintAction[] {
  const actions: BlueprintAction[] = []
  const { targets, current, gaps } = input

  if (input.living <= 0) {
    actions.push({
      id: 'need-living',
      severity: 'warn',
      title: '先填寫年生活費',
      detail: '沒有生活費基準，就無法判定你處於累積期、過渡期或退休期，也無法推薦正確配置。',
    })
  }

  if (input.netWorth <= 0) {
    actions.push({
      id: 'need-assets',
      severity: 'warn',
      title: '尚無可用淨值',
      detail: '請先在進出紀錄與現金資產頁建立持股與現金，藍圖才能對照現況給出動作。',
    })
    return actions
  }

  if (current.cash + 0.05 < CASH_DEFENSE) {
    actions.push({
      id: 'cash-defense',
      severity: 'urgent',
      title: '現金低於三成防禦線',
      detail: `目前現金僅 ${formatPct(current.cash)}，低於至少 ${CASH_DEFENSE}% 的防禦機制。請先停利收割或減少加碼，把現金補回約 ${formatPct(targets.cash)}。`,
    })
  }

  if (Math.abs(gaps.leveraged) > WEIGHT_TOLERANCE) {
    actions.push({
      id: 'adjust-leveraged',
      severity: Math.abs(gaps.leveraged) > 10 ? 'urgent' : 'warn',
      title:
        gaps.leveraged > 0
          ? `正二偏低，建議加碼約 ${formatPct(gaps.leveraged)}`
          : `正二偏高，建議減碼約 ${formatPct(-gaps.leveraged)}`,
      detail: `目標 ${targets.label} 的正二為 ${formatPct(targets.leveraged)}，目前 ${formatPct(current.leveraged)}。`,
    })
  }

  if (targets.prototype > 0 && Math.abs(gaps.prototype) > WEIGHT_TOLERANCE) {
    actions.push({
      id: 'adjust-prototype',
      severity: 'warn',
      title:
        gaps.prototype > 0
          ? `原型／債券偏低，建議補足約 ${formatPct(gaps.prototype)}`
          : `原型／債券偏高，建議調節約 ${formatPct(-gaps.prototype)}`,
      detail: `此階段原型目標 ${formatPct(targets.prototype)}（可含 0050 等原型 ETF 或 00865B 等債券 ETF），目前 ${formatPct(current.prototype)}。`,
    })
  }

  if (Math.abs(gaps.cash) > WEIGHT_TOLERANCE && current.cash + 0.05 >= CASH_DEFENSE) {
    actions.push({
      id: 'adjust-cash',
      severity: 'info',
      title:
        gaps.cash > 0
          ? `現金略低於目標，可再補約 ${formatPct(gaps.cash)}`
          : `現金高於目標約 ${formatPct(-gaps.cash)}，可在計畫內逐步轉入正二／原型`,
      detail: `目標現金 ${formatPct(targets.cash)}，目前 ${formatPct(current.cash)}。`,
    })
  }

  if (gaps.other > WEIGHT_TOLERANCE) {
    actions.push({
      id: 'reduce-other',
      severity: 'info',
      title: `藍圖外個股佔 ${formatPct(gaps.other)}`,
      detail: '正二與現金共生藍圖以「正二 + 原型／債券 + 現金」為核心；個股可逐步收斂，降低配置噪音。',
    })
  }

  if (input.dipEligible) {
    actions.push({
      id: 'dip-buy',
      severity: 'urgent',
      title: `下跌加碼啟動（已跌 ${formatPct(input.drawdown)}）`,
      detail: `可用預留現金分批打入，建議每筆約淨值的 ${DIP_TRANCHE}%（約 ${formatMoney(input.trancheAmount)}），最多 ${DIP_MAX_TRANCHES} 筆共 ${DIP_TRANCHE * DIP_MAX_TRANCHES}%。加碼後仍須保留部分現金，不能把防禦金一次用完。`,
    })
  } else if (input.drawdown > 0 && input.drawdown < DIP_TRIGGER) {
    actions.push({
      id: 'dip-watch',
      severity: 'info',
      title: `尚未達下跌加碼門檻（目前跌 ${formatPct(input.drawdown)}）`,
      detail: `從高點跌幅達 ${DIP_TRIGGER}% 才動用三成現金分批加碼；現在以持有與觀察為主，並在創高後重設基準。`,
    })
  }

  if (input.todayGain > 0 && input.trimAmount > 0) {
    actions.push({
      id: 'micro-rebalance',
      severity: 'info',
      title: `微量動態再平衡：可賣出約 ${formatMoney(input.trimAmount)}`,
      detail: '正二因上漲獲利時，把當日獲利約三分之一轉回現金，維持防禦水位，不必等到偏離很大才調整。',
    })
  }

  if (input.stage === 'retire') {
    actions.push({
      id: 'no-pledge-leveraged',
      severity: 'urgent',
      title: '絕對不要質押正二',
      detail: '退休現金流請只質押波動較低的原型 ETF 或債券 ETF（如 00865B），並維持極低質押比例，避免斷頭。',
    })
    if (input.peak > 0) {
      actions.push({
        id: 'safe-withdrawal',
        severity: 'info',
        title: `安全提領上限約 ${formatMoney(input.maxAnnual)}／年`,
        detail: `以歷史最高點 ${formatMoney(input.peak)} 的 ${input.withdrawalRate}% 為天花板；手上預留現金不能全部來自質押，大跌時才有加碼與還款緩衝。`,
      })
    } else {
      actions.push({
        id: 'need-peak',
        severity: 'warn',
        title: '請填寫金融資產歷史最高點',
        detail: '退休期的 4%（或更保守的 2%）提領上限，要以歷史最高點計算，而不是當下低點。',
      })
    }
  }

  const aligned =
    Math.abs(gaps.leveraged) <= WEIGHT_TOLERANCE &&
    Math.abs(gaps.prototype) <= WEIGHT_TOLERANCE &&
    Math.abs(gaps.cash) <= WEIGHT_TOLERANCE &&
    gaps.other <= WEIGHT_TOLERANCE &&
    !input.dipEligible

  if (aligned && input.living > 0) {
    actions.unshift({
      id: 'on-track',
      severity: 'ok',
      title: `目前大致符合「${targets.label}」`,
      detail: '維持三成現金防禦、創高後重設下跌基準即可；未碰上下限時不必頻繁交易。',
    })
  }

  return actions
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function blueprintPresetOptions(
  retirementPreset: BlueprintRetirementPreset,
): BlueprintTargets[] {
  return [
    { code: '73', ...PRESETS['73'] },
    { code: '253', ...PRESETS['253'] },
    { code: '343', ...PRESETS['343'] },
    { code: retirementPreset, ...PRESETS[retirementPreset] },
  ]
}
