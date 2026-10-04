I rebuilt an old side project, MineForge (a Bitcoin mining farm calculator), and the most useful part wasn't the redesign — it was making every number defensible.

What I found when I audited it:
• Revenue used a hardcoded network hashrate from a year earlier, overstating income by ~29%.
• A "Stock-to-Flow" option projected a $700k bitcoin.
• Hardware prices were 2024 MSRPs on obsolete machines; two "Bitcoin miners" in the list couldn't mine Bitcoin.
• The forecast and the dashboard disagreed on operating costs; IRR showed −99% next to a positive profit.

What changed:
• Market data is an input, never a constant: one live snapshot feeds the UI, the API and the tests.
• Golden fixtures pin every engine output, so any change that moves a number has to explain itself.
• One engine runs in the browser, behind a REST API, and as an MCP server — an AI agent can now plan a farm end to end and show the assumptions behind each answer.
• A new design ("Control Room") where motion only appears to explain cause and effect: a live schematic of the farm, and a map pin that shows what a site's climate does to cooling cost.

Accessibility went from 91 to 100 on Lighthouse, and every tab passes automated axe checks in light and dark themes.

Case study and code: https://github.com/marceloceccon/bitcoinmining · live: https://www.bitcoinminingfarmcalculator.com
