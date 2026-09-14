import { replay, createStateRenderer, type RenderedNoun } from "run-dmcp";
import type { World } from "../world/setup.js";
import { PRISONER_VOCABULARY } from "../world/vocabulary.js";

/**
 * `viewFor(gameId, characterId, t)` -- design §5.1: each principal's private
 * view, built POSITIVELY (select, never subtract). There is no "replay
 * minus hidden" step (§5.1's own words): a fact that does not hold produces
 * nothing, and an entity that was never selected is never read for facts at
 * all.
 *
 * Two positive predicates, exactly design §5.1's:
 *
 *   1. The room and its contents -- the cell itself, every item owned by the
 *      cell whose `concealed` value is 0 (never an item whose value is 1:
 *      that item is simply never selected, not selected-then-hidden), and
 *      the OTHER principal's presence (their character entity, selected for
 *      existence only -- see below for why no facts of theirs are ever
 *      read).
 *   2. Its own things and its own knowledge -- items THIS principal owns
 *      (concealed or not: concealment only ever hides a cell-owned item from
 *      the other principal, never an owner's own item from itself), and its
 *      own resources (`spoon_edge` for the prisoner, `warden_suspicion` for
 *      the warden) plus the cell's shared physical resources
 *      (`bar_integrity`, `lock_integrity`, `guard_attention`), which are
 *      part of the room exactly as the bar and the lock are.
 *
 * ENGINE FINDING (reported in this project's final report, not filed as a
 * run-dmcp issue per this task's hard stop): `createStateRenderer`'s
 * `render({gameId, t})` always calls `replay()` over the WHOLE game and
 * takes no `entityIds` parameter (unlike `narrationConstraintAt`, which
 * does) and no way to inject a pre-built, caller-filtered snapshot. A
 * principal-scoped view therefore cannot ask the renderer itself to scope
 * its read; the only available move is to render the whole game and then
 * select, from the result, the `RenderedNoun`s whose `entityId` this
 * function already decided to include -- which is what this function does.
 * This is still a SELECTION (a positive membership test on `entityId`
 * against a set this function built from ownership/concealment facts), not
 * a subtraction over rendered text, so it does not reopen root CLAUDE.md
 * hard rule 4 -- but it does mean `createStateRenderer` is called once for
 * the omniscient world rather than once per scoped view, which is worth
 * flagging for #18 as the two numbers design §5.2 asks for (see this
 * project's final report).
 *
 * The OTHER principal's presence carries no facts at all in this
 * repository's vocabulary (`cut`/`concealed` are item facts, never a
 * character fact), so selecting their entity id changes nothing about
 * `nouns` -- their presence is conveyed by `otherPrincipal` below, never by
 * a rendered noun about them.
 */
export interface View {
  gameId: string;
  t: number;
  forCharacterId: string;
  /** The rendered facts this principal can see -- item conditions only, in
   *  this repository's vocabulary. */
  nouns: RenderedNoun[];
  /** This principal's own resource readings, plus the cell's shared ones --
   *  raw numbers, not vocabulary nouns (a continuous 0-100 range has no
   *  finite vocabulary to render through; "bar integrity is 62" is exactly
   *  as positive a statement as a vocabulary noun would be). */
  resources: Record<string, number>;
  /** The other principal, by presence only -- no facts of theirs are ever
   *  read for this view. */
  otherPrincipal: { id: string; name: string | null };
}

function ownerOf(
  snapshot: ReturnType<typeof replay>,
  entityId: string
): { ownerId: string | null; ownerType: string | null } {
  const entity = snapshot.entities.find((e) => e.id === entityId);
  return {
    ownerId: entity?.facts.owner_id?.value ?? null,
    ownerType: entity?.facts.owner_type?.value ?? null,
  };
}

/**
 * BUG FOUND WHILE RUNNING THE CHECKPOINT SCRIPT, fixed here: `schema.ts`'s
 * migration adds `cut` and `concealed` as plain columns on run-dmcp's
 * `items` table -- which means EVERY item (the bar, the loose tile, AND
 * the prisoner's spoon) carries BOTH columns, each defaulting to `0`, and
 * therefore both facts. `createStateRenderer`'s vocabulary lookup is keyed
 * only by `(factKey, factValue)` -- entity-blind, by the engine's own
 * design ("never matches meaning", `render.ts`) -- so `PRISONER_VOCABULARY`
 * happily rendered "intact bar" for the LOOSE TILE's own `cut=0` and
 * "in plain view loose tile" for the BAR's own `concealed=0`, and the same
 * two bogus nouns again for the SPOON. Filtering `rendered.nouns` by
 * `entityId` alone (as this function already does) does not catch this,
 * because the same entity carries both the real fact and the irrelevant
 * one.
 *
 * The fix is a second, equally positive selection: which fact KEYS are
 * meaningful for a GIVEN entity in this game. `cut` means something only
 * for the bar; `concealed` only for the loose tile. Nothing here scans
 * text or infers meaning from a value -- it is a caller-declared allowlist
 * over this repository's own three items, the same shape as
 * `selectedEntityIds` above.
 */
function relevantFactKeysFor(world: World, entityId: string): readonly string[] {
  if (entityId === world.barId) return ["cut"];
  if (entityId === world.looseTileId) return ["concealed"];
  return [];
}

export function viewFor(world: World, characterId: string, t: number): View {
  if (characterId !== world.wardenId && characterId !== world.prisonerId) {
    throw new Error(`viewFor: '${characterId}' is neither the warden nor the prisoner in this world`);
  }
  const otherId = characterId === world.wardenId ? world.prisonerId : world.wardenId;

  const snapshot = replay({ gameId: world.gameId, t });

  const selectedEntityIds = new Set<string>();
  selectedEntityIds.add(world.cellId);
  selectedEntityIds.add(otherId); // presence only -- see header comment.
  selectedEntityIds.add(characterId);

  for (const entity of snapshot.entities) {
    if (entity.kind !== "item") continue;
    const { ownerId } = ownerOf(snapshot, entity.id);
    if (ownerId === characterId) {
      // This principal's own item -- always selected, concealed or not.
      selectedEntityIds.add(entity.id);
      continue;
    }
    if (ownerId === world.cellId) {
      const concealed = entity.facts.concealed?.value === "1";
      if (!concealed) {
        selectedEntityIds.add(entity.id);
      }
      // Concealed and cell-owned: never selected. Not filtered out of a
      // rendered list -- simply never a member of the set a fact is read
      // from at all.
    }
  }

  const rendered = createStateRenderer({ vocabulary: PRISONER_VOCABULARY }).render({ gameId: world.gameId, t });
  const nouns = rendered.nouns.filter(
    (n) => selectedEntityIds.has(n.entityId) && relevantFactKeysFor(world, n.entityId).includes(n.key)
  );

  // Item 6: the positive view selects its own items -- an item with no
  // meaningful cut/concealed state (the prisoner's spoon has neither) must
  // still APPEAR, or "select, never subtract" would quietly subtract it by
  // omission. This is not a vocabulary noun (there is no fact key/value to
  // look up); it is the item's own name, exactly the way `otherPrincipal`
  // below reports presence without a fact. Only added for a selected item
  // that the vocabulary-backed nouns above produced nothing for, so a bar
  // or a loose tile is never listed twice.
  const namedEntityIds = new Set(nouns.map((n) => n.entityId));
  for (const entity of snapshot.entities) {
    if (entity.kind !== "item") continue;
    if (!selectedEntityIds.has(entity.id) || namedEntityIds.has(entity.id)) continue;
    const bareName = (entity.name ?? "item").replace(/^the\s+/i, "");
    nouns.push({
      entityId: entity.id,
      entityKind: "item",
      entityName: entity.name,
      key: "presence",
      value: "1",
      noun: bareName,
      adjectives: [],
      phrase: bareName,
    });
  }

  const resourceEntries: [string, string][] = [
    ["bar_integrity", world.resources.barIntegrity],
    ["lock_integrity", world.resources.lockIntegrity],
    ["guard_attention", world.resources.guardAttention],
    ["spoon_edge", world.resources.spoonEdge],
    ["warden_suspicion", world.resources.wardenSuspicion],
  ];
  const resources: Record<string, number> = {};
  for (const [name, resourceId] of resourceEntries) {
    const { ownerId } = ownerOf(snapshot, resourceId);
    const visible = ownerId === world.cellId || ownerId === characterId;
    if (!visible) continue;
    const valueFact = snapshot.entities.find((e) => e.id === resourceId)?.facts.value;
    if (valueFact) {
      resources[name] = Number(valueFact.value);
    }
  }

  const otherEntity = snapshot.entities.find((e) => e.id === otherId);

  return {
    gameId: world.gameId,
    t,
    forCharacterId: characterId,
    nouns,
    resources,
    otherPrincipal: { id: otherId, name: otherEntity?.name ?? null },
  };
}
