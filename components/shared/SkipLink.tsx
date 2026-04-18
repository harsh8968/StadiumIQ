/**
 * Keyboard-accessible skip link. Hidden until focused, jumps screen readers
 * and keyboard users past the navigation straight to the main content.
 *
 * Must be the first focusable element inside <body>. Rendered by RootLayout.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
    >
      Skip to main content
    </a>
  );
}
