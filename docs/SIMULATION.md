# Simulation design

Everything here is implemented in `src/game` (pure TypeScript, no React) and covered by the tests in `tests/unit`.
Numbers are the shipped defaults; content tables live in `src/game/content`.

## Time

- One **tick** = 0.25 game seconds (4 ticks per second). The engine always advances in whole ticks; real time × speed (1×, 2×, 4×) accumulates in `GameEngine.updateSimulation`.
- All content rates are **per game minute**; systems multiply by `dt / 60`.
- Rendering never drives the simulation. The frame loop hands real seconds to the engine, and React only re-renders when a new snapshot is published (at most once per batch of ticks).

## Tick order

`src/game/engine/step.ts` runs, in this order:

1. construction timers
2. capacities (from built modules)
3. topology (adjacency graph, once per tick)
4. power allocation and module status
5. resources and life support
6. temperature
7. condition, wear, breaches, hull
8. crew tasks and needs
9. anomalies (growth, spread, echo-driven spawning)
10. echo condensers, echo decay
11. research progress
12. expeditions
13. incidents (every 5 s)
14. objectives and achievements (once per second), game over check

## Resources

| Resource | Start | Base capacity | Sources | Sinks | At zero |
|---|---|---|---|---|---|
| Power (battery) | 50 | 80 + 40 per reactor + 60 per storage | reactors | every powered module | modules shed by priority |
| Oxygen | 95 | 150 + 50 per oxygen generator | oxygen generator 10, hydroponics 2 | crew 3 each, Bloom 0.02 × intensity, breaches 8, hull below 30 % up to 4 | crew lose 4 health and 3 morale per minute |
| Food | 45 | 80 + 30 per hydroponics + 60 per storage | hydroponics 6 | crew 1 each | crew lose 1 health and 2 morale per minute |
| Water | 60 | 100 + 40 per recycler + 60 per storage | recycler 5, Glacier Shard | oxygen generator 2, hydroponics 3 | those modules stop ("no input") |
| Research | 10 | 9999 | labs 3, scientists 2 × work rate, echo condensers, harnessed Bloom | research projects | — |
| Materials | 150 | 150 + 100 per storage | workshop 1.5, expeditions, salvage | building, upgrading, repairs (0.15 per condition point) | repairs stall |
| Credits | 50 | 99 999 | expeditions, salvage | advanced modules, upgrades | — |
| Hull | 72 % | 100 | workshop 0.15, shield 0.6 per minute | meteor strikes, failed expeditions | game over (recoverable) |

Values are clamped to `[0, capacity]` every tick; the property-based test in `tests/unit/determinism-invariants.test.ts` checks this for random command sequences.

Output of a module = base × level multiplier (1, 1.35, 1.7) × condition efficiency (100 % above 60 condition, falling to 40 % at 0) × anomaly and echo factors × captain bonus (+2 % per level).

## Power

1. Each module first gets a base status: constructing, disabled, quarantined, broken (< 10 condition), overheated, too cold, or overgrown.
2. Power travels through shared walls. Broken modules do not conduct, so a broken corridor can cut a wing off (`disconnected`). With no working reactor at all, consumers report `no_power`.
3. Supply = reactor output (60 × level × condition efficiency × 1.2 with Reactor Tuning) + tapped Static Choir + what the battery may discharge this tick.
4. Consumers are served by priority — 1 life support (oxygen, recycler, radiator), 2 essential, 3 operations, 4 non-essential — then by id. A consumer gets all of its demand or nothing.
5. **Battery reserve:** when the battery runs flat it only discharges again after recharging to 25 %. This stops the last consumer from flickering on and off.

## Temperature

Per module, per minute:

```
dT = heat − cooling × f(T) − 0.25 × (T − (−5 °C)) + Σ 0.05 × (T_neighbour − T)
f(T) = clamp((T + 5) / 40, 0, 1.5)     // radiators work harder on hot rooms and never cool below ambient
```

- Heat while online: reactor 30 × (0.4 + 0.6 × load) × damage factor (up to ×2 when damaged); other rooms 2–9.
- Residual-energy echoes add 0.06 °C/min per intensity point; the Static Choir 0.04; Void Frost removes 0.08.
- Radiators (hull edge): 14 °C/min on themselves, half on each neighbour.
- Above a module's max temperature it loses 3 condition per minute; 15 °C above it shuts down until it falls below max again.
- **Reactor overload** (the reactor trips its shutdown temperature): −15 condition, a scar, a 70-intensity residual-energy echo in the reactor and 35 in every neighbour.

## Crew

Work rate = (0.5 + 0.25 × skill) × health factor (0.5 below 30) × fatigue factor (0.6 above 80) × (0.7 + 0.3 × morale) × traits.

| Task | Skill | Effect per minute | Fatigue / min |
|---|---|---|---|
| Rest | — | fatigue −8 in a bunk (−3 without), health +1 | — |
| Repair | engineering | condition +4 × rate (×1.5 with a workshop), costs materials | 6 |
| Research | science | +2 × rate research; speeds the active project by 50 % × rate | 5 |
| Maintenance | engineering | no wear, condition +0.5 × rate, eases structural fatigue | 3 |
| Expedition prep | piloting | readiness toward 100 % | 4 |
| Emergency | best skill | anomaly −8 × rate (×1.5 with Bloom Taxonomy), seals breaches, cools rooms | 8 |

At 100 fatigue a crew member collapses into rest (−10 morale). At 0 health they are incapacitated — never killed — until they recover to 25. Morale drifts toward a target set by bunks, air, food, temperature, incidents and **memories** (each memory shifts the baseline permanently).

## Anomalies

Nothing spreads at random. Growth per minute has listed reasons (shown in the inspector), and spread is a deterministic accumulator:

- Above 50 intensity an unquarantined anomaly builds **spread pressure** at (intensity − 40) × 0.3 per minute. At 100 it spreads into the connected neighbour with the highest susceptibility (ties by id) at intensity 10.
- **Lumen Bloom** grows 2/min in rooms between 12 and 38 °C, ×2 in organic rooms, ×0.5 when ship water is low, plus (intensity of residual energy / 50) × its rate. Quarantine stops it (and it slowly dies of cold in a sealed, unpowered room). Above 90 it overgrows its room. Harnessed (Symbiotic Cultures): boosts hydroponics, or yields research while sealed elsewhere.
- **Static Choir** grows with the power flowing through its module (|flow| / 10) and residual energy, drains 0.2 × intensity power, starves (−3/min) when its module is off, is dampened by nearby shields, and at 60 causes power surges. It wakes from residual energy ≥ 60 in a powered room once the Lantern has been visited (or after two overloads). Harnessed (Choir Tap): produces power instead.
- **Void Frost** grows 2/min below 8 °C (×1.5 on the hull edge), melts above 18 °C, chills and cracks its room. Harnessed (Cryo Lattice): stops damaging and cools its neighbours.
- A containment field next to (or in) a room stops all growth there and wears the anomaly down by 2/min.
- Purging destroys an anomaly instantly for materials and power, damages the room and scars it.

## Echo Memory

Echo traces are anchored to **grid cells**, so they outlive the module that was there: dismantle and rebuild a contaminated room and it is still contaminated.

| Echo | Created by | Effect | Decay |
|---|---|---|---|
| Residual energy | reactor overload (70 core, 35 halo), absorbed power surges, a dissolved Choir | +heat; Bloom grows faster; ≥ 60 in a powered room wakes the Choir; ≥ 50 around a running reactor builds toward a power surge | 1 / min |
| Contamination | the Bloom dying (60 % of its peak, 80 % if purged, 20 % with Sterilization) | hydroponics −c/200 (or +c/200 with Symbiotic Cultures); ≥ 30 lets the Bloom regrow | 0.5 / min (×3 with Sterilization) |
| Structural fatigue | the third damage incident on a module (40, +15 per further incident) | wear × (1 + s/50); on the hull edge with low condition it breaches; with Lattice Alloys it repairs the module instead | none (maintenance eases it) |
| Resonance | major decisions, near death | ship-wide: labs +r/400, Echo Studies faster, counts toward the Resonance ending | none |

Every trace records its consequences (e.g. "the Lumen Bloom in the Storage Bay is feeding on it", "opened a hull breach"), shown in the Echo archive.

## Incidents

Checked every 5 game seconds, first match wins: decompression, reactor instability, oxygen shortage, anomaly discovery, contamination warning, power surge, meteor strike (2 % per check, not offline), crew conflict, echo resurgence, research breakthrough (6 %), salvage (3 %). Each has a cooldown counted from its resolution, real triggers, choices with requirements, and a safe default used after 60 s or when offline. Choices marked *major* leave a Resonance echo.

## Campaign

Fourteen objectives over four chapters: wake the ship (tutorial), drift (Glacier Shard), signal (the Lantern), the Ark. Three endings — *The Clean Return*, *The Garden Ship*, *The Remembering* — follow the dominant ship-evolution score (containment / symbiosis / resonance), built from choices, research and harnessed anomalies. `tests/unit/campaign.test.ts` plays the campaign end to end; a reasonable player reaches an ending in about 105–125 minutes of ship time.

## Offline progression

On load or resume, elapsed real time is clamped to 0–4 hours (clock changes backwards count as zero) and simulated in at most ~720 coarse steps. Incidents resolve with their safe defaults, meteor strikes do not happen, and oxygen, food, water, hull and crew health are held above safety floors, so the player never returns to a destroyed ship. A summary dialog lists what changed.

## Saves

Three slots, each a versioned JSON envelope in the app's documents folder. Saving validates in memory, writes a temp file, reads it back and validates it, keeps the previous good save as a backup, then atomically replaces the main file. Saves run one at a time. Loading migrates older schemas (1 → 2 → 3), refuses newer ones, repairs bad values and falls back to the backup if the main file is damaged.
