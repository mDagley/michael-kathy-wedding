// test/pending-css.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Comments are removed first so a comment above a rule never becomes part of its selector.
const css = readFileSync(new URL('../site/css/base.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function ruleFor(selector) {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].split(',').map((s) => s.trim()), body: m[2] }));
  return rules.find((r) => r.selectors.includes(selector));
}

test('the pending rule hides both data-c text and the footer', () => {
  const rule = ruleFor('.content-pending [data-c]');
  assert.ok(rule, 'pending rule exists');
  assert.ok(rule.selectors.includes('.content-pending #site-footer'));
  assert.match(rule.body, /visibility:\s*hidden/);
});

test('line breaks typed into the sheet are shown (data-c text uses pre-line)', () => {
  // Without this, "Line one\nLine two" collapses onto one line on the page.
  const rule = ruleFor('[data-c]');
  assert.ok(rule, 'a plain [data-c] rule exists');
  assert.match(rule.body, /white-space:\s*pre-line/);
});

test('the pending rule has a reveal backstop of at least 2 seconds', () => {
  const rule = ruleFor('.content-pending [data-c]');
  const m = rule.body.match(/animation:\s*content-reveal\s+(\S+)\s+\S+\s+([\d.]+)(m?s)/);
  assert.ok(m, 'animation references content-reveal with a delay');
  const delaySeconds = m[3] === 'ms' ? Number(m[2]) / 1000 : Number(m[2]);
  assert.ok(delaySeconds >= 2);
  const frames = css.match(/@keyframes\s+content-reveal\s*\{\s*to\s*\{([^}]*)\}\s*\}/);
  assert.ok(frames, '@keyframes content-reveal exists');
  assert.match(frames[1], /visibility:\s*visible/);
});

test('the announcement banner uses the theme band tokens and no literal colors', () => {
  const rule = ruleFor('.announcement');
  assert.ok(rule, '.announcement rule exists');
  for (const token of ['--band', '--band-text', '--band-line']) assert.ok(rule.body.includes(`var(${token})`), token);
  assert.doesNotMatch(rule.body, /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/);
});
