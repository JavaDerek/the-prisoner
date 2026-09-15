/**
 * The open variant's scenario objects (OPEN-VARIANT.md §4.1) -- content, not
 * mechanism, exactly the discipline `src/scenario.ts` already keeps for the
 * closed variant's identity/motive text. The description column is copied
 * VERBATIM from §4.1's table, per this task's brief ("the §4.1 description
 * table is draft content, to be copied verbatim"). These are DRAFT
 * descriptions, awaiting the owner's review (§8.3) before any real game
 * runs against them -- nothing here is played against doris by this task.
 *
 * Beyond §4.1's own four columns (object, held by, perceptibility,
 * description), this file adds what §4.2's generic effects need to act on
 * an object at all: which BOUNDED NUMERIC PROPERTIES it has, and a
 * magnitude table (slight/moderate/substantial -> a number) per property
 * per effect direction (`wear` lowers, `restore` raises/resets). This is
 * new content this task's brief asks be authored here and recorded as an
 * OPEN-VARIANT.md revision note (see that file's own revision section).
 *
 * CARRYING OVER THE CLOSED VARIANT'S NUMBERS (this task's brief): every
 * property that already exists in the closed variant keeps the closed
 * variant's own constants as its `moderate` magnitude, so an open-mode FILE-
 * shaped wear on the bar behaves identically in scale to the closed
 * variant's own `FILE_AMOUNT` -- see the inline citations below, each naming
 * the closed-variant constant it carries over from `src/world/mechanics.ts`.
 * `slight`/`substantial` are new, and are this task's own authored content
 * (roughly half and roughly 1.5-2x the carried-over `moderate` number,
 * documented per property below), never invented silently.
 *
 * NOT EVERY OBJECT HAS A NUMERIC PROPERTY. `bucket`, `meal tray` and `key
 * ring` carry none in O1: the bucket exists for `noise` (it "rings sharply
 * when anything strikes it" -- a perceptible event with no state to wear),
 * the meal tray and key ring exist for O1 as things an intent can `reveal`
 * or attempt to act on and be ruled impossible against (custody -- taking
 * the keys, hiding something in the tray -- is `move`, out of scope per
 * OPEN-VARIANT.md §7/O1; see this repository's CLAUDE.md, "Custody is out,
 * for now"), and the loose tile's own hiding function is carried by the
 * SPOON's `concealment` property below (mirroring the closed variant's own
 * choice, `world/vocabulary.ts`'s header: "CONCEAL now hides the SPOON...
 * not the tile itself").
 */

export type OpenPropertyKey = "integrity" | "edge" | "concealment" | "passage";

export interface MagnitudeTable {
  slight: number;
  moderate: number;
  substantial: number;
}

export interface OpenObjectProperty {
  /** Generic property name -- what a `wear`/`restore`/`conceal`/`expose`
   *  effect names as its target when it targets this object. */
  key: OpenPropertyKey;
  /** The scenario-level resource name this property maps onto -- reused
   *  verbatim from the closed variant's own resource names where one
   *  already exists (`bar_integrity`, `lock_integrity`, `spoon_edge`), so
   *  belief/expects plumbing (`src/ledger/beliefs.ts`) needs no new
   *  vocabulary for those three. */
  resourceName: string;
  min: number;
  max: number;
  initialValue: number;
  /** How much a `wear` effect lowers this property, by ruled magnitude. */
  wear: MagnitudeTable;
  /** How much a `restore` effect raises this property, by ruled magnitude
   *  (added, then clamped to `max` -- never a hidden "set to max"; a
   *  `substantial` restore is authored large enough to reach `max` from
   *  `min` in one step where the closed variant's own equivalent move did,
   *  e.g. `REPLACE_BAR`/`SERVICE_LOCK` setting integrity to 100). */
  restore: MagnitudeTable;
}

export interface OpenObjectSpec {
  /** A short, stable, scenario-local id -- never exposed to a mind as
   *  anything but this string; the referee's `target` answer key set is
   *  built from these (`referee.ts`). */
  id: string;
  heldBy: string;
  /** OPEN-VARIANT.md §15.1: the id of another object this one is inside. It is
   *  perceived by nobody while that container's `concealment` stands at 50 or
   *  more; once the container is open to view, §10.1's own rule applies to it
   *  as usual. Generic: the hollow under the loose tile is its first caller. */
  heldIn?: string;
  /** Verbatim from OPEN-VARIANT.md §4.1. */
  description: string;
  properties: readonly OpenObjectProperty[];
}

export const OPEN_OBJECTS: readonly OpenObjectSpec[] = [
  {
    // OPEN-VARIANT.md §17.1: a way out is an object of its own, so the ids the
    // referee answers with are the names the minds and §12's rules use. It
    // declares `passage` (moved here from its part, resource name unchanged);
    // its part keeps `integrity` (`world.ts` joins the two into an exit).
    id: "window",
    heldBy: "the cell wall",
    description:
      // OPEN-VARIANT.md §27: the world models one bar as the whole obstacle, so the text says so.
      "A small window high in the wall, a little wider than a person's shoulders. Iron bars cross it, and a single rusted bar closes its widest gap: with that bar gone, a person could climb through.",
    properties: [
      {
        // 0 shut, 1 open, changed only by `open`/`close` (effects.ts refuses
        // wear/restore on it), so the wear/restore tables below are never read.
        key: "passage",
        resourceName: "window_passage",
        min: 0,
        max: 1,
        initialValue: 0,
        wear: { slight: 1, moderate: 1, substantial: 1 },
        restore: { slight: 1, moderate: 1, substantial: 1 },
      },
    ],
  },
  {
    id: "bar",
    heldBy: "the window",
    description:
      "The iron bar that closes the widest gap in the cell's small window, about as thick as a thumb. Rust has " +
      "pitted it near the bottom, where it is set into old mortar that is dry and cracked.",
    properties: [
      {
        key: "integrity",
        resourceName: "bar_integrity",
        min: 0,
        max: 100,
        initialValue: 100,
        // moderate=15 carries over FILE_AMOUNT; substantial=25 carries over
        // FILE_AMOUNT_SHARP (mechanics.ts) -- a spoon sharp enough to help
        // is exactly what makes a wear "substantial" rather than
        // "moderate". slight=8, authored (roughly half of moderate).
        wear: { slight: 8, moderate: 15, substantial: 25 },
        // substantial=100 carries over REPLACE_BAR's own `setResource(...,
        // 100)`. moderate/slight are authored, smaller restorations (a
        // partial patch) that O1's mechanics never happen to reach with a
        // move name, but the magnitude table exists independent of any one
        // move.
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
  {
    // OPEN-VARIANT.md §17.1: a way out is an object of its own, so the ids the
    // referee answers with are the names the minds and §12's rules use. It
    // declares `passage` (moved here from its part, resource name unchanged);
    // its part keeps `integrity` (`world.ts` joins the two into an exit).
    id: "door",
    heldBy: "the cell wall",
    description:
      "A heavy door of iron-bound planks in a stone frame. It hangs a finger's width short of its frame, and the edge of the bolt shows in the gap.",
    properties: [
      {
        // 0 shut, 1 open, changed only by `open`/`close` (effects.ts refuses
        // wear/restore on it), so the wear/restore tables below are never read.
        key: "passage",
        resourceName: "door_passage",
        min: 0,
        max: 1,
        initialValue: 0,
        wear: { slight: 1, moderate: 1, substantial: 1 },
        restore: { slight: 1, moderate: 1, substantial: 1 },
      },
    ],
  },
  {
    id: "lock",
    heldBy: "the cell door",
    // OPEN-VARIANT.md §17.1: the door's gap and the bolt's edge moved to the door.
    description: "A steel lock set in the cell door, its keyhole on the corridor side and its bolt thrown across into the frame.",
    properties: [
      {
        key: "integrity",
        resourceName: "lock_integrity",
        min: 0,
        max: 100,
        initialValue: 100,
        // moderate=20 carries over SHIM_AMOUNT (mechanics.ts).
        wear: { slight: 10, moderate: 20, substantial: 35 },
        // substantial=100 carries over SERVICE_LOCK's own `setResource(...,
        // 100)`.
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
  {
    id: "spoon",
    heldBy: "Voss",
    description:
      "A dented aluminium spoon, thin enough to bend by hand. One side of the bowl is worn flat from " +
      "being scraped along the floor.",
    properties: [
      {
        key: "edge",
        resourceName: "spoon_edge",
        min: 0,
        max: 100,
        initialValue: 0,
        // A honed edge can also be worn back down (scraped flat again,
        // dropped) -- symmetric with restore's own authored numbers, since
        // the closed variant never modelled dulling at all.
        wear: { slight: 5, moderate: 10, substantial: 20 },
        // moderate=10 carries over HONE_AMOUNT (mechanics.ts).
        restore: { slight: 5, moderate: 10, substantial: 20 },
      },
      {
        // Carries the closed variant's `concealed` flag (world/schema.ts,
        // vocabulary.ts's header: concealment is the SPOON's own fact, not
        // the loose tile's) forward as a bounded 0-100 property rather than
        // a 0/1 flag, so a `conceal`/`expose` effect can be ruled at a
        // magnitude like every other effect (OPEN-VARIANT.md §4.2: "today
        // (numeric flag)"). 0 = fully visible (the closed variant's
        // `concealed=0`); 100 = fully concealed under the loose tile (the
        // closed variant's `concealed=1`) -- the closed variant's own two
        // numbers are carried over as this property's own `min`/`max`.
        key: "concealment",
        resourceName: "spoon_concealment",
        min: 0,
        max: 100,
        initialValue: 0,
        // expose lowers concealment -- authored; the closed variant had no
        // partial-exposure concept (CONCEAL was binary).
        wear: { slight: 20, moderate: 50, substantial: 100 },
        // conceal raises concealment; substantial=100 matches the closed
        // variant's CONCEAL going straight to `concealed=1`.
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
  {
    id: "loose_tile",
    heldBy: "the floor",
    description:
      "A square clay floor tile beside the cot, cracked across one corner. It rocks underfoot, and " +
      "beneath it is a shallow hollow of dry grit about the size of a hand.",
    // O1 gave the tile no property (the spoon's own concealment carried the
    // hiding). OPEN-VARIANT.md §15.2 gives it `concealment`: 100 is the tile
    // down and the grit undisturbed, and it gates what is held in the hollow
    // (§15.1, `banknotes` below) -- never the tile's own visibility, which a
    // container keeps (`briefing.ts`). `expose` (lift the tile, dig through
    // the grit) lowers it, `conceal` raises it: the ordinary effects.
    properties: [
      {
        key: "concealment",
        resourceName: "loose_tile_concealment",
        min: 0,
        max: 100,
        initialValue: 100,
        // The spoon's own proportion (§15.2, §9.1).
        wear: { slight: 20, moderate: 50, substantial: 100 },
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
  {
    id: "cot",
    heldBy: "the wall",
    description:
      "A narrow cot whose iron frame is bolted to the wall at the head and stands on two legs at the " +
      "foot. The crossbar is rough with flaking paint, and the springs are held to the frame by twists " +
      "of wire.",
    properties: [
      {
        // The review note in OPEN-VARIANT.md §4.1 names the cot's wire as
        // one of the ideas the descriptions deliberately leave open (a
        // twist of wire, worked loose, is a tool or a shim in the making).
        // Wholly new to the open variant -- no closed-variant number to
        // carry over, so slight/moderate/substantial are authored in the
        // same proportion as the bar's own wear table (the wire is a
        // comparable "worry it loose" action).
        key: "integrity",
        resourceName: "cot_wire_integrity",
        min: 0,
        max: 100,
        initialValue: 100,
        wear: { slight: 10, moderate: 20, substantial: 35 },
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
  {
    id: "blanket",
    heldBy: "the cot",
    description: "A heavy grey wool blanket, thick and coarse, frayed along the hem, with a loose thread running down one edge.",
    properties: [
      {
        // The loose thread -- also named in the owner's review note.
        // Authored the same way as the cot's wire, for the same reason.
        key: "integrity",
        resourceName: "blanket_thread_integrity",
        min: 0,
        max: 100,
        initialValue: 100,
        wear: { slight: 10, moderate: 20, substantial: 35 },
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
  {
    id: "bucket",
    heldBy: "the floor",
    description: "A tin slop bucket with a wire handle and a dented rim. It rings sharply when anything strikes it.",
    // No numeric property: the bucket's whole authored purpose is `noise`
    // (striking it "rings sharply"), which is a perceptible event with no
    // state to wear (OPEN-VARIANT.md §4.2's own table).
    properties: [],
  },
  {
    id: "meal_tray",
    heldBy: "passes through the door slot each round",
    description: "A shallow steel tray pushed through a slot at the bottom of the door, holding a tin cup and a bowl, and collected at the next round.",
    // No numeric property in O1 -- see this file's header ("custody is
    // out"). A legal `reveal`/`noise` target; `wear`/`restore`/`conceal`/
    // `expose` are ruled impossible against it.
    properties: [],
  },
  {
    id: "key_ring",
    heldBy: "Croft's belt",
    description: "A heavy iron ring on Croft's belt holding four keys, one of them long-shanked and brass. The keys clink against each other when Croft walks.",
    // No numeric property in O1 -- taking or copying a key is custody
    // (`move`), out of scope (OPEN-VARIANT.md §7). Legal `reveal`/`noise`
    // target only.
    properties: [],
  },
  {
    // OPEN-VARIANT.md §15.3 -- world content, owned by nobody, mentioned by no
    // briefing, stake, motive or precedent line. Nothing makes it worth
    // anything to anyone, and there is no effect that moves it.
    id: "banknotes",
    heldBy: "the hollow beneath the loose tile",
    heldIn: "loose_tile",
    description: "A fold of banknotes wrapped in a strip of oilcloth, ten notes of a hundred each, soft and grey with damp.",
    properties: [
      {
        key: "concealment",
        resourceName: "banknotes_concealment",
        min: 0,
        max: 100,
        initialValue: 0,
        // The spoon's own proportion (§9.1).
        wear: { slight: 20, moderate: 50, substantial: 100 },
        restore: { slight: 20, moderate: 50, substantial: 100 },
      },
    ],
  },
];

export function findObject(id: string): OpenObjectSpec | undefined {
  return OPEN_OBJECTS.find((o) => o.id === id);
}

export function findProperty(objectId: string, key: OpenPropertyKey): OpenObjectProperty | undefined {
  return findObject(objectId)?.properties.find((p) => p.key === key);
}

export const OPEN_OBJECT_IDS: readonly string[] = OPEN_OBJECTS.map((o) => o.id);
