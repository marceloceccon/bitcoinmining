/** FAQPage structured data for /methodology, where the FAQ is visible (Google requires the two to match). */
export const FAQ_JSON_LD = {
  "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is this Bitcoin mining calculator free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. No account, no payment, no trial period. Calculations run in your browser; the only request is for live market data, and your farm configuration is never sent or stored.",
        },
      },
      {
        "@type": "Question",
        name: "How accurate are the mining profitability projections?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The projections are estimates based on the live network hashrate, block subsidy and transaction fees, the BTC price scenario you choose (flat, annual growth or a target price), and your input parameters. Real results depend on actual BTC price movement, difficulty changes, hardware reliability, and electricity rate changes. Use this as a planning tool, not a guarantee.",
        },
      },
      {
        "@type": "Question",
        name: "Can I model a large-scale industrial mining farm?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. The simulator supports any farm size from 1 miner to 10,000+. It calculates racks, containers, transformers, cooling, and labor costs that scale with your operation. Most competing calculators only handle single-rig scenarios.",
        },
      },
      {
        "@type": "Question",
        name: "Does this calculator account for Bitcoin halving events?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Halvings are computed from block height: the forecast estimates when block 1,050,000 (and later halvings) will be mined at 10 minutes per block and halves the block subsidy from that month on, weighting the month in which it happens by blocks on each side.",
        },
      },
      {
        "@type": "Question",
        name: "How is electricity cost modeled?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You set a base electricity rate in dollars per kWh and an annual energy inflation percentage. The forecast engine compounds inflation monthly, giving a realistic cost curve over multi-year horizons. Solar offset reduces the effective grid consumption.",
        },
      },
    ],
  };
