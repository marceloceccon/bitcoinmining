/**
 * The homepage FAQ: one array feeds both the visible questions (components/Faq.tsx) and the
 * FAQPage structured data, so the two can't drift (Google requires them to match).
 */
export const FAQ: { question: string; answer: string }[] = [
  {
    question: "How is Bitcoin mining profitability calculated?",
    answer:
      "Revenue is your share of the network: your hashrate divided by the live network hashrate, times the bitcoin paid to all miners (144 blocks a day × block subsidy plus average fees), adjusted for uptime and the pool fee, at the BTC price you choose. Profit is that revenue minus OPEX: grid electricity, hardware maintenance, maintenance labor and solar upkeep.",
  },
  {
    question: "What electricity price makes a Bitcoin miner profitable?",
    answer:
      "A miner breaks even when its daily revenue equals its daily power cost, so the break-even rate is daily revenue ÷ (power draw in kW × 24 hours). The Compare miners table shows this break-even $/kWh for every ASIC in the catalog at today's network data and flags the ones that lose money at your electricity price.",
  },
  {
    question: "How long does a mining farm take to pay back?",
    answer:
      "Payback is the month in which cumulative net cash flow covers CAPEX. The Projections tab finds it month by month, with network hashrate growth, halvings by block height, hardware degradation, energy inflation and your BTC price scenario, and also reports the BTC price at which the farm breaks even.",
  },
  {
    question: "Is this Bitcoin mining calculator free?",
    answer:
      "Yes. No account, no payment, no trial period. Calculations run in your browser; the only request is for live market data, and your farm configuration is never sent or stored.",
  },
  {
    question: "How accurate are the mining profitability projections?",
    answer:
      "The projections are estimates based on the live network hashrate, block subsidy and transaction fees, the BTC price scenario you choose (flat, annual growth or a target price), and your input parameters. Real results depend on actual BTC price movement, difficulty changes, hardware reliability, and electricity rate changes. Use this as a planning tool, not a guarantee.",
  },
  {
    question: "Can I model a large-scale industrial mining farm?",
    answer:
      "Yes. The simulator supports any farm size from 1 miner to 10,000+. It calculates racks, containers, transformers, cooling, and labor costs that scale with your operation. Most competing calculators only handle single-rig scenarios.",
  },
  {
    question: "Does this calculator account for Bitcoin halving events?",
    answer:
      "Yes. Halvings are computed from block height: the forecast estimates when block 1,050,000 (and later halvings) will be mined at 10 minutes per block and halves the block subsidy from that month on, weighting the month in which it happens by blocks on each side.",
  },
  {
    question: "How is electricity cost modeled?",
    answer:
      "You set a base electricity rate in dollars per kWh and an annual energy inflation percentage. The forecast engine compounds inflation monthly, giving a realistic cost curve over multi-year horizons. Solar offset reduces the effective grid consumption.",
  },
];

export const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};
