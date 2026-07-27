/**
 * Touch support: hover-free devices get tap-to-open tooltips (any [data-tip]
 * element), and prompts can branch on isTouch() to swap mouse-only wording
 * (right-click hints) for touch-friendly ones.
 */

/** True on devices whose primary pointer can't hover (phones, tablets). */
export function isTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches
}

/**
 * Tap a [data-tip] element to show its tooltip (class .tip-on mirrors the
 * :hover rules); tapping elsewhere — or a 2.6 s timeout — hides it again.
 * Installed only on hover-free devices so mouse behavior is untouched.
 */
export function installTouchTips() {
  if (!isTouch()) return
  let active: HTMLElement | null = null
  let timer = 0
  const hide = () => {
    active?.classList.remove('tip-on')
    active = null
  }
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null
      clearTimeout(timer)
      if (!el || el === active) {
        hide()
        return
      }
      hide()
      active = el
      el.classList.add('tip-on')
      timer = window.setTimeout(hide, 2600)
    },
    true,
  )
}
