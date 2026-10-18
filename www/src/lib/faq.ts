// Homepage FAQ. Rendered on the page and as FAQPage structured data, so keep answers
// plain text.

export const faq = [
  {
    q: "Is OpenASO really free?",
    a: "Yes. OpenASO is open source under the MIT license: no subscription, no account, no keyword limits. It uses Apple's free public App Store endpoints, so there's no server for us to pay for and nothing to charge you for.",
  },
  {
    q: "How accurate are popularity and difficulty?",
    a: "They're estimates. Apple only shares real search volume through Search Ads, so popularity comes from App Store autocomplete and difficulty from the strength of the current top 10. Treat them as relative signals for comparing keywords. In our comparisons they track Astro's values closely for low- and mid-volume keywords. Rankings themselves aren't estimated: they're the same ordered results the App Store shows.",
  },
  {
    q: "Can Claude or other AI agents use OpenASO?",
    a: "Yes. OpenASO has a built-in MCP server: turn it on in Settings, connect Claude Desktop, Claude Code, Cursor, VS Code or any MCP client, and the agent can research keywords, check rankings and track keywords for your apps. It runs locally while OpenASO is open.",
  },
  {
    q: "Does it support Google Play?",
    a: "Not yet. OpenASO covers the iOS App Store in 51 storefronts.",
  },
  {
    q: "Where is my data stored?",
    a: "In a SQLite database on your computer: under ~/Library/Application Support/OpenASO on macOS, %APPDATA%\\OpenASO on Windows and ~/.config/OpenASO on Linux. Help → Open Data Folder in the app shows it. Nothing is sent to us.",
  },
  {
    q: "Why does Windows warn me when I install it?",
    a: 'The Windows installer isn\'t code-signed yet, so SmartScreen may say "Windows protected your PC". Click More info, then Run anyway. The macOS app is signed and notarized by Apple.',
  },
  {
    q: "How does it keep rankings up to date?",
    a: "While the app is open, every tracked keyword is refreshed once a day, on launch, on hourly checks and when your computer wakes. You can also refresh any keyword on demand. Days the app wasn't open simply have no data point.",
  },
  {
    q: "What happens if Apple rate limits me?",
    a: "OpenASO throttles requests per host and backs off automatically when Apple pushes back. Cached data is reused for 24 hours, so most views never hit Apple at all. If you do hit the limit, wait a minute and try again.",
  },
  {
    q: "How do updates work?",
    a: "OpenASO checks for a new version on launch and every few hours, and downloads it in the background. When it's ready, a Restart to update button appears; otherwise it installs the next time you quit.",
  },
];
