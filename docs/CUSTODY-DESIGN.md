# Custody: who holds a thing can change (design, 2026-09-22)

Written for: Derek, to approve or change before any code. OPEN-VARIANT §74 decision 2. Short on purpose.

## Why

Phase 1 batch 1 labelled 12 refusals `unbuilt: custody / search`, and they were the warden's entire missing half:
confiscate the wire, pat her down, collect the tray, take the spoon. Your blind game reached for it too (steal
the key ring). D4 is met. Today an item's holder is fixed at creation: `OWNER_OF` in `briefing.ts` for the spoon and
key ring, and `derived.heldBy` for made things.

## What changes in the world

**Two new effects for the referee, and one new use of an existing one:**

| act | effect key | target | what resolves |
|---|---|---|---|
| take a thing, from the room or from a person | `take` | the thing taken | the thing's owner becomes the actor |
| hand a thing over | `give` | the thing given | the thing's owner becomes the other principal, who must be present |
| search a person | `expose` on a person | the person searched | every thing she holds loses its concealment, so it is perceived |

`take` and `give` follow your D3 rule: the act targets the thing, not the place or the person. A search is the one
act that targets the person, because it is done to them.

**Engine:** one `set` leg on the item's `owner_id` and `owner_type` through `resolve()`, the same change kind
`OPEN_LEAVE` already uses for `location_id`. No second write path (the-prisoner CLAUDE.md). Every read of who holds
what (perception, the seat's `holding` line, the briefing's "holding: spoon") reads the item's owner at time t with
`readFactValue`, as presence already does. `OWNER_OF` becomes authoring only: who holds what at the start.

**Suspicion:** unchanged rules. A take or give by the prisoner that the warden can perceive bumps suspicion like any
other visible act.

**Out of scope:** the meal tray being collected each round, and so keeping the spoon back from it (2 rows). The
tray's collection isn't modelled at all today. Incapacitation is the next build.

## One decision for you

**C1. When can someone take a thing that another person is holding?** This decides whether the key ring is
reachable, and so whether the door has a second way to open.

- **A (recommended): only when the holder is not on her feet** (posture below 100: crouched or down). A person
  standing and alert keeps what she holds. The warden gets the prisoner's things by searching first (the thing is
  then perceived), and then taking when the prisoner is down. The prisoner gets the key ring only by putting Croft
  on the floor first. It uses posture, which already exists and which you used in round 1. It also makes
  incapacitation's build the natural next step, not a separate one.
- **B: whenever the thing is perceived.** Simpler, but the prisoner could lift the key ring off a standing warden in
  round 1 and unlock the door, and the warden could strip the prisoner of everything on sight.
- **C: by role.** The warden may always take and the prisoner never may. That's this game's content, not a
  mechanism, and it would help nobody else (the harness rule).

Taking a thing that lies in the room, rather than from a person, is always possible if it's perceived.

## How it's measured

1. Test first: `take`/`give`/search each resolve through `resolve()`, ownership read at t, a planted violation
   for each gate (taking from a standing holder under A; giving with nobody present).
2. A referee probe, prediction first: batch 1's 12 custody rows plus your "steal the key ring", with controls for
   the effects the new keys could pull (derive "take a wire out of the cot" must stay derive; examination must stay
   reveal).
3. Batch 2, from a pinned commit, after the one-act rule (§74.1) and the hiding target (§74.3) have landed.
