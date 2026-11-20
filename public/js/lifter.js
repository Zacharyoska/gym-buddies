/* Decorative animated weightlifter used as a subtle page-background accent. */

export function lifterBackground(variant = '') {
  return `<div class="lifter-bg ${variant}" aria-hidden="true">
    <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="6"
      stroke-linecap="round" stroke-linejoin="round" focusable="false">
      <g class="lifter-body">
        <circle cx="100" cy="56" r="14" fill="currentColor" stroke="none" />
        <path d="M100 72v44" />
        <path d="M100 116 74 166M100 116l26 50" />
        <path d="M68 166h12M120 166h12" />
      </g>
      <g class="lifter-lift">
        <path d="M100 86 72 70M100 86l28-16" />
        <path d="M38 68h124" />
        <path d="M38 56v24M162 56v24" />
        <rect x="26" y="52" width="12" height="32" rx="3" fill="currentColor" stroke="none" />
        <rect x="162" y="52" width="12" height="32" rx="3" fill="currentColor" stroke="none" />
      </g>
    </svg>
  </div>`;
}
