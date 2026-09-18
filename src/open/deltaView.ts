import type { ProseBlock, ProseBlockKind, ProseItem } from "./proseView.js";

/**
 * The human seat's turn-to-turn delta (2026-09-18), from the first real
 * `PRISONER_VIEW=narrated` game: "I can barely even read this."
 *
 * The seat was re-printing the whole world every round -- six conditions,
 * twelve object descriptions, the identity paragraph and the standing rules,
 * byte-for-byte identical to the round before -- and burying the two or three
 * sentences that were actually NEW (what the last attempt met, what the
 * warden did, the clock) in the middle of it. Nothing was wrong with any
 * individual block; the wall was made of repetition, and repetition is the
 * one thing a player already has, because they read it last turn.
 *
 * WHAT THIS IS NOT: a smaller information set. OPEN-VARIANT.md §47's rule is
 * that a person is shown exactly what the model in that chair would have
 * been shown, and CLAUDE.md's is that a view chooses HOW, never WHAT. This
 * module holds a block back only when the player has ALREADY been shown that
 * exact text, in this same run, and it is still true -- so what the player
 * has been told, cumulatively, is unchanged. `humanSeat.ts`'s `raw` escape
 * hatch reprints the model's own view in full, on demand, spending no turn;
 * every render that holds anything back says so and points at it.
 *
 * THE RAW VIEW IS UNTOUCHED. `PRISONER_VIEW=raw` -- the default, and what
 * every measured run uses -- never reaches this module. This is the prose
 * view's own layout, one layer further along than §53's "layout only" fix,
 * which made each block scannable but could not do anything about the same
 * block arriving thirty times.
 */

/** The world as it stands: worth reading once, and again whenever it moves.
 *  A player who has read the condition list does not need it re-read to them
 *  while it says the same thing. */
const STANDING: ReadonlySet<ProseBlockKind> = new Set<ProseBlockKind>(["conditions", "identity", "scene", "rules"]);

/** How a held-back block is named in the notice. Short, and in the player's
 *  own terms rather than this codebase's block kinds. */
const BLOCK_NAMES: Record<ProseBlockKind, string> = {
  conditions: "the conditions",
  identity: "who you are",
  scene: "the cell",
  rules: "the standing rules",
  news: "the news",
  notesAndPlan: "your notes and plan",
  knowledge: "what you know",
};

/** Exported so the test names this line explicitly rather than matching it
 *  by a wildcard, and so a future edit to the wording fails loudly. */
export const HELD_BACK_LEAD = "Unchanged since last round, so held back:";

export interface DeltaView {
  /** The turn's blocks, rendered with the standing world held back where the
   *  player has already read exactly that text. Stateful across calls: one
   *  `DeltaView` per seat, for the life of a game. */
  render(blocks: readonly ProseBlock[]): string;
}

function byKey(items: readonly ProseItem[]): ReadonlyMap<string, string> {
  return new Map(items.map((i) => [i.key, i.text]));
}

function heldBackNotice(kinds: readonly ProseBlockKind[]): string {
  return `(${HELD_BACK_LEAD} ${kinds.map((k) => BLOCK_NAMES[k]).join(", ")}. Type "raw" at the prompt for the full view, which costs no turn.)`;
}

export function createDeltaView(): DeltaView {
  const lastText = new Map<ProseBlockKind, string>();
  const lastItems = new Map<ProseBlockKind, ReadonlyMap<string, string>>();

  return {
    render(blocks: readonly ProseBlock[]): string {
      const out: string[] = [];
      const heldBack: ProseBlockKind[] = [];

      for (const block of blocks) {
        if (!STANDING.has(block.kind)) {
          // The turn's own state -- the news, the plan, every belief with its
          // "as of round N" stamp. Always shown, however little it moved:
          // this is the fog the seat exists to put a person inside, and a
          // player reasoning about a stale belief needs the stamp in front of
          // them, not in their memory of last turn.
          out.push(block.text);
          continue;
        }

        const items = block.items;
        if (items === undefined) {
          if (lastText.get(block.kind) === block.text) {
            heldBack.push(block.kind);
            continue;
          }
          lastText.set(block.kind, block.text);
          out.push(block.text);
          continue;
        }

        const previous = lastItems.get(block.kind);
        lastItems.set(block.kind, byKey(items));
        if (previous === undefined) {
          out.push(block.text);
          continue;
        }
        // Something GONE cannot be shown as a changed item -- an absence is
        // not in the list of what is here. The whole block goes back up
        // instead, which is exactly what this view did every turn before this
        // module existed, so a removal is never told worse than it used to
        // be. (Telling it positively -- "the warden has left" -- would mean
        // this module composing a sentence about the world, which is
        // `perception.ts`'s job and not a view's.) Compared BY KEY: an object
        // whose description changed is one item that moved, never one object
        // leaving and another arriving.
        const removed = [...previous.keys()].some((key) => !items.some((item) => item.key === key));
        if (removed) {
          out.push(block.text);
          continue;
        }
        const fresh = items.filter((item) => previous.get(item.key) !== item.text);
        if (fresh.length === 0) {
          heldBack.push(block.kind);
          continue;
        }
        out.push([block.lead, ...fresh.map((i) => i.text)].filter((l): l is string => l !== undefined && l.length > 0).join("\n"));
      }

      if (heldBack.length > 0) out.push(heldBackNotice(heldBack));
      return out.join("\n\n");
    },
  };
}
