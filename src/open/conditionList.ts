/**
 * The condition list (OPEN-VARIANT.md §33.15, §34), in generic words so it can
 * move to a shared package as a file: nothing in this module names this game.
 *
 * The owner's prompt lab found that a model told the thresholds that unlock
 * actions as plain rule sentences keeps preparing after a threshold is met,
 * and acts once they are put at the top of its prompt as a fixed opening line
 * plus a delimited, numbered list of flat single if-then conditions (11/12).
 *
 * Flatness is structural here: a condition is one list of clauses joined by
 * "and", and one outcome. There is no "or" and no nesting, so a caller holding
 * a disjunction must split it into separate conditions, which is what the lab
 * did by hand. Each condition names whose it is, rendered from the reader's
 * side, because an unmarked list let a reader plan to "trigger" a condition
 * that ends the episode against it (§33.15 item 1).
 *
 * The clause text is the caller's: it holds the numbers and the names, and
 * this module only places them.
 */

export interface Condition {
  /** Every clause must hold. Each is one plain statement, never itself a condition. */
  readonly when: readonly string[];
  /** What becomes available, or happens, once they all hold. */
  readonly then: string;
  /** Whose condition it is: the party it unlocks an action for. */
  readonly for: string;
}

export const CONDITION_LIST_OPENING =
  "Whenever a condition stated below is met, the action it unlocks is available immediately. Nothing further needs to be done before attempting it.";

export function renderConditionList(conditions: readonly Condition[], options: { reader: string }): string[] {
  if (conditions.length === 0) return [];
  const lines = conditions.map((condition, index) => {
    if (condition.when.length === 0) throw new Error(`condition ${index + 1}: needs at least one clause`);
    if (condition.when.some((clause) => clause.trim().length === 0)) throw new Error(`condition ${index + 1}: a clause is blank`);
    const whose = condition.for === options.reader ? "you" : condition.for;
    return `CONDITION ${index + 1} (for ${whose}): If ${condition.when.join(", and ")}, then ${condition.then}.`;
  });
  return [CONDITION_LIST_OPENING, "", "START LIST OF CONDITIONS", ...lines, "END LIST OF CONDITIONS"];
}
