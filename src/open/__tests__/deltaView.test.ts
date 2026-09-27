import { describe, it, expect } from "vitest";
import { createDeltaView, HELD_BACK_LEAD } from "../deltaView.js";
import type { ProseBlock } from "../proseView.js";

const CONDITIONS = (thresholds: string): ProseBlock => ({
  kind: "conditions",
  lead: "Whenever a condition stated below is met, the action it unlocks is available immediately.",
  items: [{ key: "condition 1", text: `Once the bar's integrity is at or below ${thresholds}, Mara Voss can open the window -- condition 1, for you.` }],
  text: `Whenever a condition stated below is met, the action it unlocks is available immediately.\nOnce the bar's integrity is at or below ${thresholds}, Mara Voss can open the window -- condition 1, for you.`,
});

const IDENTITY: ProseBlock = { kind: "identity", text: "You are Mara Voss, three years into a sentence. Get out of this cell." };

const scene = (barDescription: string, extra: readonly { key: string; text: string }[] = []): ProseBlock => {
  const items = [
    { key: "bar", text: `The bar: ${barDescription}` },
    { key: "spoon", text: "The spoon: A dented aluminium spoon." },
    { key: "cot", text: "The cot: A narrow cot." },
    ...extra,
  ];
  return { kind: "scene", lead: "In the cell around you:", items, text: ["In the cell around you:", ...items.map((i) => i.text)].join("\n") };
};

const news = (round: number): ProseBlock => ({ kind: "news", text: `This is round ${round} of 30. Warden Croft examines the bar closely.` });
const STAKES: ProseBlock = { kind: "stakes", text: "At the end of round 30 you are transferred to a maximum-security block, and this chance is gone." };
// D10-2 (PLAYTEST-2026-09-27-DESIGN.md R7): the real `knowledge` block
// (`proseView.ts`) is now a list, one item per belief keyed by its resource
// label -- shaped here the same way `scene`/`CONDITIONS` already are, so this
// suite exercises the SAME per-item mechanism those blocks already pin,
// rather than a second, bespoke one.
const knowledge = (barValue = 100, round = 0, extra: readonly { key: string; text: string }[] = []): ProseBlock => {
  const items = [{ key: "bar integrity", text: `Your last word on the bar integrity was ${barValue}, as of round ${round}.` }, ...extra];
  return { kind: "knowledge", lead: "What you know, and as of when:", items, text: ["What you know, and as of when:", ...items.map((i) => i.text)].join("\n") };
};
const RULES: ProseBlock = { kind: "rules", text: "Some things about this cell never change: suspicion rises by 5 for a slight act." };

const turn = (round: number, bar = "Rust has pitted it.", thresholds = "50", extra: readonly { key: string; text: string }[] = []): ProseBlock[] => [
  CONDITIONS(thresholds),
  IDENTITY,
  scene(bar, extra),
  news(round),
  knowledge(),
  RULES,
];

describe("the delta view: the standing world once, the turn's news every turn", () => {
  it("holds nothing back on the first turn -- it is exactly the prose view", () => {
    const view = createDeltaView();
    const shown = view.render(turn(1));
    expect(shown).toBe(turn(1).map((b) => b.text).join("\n\n"));
    expect(shown).not.toContain(HELD_BACK_LEAD);
  });

  it("holds back the standing world on a later turn when it has not moved, and still shows the news", () => {
    const view = createDeltaView();
    view.render(turn(1));
    const second = view.render(turn(2));

    // The turn's own state, every turn, however little it moved.
    expect(second).toContain("This is round 2 of 30");

    // The standing world, shown once and held back after -- D10-2 moved
    // `knowledge` into this set too (see the dedicated describe block below):
    // an UNCHANGED belief is held back exactly like an unchanged condition.
    expect(second).not.toContain("You are Mara Voss");
    expect(second).not.toContain("The spoon: A dented aluminium spoon.");
    expect(second).not.toContain("condition 1, for you.");
    expect(second).not.toContain("suspicion rises by 5");
    expect(second).not.toContain("Your last word on the bar integrity was 100, as of round 0.");
  });

  it("names what it held back, and how to get it all again", () => {
    const view = createDeltaView();
    view.render(turn(1));
    const second = view.render(turn(2));
    expect(second).toContain(HELD_BACK_LEAD);
    expect(second).toContain("the conditions");
    expect(second).toContain("the cell");
    expect(second).toContain("the standing rules");
    expect(second).toContain('"raw"');
  });

  it("shows the ONE object that changed, under its lead line, and holds back the others", () => {
    const view = createDeltaView();
    view.render(turn(1));
    const second = view.render(turn(2, "Rust has pitted it, and a bright scrape runs along the bottom."));
    expect(second).toContain("In the cell around you:");
    expect(second).toContain("a bright scrape runs along the bottom");
    expect(second).not.toContain("The spoon: A dented aluminium spoon.");
    expect(second).not.toContain("The cot: A narrow cot.");
  });

  it("shows an object that has just appeared -- a principal walking in is news, not furniture", () => {
    const view = createDeltaView();
    view.render(turn(1));
    const second = view.render(turn(2, "Rust has pitted it.", "50", [{ key: "warden", text: "The warden: Warden Croft. She is on her feet." }]));
    expect(second).toContain("The warden: Warden Croft. She is on her feet.");
    expect(second).not.toContain("The spoon: A dented aluminium spoon.");
  });

  // The one case a per-item delta cannot express: an item that is GONE says
  // nothing by being absent from a list of changes. Re-showing the whole
  // block is exactly what the view did every turn before this module
  // existed, so it is never worse than the behaviour it replaces.
  it("re-shows the whole list when something has gone from it, rather than passing a removal in silence", () => {
    const view = createDeltaView();
    view.render(turn(1, "Rust has pitted it.", "50", [{ key: "warden", text: "The warden: Warden Croft. She is on her feet." }]));
    const second = view.render(turn(2));
    expect(second).toContain("The spoon: A dented aluminium spoon.");
    expect(second).toContain("The cot: A narrow cot.");
    expect(second).toContain("The bar: Rust has pitted it.");
  });

  it("shows a standing prose block again the moment its words change", () => {
    const view = createDeltaView();
    view.render(turn(1));
    view.render(turn(2));
    const third = view.render(turn(3, "Rust has pitted it.", "40"));
    expect(third).toContain("condition 1, for you.");
    expect(third).toContain("at or below 40");
  });

  it("never holds back a block it has not already shown with the identical text", () => {
    const view = createDeltaView();
    const shownTexts: string[] = [];
    for (let round = 1; round <= 4; round += 1) {
      const blocks = turn(round, round === 3 ? "Rust, and a bright scrape." : "Rust has pitted it.");
      const rendered = view.render(blocks);
      shownTexts.push(rendered);
      for (const block of blocks) {
        const texts = block.items?.map((i) => i.text) ?? [block.text];
        for (const item of texts) {
          const everShown = shownTexts.some((t) => t.includes(item));
          expect(everShown, `"${item.slice(0, 40)}..." was never shown to the player in any turn`).toBe(true);
        }
      }
    }
  });
});

// The owner's blind game (`checkpoints/2026-09-21-human-blind/`): the player
// picked the lock in round 6 and the door stood open through round 10, but the
// screen said "It stands open now" once, in round 7, and then held the whole
// cell back as unchanged -- the only trace left was "Your last word on the door
// passage was 1". A way out that has changed since the player first saw it is
// the one fact the condition list turns on ("Once a way out stands open ...
// she has escaped"), so a caller can name the keys that stay on screen for as
// long as their text differs from the first text shown for them. Structural,
// never a reading of the words: the view compares strings it has already shown.
describe("the delta view: a changed way out stays on screen", () => {
  const DOOR_SHUT = { key: "door", text: "The door: A heavy door of iron-bound planks." };
  const DOOR_OPEN = { key: "door", text: "The door: A heavy door of iron-bound planks. It stands open now." };
  const isWayOut = (key: string): boolean => key === "door";

  it("a way out that has changed since it was first shown is shown every round it stays changed, however unchanged since last round", () => {
    const view = createDeltaView({ keepShownWhileChanged: isWayOut });
    view.render(turn(1, "Rust has pitted it.", "50", [DOOR_SHUT]));
    view.render(turn(2, "Rust has pitted it.", "50", [DOOR_OPEN]));
    const third = view.render(turn(3, "Rust has pitted it.", "50", [DOOR_OPEN]));
    const fourth = view.render(turn(4, "Rust has pitted it.", "50", [DOOR_OPEN]));
    for (const shown of [third, fourth]) {
      expect(shown).toContain("It stands open now.");
      expect(shown).not.toContain("The spoon: A dented aluminium spoon.");
    }
  });

  it("once it is back as first shown, it is told once as a change and then held back again", () => {
    const view = createDeltaView({ keepShownWhileChanged: isWayOut });
    view.render(turn(1, "Rust has pitted it.", "50", [DOOR_SHUT]));
    view.render(turn(2, "Rust has pitted it.", "50", [DOOR_OPEN]));
    const shutAgain = view.render(turn(3, "Rust has pitted it.", "50", [DOOR_SHUT]));
    const after = view.render(turn(4, "Rust has pitted it.", "50", [DOOR_SHUT]));
    expect(shutAgain).toContain("The door: A heavy door of iron-bound planks.");
    expect(after).not.toContain("The door:");
    expect(after).toContain("the cell");
  });

  it("a key the caller does not name is held back as before once its change has been told", () => {
    const view = createDeltaView({ keepShownWhileChanged: isWayOut });
    view.render(turn(1, "Rust has pitted it."));
    view.render(turn(2, "Rust has pitted it. A bright scrape runs along it."));
    const third = view.render(turn(3, "Rust has pitted it. A bright scrape runs along it."));
    expect(third).not.toContain("A bright scrape");
  });

  it("with no keys named, an opened way out is held back exactly as before -- the default is unchanged", () => {
    const view = createDeltaView();
    view.render(turn(1, "Rust has pitted it.", "50", [DOOR_SHUT]));
    view.render(turn(2, "Rust has pitted it.", "50", [DOOR_OPEN]));
    expect(view.render(turn(3, "Rust has pitted it.", "50", [DOOR_OPEN]))).not.toContain("It stands open now.");
  });
});

// D10-1 (PLAYTEST-2026-09-27-DESIGN.md R7): the stakes sentence is STANDING
// (shown once, held back once it repeats verbatim), except a caller may force
// it back on screen for a reason the delta itself never reasons about --
// here, the last five rounds of the game. `forceShow` is decided fresh on
// every `render` call, never baked into the view at construction, because it
// depends on the CURRENT round and the view is long-lived for the whole game.
describe("the delta view: the stakes block is STANDING, with a forced re-show (D10-1)", () => {
  const turnWithStakes = (round: number): ProseBlock[] => [...turn(round), STAKES];

  it("shows the stakes sentence once, then holds it back on a later turn while it is unchanged", () => {
    const view = createDeltaView();
    const first = view.render(turnWithStakes(1));
    expect(first).toContain("transferred to a maximum-security block");
    const second = view.render(turnWithStakes(2));
    expect(second).not.toContain("transferred to a maximum-security block");
  });

  it("forces the stakes block back on screen when the caller says so, even though its text has not changed", () => {
    const view = createDeltaView();
    view.render(turnWithStakes(1));
    view.render(turnWithStakes(2)); // held back
    const forced = view.render(turnWithStakes(3), { forceShow: (kind) => kind === "stakes" });
    expect(forced).toContain("transferred to a maximum-security block");
  });

  it("forceShow is scoped to the kind it names -- it does not also resurrect other held-back standing blocks", () => {
    const view = createDeltaView();
    view.render(turnWithStakes(1));
    const second = view.render(turnWithStakes(2), { forceShow: (kind) => kind === "stakes" });
    // The stakes block is forced back...
    expect(second).toContain("transferred to a maximum-security block");
    // ...but the identity/rules/conditions blocks are still held back as before.
    expect(second).not.toContain("You are Mara Voss");
    expect(second).not.toContain("suspicion rises by 5");
  });

  it("with no forceShow at all (the default), the stakes block behaves exactly like any other standing block", () => {
    const view = createDeltaView();
    view.render(turnWithStakes(1));
    expect(view.render(turnWithStakes(2))).not.toContain("transferred to a maximum-security block");
  });
});

// D10-2 (PLAYTEST-2026-09-27-DESIGN.md R7): the motivating transcript's
// six-line belief block repeated whole every round. `knowledge` is now
// STANDING and a list block, so an unchanged belief is held back exactly
// like an unchanged perceived object, while a belief that actually moved
// still shows -- under its own lead line, with the held-back notice for the
// rest.
describe("the delta view: an unchanged belief is held back, a changed one still shows (D10-2)", () => {
  const LOCK = { key: "lock integrity", text: "Your last word on the lock integrity was 80, as of round 0." };

  it("shows every belief the first turn", () => {
    const view = createDeltaView();
    const shown = view.render([knowledge(100, 0, [LOCK])]);
    expect(shown).toContain("Your last word on the bar integrity was 100, as of round 0.");
    expect(shown).toContain("Your last word on the lock integrity was 80, as of round 0.");
  });

  it("holds back a belief whose text has not moved, but still shows one that has -- under the lead line", () => {
    const view = createDeltaView();
    view.render([knowledge(100, 0, [LOCK])]);
    const second = view.render([knowledge(92, 1, [LOCK])]); // bar moved, lock did not
    // A PARTIAL change re-prints the lead and only the item that moved --
    // exactly the "shows the ONE object that changed" rule `scene` already
    // pins -- so there is no separate "held back" NOTICE here (that notice
    // is for a block held back WHOLE; see the next test).
    expect(second).toContain("What you know, and as of when:");
    expect(second).toContain("Your last word on the bar integrity was 92, as of round 1.");
    expect(second).not.toContain("Your last word on the lock integrity was 80, as of round 0.");
  });

  it("holds back the whole knowledge block when NOTHING in it has moved", () => {
    const view = createDeltaView();
    view.render([knowledge(100, 0, [LOCK])]);
    const second = view.render([knowledge(100, 0, [LOCK])]);
    expect(second).not.toContain("Your last word on the bar integrity");
    expect(second).not.toContain("Your last word on the lock integrity");
    expect(second).toContain("what you know");
  });

  it("keeps the warden's own suspicion item separate: an unchanged suspicion is held back even while a belief moves, and vice versa", () => {
    const SUSPICION = (n: number): { key: string; text: string } => ({ key: "suspicion", text: `Your own reading of her, right now, stands at suspicion ${n}.` });
    const view = createDeltaView();
    view.render([knowledge(100, 0, [SUSPICION(40)])]);
    const second = view.render([knowledge(92, 1, [SUSPICION(40)])]); // belief moved, suspicion did not
    expect(second).toContain("bar integrity was 92");
    expect(second).not.toContain("suspicion 40");
  });
});
