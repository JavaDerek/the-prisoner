import { DEFAULT_MIND_MODEL, resolveVoiceModel, readSkipVoice, resolveRefereeModel, resolveSeatModels, seatModelNames, type SeatModels } from "../modelRoles.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../ollamaSwap.js";
import { buildOpenWorld, readDoorPrice, readWindowMode } from "../open/world.js";
import { buildOpenResolver } from "../open/mechanics.js";
import {
  createReferee,
  readInstrumentMode,
  readDeriveWordingMode,
  readElisionMode,
  readContainerClauseMode,
  readDeriveRepeatMode,
  readOneActMode,
  readPersonInstrumentMode,
} from "../open/referee.js";
import { declaredProperty, declaredPropertyKeys, derivedKindOf, type OpenWorld } from "../open/world.js";
import { createRefereeTransport } from "../open/refereeTransport.js";
import { createOpenPrisonerMind, createOpenWardenMind } from "../open/mind.js";
import { readPresenceMode, readAbsenceMode, checkAbsenceMode } from "../open/briefing.js";
import { openConditions, readConditionsMode, readDoorMode } from "../open/conditions.js";
import { readBlockMode } from "../open/effects.js";
import { resolveRefereeThinking, resolveWitsThinking } from "../open/thinking.js";
import type { SessionFactory, SessionFactoryResult } from "./server.js";
import type { Principal as OpenPrincipal } from "../ledger/beliefs.js";

/**
 * The ONLY file in the-prisoner#11's MCP half that reads `process.env` or
 * constructs a real referee/opponent mind/swapper -- the "same env
 * configuration as `npm run checkpoint`" this task's brief asks for, read
 * through the SAME functions `checkpoint.ts` itself calls
 * (`src/modelRoles.ts`, `src/ollamaSwap.ts`, and each condition/effect
 * module's own `read*Mode`), never a second copy of a default. Where
 * CLAUDE.md's "Defaults changed on 2026-09-27" moves an arm's default
 * again, this file needs no change: it reads the identical function
 * `checkpoint.ts` reads, so the two can never silently disagree about what
 * "unset" means.
 *
 * DELIBERATELY THIN, AND THE GAPS ARE NAMED IN THE ISSUE'S OWN REPORT: this
 * does not wire the precedent condition, the pick condition, the play-time
 * elaboration referee, the prose seat, the narrator, or the strategy
 * pre-commitment step -- every one of those is a `checkpoint.ts` arm this
 * server does not (yet) expose. What IS wired is enough for a real game:
 * the world, the resolver, the referee (with the same six citation/wording
 * arms and the one-act/block/person-instrument questions), the opponent
 * mind (per-chair model override included), presence and absence, and the
 * condition list.
 *
 * NEVER UNIT TESTED DIRECTLY (this task's own constraint: no model call
 * while building this) -- `server.test.ts`/`session.test.ts` cover the
 * engine and the tool surface with a scripted referee and a scripted
 * opponent; this file is exercised only by a real `npm run mcp-seat` run,
 * which is why its own logic is kept to plain, inspectable wiring with no
 * branches worth a unit test on their own -- each one is already tested
 * where it is DEFINED (`modelRoles.test.ts`, `referee.test.ts`, etc.).
 */
export interface LiveSessionFactoryHandle {
  factory: SessionFactory;
  /** Call once, before the server starts serving: throws if a model this
   *  run did not configure is already loaded (`assertNoForeignModel`), and
   *  records what was resident so `restoreOnExit` can put it back. */
  assertNoForeignModelLoaded(): Promise<void>;
  /** Registers `swapper.restoreResidents` against process exit signals, so
   *  a resident model this run swapped away from (e.g. Shep's
   *  `muse-glimmer:30b`, CLAUDE.md's "Local play is all-Muse") is restored
   *  when the MCP server process ends, exactly as `checkpoint.ts`'s own
   *  `finally` restores it at the end of one game. An MCP server's own
   *  lifetime spans many games (or none, if the client never calls
   *  `new_game`), so this is wired once, at process level, rather than
   *  once per game. */
  restoreOnExit(): void;
}

function readNumberEnv(name: string): number | undefined {
  const raw = process.env[name];
  return raw ? Number(raw) : undefined;
}

export function buildLiveSessionFactory(): LiveSessionFactoryHandle {
  const MODEL_URL = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
  const MODEL = process.env.PRISONER_MODEL;
  const WITS_MODEL = process.env.PRISONER_WITS_MODEL ?? MODEL ?? DEFAULT_MIND_MODEL;
  const VOICE_MODEL = resolveVoiceModel(WITS_MODEL, process.env.PRISONER_VOICE_MODEL ?? MODEL ?? DEFAULT_MIND_MODEL, readSkipVoice(process.env.PRISONER_SKIP_VOICE));
  const PRISONER_SEAT: SeatModels = resolveSeatModels(process.env.PRISONER_PRISONER_MODEL, { wits: WITS_MODEL, voice: VOICE_MODEL });
  const WARDEN_SEAT: SeatModels = resolveSeatModels(process.env.PRISONER_WARDEN_MODEL, { wits: WITS_MODEL, voice: VOICE_MODEL });
  const REFEREE_MODEL = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);

  const THINK_TIMEOUT_MS = readNumberEnv("PRISONER_THINK_TIMEOUT_MS");
  const REFEREE_TIMEOUT_MS = readNumberEnv("PRISONER_REFEREE_TIMEOUT_MS") ?? THINK_TIMEOUT_MS;
  const WITS_THINKING = resolveWitsThinking(process.env.PRISONER_WITS_THINKING, process.env.PRISONER_THINKING);
  const REFEREE_THINKING = resolveRefereeThinking(process.env.PRISONER_REFEREE_THINKING, process.env.PRISONER_THINKING);

  const NATIVE_BASE_URL = nativeBaseUrl(MODEL_URL, process.env.PRISONER_OLLAMA_NATIVE_URL);
  const RESIDENT_MODELS = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const CONFIGURED_MODELS = [...new Set([...seatModelNames(PRISONER_SEAT, WARDEN_SEAT), REFEREE_MODEL])];
  const ALLOWED_MODELS = [...new Set([...CONFIGURED_MODELS, ...RESIDENT_MODELS])];
  const swapper = new OllamaModelSwapper({ nativeBaseUrl: NATIVE_BASE_URL, allowedModels: ALLOWED_MODELS });
  const ensureLoaded = (model: string): Promise<void> => swapper.withModel(model, async () => {});

  // OPEN-VARIANT.md's own arms, read exactly as `checkpoint.ts` reads them (see this file's own
  // header) -- unset means the-prisoner's CURRENT default for each, wherever CLAUDE.md's own
  // "Defaults changed on 2026-09-27" section says that is.
  const PRESENCE = readPresenceMode(process.env.PRISONER_PRESENCE);
  const ABSENCE = readAbsenceMode(process.env.PRISONER_ABSENCE);
  checkAbsenceMode(ABSENCE, PRESENCE);
  const DOOR = readDoorMode(process.env.PRISONER_DOOR);
  const DOOR_PRICE = readDoorPrice(process.env.PRISONER_DOOR_PRICE);
  const WINDOW = readWindowMode(process.env.PRISONER_WINDOW);
  const BLOCK = readBlockMode(process.env.PRISONER_BLOCK);
  const CONDITIONS = readConditionsMode(process.env.PRISONER_CONDITIONS);
  const ONE_ACT = readOneActMode(process.env.PRISONER_ONE_ACT);
  const INSTRUMENT = readInstrumentMode(process.env.PRISONER_INSTRUMENT);
  const DERIVE_WORDING = readDeriveWordingMode(process.env.PRISONER_DERIVE_WORDING);
  const ELISION = readElisionMode(process.env.PRISONER_ELISION);
  const CONTAINER_CLAUSE = readContainerClauseMode(process.env.PRISONER_CONTAINER_CLAUSE);
  const DERIVE_REPEAT = readDeriveRepeatMode(process.env.PRISONER_DERIVE_REPEAT);
  const PERSON_INSTRUMENT = readPersonInstrumentMode(process.env.PRISONER_PERSON_INSTRUMENT);

  const factory: SessionFactory = async ({ side }): Promise<SessionFactoryResult> => {
    const openWorld: OpenWorld = buildOpenWorld({ doorPrice: DOOR_PRICE, presence: PRESENCE, window: WINDOW });
    const resolver = buildOpenResolver();
    const referee = createReferee(
      [createRefereeTransport({ baseUrl: MODEL_URL, model: REFEREE_MODEL, timeoutMs: REFEREE_TIMEOUT_MS, ensureLoaded, thinking: REFEREE_THINKING.mode })],
      {
        isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined,
        kindOf: (objectId) => derivedKindOf(openWorld, objectId),
        propertiesOf: (objectId) => declaredPropertyKeys(openWorld, objectId),
        instrumentMode: INSTRUMENT,
        deriveWording: DERIVE_WORDING,
        elisionMode: ELISION,
        containerClauseMode: CONTAINER_CLAUSE,
        repeatDeriveMode: DERIVE_REPEAT,
        oneAct: ONE_ACT,
        blockMode: BLOCK,
        personInstrumentMode: PERSON_INSTRUMENT,
      }
    );

    const opponentSide: OpenPrincipal = side === "prisoner" ? "warden" : "prisoner";
    const opponentSeat = opponentSide === "warden" ? WARDEN_SEAT : PRISONER_SEAT;
    const conditions = CONDITIONS === "off" ? undefined : openConditions({ door: DOOR, doorPrice: DOOR_PRICE, window: WINDOW, block: BLOCK });
    const mindOptions = {
      baseUrl: MODEL_URL,
      witsModel: opponentSeat.wits,
      voiceModel: opponentSeat.voice,
      timeoutMs: THINK_TIMEOUT_MS,
      ensureLoaded,
      thinking: WITS_THINKING.mode,
      ...(conditions ? { conditions } : {}),
    };
    const opponentMind = opponentSide === "warden" ? createOpenWardenMind(mindOptions) : createOpenPrisonerMind(mindOptions);
    const opponentModelLabel = opponentSeat.wits === opponentSeat.voice ? opponentSeat.wits : `${opponentSeat.wits} (wits) / ${opponentSeat.voice} (voice)`;

    return {
      openWorld,
      resolver,
      referee,
      opponentMind,
      ...(conditions ? { conditions } : {}),
      presenceMode: PRESENCE,
      absenceMode: ABSENCE,
      transcriptMeta: { refereeModel: REFEREE_MODEL, opponentModel: opponentModelLabel, modelUrl: MODEL_URL },
    };
  };

  let residentsAtStart: string[] = [];
  return {
    factory,
    async assertNoForeignModelLoaded(): Promise<void> {
      let ps;
      try {
        ps = await swapper.fetchPs();
      } catch {
        return; // Unreachable /api/ps is reported loudly by the first real mind/referee call instead.
      }
      assertNoForeignModel(ps, ALLOWED_MODELS);
      residentsAtStart = ps.models.map((m) => m.name).filter((name) => RESIDENT_MODELS.includes(name));
    },
    restoreOnExit(): void {
      // Node's own "exit" event handlers must be synchronous -- an async `restoreResidents`
      // (an HTTP call) cannot complete inside one. SIGINT/SIGTERM are handled explicitly
      // instead, awaiting the restore and only then exiting, mirroring `checkpoint.ts`'s own
      // `finally { await swapper.restoreResidents(...) }`. A `kill -9` or a crash outside
      // these two signals is NOT covered -- the same gap `checkpoint.ts` itself would have
      // under either, and named in this issue's own report rather than silently assumed away.
      const onSignal = (signal: NodeJS.Signals) => {
        swapper
          .restoreResidents(residentsAtStart)
          .catch((err) => {
            console.error("mcp-seat: failed to restore resident model(s) on exit:", err);
          })
          .finally(() => process.exit(signal === "SIGINT" ? 130 : 0));
      };
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    },
  };
}
