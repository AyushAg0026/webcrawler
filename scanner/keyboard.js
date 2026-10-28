// Phase 4: our own keyboard check, beyond what axe tests.
// Presses Tab repeatedly, records where focus goes, and flags focus traps
// and focused elements that have no visible focus indicator.

const MAX_TABS = 50;

// Runs inside the browser page (not in Node). Describes the focused element.
function describeFocusedElement() {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;

  const html = el.outerHTML.replace(/ data-a11y-focus-id="\d+"/, '').slice(0, 200);

  // Tag each element with a number the first time it gets focus, so we can
  // tell later whether focus came back to the same element.
  if (!el.dataset.a11yFocusId) {
    window.__a11yFocusCount = (window.__a11yFocusCount ?? 0) + 1;
    el.dataset.a11yFocusId = String(window.__a11yFocusCount);
  }

  // Short CSS selector: walk up at most 4 levels, stop at the nearest id.
  const parts = [];
  for (let node = el; node && parts.length < 4; node = node.parentElement) {
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    let part = node.tagName.toLowerCase();
    const siblings = node.parentElement
      ? [...node.parentElement.children].filter((c) => c.tagName === node.tagName)
      : [];
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
    parts.unshift(part);
  }

  // A focus indicator here means an outline or a box-shadow while focused.
  const style = getComputedStyle(el);
  const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
  const hasBoxShadow = style.boxShadow !== 'none';

  return {
    key: el.dataset.a11yFocusId,
    isFrame: el.tagName === 'IFRAME',
    selector: parts.join(' > '),
    html,
    text: (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 60),
    hasVisibleFocus: hasOutline || hasBoxShadow,
  };
}

function toElement(focused, failureSummary) {
  return { selector: focused.selector, html: focused.html, failureSummary };
}

export async function checkKeyboard(page, maxTabs = MAX_TABS) {
  const focusOrder = [];
  const seen = new Set();
  let trap = null;

  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab');
    const current = await page.evaluate(describeFocusedElement);
    if (!current) continue; // focus is on <body>, e.g. between the end and start of the page

    const previous = focusOrder.at(-1);
    // Inside an iframe, the outer page keeps reporting the iframe itself. That's not a trap.
    if (current.isFrame && previous?.key === current.key) continue;

    if (seen.has(current.key)) {
      // Back to the first element means we went through the whole page and
      // wrapped around: normal. (On a page with one link, that's the same element twice.)
      if (current.key === focusOrder[0].key) break;
      // Back to any other element means focus is stuck or looping in a small group.
      const reason =
        previous.key === current.key
          ? 'Pressing Tab did not move focus away from this element.'
          : 'Focus loops back to this element and never reaches the rest of the page.';
      trap = { element: current, reason };
      break;
    }
    seen.add(current.key);
    focusOrder.push(current);
  }

  const issues = [];
  if (trap) {
    issues.push({
      ruleId: 'keyboard-focus-trap',
      source: 'keyboard',
      impact: 'critical',
      description: 'Keyboard users must be able to move focus away from every element using Tab.',
      help: 'Possible keyboard focus trap',
      helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html',
      wcag: ['2.1.2'],
      elements: [toElement(trap.element, trap.reason)],
    });
  }

  const noIndicator = focusOrder.filter((f) => !f.hasVisibleFocus);
  if (noIndicator.length > 0) {
    issues.push({
      ruleId: 'keyboard-focus-visible',
      source: 'keyboard',
      impact: 'serious',
      description: 'When an element has keyboard focus, users must be able to see where focus is.',
      help: 'Focused element has no visible focus indicator',
      helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html',
      wcag: ['2.4.7'],
      elements: noIndicator.map((f) =>
        toElement(f, 'No outline or box-shadow when focused. Add a :focus-visible style.')
      ),
    });
  }

  return {
    focusOrder: focusOrder.map(({ selector, text, hasVisibleFocus }) => ({ selector, text, hasVisibleFocus })),
    issues,
  };
}
