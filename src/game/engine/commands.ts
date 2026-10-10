/**
 * Typed player commands. Each command is validated against the current state first; an invalid
 * command returns an error key and leaves the state untouched.
 */
import { ANOMALIES } from '../content/anomalies';
import { DESTINATION_BY_ID } from '../content/destinations';
import { purgeAnomaly } from '../content/events';
import { DISMANTLE_REFUND, MODULES, UPGRADE_RESEARCH, upgradeCost } from '../content/modules';
import { OBJECTIVES } from '../content/objectives';
import { RESEARCH_BY_ID } from '../content/research';
import { checkPlacement, moduleCells, wouldDisconnect } from './grid';
import { addResource, cloneState, crewById, log, needsEmergency, spend } from './helpers';
import { createModule } from './newGame';
import type { Command, CommandResult, GameState } from './types';
import { createEcho } from '../systems/echo';
import { destinationUnlocked, launchError, launchExpedition } from '../systems/expeditions';
import { emergencyRecovery } from '../systems/progression';
import { researchAvailability } from '../systems/research';
import { resolveEvent } from '../systems/events';
import { computeCapacity } from '../systems/resources';

type Err = { error: string; params?: Record<string, string | number> };
const err = (error: string, params?: Record<string, string | number>): Err => ({ error, params });

/** Validates and applies a command to a mutable draft. Returns an error or null. */
function apply(s: GameState, cmd: Command): Err | null {
  if (s.gameOver && cmd.type !== 'EmergencyRecovery') return err('error.gameOver');

  switch (cmd.type) {
    case 'PlaceModule': {
      if (!MODULES[cmd.moduleType]) return err('error.unknownModule');
      const check = checkPlacement(s, cmd.moduleType, cmd.x, cmd.y, cmd.rotation);
      if (!check.valid) return err(`placement.${check.error}`);
      const def = MODULES[cmd.moduleType];
      spend(s, { materials: def.cost.materials, credits: def.cost.credits });
      const id = `m${s.nextId++}`;
      const neighbourTemps = Object.values(s.modules).map((m) => m.temperature);
      const temperature = neighbourTemps.length ? Math.min(30, Math.max(0, neighbourTemps.reduce((a, b) => a + b, 0) / neighbourTemps.length)) : 15;
      s.modules[id] = createModule(id, cmd.moduleType, cmd.x, cmd.y, cmd.rotation, { buildRemaining: def.buildSeconds, temperature });
      s.layoutVersion += 1;
      s.stats.modulesBuilt += 1;
      log(s, { severity: 'info', category: 'build', key: 'log.buildStarted', params: { module: cmd.moduleType } });
      return null;
    }
    case 'RemoveModule': {
      const m = s.modules[cmd.moduleId];
      if (!m) return err('error.noModule');
      if (m.type === 'reactor' && Object.values(s.modules).filter((x) => x.type === 'reactor').length <= 1) return err('error.lastReactor');
      if (m.type === 'airlock' && s.expeditions.active && Object.values(s.modules).filter((x) => x.type === 'airlock').length <= 1) return err('error.expeditionActive');
      if (wouldDisconnect(s, m.id)) return err('error.wouldDisconnect');
      const def = MODULES[m.type];
      // Partially built modules refund in full; finished ones refund half.
      const refund = m.buildRemaining > 0 && m.level === 1 ? 1 : DISMANTLE_REFUND;
      addResource(s, 'materials', Math.floor(def.cost.materials * refund));
      // An anomaly dies with its room, but the cells remember it.
      for (const a of s.anomalies.filter((x) => x.moduleId === m.id)) {
        const leaves = ANOMALIES[a.kind].leaves;
        if (leaves !== 'structural') createEcho(s, { kind: leaves, cells: moduleCells(m), intensity: Math.max(10, a.peak * 0.6), causeKey: 'echo.cause.dismantled', causeParams: { kind: a.kind, module: m.type } });
      }
      s.anomalies = s.anomalies.filter((x) => x.moduleId !== m.id);
      for (const c of s.crew) {
        if (c.targetId === m.id) {
          c.task = 'rest';
          c.targetId = null;
          c.taskProgress = 0;
        }
      }
      delete s.modules[m.id];
      s.layoutVersion += 1;
      s.stats.modulesRemoved += 1;
      s.capacity = computeCapacity(s);
      for (const r of Object.keys(s.resources) as (keyof typeof s.resources)[]) s.resources[r] = Math.min(s.resources[r], s.capacity[r]);
      log(s, { severity: 'info', category: 'build', key: 'log.removed', params: { module: m.type } });
      return null;
    }
    case 'UpgradeModule': {
      const m = s.modules[cmd.moduleId];
      if (!m) return err('error.noModule');
      const def = MODULES[m.type];
      if (m.buildRemaining > 0) return err('error.underConstruction');
      if (m.level >= def.maxLevel) return err('error.maxLevel');
      const research = UPGRADE_RESEARCH[m.level + 1];
      if (research && !s.research.completed.includes(research)) return err('error.needsResearch', { id: research });
      const cost = upgradeCost(m.type, m.level);
      if (!spend(s, cost)) return err('error.cannotAfford');
      m.level += 1;
      m.buildRemaining = Math.round(def.buildSeconds * 0.5);
      s.layoutVersion += 1;
      s.stats.upgrades += 1;
      log(s, { severity: 'info', category: 'build', key: 'log.upgradeStarted', params: { module: m.type, level: m.level } });
      return null;
    }
    case 'ToggleModule': {
      const m = s.modules[cmd.moduleId];
      if (!m) return err('error.noModule');
      m.enabled = cmd.enabled;
      return null;
    }
    case 'SetQuarantine': {
      const m = s.modules[cmd.moduleId];
      if (!m) return err('error.noModule');
      if (m.quarantined === cmd.quarantined) return null;
      m.quarantined = cmd.quarantined;
      log(s, { severity: 'info', category: 'anomaly', key: cmd.quarantined ? 'log.quarantined' : 'log.quarantineLifted', params: { module: m.type } });
      return null;
    }
    case 'AssignCrewTask': {
      const c = crewById(s, cmd.crewId);
      if (!c) return err('error.noCrew');
      if (c.away) return err('error.crewAway');
      if (c.incapacitated && cmd.task !== 'rest') return err('error.crewIncapacitated');
      const t = cmd.targetId;
      switch (cmd.task) {
        case 'rest':
          break;
        case 'repair': {
          const m = t ? s.modules[t] : undefined;
          if (!m || m.buildRemaining > 0) return err('error.noModule');
          if (m.condition >= 100) return err('error.nothingToRepair');
          break;
        }
        case 'maintenance': {
          const m = t ? s.modules[t] : undefined;
          if (!m || m.buildRemaining > 0) return err('error.noModule');
          break;
        }
        case 'research': {
          const m = t ? s.modules[t] : undefined;
          if (!m || m.type !== 'lab') return err('error.needsLab');
          break;
        }
        case 'emergency': {
          const anomaly = s.anomalies.find((a) => a.id === t);
          const m = t ? s.modules[t] : undefined;
          if (!anomaly && !(m && needsEmergency(m, MODULES[m.type].maxTemp))) return err('error.noEmergency');
          break;
        }
        case 'expedition_prep': {
          const d = t ? DESTINATION_BY_ID[t] : undefined;
          if (!d || !destinationUnlocked(s, d)) return err('error.destinationLocked');
          if ((s.expeditions.readiness[d.id] ?? 0) >= 100) return err('error.alreadyReady');
          break;
        }
      }
      c.task = cmd.task;
      c.targetId = cmd.task === 'rest' ? null : t;
      c.taskProgress = 0;
      log(s, { severity: 'info', category: 'crew', key: 'log.taskAssigned', params: { crew: c.name, task: cmd.task } });
      return null;
    }
    case 'StartResearch': {
      const def = RESEARCH_BY_ID[cmd.researchId];
      if (!def) return err('error.unknownResearch');
      if (s.research.active) return err('error.researchBusy');
      const avail = researchAvailability(s, def);
      if (avail.status === 'completed') return err('error.researchDone');
      if (avail.status !== 'available') return err('error.researchLocked');
      if (!spend(s, { research: def.cost })) return err('error.notEnoughResearch');
      s.research.active = { id: def.id, progress: 0, duration: def.seconds };
      log(s, { severity: 'info', category: 'research', key: 'log.researchStarted', params: { id: def.id } });
      return null;
    }
    case 'StartExpedition': {
      const e = launchError(s, cmd.destinationId, cmd.crewIds);
      if (e) return err(`expedition.error.${e}`);
      launchExpedition(s, cmd.destinationId, cmd.crewIds);
      return null;
    }
    case 'ContainAnomaly': {
      const a = s.anomalies.find((x) => x.id === cmd.anomalyId);
      if (!a) return err('error.noAnomaly');
      if (cmd.method === 'quarantine') {
        const m = s.modules[a.moduleId];
        if (!m) return err('error.noModule');
        if (!m.quarantined) {
          m.quarantined = true;
          s.disposition.containment += 1;
          log(s, { severity: 'info', category: 'anomaly', key: 'log.quarantined', params: { module: m.type } });
        }
        return null;
      }
      if (!purgeAnomaly(s, a.id)) return err('error.cannotAfford');
      return null;
    }
    case 'ExploitAnomaly': {
      const a = s.anomalies.find((x) => x.id === cmd.anomalyId);
      if (!a) return err('error.noAnomaly');
      if (a.exploited) return err('error.alreadyExploited');
      const research = ANOMALIES[a.kind].exploitResearch;
      if (!s.research.completed.includes(research)) return err('error.needsResearch', { id: research });
      a.exploited = true;
      s.stats.anomaliesExploited += 1;
      if (a.kind === 'choir') s.disposition.resonance += 2;
      else s.disposition.symbiosis += 2;
      log(s, { severity: 'success', category: 'anomaly', key: 'log.exploited', params: { kind: a.kind } });
      return null;
    }
    case 'ResolveEvent': {
      const e = resolveEvent(s, cmd.choiceId);
      return e ? err(e) : null;
    }
    case 'AcknowledgeObjective': {
      if (!OBJECTIVES.some((o) => o.id === cmd.objectiveId)) return err('error.unknownObjective');
      if (!s.objectives.acknowledged.includes(cmd.objectiveId)) s.objectives.acknowledged.push(cmd.objectiveId);
      return null;
    }
    case 'AcknowledgeEnding': {
      if (!s.ending) return err('error.noEnding');
      s.flags.ending_seen = true;
      return null;
    }
    case 'EmergencyRecovery': {
      if (!s.gameOver) return err('error.notGameOver');
      emergencyRecovery(s);
      return null;
    }
  }
}

export function executeCommand(state: GameState, cmd: Command): CommandResult {
  const draft = cloneState(state);
  const e = apply(draft, cmd);
  if (e) return { ok: false, state, error: e.error, params: e.params };
  return { ok: true, state: draft };
}

/** Validate without applying. */
export function validateCommand(state: GameState, cmd: Command): string | null {
  const r = executeCommand(state, cmd);
  return r.ok ? null : r.error;
}
