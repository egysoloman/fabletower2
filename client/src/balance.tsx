import { ARCHETYPES, type CharId } from '@neonspire/engine'
import { useEffect, useState } from 'preact/hooks'
import type { RunRecord } from './game'
import { lang } from './i18n'

interface BalanceRow {
  char: CharId
  policy: 'greedy' | 'archetype' | 'ceiling'
  archetype: string | null
  label: string
  runs: number
  wins: number
  winRate: number
  floor: { mean: number; p25: number; median: number; p75: number; p90: number }
  reach: Record<string, number>
  averages: { turnsPerCombat: number; deckSize: number; upgrades: number; relics: number }
}

interface BalanceReport {
  generatedAt: string
  commit: string
  seeds: number
  ascension: number
  methodology: { caveat: string }
  rows: BalanceRow[]
  comparison: {
    char: CharId
    lowerMean: number
    upperMean: number
    gap: number
    bestArchetype: string
    lowerWinRate: number
    upperWinRate: number
  }[]
}

const CHARS: CharId[] = ['runner', 'vector', 'ghost', 'array']
const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`

function personalRows(history: RunRecord[]) {
  return CHARS.map((char) => {
    const rows = history.filter((r) => (r.ch ?? 'runner') === char)
    const wins = rows.filter((r) => r.win).length
    const floors = rows.map((r) => r.floor).sort((a, b) => a - b)
    return {
      char,
      runs: rows.length,
      winRate: rows.length ? Number((wins / rows.length * 100).toFixed(1)) : 0,
      mean: rows.length ? Number((floors.reduce((a, b) => a + b, 0) / rows.length).toFixed(1)) : 0,
      median: floors.length ? floors[Math.round((floors.length - 1) / 2)] : 0,
      best: floors.at(-1) ?? 0,
    }
  })
}

function archetypeName(id: string | null, zh: boolean): string {
  const def = ARCHETYPES.find((a) => a.id === id)
  return def ? (zh ? def.nameZh : def.name) : (zh ? '未分类' : 'Unclassified')
}

export function BalanceReportPanel({ history }: { history: RunRecord[] }) {
  const [report, setReport] = useState<BalanceReport | null>(null)
  const [failed, setFailed] = useState(false)
  const zh = lang.value === 'zh'
  useEffect(() => {
    fetch('/balance/latest.json')
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status))
        return res.json()
      })
      .then(setReport)
      .catch(() => setFailed(true))
  }, [])
  const mine = personalRows(history)

  return (
    <div class="balance-lab">
      <h2>{zh ? '── 我的对局分析 ──' : '── MY RUN ANALYTICS ──'}</h2>
      <div class="balance-table-wrap">
        <table class="balance-table">
          <thead><tr><th>{zh ? '角色' : 'CHAR'}</th><th>{zh ? '局数' : 'RUNS'}</th><th>{zh ? '胜率' : 'WIN'}</th><th>{zh ? '均层' : 'MEAN'}</th><th>P50</th><th>{zh ? '最佳' : 'BEST'}</th></tr></thead>
          <tbody>{mine.map((row) => (
            <tr key={row.char}><td>{row.char.toUpperCase()}</td><td>{row.runs}</td><td>{row.winRate}%</td><td>{row.mean}</td><td>{row.median}</td><td>{row.best}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <div class="sub balance-note">
        {zh ? `设备与云端最多合并保留 100 局；已有 ${history.length} 局。新记录会包含流派、牌组、升级和遗物指标。` :
          `Up to 100 device/cloud runs are merged; ${history.length} recorded. New entries include archetype, deck, upgrade and relic metrics.`}
      </div>

      <h2>{zh ? '── 全局平衡基准 ──' : '── BALANCE LAB BENCHMARK ──'}</h2>
      {failed && <div class="sub">{zh ? '平衡快照暂不可用。' : 'Balance snapshot unavailable.'}</div>}
      {!report && !failed && <div class="sub">{zh ? '正在加载…' : 'Loading…'}</div>}
      {report && (
        <>
          <div class="sub balance-note">
            A{report.ascension} · {report.seeds} seeds / profile · {report.generatedAt.slice(0, 10)} · {report.commit}
          </div>
          <div class="bound-chart">
            {report.comparison.map((row) => (
              <div class="bound-row" key={row.char}>
                <b>{row.char.toUpperCase()}</b>
                <div class="bound-track">
                  <span class="bound-gap" style={{ left: pct(row.lowerMean / 24 * 100), width: pct(row.gap / 24 * 100) }} />
                  <i class="bound-low" style={{ left: pct(row.lowerMean / 24 * 100) }} />
                  <i class="bound-high" style={{ left: pct(row.upperMean / 24 * 100) }} />
                </div>
                <span>{row.lowerMean} → {row.upperMean}</span>
                <small>{archetypeName(row.bestArchetype, zh)}</small>
              </div>
            ))}
          </div>
          <div class="balance-legend"><span class="low">● {zh ? '贪心下限' : 'greedy floor'}</span><span class="high">● {zh ? '流派上限包络' : 'archetype ceiling'}</span></div>
          <div class="balance-table-wrap">
            <table class="balance-table profile-table">
              <thead><tr><th>{zh ? '角色/流派' : 'CHAR / ARCHETYPE'}</th><th>{zh ? '胜率' : 'WIN'}</th><th>{zh ? '均层' : 'MEAN'}</th><th>P25/P50/P75/P90</th><th>{zh ? '到16层' : 'REACH 16'}</th><th>{zh ? '牌组/升级/遗物' : 'DECK/UP/RELIC'}</th></tr></thead>
              <tbody>{report.rows.filter((row) => row.policy === 'archetype').map((row) => (
                <tr key={row.archetype ?? row.label}>
                  <td>{row.char.toUpperCase()} · {archetypeName(row.archetype, zh)}</td><td>{row.winRate}%</td><td>{row.floor.mean}</td>
                  <td>{row.floor.p25}/{row.floor.median}/{row.floor.p75}/{row.floor.p90}</td><td>{row.reach['16']}%</td>
                  <td>{row.averages.deckSize}/{row.averages.upgrades}/{row.averages.relics}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div class="sub balance-note">
            {zh ? '红点是简单贪心 bot 的保守下限；绿点是同 seed 三流派最佳包络，用于估计构筑可控空间，不代表真人胜率。' :
              'Red is the conservative greedy-bot floor; green is the same-seed best-of-three archetype envelope. It measures build agency, not human win rate.'}
          </div>
        </>
      )}
    </div>
  )
}
