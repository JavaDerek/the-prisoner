# Architecture diagram brief: Autonomous NPCs for interactive fiction

> **Status: current as of 2026-09-17 (afternoon).** Revised for two decisions taken after the first
> draft: a cartridge's presentation ships as **MCP Apps** (SEP-1865) with the console as its host
> (run-dmcp#38, the-prisoner#13, #14), and **Brink is a cartridge with its own presentation module**,
> not a separate console. The console accordingly owns the model, speech, image and video services and
> a GPU scheduler, and guarantees **one window**.
>
> **Drawn: https://claude.ai/artifact/Qh3HMgomuNSpmkzXpxmFZu** (2026-09-17). If this brief changes, the
> drawing is stale until it is republished to that same URL.

Draw one architecture diagram. It shows a proposed system where interactive-fiction games are loaded like
cartridges into a console, and the characters in them are run by independent AI minds instead of by a single
narrator.

## The one idea the picture must make obvious

**The engine never thinks. The console is the only place that calls AI models. Games are data — including
how they look.**

Three horizontal bands, top to bottom: **Cartridges** (data, including their own UI), **Console** (the
runtime that thinks and renders), **Engine** (storage and rules that never think). Models and media
services sit off to the side of the Console, and only the Console touches them.

The second thing the picture should carry, quietly: a cartridge ships its *own screen*, and the console
draws it in the console's single window. Nothing a cartridge ships escapes that window.

## Visual conventions

- **Solid boxes** = exists today. **Dashed boxes** = proposed, not built.
- **Colour by band:** Cartridges warm (amber), Console cool (blue), Engine neutral (slate grey),
  Models and media services violet.
- Label each box with its **name** (bold) and a **one-line role** underneath.
- Where a box maps to a tracked issue, show the issue as a small tag in the corner (e.g. `run-dmcp#39`).
- Arrows are labelled with what flows along them. Thick arrows show the per-turn path. Thin arrows are setup.
- Include a small legend (solid vs dashed, the four colours).

---

## Band 1: Cartridges (top). Games as data, UI included

A row of cartridge-shaped boxes, like game cartridges waiting to be slotted in.

1. **The Prisoner** *(dashed: today it is TypeScript, not yet a data cartridge)*
   Role: two principals, one room; the first cartridge.
2. **Brink** *(dashed)*
   Role: a geopolitical turn-based game. **A cartridge like any other** — its map and situation room are
   its own presentation module, and its narrator is a console capability it declares, not a reason for a
   second console.
3. **Your game** *(dashed, faded)*
   Role: any author's game.

Inside the first cartridge, show its contents as a small stacked list (the same for any cartridge):
- World: objects, descriptions, properties, constraints
- Rules as data: mechanics, gates, end conditions (`run-dmcp#41`)
- Roles: identity, motive, what each principal perceives
- Referee questions
- **Presentation: an MCP Apps View — the cartridge's own HTML for its scenes** (`the-prisoner#13`)
- **Declared capabilities: what this game needs of the console** (`the-prisoner#14`)
- Role test suites and training data (`the-prisoner#10`)

A cartridge is **an MCP server**: it holds the authoritative world and its rules as data, and it ships
its UI. Draw the arrow from a cartridge down into the Console as **"load cartridge: rules, roles and
its View"**.

Worth a small note somewhere near this band: **a cartridge never opens a window of its own.**

---

## Band 2: Console (middle). The runtime; the only part that calls models, and the only part that draws

One large container labelled **IF Console** *(dashed; a new application, repo to be decided —
`the-prisoner#13`)*. Subtitle: *"The Z-machine to the cartridge's story file."*
Along the top edge of this container, a thin banner: **ONE WINDOW — everything composes here**.

Inside it, left to right:

1. **Turn loop** *(dashed)*
   Role: notices a principal is due to act and runs its turn (`run-dmcp#40`).
2. **Mind runner** *(dashed)* (`mind-seam#1`)
   Role: builds a principal's context from its own view, calls its mind, submits the proposal.
   Contains two small solid library chips:
   - **mind-seam**: the mind contract and the wire (exists, published)
   - **mother-of-invention**: novelty mechanisms (exists, published). `pick` is *a working force, not
     yet a novelty mechanism*; free-turn novelty is next (`mother-of-invention#2`)
3. **Referee** *(solid-ish: exists inside The Prisoner today; dashed as a console component)*
   Role: asks a model to rule on a free-text intent, with citations the engine verifies.
4. **Condition lists** *(solid chip: exists inside The Prisoner today, and is now its default)*
   Role: tells each mind the thresholds that unlock actions for it, read from its own side.
5. **Player seat** *(dashed)* (`the-prisoner#11`)
   Role: a human plays any principal. To the system, a human is just another mind.
6. **MCP Apps host** *(dashed)* (`the-prisoner#13`, `#14`) — **this replaces the old "Screen / UI" box**
   Role: renders the cartridge's own View in a sandboxed frame, full-window, and talks to it over
   postMessage. Show two small chips inside it:
   - **Host profile**: the documented superset of the spec this console guarantees — persistent views,
     host-side fullscreen, audio without a click, turn-level messaging (`the-prisoner#14`)
   - **Asset server**: serves images, clips, speech and art **by URL** (`the-prisoner#14`)
7. **GPU scheduler** *(dashed)* (`the-prisoner#14`)
   Role: one consumer card, one big model at a time. Decides what is resident and what degrades —
   subtitles instead of voice, a still frame instead of a clip.
8. **Saves** *(dashed)*
   Role: the console owns them.

**Minds, drawn as character tokens** inside the console, each with its own sealed speech bubble:
- "Principal A: sees only its own view"
- "Principal B: sees only its own view"
- "Player (human seat)"
Put a small padlock between the tokens labelled **"no shared context"**.

Two arrows that matter inside this band:
- MCP Apps host ↔ the cartridge's View: **"postMessage: turn-level state; asset URLs, never base64"**
- GPU scheduler → Models and media services: **"what is resident now"**

---

## Side panel: Models and media services (right of the Console, violet)

One tall box **Local services on one GPU** (solid for the model roles, dashed for the media ones),
subtitle *"e.g. Ollama on a single consumer card; one big model at a time"*.

Inside, role slots in two groups:
- **Model roles**: **Wits** (decides), **Voice** (speaks the line), **Referee** (rules), **Narrator**
  (a declared capability, dashed)
- **Media services** *(all dashed)*: **TTS**, **Speech-to-text** (for a live voice call with barge-in),
  **Image generation**, **Video generation** — with a note on the last one: *"minutes, not seconds: a
  turn never blocks on a clip; narrate now, show it when it lands."*

Arrows, between the Console and this panel only:
- Mind runner → Models: **"briefing → proposal"**
- Referee → Models: **"intent + questions → cited answers"**
- MCP Apps host ← Media services: **"asset URLs"** (the clip, the still, the spoken line)
- GPU scheduler → the whole panel: **"residency and preemption"** (thin, setup-coloured)

Draw **no arrow** between this panel and the Engine. Optionally put a small "no" marker in the gap,
labelled **"the engine never calls a model"**.

---

## Band 3: Engine (bottom). run-dmcp: stores, rules and resolves, never thinks

A wide container labelled **run-dmcp** (solid), subtitle *"MCP server + library. Exists, published."*

Inside, a row of components:

1. **World store and timeline** (solid): entities, facts, events; replay any moment.
2. **Constraints** (solid): bounded, monotonic, conserved, resolve-only, irreversible.
3. **Resolve protocol** (solid): the single write path. Propose → adjudicate → outcome.
4. **Turn reader** (solid as a library; dashed as a verb, `run-dmcp#39`): verifies that each cited answer is verbatim from a named source.
5. **Per-principal view** (dashed, `run-dmcp#18`): what one character perceives and knows at a moment. Badge: *"everything else depends on this"*.
6. **Declared rules loader** (dashed, `run-dmcp#41`): loads a cartridge's mechanics, gates and end conditions as data.
7. **"Due to act"** (dashed, `run-dmcp#40`): surfaces whose turn it is.

Arrows between Console and Engine (thick, the per-turn path, numbered in order):

1. Turn loop → "Due to act": **"who is due?"**
2. Mind runner → Per-principal view: **"what does this principal see?"**
3. (Mind runner ↔ Models, in the side panel)
4. Referee → Turn reader: **"rule this intent: verify the citations"**
5. Console → Resolve protocol: **"resolve the ruling"** (the only write)
6. Resolve protocol → Console: **"outcome"** → back up to the Minds as news on their next turn, **and
   out to the MCP Apps host as the scene to draw**

Add a small callout on arrow 5: **"the one write path: minds cannot write"**.

---

## Off to the far left: plain MCP clients (small, solid, grey)

A small box **Any MCP client (e.g. Claude Desktop)**. Thin arrow straight down to run-dmcp: **"DM-style play:
one model narrates every character"**. This shows today's way of playing still works; the Console is what adds
autonomous NPCs.

If it fits without crowding, a second thin arrow from that box up to a cartridge, dashed and faded,
labelled **"degraded: a stock MCP Apps host renders the View with none of the profile's extras"** — this
is spike 3 of `the-prisoner#14` and is a question, not a promise. Leave it out rather than crowd the
picture.

---

## Title and caption

**Title:** Autonomous NPCs: games as cartridges, minds in the console, an engine that never thinks

**Caption (small, under the diagram):**
*Earned so far, in real games: minds that reason from their own view and act on their own unlocks
(2 of 6 → 6 of 6 with a condition list, now the default; the other side 0 of 20 → 20 of 20). Still a
roadmap: choosing something new unforced, and anything social. Dashed = proposed. Umbrella: run-dmcp#38.*
