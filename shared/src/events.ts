import { isZh } from './i18n'
import { EVENT_ZH } from './locale-zh'

export type Outcome =
  | { k: 'gold'; n: number }
  | { k: 'damage'; n: number }
  | { k: 'heal'; n: number }
  | { k: 'maxhp'; n: number }
  | { k: 'relic' }
  | { k: 'cardRandom'; rarity: 'common' | 'uncommon' | 'rare' }
  | { k: 'cardGlitch' }
  | { k: 'upgradeRandom' }
  | { k: 'removeChoose' }
  | { k: 'potion' }
  | { k: 'curse' }
  | { k: 'cardSpecific'; id: string }

export interface EventChoice {
  label: string
  detail: string
  outcomes: Outcome[]
  needGold?: number
}

export interface EventDef {
  id: string
  name: string
  glyph: string
  text: string
  choices: EventChoice[]
}

export function eventName(ev: EventDef): string {
  return isZh() ? (EVENT_ZH[ev.id]?.name ?? ev.name) : ev.name
}

export function eventText(ev: EventDef): string {
  return isZh() ? (EVENT_ZH[ev.id]?.text ?? ev.text) : ev.text
}

export function eventChoiceLabel(ev: EventDef, i: number): string {
  return isZh() ? (EVENT_ZH[ev.id]?.choices[i]?.label ?? ev.choices[i].label) : ev.choices[i].label
}

export function eventChoiceDetail(ev: EventDef, i: number): string {
  return isZh() ? (EVENT_ZH[ev.id]?.choices[i]?.detail ?? ev.choices[i].detail) : ev.choices[i].detail
}

export const EVENTS: EventDef[] = [
  {
    id: 'server',
    name: 'Abandoned Server Farm',
    glyph: '🏚',
    text: 'Racks of dead machines hum with residual charge. Something valuable is still plugged in — behind a mesh of live wires.',
    choices: [
      { label: 'JACK IN', detail: 'Gain a random relic. Take 12 damage.', outcomes: [{ k: 'relic' }, { k: 'damage', n: 12 }] },
      { label: 'WALK AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'courier',
    name: 'Black Market Courier',
    glyph: '🛵',
    text: 'A courier drone idles in the alley, cargo bay cracked open. "Prototype deck tech. No refunds. No questions."',
    choices: [
      { label: 'BUY THE CHIP', detail: 'Pay 50¤: add a random RARE card to your deck.', needGold: 50, outcomes: [{ k: 'gold', n: -50 }, { k: 'cardRandom', rarity: 'rare' }] },
      { label: 'DECLINE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'shrine',
    name: 'Neon Shrine',
    glyph: '⛩',
    text: 'A shrine of stacked CRTs flickers in the dark. The static almost sounds like a voice offering you a trade.',
    choices: [
      { label: 'PRAY', detail: 'Upgrade a random card. Lose 8 HP.', outcomes: [{ k: 'upgradeRandom' }, { k: 'damage', n: 8 }] },
      { label: 'REST', detail: 'Heal 18 HP.', outcomes: [{ k: 'heal', n: 18 }] },
    ],
  },
  {
    id: 'cache',
    name: 'Corrupted Cache',
    glyph: '📦',
    text: 'A supply cache, seals broken, contents scrambled. The credits inside look real. The checksum does not.',
    choices: [
      { label: 'CRACK IT OPEN', detail: 'Gain 60¤. A Glitch is permanently added to your deck.', outcomes: [{ k: 'gold', n: 60 }, { k: 'cardGlitch' }] },
      { label: 'LEAVE IT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'ghost',
    name: 'Ghost in the Shell',
    glyph: '🫥',
    text: 'A fragment of an old runner\'s consciousness drifts through your HUD. "Travel light," it whispers, "or grow strong."',
    choices: [
      { label: 'TRAVEL LIGHT', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
      { label: 'GROW STRONG', detail: 'Raise your Max HP by 6.', outcomes: [{ k: 'maxhp', n: 6 }] },
    ],
  },
  {
    id: 'terminal',
    name: 'Overclocked Terminal',
    glyph: '⌨',
    text: 'A dev terminal, still logged in, fans screaming at redline. The build pipeline is wide open — if you can stand the heat.',
    choices: [
      { label: 'HIJACK THE BUILD', detail: 'Upgrade 2 random cards. Take 10 damage.', outcomes: [{ k: 'upgradeRandom' }, { k: 'upgradeRandom' }, { k: 'damage', n: 10 }] },
      { label: 'STEP AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'broker',
    name: 'Data Broker',
    glyph: '🕴',
    text: '"Everything sells," the broker says, tapping a slate of grey-market listings. "Even the code you\'re carrying."',
    choices: [
      { label: 'SELL A CARD', detail: 'Remove a card from your deck and gain 45¤.', outcomes: [{ k: 'removeChoose' }, { k: 'gold', n: 45 }] },
      { label: 'DECLINE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'quarantine',
    name: 'Quarantine Vault',
    glyph: '⚠',
    text: 'A sealed vault stamped with hazard glyphs. Whatever is inside was locked away for a reason — and it is still running.',
    choices: [
      { label: 'BREACH THE SEAL', detail: 'Add a random RARE card to your deck. A Glitch comes with it.', outcomes: [{ k: 'cardRandom', rarity: 'rare' }, { k: 'cardGlitch' }] },
      { label: 'LEAVE IT SEALED', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'backup',
    name: 'Backup Node',
    glyph: '◍',
    text: 'An intact backup node hums behind a cracked wall, brimming with clean state. Enough to restore — or to permanently extend.',
    choices: [
      { label: 'RESTORE', detail: 'Heal 25 HP.', outcomes: [{ k: 'heal', n: 25 }] },
      { label: 'EXTEND', detail: 'Raise your Max HP by 5.', outcomes: [{ k: 'maxhp', n: 5 }] },
    ],
  },
  {
    id: 'cursedware',
    name: 'Cursed Firmware',
    glyph: '☠',
    text: 'A payment terminal offers an absurd bounty for one small install. The changelog is a single line: "minor latency issues."',
    choices: [
      { label: 'INSTALL IT', detail: 'Gain 120¤. A Lag curse is permanently added to your deck.', outcomes: [{ k: 'gold', n: 120 }, { k: 'curse' }] },
      { label: 'REFUSE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'dispenser',
    name: 'Med Dispenser',
    glyph: '✚',
    text: 'A field-medic dispenser, still stocked. The lock is broken and the expiry dates are… optimistic.',
    choices: [
      { label: 'RAID THE TRAY', detail: 'Gain a random potion and heal 5 HP.', outcomes: [{ k: 'potion' }, { k: 'heal', n: 5 }] },
      { label: 'LEAVE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'auction',
    name: 'Darknet Auction',
    glyph: '🔨',
    text: 'A pop-up auction house floods your HUD with lots: unlabeled hardware, hot firmware, and a countdown that is always at ten seconds.',
    choices: [
      { label: 'BID ON HARDWARE', detail: 'Pay 85¤: gain a random relic.', needGold: 85, outcomes: [{ k: 'gold', n: -85 }, { k: 'relic' }] },
      { label: 'BID ON FIRMWARE', detail: 'Pay 40¤: add a random UNCOMMON card to your deck.', needGold: 40, outcomes: [{ k: 'gold', n: -40 }, { k: 'cardRandom', rarity: 'uncommon' }] },
      { label: 'LURK', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'stimlab',
    name: 'Abandoned Stim Lab',
    glyph: '⚗',
    text: 'Half-finished batches bubble under cracked heat lamps. The good stuff is in the fridge; the fridge is wired to something.',
    choices: [
      { label: 'RAID THE FRIDGE', detail: 'Gain 2 random potions. Take 6 damage.', outcomes: [{ k: 'potion' }, { k: 'potion' }, { k: 'damage', n: 6 }] },
      { label: 'BREW CAREFULLY', detail: 'Gain a random potion.', outcomes: [{ k: 'potion' }] },
      { label: 'LEAVE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'archivist',
    name: 'The Archivist',
    glyph: '📚',
    text: 'A hunched figure of stacked drives catalogues everything that was ever deleted. It will trade — but only in kind.',
    choices: [
      { label: 'TRADE KNOWLEDGE', detail: 'Remove a card from your deck, then add a random UNCOMMON card.', outcomes: [{ k: 'removeChoose' }, { k: 'cardRandom', rarity: 'uncommon' }] },
      { label: 'DONATE', detail: 'Pay 40¤: upgrade a random card.', needGold: 40, outcomes: [{ k: 'gold', n: -40 }, { k: 'upgradeRandom' }] },
      { label: 'BACK AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'junkyard',
    name: 'Drone Junkyard',
    glyph: '🛠',
    text: 'Acres of dead drones, picked half-clean. Something under the pile is still broadcasting a service manual.',
    choices: [
      { label: 'DIG FOR THE CORE', detail: 'Gain a random relic. A Glitch is added to your deck.', outcomes: [{ k: 'relic' }, { k: 'cardGlitch' }] },
      { label: 'STRIP PARTS', detail: 'Gain 50¤.', outcomes: [{ k: 'gold', n: 50 }] },
      { label: 'MOVE ON', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'chapel',
    name: 'Silent Server Chapel',
    glyph: '🕯',
    text: 'A hall of servers spun down to zero RPM. Whatever was worshipped here has finished computing. The silence is load-bearing.',
    choices: [
      { label: 'MEDITATE', detail: 'Raise your Max HP by 4 and heal 10 HP.', outcomes: [{ k: 'maxhp', n: 4 }, { k: 'heal', n: 10 }] },
      { label: 'STRIP THE COPPER', detail: 'Gain 70¤. A Lag curse is added to your deck.', outcomes: [{ k: 'gold', n: 70 }, { k: 'curse' }] },
      { label: 'TIPTOE OUT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'glitchpool',
    name: 'Glitch Pool',
    glyph: '🌀',
    text: 'A pool of raw, un-rendered space where the floor forgot its textures. Things dropped in come back… different.',
    choices: [
      { label: 'DIVE', detail: 'Add a random RARE card. Take 10 damage and gain a Glitch.', outcomes: [{ k: 'cardRandom', rarity: 'rare' }, { k: 'damage', n: 10 }, { k: 'cardGlitch' }] },
      { label: 'SKIM THE SURFACE', detail: 'Upgrade a random card.', outcomes: [{ k: 'upgradeRandom' }] },
      { label: 'KEEP YOUR DISTANCE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'vending',
    name: 'Haunted Vending Machine',
    glyph: '🥤',
    text: 'The machine hums a tune nobody wrote and stocks flavors nobody ordered. The coin slot breathes.',
    choices: [
      { label: 'INSERT COINS', detail: 'Pay 15¤: gain a random potion.', needGold: 15, outcomes: [{ k: 'gold', n: -15 }, { k: 'potion' }] },
      { label: 'SHAKE IT', detail: 'Gain 25¤. Take 4 damage.', outcomes: [{ k: 'gold', n: 25 }, { k: 'damage', n: 4 }] },
      { label: 'WALK PAST', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'streetdoc',
    name: 'Street Doc',
    glyph: '💉',
    text: 'A back-alley clinic with a suspicious autoclave and immaculate hands. "Cash up front. Anesthesia extra."',
    choices: [
      { label: 'FULL AUGMENTATION', detail: 'Pay 60¤: raise your Max HP by 7.', needGold: 60, outcomes: [{ k: 'gold', n: -60 }, { k: 'maxhp', n: 7 }] },
      { label: 'QUICK PATCH', detail: 'Pay 25¤: heal 20 HP.', needGold: 25, outcomes: [{ k: 'gold', n: -25 }, { k: 'heal', n: 20 }] },
      { label: 'DECLINE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'signaltower',
    name: 'Pirate Signal Tower',
    glyph: '📡',
    text: 'A rogue transmitter stitched to a rooftop, screaming encrypted treasure into the void. The climb looks bad. The payload looks worse.',
    choices: [
      { label: 'CLIMB', detail: 'Gain a random relic. Take 14 damage.', outcomes: [{ k: 'relic' }, { k: 'damage', n: 14 }] },
      { label: 'TAP THE FEED', detail: 'Gain 40¤.', outcomes: [{ k: 'gold', n: 40 }] },
      { label: 'STAY GROUNDED', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'memoryleak',
    name: 'Memory Leak',
    glyph: '💧',
    text: 'Something in your deck is dripping cycles into the floor. You could patch it out — or bottle the runoff and sell it.',
    choices: [
      { label: 'PATCH IT', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
      { label: 'EXPLOIT IT', detail: 'Gain 55¤. A Glitch is added to your deck.', outcomes: [{ k: 'gold', n: 55 }, { k: 'cardGlitch' }] },
      { label: 'IGNORE IT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'straydrone',
    name: 'Stray Drone',
    glyph: '🛩',
    text: 'A limping courier drone bumps against your shin, cargo light blinking. Its manifest lists one item: "gift".',
    choices: [
      { label: 'REPAIR IT', detail: 'Pay 30¤: it leads you to a random relic.', needGold: 30, outcomes: [{ k: 'gold', n: -30 }, { k: 'relic' }] },
      { label: 'SCRAP IT', detail: 'Gain 35¤.', outcomes: [{ k: 'gold', n: 35 }] },
      { label: 'SHOO IT AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'forcedupdate',
    name: 'Forced Firmware Update',
    glyph: '⟳',
    text: 'UPDATE REQUIRED, insists every surface of the corridor. The changelog promises optimizations. The EULA is 40,000 pages.',
    choices: [
      { label: 'ACCEPT ALL', detail: 'Upgrade 2 random cards. A Lag curse is added to your deck.', outcomes: [{ k: 'upgradeRandom' }, { k: 'upgradeRandom' }, { k: 'curse' }] },
      { label: 'REMIND ME LATER', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'blackice',
    name: 'Black ICE Node',
    glyph: '🧊',
    text: 'A fortune in credits, wrapped in counter-intrusion ICE that is already tasting your firewall. It knows you are reading this.',
    choices: [
      { label: 'CRACK IT', detail: 'Gain 90¤. Take 14 damage.', outcomes: [{ k: 'gold', n: 90 }, { k: 'damage', n: 14 }] },
      { label: 'SAFE PROBE', detail: 'Gain 30¤.', outcomes: [{ k: 'gold', n: 30 }] },
      { label: 'DISCONNECT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'timecapsule',
    name: 'Data Time Capsule',
    glyph: '⧗',
    text: 'A sealed archive from the city that stood here before the Spire. Collectors pay well for unopened history — but you want to look.',
    choices: [
      { label: 'OPEN IT', detail: 'Gain a random potion and 20¤.', outcomes: [{ k: 'potion' }, { k: 'gold', n: 20 }] },
      { label: 'SELL IT SEALED', detail: 'Gain 65¤.', outcomes: [{ k: 'gold', n: 65 }] },
      { label: 'BURY IT AGAIN', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'tollgate',
    name: 'Corporate Tollgate',
    glyph: '⛩',
    text: 'A privatized checkpoint straddles the only corridor up. The fee schedule is laminated. The turret is not decorative.',
    choices: [
      { label: 'PAY THE TOLL', detail: 'Pay 45¤: heal 15 HP and gain a random potion.', needGold: 45, outcomes: [{ k: 'gold', n: -45 }, { k: 'heal', n: 15 }, { k: 'potion' }] },
      { label: 'SMASH THROUGH', detail: 'Gain 45¤ from the till. Take 10 damage.', outcomes: [{ k: 'gold', n: 45 }, { k: 'damage', n: 10 }] },
      { label: 'FIND ANOTHER WAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'ratking',
    name: "Rat King's Hoard",
    glyph: '🐀',
    text: 'A nest of cable-rats has dragged half the floor\'s valuables into a glittering pile. Their king watches you with seven borrowed eyes.',
    choices: [
      { label: 'TAKE THE CROWN JEWEL', detail: 'Gain a random relic. A Lag curse is added to your deck.', outcomes: [{ k: 'relic' }, { k: 'curse' }] },
      { label: 'SKIM THE PILE', detail: 'Gain 40¤.', outcomes: [{ k: 'gold', n: 40 }] },
      { label: 'BOW AND RETREAT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'coolantspill',
    name: 'Coolant Spill',
    glyph: '❆',
    text: 'A ruptured line floods the corridor ankle-deep in server coolant. It numbs everything it touches — wounds included.',
    choices: [
      { label: 'WADE IN', detail: 'Heal 22 HP.', outcomes: [{ k: 'heal', n: 22 }] },
      { label: 'BOTTLE IT', detail: 'Gain a random potion.', outcomes: [{ k: 'potion' }] },
      { label: 'STAY DRY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'debtcollector',
    name: 'Debt Collector',
    glyph: '🧾',
    text: 'A repo-drone unfolds from the ceiling, reciting a debt you never took under a name that is almost yours. It is not asking.',
    choices: [
      { label: 'SETTLE IT', detail: 'Pay 55¤: it upgrades your chassis as a courtesy — raise Max HP by 5.', needGold: 55, outcomes: [{ k: 'gold', n: -55 }, { k: 'maxhp', n: 5 }] },
      { label: 'REFUSE', detail: 'Take 8 damage as it garnishes your hardware.', outcomes: [{ k: 'damage', n: 8 }] },
    ],
  },
  {
    id: 'ghostsignal',
    name: 'Ghost Signal',
    glyph: '〰',
    text: 'A transmission with no source keeps repeating your handle — and then coordinates, three floors where nothing should be.',
    choices: [
      { label: 'FOLLOW IT', detail: 'Gain a random relic. Take 10 damage.', outcomes: [{ k: 'relic' }, { k: 'damage', n: 10 }] },
      { label: 'RECORD AND SELL', detail: 'Gain 35¤.', outcomes: [{ k: 'gold', n: 35 }] },
      { label: 'JAM THE BAND', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'antivirus',
    name: 'Militant Antivirus',
    glyph: '⛑',
    text: 'A century-old antivirus daemon scans you and frowns at what it finds. "QUARANTINE," it suggests, extending a claw. "OR CO-OPERATION."',
    choices: [
      { label: 'SUBMIT TO PURGE', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
      { label: 'COMPLY QUIETLY', detail: 'Heal 15 HP.', outcomes: [{ k: 'heal', n: 15 }] },
      { label: 'RESIST', detail: 'Gain 50¤ from its bounty cache. Take 8 damage.', outcomes: [{ k: 'gold', n: 50 }, { k: 'damage', n: 8 }] },
    ],
  },
  {
    id: 'foundry',
    name: 'Automated Foundry',
    glyph: '⚙',
    text: 'The production line never stopped: it just ran out of blueprints. It will forge whatever you feed it — including you.',
    choices: [
      { label: 'FEED THE FORGE', detail: 'Upgrade 2 random cards. Take 8 damage.', outcomes: [{ k: 'upgradeRandom' }, { k: 'upgradeRandom' }, { k: 'damage', n: 8 }] },
      { label: 'SALVAGE SCRAP', detail: 'Gain 45¤.', outcomes: [{ k: 'gold', n: 45 }] },
      { label: 'DO NOT FEED', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'lottery',
    name: 'Neon Lottery',
    glyph: '✶',
    text: 'A kiosk promises RARE TECH, GUARANTEED, in letters taller than you. The fine print is in a dead language.',
    choices: [
      { label: 'BUY A TICKET', detail: 'Pay 25¤: add a random RARE card to your deck.', needGold: 25, outcomes: [{ k: 'gold', n: -25 }, { k: 'cardRandom', rarity: 'rare' }] },
      { label: 'ROB THE KIOSK', detail: 'Gain 40¤. A Glitch is added to your deck.', outcomes: [{ k: 'gold', n: 40 }, { k: 'cardGlitch' }] },
      { label: 'KEEP WALKING', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'coldstorage',
    name: 'Cold Storage',
    glyph: '❄',
    text: 'Rows of cryo-pods hum at four kelvin. Most are empty. One is full of medical supplies. One is full of something grateful.',
    choices: [
      { label: 'THAW THE POD', detail: 'Heal 20 HP and raise your Max HP by 3.', outcomes: [{ k: 'heal', n: 20 }, { k: 'maxhp', n: 3 }] },
      { label: 'LOOT THE SUPPLIES', detail: 'Gain a random potion and 25¤.', outcomes: [{ k: 'potion' }, { k: 'gold', n: 25 }] },
      { label: 'RESEAL THE DOOR', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'adbot',
    name: 'Malfunctioning Ad-Bot',
    glyph: '▷',
    text: '"ONE WEIRD TRICK," screams the ad-bot, projecting directly onto your retinas, "SPONSORS HATE IT. WATCH NOW. WATCH NOW. WATCH—"',
    choices: [
      { label: 'WATCH 30 ADS', detail: 'Gain 60¤. A Lag curse is added to your deck.', outcomes: [{ k: 'gold', n: 60 }, { k: 'curse' }] },
      { label: 'SMASH IT', detail: 'Gain 20¤ in loose change. Take 5 damage.', outcomes: [{ k: 'gold', n: 20 }, { k: 'damage', n: 5 }] },
      { label: 'AD BLOCKER', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'mirrormaze',
    name: 'Mirror Maze',
    glyph: '◫',
    text: 'A calibration chamber of infinite reflections. Somewhere in there is a version of you that made better choices. It is armed.',
    choices: [
      { label: 'FACE YOURSELF', detail: 'Upgrade a random card. A Glitch is added to your deck.', outcomes: [{ k: 'upgradeRandom' }, { k: 'cardGlitch' }] },
      { label: 'MAP THE EXITS', detail: 'Gain 30¤.', outcomes: [{ k: 'gold', n: 30 }] },
      { label: 'BREAK EYE CONTACT', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'quine',
    name: 'The Quine',
    glyph: '∞',
    text: 'A program whose only output is itself, running since before the Spire had a name. Watching it feels like being rewritten.',
    choices: [
      { label: 'STUDY THE LOOP', detail: 'Upgrade a random card. Take 4 damage.', outcomes: [{ k: 'upgradeRandom' }, { k: 'damage', n: 4 }] },
      { label: 'TRANSCRIBE IT', detail: 'Add a random UNCOMMON card to your deck.', outcomes: [{ k: 'cardRandom', rarity: 'uncommon' }] },
      { label: 'LOOK AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'karaoke',
    name: 'Empty Karaoke Bar',
    glyph: '♫',
    text: 'The stage lights still cycle for an audience of dust. The songbook is open to a track you almost remember being human to.',
    choices: [
      { label: 'SING IT OUT', detail: 'Heal 10 HP and raise your Max HP by 2.', outcomes: [{ k: 'heal', n: 10 }, { k: 'maxhp', n: 2 }] },
      { label: 'RAID THE TIP JAR', detail: 'Gain 25¤.', outcomes: [{ k: 'gold', n: 25 }] },
      { label: 'RESPECT THE SILENCE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'proxywar',
    name: 'Proxy War',
    glyph: '⚑',
    text: 'Two botnets fight for the floor, packet by packet. Both sides are recruiting. Both sides are losing.',
    choices: [
      { label: 'PICK A SIDE', detail: 'Gain a random relic. Take 12 damage.', outcomes: [{ k: 'relic' }, { k: 'damage', n: 12 }] },
      { label: 'SELL INTEL TO BOTH', detail: 'Gain 55¤.', outcomes: [{ k: 'gold', n: 55 }] },
      { label: 'STAY NEUTRAL', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'blackbox',
    name: 'Flight Black Box',
    glyph: '▣',
    text: 'A crash-hardened recorder from a vehicle that had no business this high in the Spire. The last entry is still warm.',
    choices: [
      { label: 'DECODE IT', detail: 'Add a random RARE card to your deck.', outcomes: [{ k: 'cardRandom', rarity: 'rare' }] },
      { label: 'SELL IT UNREAD', detail: 'Gain 50¤.', outcomes: [{ k: 'gold', n: 50 }] },
      { label: 'LET IT REST', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'servergarden',
    name: 'Server Garden',
    glyph: '⚘',
    text: 'Someone planted saplings in the hot aisle, and the trees learned to photosynthesize LED light. The gardener is long gone. The pruning shears are not.',
    choices: [
      { label: 'PRUNE YOUR DECK', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
      { label: 'HARVEST', detail: 'Gain a random potion and heal 5 HP.', outcomes: [{ k: 'potion' }, { k: 'heal', n: 5 }] },
      { label: 'JUST BREATHE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'tribunal',
    name: 'Deprecation Tribunal',
    glyph: '⚖',
    text: 'Three hooded processes preside over a docket of obsolete code. Your deck has been subpoenaed.',
    choices: [
      { label: 'PAY THE FINE', detail: 'Pay 30¤: upgrade 2 random cards.', needGold: 30, outcomes: [{ k: 'gold', n: -30 }, { k: 'upgradeRandom' }, { k: 'upgradeRandom' }] },
      { label: 'PLEAD OBSOLESCENCE', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
      { label: 'MOTION TO DISMISS', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'blackoutzone',
    name: 'Rolling Blackout',
    glyph: '☾',
    text: 'The floor goes dark section by section, scheduled like tides. In the gaps between power, things move that shouldn\'t.',
    choices: [
      { label: 'SIPHON THE GRID', detail: 'Gain 65¤. A Lag curse is added to your deck.', outcomes: [{ k: 'gold', n: 65 }, { k: 'curse' }] },
      { label: 'WAIT IT OUT', detail: 'Heal 12 HP.', outcomes: [{ k: 'heal', n: 12 }] },
      { label: 'MOVE THROUGH', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'punchcard',
    name: 'Punch-Card Oracle',
    glyph: '⌸',
    text: 'An ancient tabulator wakes as you pass, hungry for questions. Its answers arrive as neat rectangular holes in the truth.',
    choices: [
      { label: 'CONSULT IT', detail: 'Upgrade a random card. Take 5 damage.', outcomes: [{ k: 'upgradeRandom' }, { k: 'damage', n: 5 }] },
      { label: 'DONATE PUNCH CARDS', detail: 'Pay 20¤: heal 18 HP.', needGold: 20, outcomes: [{ k: 'gold', n: -20 }, { k: 'heal', n: 18 }] },
      { label: 'ASK NOTHING', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'scrapdog',
    name: 'Scrapyard Dog',
    glyph: '⚛',
    text: 'A dog-shaped assembly of salvage guards a buried cache. Its tail-servo wags. Its teeth are very real.',
    choices: [
      { label: 'ADOPT IT', detail: 'Pay 35¤: it digs up a random relic for you.', needGold: 35, outcomes: [{ k: 'gold', n: -35 }, { k: 'relic' }] },
      { label: 'PET IT', detail: 'Heal 8 HP. Morale matters.', outcomes: [{ k: 'heal', n: 8 }] },
      { label: 'BACK AWAY SLOWLY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'datawell',
    name: 'Data Well',
    glyph: '◍',
    text: 'A vertical shaft of pure archive, deeper than the Spire is tall. Things float up from the bottom: some valuable, some barbed.',
    choices: [
      { label: 'DIVE', detail: 'Add a random UNCOMMON card. A Glitch comes with it.', outcomes: [{ k: 'cardRandom', rarity: 'uncommon' }, { k: 'cardGlitch' }] },
      { label: 'DRINK FROM IT', detail: 'Heal 15 HP.', outcomes: [{ k: 'heal', n: 15 }] },
      { label: 'DROP A COIN', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'ransomnote',
    name: 'Ransomware Note',
    glyph: '⚿',
    text: 'YOUR DECK HAS BEEN ENCRYPTED, claims a note pinned to your HUD. It hasn\'t — yet. The countdown, however, is real.',
    choices: [
      { label: 'PAY UP', detail: 'Pay 40¤: they even remove a card of your choice as a courtesy.', needGold: 40, outcomes: [{ k: 'gold', n: -40 }, { k: 'removeChoose' }] },
      { label: 'IGNORE IT', detail: 'A Lag curse is added to your deck.', outcomes: [{ k: 'curse' }] },
    ],
  },
  {
    id: 'glitchfest',
    name: 'Glitch Festival',
    glyph: '✦',
    text: 'Corrupted sprites parade through the corridor in impossible colors, celebrating nothing, beautifully. You are invited.',
    choices: [
      { label: 'JOIN THE DANCE', detail: 'Gain 50¤ and heal 10 HP. A Glitch joins your deck.', outcomes: [{ k: 'gold', n: 50 }, { k: 'heal', n: 10 }, { k: 'cardGlitch' }] },
      { label: 'WATCH FROM AFAR', detail: 'Gain 15¤ in dropped tokens.', outcomes: [{ k: 'gold', n: 15 }] },
      { label: 'DECLINE THE INVITE', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'lasttrain',
    name: 'Last Train Home',
    glyph: '⛁',
    text: 'A maglev idles at a platform that isn\'t on any map, doors open, destination blank. It will leave exactly once.',
    choices: [
      { label: 'RIDE ONE STOP', detail: 'Heal 18 HP.', outcomes: [{ k: 'heal', n: 18 }] },
      { label: 'RAID THE LOST & FOUND', detail: 'Gain a random potion and 20¤. Take 4 damage.', outcomes: [{ k: 'potion' }, { k: 'gold', n: 20 }, { k: 'damage', n: 4 }] },
      { label: 'LET IT GO', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'arcade',
    name: 'Dead Arcade',
    glyph: '🕹',
    text: 'One cabinet still glows in the gutted arcade, marquee flickering: INSERT CREDIT. The high-score list is all the same three letters.',
    choices: [
      { label: 'INSERT CREDIT', detail: 'Pay 10¤: win a random potion.', needGold: 10, outcomes: [{ k: 'gold', n: -10 }, { k: 'potion' }] },
      { label: 'TILT THE MACHINE', detail: 'Gain 30¤. Take 3 damage.', outcomes: [{ k: 'gold', n: 30 }, { k: 'damage', n: 3 }] },
      { label: 'LET IT REST', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
]

EVENTS.push(
  {
    id: 'dronegrave',
    name: 'Drone Graveyard',
    glyph: '⚰',
    text: 'A trench of decommissioned drones, stacked like sediment. One chassis near the top still twitches when you get close.',
    choices: [
      { label: 'REBUILD IT', detail: 'Add a Rent-a-Drone to your deck and heal 5 HP.', outcomes: [{ k: 'cardSpecific', id: 'rentadrone' }, { k: 'heal', n: 5 }] },
      { label: 'STRIP FOR PARTS', detail: 'Gain 45¤.', outcomes: [{ k: 'gold', n: 45 }] },
      { label: 'LET THEM REST', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'signalnest',
    name: 'Feral Signal Nest',
    glyph: '☖',
    text: 'Stray maintenance daemons have built a nest of hijacked bandwidth. They chirp at you in corrupted handshake protocols. They seem… adoptable.',
    choices: [
      { label: 'ADOPT THE BROOD', detail: 'Add 2 Rent-a-Drones to your deck. Take 6 damage in the process.', outcomes: [{ k: 'cardSpecific', id: 'rentadrone' }, { k: 'cardSpecific', id: 'rentadrone' }, { k: 'damage', n: 6 }] },
      { label: 'HARVEST THE NEST', detail: 'Gain a random potion.', outcomes: [{ k: 'potion' }] },
      { label: 'BACK AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'datavault',
    name: 'The Data Vault',
    glyph: '◫',
    text: 'A bank vault that has been offline for decades. The terminal still shows a withdrawal screen — balance: 0. The tumblers hum when you approach.',
    choices: [
      { label: 'FORGE THE LEDGER', detail: 'Gain 120¤. A Glitch is added to your deck.', outcomes: [{ k: 'gold', n: 120 }, { k: 'cardGlitch' }] },
      { label: 'CRACK THE TUMBLERS', detail: 'Gain a random relic. Take 10 damage.', outcomes: [{ k: 'relic' }, { k: 'damage', n: 10 }] },
      { label: 'LOG OFF', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
  {
    id: 'recyclebin',
    name: 'The Recycle Bin',
    glyph: '♻',
    text: 'A recycle bin the size of a room. Deleted files drift inside it like fish in a dark tank — some still readable, most just scraps.',
    choices: [
      { label: 'RESTORE A FILE', detail: 'Heal 18 HP.', outcomes: [{ k: 'heal', n: 18 }] },
      { label: 'PURGE PERMANENTLY', detail: 'Remove a card from your deck. Gain 45¤.', outcomes: [{ k: 'removeChoose' }, { k: 'gold', n: 45 }] },
      { label: 'WALK AWAY', detail: 'Nothing happens.', outcomes: [] },
    ],
  },
)

/** Run-start bonus choice (Neow-style). Not part of the random event pool. */
export const BOOT_EVENT: EventDef = {
  id: 'boot',
  name: 'BOOT SEQUENCE',
  glyph: '⏻',
  text: 'The Spire\'s outer firewall parses your signature and hesitates. One free write to your loadout before the climb begins.',
  choices: [
    { label: 'REINFORCE', detail: 'Raise your Max HP by 8.', outcomes: [{ k: 'maxhp', n: 8 }] },
    { label: 'LIQUIDATE', detail: 'Gain 75¤.', outcomes: [{ k: 'gold', n: 75 }] },
    { label: 'SCAVENGE', detail: 'Gain a random relic.', outcomes: [{ k: 'relic' }] },
    { label: 'DEFRAG', detail: 'Remove a card from your deck.', outcomes: [{ k: 'removeChoose' }] },
  ],
}
