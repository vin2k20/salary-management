import axe from 'axe-core';
import { expect } from 'vitest';

/** Radix draws menus and dropdowns in a wrapper at the end of the page, outside the landmarks. */
const POPUP_WRAPPER = '[data-radix-popper-content-wrapper]';

/**
 * Runs the axe accessibility rules on the page and fails with one line per problem. jsdom cannot
 * work out colours, so contrast is checked by hand in the browser instead. An open popup is not
 * reported for sitting outside the page landmarks, as it belongs to the control that opened it.
 */
export async function expectNoAccessibilityProblems(root: Element = document.body) {
  const results = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  const problems = results.violations.flatMap((violation) =>
    violation.nodes
      .filter(
        (node) =>
          !(
            violation.id === 'region' &&
            document.querySelector(node.target.join(' '))?.matches(POPUP_WRAPPER)
          ),
      )
      .map((node) => `${violation.id}: ${violation.help} at ${node.target.join(' ')}`),
  );
  expect(problems).toEqual([]);
}
