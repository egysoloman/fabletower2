/** Entry gate: shown only when the server has GAME_ENTRY_PASSWORD set. */
import { useState } from 'preact/hooks'
import { gate, tryGate } from '../account'
import { t } from '../i18n'

export function GateScreen() {
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(false)
  if (gate.value === 'checking') return <div class="screen menu" />
  const submit = () => {
    setErr(false)
    void tryGate(pass).then((ok) => setErr(!ok))
  }
  return (
    <div class="screen menu">
      <div class="logo">
        NEON<span>SPIRE</span>
      </div>
      <div class="panel popin" style={{ minWidth: '320px' }}>
        <h2>{t('gateTitle')}</h2>
        <div class="sub">{t('gateText')}</div>
        <input
          class="neon"
          type="password"
          value={pass}
          placeholder={t('accPass')}
          onInput={(e) => setPass((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {err && <div class="sub" style={{ color: 'var(--red)' }}>{t('gateWrong')}</div>}
        <button class="btn big pink" onClick={submit}>
          {t('gateEnter')}
        </button>
      </div>
    </div>
  )
}
