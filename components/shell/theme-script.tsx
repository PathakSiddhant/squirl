/**
 * Applies the stored theme before first paint.
 *
 * Without this the page renders light, then snaps to dark once React
 * hydrates, which is the single most obvious "cheap app" tell there is.
 */
const script = `
(function () {
  try {
    var stored = localStorage.getItem('hisaab-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || ((!stored || stored === 'system') && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />;
}
