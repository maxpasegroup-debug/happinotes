'use client';

import { Tooltip } from 'react-tooltip';

const toggleInput = 'input:is([type="checkbox"], [type="radio"])';
const actions = [
  'button', 'a[href]', 'summary', 'select', 'input:is([type="file"], [type="submit"], [type="button"], [type="range"], [type="reset"])',
  toggleInput, `label:has(${toggleInput})`, '[data-tooltip-content]',
  ...['button', 'link', 'tab', 'switch', 'checkbox', 'radio', 'menuitem', 'menuitemradio',
    'menuitemcheckbox', 'option', 'combobox', 'slider'].map(role => `[role="${role}"]`),
].join(', ');

// The admin layout owns this instance, including actions rendered in overlay portals.
// Charts with their own data-rich HeroUI tooltip keep their existing trigger.
const anchorSelect = `:is(${actions}):not([data-own-tooltip], .admin-menu-icon)`;

function actionHint(anchor: HTMLElement | null) {
  if (!anchor) return null;
  const control = anchor instanceof HTMLLabelElement ? anchor.control ?? anchor : anchor;
  const labelledBy = control.getAttribute('aria-labelledby')?.split(/\s+/)
    .map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
  const label = anchor.dataset.tooltipContent || control.getAttribute('aria-label') || labelledBy ||
    control.getAttribute('title') || (control instanceof HTMLInputElement &&
      (control.labels?.[0]?.innerText || (['button', 'submit'].includes(control.type) && control.value))) ||
    anchor.innerText?.trim() || anchor.querySelector('img[alt]')?.getAttribute('alt');
  if (!label) return null;
  if (control.matches('[role="tab"]')) return `Show ${label}`;
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    return `${control.checked ? 'Turn off' : 'Turn on'} ${label}`;
  }
  return label;
}

export default function AdminActionTooltips() {
  return <Tooltip id="admin-action-tooltip" anchorSelect={anchorSelect} positionStrategy="fixed"
    delayShow={350} delayHide={90} clickable noArrow opacity={1}
    disableTooltip={anchor => Boolean(anchor?.matches(':disabled, [aria-disabled="true"]'))}
    openEvents={{ mouseenter: true, focus: true }}
    closeEvents={{ mouseleave: true, blur: true, click: true }}
    globalCloseEvents={{ escape: true, clickOutsideAnchor: true }}
    render={({ activeAnchor }) => actionHint(activeAnchor)} />;
}
