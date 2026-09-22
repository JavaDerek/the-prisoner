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
const KNOWLEDGE: ProseBlock = { kind: "knowledge", text: "Your last word on the bar integrity was 100, as of round 0." };
const RULES: ProseBlock = { kind: "rules", text: "Some things about this cell never change: suspicion rises by 5 for a slight act." };

const turn = (round: number, bar = "Rust has pitted it.", thresholds = "50", extra: readonly { key: string; text: string }[] = []): ProseBlock[] => [
  CONDITIONS(thresholds),
  IDENTITY,
  scene(bar, extra),
  news(round),
  KNOWLEDGE,
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
    expect(second).toContain("Your last word on the bar integrity was 100, as of round 0.");

    // The standing world, shown once and held back after.
    expect(second).not.toContain("You are Mara Voss");
    expect(second).not.toContain("The spoon: A dented aluminium spoon.");
    expect(second).not.toContain("condition 1, for you.");
    expect(second).not.toContain("suspicion rises by 5");
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
