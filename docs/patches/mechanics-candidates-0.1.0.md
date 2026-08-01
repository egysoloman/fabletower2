# Mechanics candidate patch 0.1.0

Status: **archived experiment**. These stacks remain versioned and selectable.
The reinforced-one Shared-4 finalist has been consolidated without behavior
changes into `production-v4-mechanics@2.0.0`; the previous
`production-v3-enemy-hp-95@1.0.0` stack remains available for rollback.

## Promotion decision (2026-08-01)

`candidate-mechanics-relic-reinforced-one-shared4` was selected for the formal
2.0.0 patch. It deliberately retains both opening **Stance Wall** layers on Phase
Locket and adds +1 Energy after every real stance switch; it does not exchange
the defensive relic identity for Energy. Across the two retrained policy
populations, GHOST won 33.740% and 34.424% of 2,048 evaluation episodes,
respectively, versus VECTOR at 33.594% and 33.643%.

The same candidate gives Drone Cradle +1 HP to each role's shared summon body.
ARRAY won 35.205% and 31.787% in the two populations (33.496% simple mean),
with floor-16 reach rates of 74.902% and 73.145%. This keeps the summon build
viable without restoring the runaway scaling seen with independent per-layer
HP or a pre-deployed Ferro body.

## GHOST

- Adds the visible neutral **Stable** stance for GHOST combat starts.
- Exiting Overdrive or Stealth returns to Stable.
- An Attack played while already in Stealth resolves, then breaks Stealth.
- Removes the fixed legacy “leave Stealth: +2 Energy” rule in both candidates.
- `ghost-stable-exit-energy@0.1.0`: leaving Stable grants 1 Energy.
- `ghost-every-switch-energy@0.1.0`: every real stance transition grants 1
  Energy; re-entering the same stance remains a no-op.

## ARRAY

- ARRAY starts with 8 less Max HP (67 instead of 75 at A0).
- Deploy Turret/Plating become Ferro/Bulwark summon starters.
- ARRAY Attack cards command all living summons to act once instead of dealing
  direct body damage. Non-damage riders remain intact.
- Same-role summons share one board slot and stack up to 5 layers. Each layer
  adds one action and one independently sacrificed HP body.
- Layering and mixed-role bonuses are ARRAY-only; other characters' summon
  behavior is byte-for-byte unchanged in paired evaluation.
- Linear candidate: actions scale only with surviving layers.
- Mixed candidate: each layer gains +1 action power per other role present.
- Smooth-4 candidate: ARRAY starts at 70 HP, each role caps at 4 layers, and
  mixed formation power is capped at +1 per layer even with all three roles.
- Smooth-3 candidate: ARRAY starts at 72 HP and caps each role at 3 layers,
  with the same capped mixed-formation bonus. These two candidates trade late
  snowball power for a less brittle opening.
- Shared-4 candidate: keeps the Smooth-4 offense, but all layers of one role
  share one HP bar. Layers still add actions; losing that body removes the
  whole role stack instead of consuming just one full-HP layer.
- Relic-core Shared-4 candidate: Phase Locket owns the +1 Energy stance-switch
  hook (and no longer grants Stance Wall), while Drone Cradle deploys one base
  Ferro layer at combat start. This keeps signature mechanics attached to the
  starter relics and removes ARRAY's empty-board opening brick.
- Relic-seed Shared-4 candidate: Phase Locket keeps 2 Stance Wall alongside
  its switch-energy hook. Drone Cradle deploys a 2-HP, power-1 Ferro Seed;
  summoning normal Ferro stacks onto it and upgrades the shared strike role.
- Relic-reinforced Shared-4 candidate: Drone Cradle pre-deploys nothing and
  instead grants +2 HP to each summoned role's one shared body. This improves
  early tolerance without unlocking empty-board Command cards or scaling HP
  with layers. Phase Locket keeps both Stance Wall layers and owns the +1
  stance-switch Energy hook.
- Relic-reinforced-one Shared-4 candidate: the same finalist with Drone
  Cradle reduced to +1 shared-body HP, targeting the midpoint between the
  no-effect relic and the slightly overtuned +2 HP experiment.

## Built-in candidate stacks

- `candidate-mechanics-stable-linear`
- `candidate-mechanics-switch-linear`
- `candidate-mechanics-stable-synergy`
- `candidate-mechanics-switch-synergy`
- `candidate-mechanics-switch-smooth4`
- `candidate-mechanics-switch-smooth3`
- `candidate-mechanics-switch-shared4`
- `candidate-mechanics-relic-core-shared4`
- `candidate-mechanics-relic-seed-shared4`
- `candidate-mechanics-relic-reinforced-shared4`
- `candidate-mechanics-relic-reinforced-one-shared4`

The RL lab selects these through `balanceStack`, so training, authoritative
simulation, clients and tests all resolve the exact same patch objects.
