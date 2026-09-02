/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders light, then snaps to dark once React
 * hydrates, which is the single most obvious "cheap app" tell there is.
 *
 * The choice itself is stamped alongside the resolved class, because `light`
 * and `system that happens to be light` are the same colour but not the same
 * instruction. The threshold needs to tell them apart: a chosen Light is
 * allowed to overrule the hour and send the night picture away, and a Light
 * that only came from the OS is not.
 */
const script = `
(function () {
  try {
    var stored = localStorage.getItem('squirl-theme') || 'system';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.dataset.theme = stored;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />;
}
