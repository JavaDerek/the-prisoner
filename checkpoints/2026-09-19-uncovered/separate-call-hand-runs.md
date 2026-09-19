# The separate call, by hand (2026-09-19, after V0; NOT a pre-committed measurement)

Run by the owner from `uncovered.html` (this folder's copy; served from `~/prisoner-prompt-lab`) and,
for the three traps, by a one-off script reproducing the page's "Build separate-call prompt" output
byte for byte. `qwen3:14b`, temperature 0, thinking ON, no response schema -- the game's referee
settings. The prompt: the game's own header and answer-format lines, ONE source (the intent, with its
numbered words), ONE question:

> The referee can rule on these kinds of effect and no others: wear, restore, reveal, conceal, expose,
> noise, open, close, leave, derive. Is what the actor's intent attempts named by one of those kinds?
> Answer covered if one of them names what is being done; uncovered if what is being done is not one of
> them, whatever it might lead to. Cite the words of the intent that name what is attempted.
> Answer with exactly one of: covered, uncovered.

| intent | label | n | read | citing | secs |
|---|---|---|---|---|---|
| dig under the loose_tile | U | **5** | **uncovered 5/5** | "dig" ×5 | 3-4 each |
| Dig through the loose tile to see if there's anything hidden underneath. | C (trap) | 1 | covered | "if there's anything hidden underneath." | 7 |
| Pry up the loose tile to see what's underneath | C | 1 | covered | "see what's underneath" | 3 |
| Use the spoon and grit from the loose_tile to scrape the window bar's weld again | N (trap) | 1 | **uncovered** | "scrape" | 6 |

Same model, same intent, same temperature as V0, where the dig read `covered` 5/5 under form Q and
`reveal`/`derive` 5/5 under form K: the one change is one question instead of nine under eleven
descriptions. The reading is NOT keying on the word "dig" (the stated-aim trap held). It over-fires on
"scrape", which is `wear`: the separate question lists the kinds as bare words, where the game's own
effect question glosses each one ("wear (lower a property)..."). Hypothesis, untested when this was
written: the glossed list closes that gap. Whatever wording closes it becomes form **S** in a new
`PREDICTION.md`, replayed over the whole labelled set at the same kill numbers before anything is built.
