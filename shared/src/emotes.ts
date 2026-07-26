/**
 * Emote / quick-phrase registry for multiplayer. Base set ships here; mods
 * extend it through applyMod (JSON only, validated). Both languages live on
 * the def itself so modded emotes localize the same way built-ins do.
 */

export interface EmoteDef {
  id: string
  /** Short glyph shown large in the bubble (1-4 chars). */
  sym: string
  /** Quick-phrase line under the glyph. */
  text: string
  /** Chinese text; falls back to `text` when absent. */
  zh?: string
}

export const EMOTES: Record<string, EmoteDef> = {
  gg: { id: 'gg', sym: 'GG', text: 'good game', zh: '打得好' },
  glhf: { id: 'glhf', sym: '▲', text: 'GL // HF', zh: '祝好运' },
  go: { id: 'go', sym: '▶', text: 'GO GO GO', zh: '冲冲冲' },
  wait: { id: 'wait', sym: '∥', text: 'hold on', zh: '等一下' },
  help: { id: 'help', sym: '✚', text: 'need backup', zh: '需要支援' },
  wow: { id: 'wow', sym: '!!', text: 'impressive', zh: '厉害' },
  think: { id: 'think', sym: '?', text: 'processing…', zh: '思考中…' },
  oops: { id: 'oops', sym: '×', text: 'segfault :(', zh: '出错了' },
  taunt: { id: 'taunt', sym: '◊', text: 'catch me', zh: '来抓我呀' },
  heart: { id: 'heart', sym: '♥', text: '<3', zh: '爱了' },
}

/** Display order for pickers: base set first, then modded extras. */
export function emoteList(): EmoteDef[] {
  return Object.values(EMOTES)
}
