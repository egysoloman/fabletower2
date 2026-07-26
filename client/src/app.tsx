import { FxLayer } from './fx'
import { PickerModal, PileModal } from './components'
import { screen } from './store'
import { MenuScreen, NewRunScreen, SettingsScreen } from './screens/menu'
import { CodexScreen } from './screens/codex'
import { achToasts } from './meta'
import { t } from './i18n'
import { MapScreen } from './screens/map'
import { CombatScreen } from './screens/combat'
import { DescendScreen, EventScreen, RestScreen, RewardScreen, ShopScreen } from './screens/overlays'
import { FinaleScreen } from './screens/finale'
import { PvpScreen } from './screens/pvp'
import { ClimbScreen } from './screens/climb'
import { CoopScreen } from './screens/coop'
import { CheatMenu } from './screens/cheats'

export function App() {
  const s = screen.value
  return (
    <>
      {/* keyed wrapper remounts per screen → fade/settle transition */}
      <div class="screenwrap" key={s}>
        {s === 'menu' && <MenuScreen />}
        {s === 'newrun' && <NewRunScreen />}
        {s === 'settings' && <SettingsScreen />}
        {s === 'codex' && <CodexScreen />}
        {s === 'map' && <MapScreen />}
        {s === 'combat' && <CombatScreen />}
        {s === 'reward' && <RewardScreen />}
        {s === 'shop' && <ShopScreen />}
        {s === 'rest' && <RestScreen />}
        {s === 'event' && <EventScreen />}
        {s === 'descend' && <DescendScreen />}
        {s === 'gameover' && <FinaleScreen win={false} />}
        {s === 'victory' && <FinaleScreen win />}
        {s === 'pvp' && <PvpScreen />}
        {s === 'climb' && <ClimbScreen />}
        {s === 'coop' && <CoopScreen />}
      </div>
      <div class="achtoasts">
        {achToasts.value.map((id) => (
          <div key={id} class="achtoast">
            <span class="asym">★</span>
            <span>
              <b>{t(('ach_' + id) as Parameters<typeof t>[0])}</b>
              <small>{t('achUnlocked')}</small>
            </span>
          </div>
        ))}
      </div>
      <CheatMenu />
      <PileModal />
      <PickerModal />
      <FxLayer />
    </>
  )
}
