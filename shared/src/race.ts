/** Pure checkpoint scoring shared by the server and tests. */
export function scoreClimbRound(
  previous: readonly [number, number],
  winner: 0 | 1,
  act: number,
): { score: [number, number]; final: boolean } {
  const score: [number, number] = [previous[0], previous[1]]
  score[winner]++
  return { score, final: act >= 3 }
}
