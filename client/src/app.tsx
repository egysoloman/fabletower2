import { FxLayer } from './fx'
import { PickerModal, PileModal } from './components'
import { screen } from './store'
import { MenuScreen } from './screens/menu'
import { MapScreen } from './screens/map'
import { CombatScreen } from './screens/combat'
import { EventScreen, RestScreen, RewardScreen, ShopScreen } from './screens/overlays'
import { FinaleScreen } from './screens/finale'
import { PvpScreen } from './screens/pvp'
import { CheatMenu } from './screens/cheats'

export function App() {
  const s = screen.value
  return (
    <>
      {/* keyed wrapper remounts per screen → fade/settle transition */}
      <div class="screenwrap" key={s}>
        {s === 'menu' && <MenuScreen />}
        {s === 'map' && <MapScreen />}
        {s === 'combat' && <CombatScreen />}
        {s === 'reward' && <RewardScreen />}
        {s === 'shop' && <ShopScreen />}
        {s === 'rest' && <RestScreen />}
        {s === 'event' && <EventScreen />}
        {s === 'gameover' && <FinaleScreen win={false} />}
        {s === 'victory' && <FinaleScreen win />}
        {s === 'pvp' && <PvpScreen />}
      </div>
      <CheatMenu />
      <PileModal />
      <PickerModal />
      <FxLayer />
    </>
  )
}
