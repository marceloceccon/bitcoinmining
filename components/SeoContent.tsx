// Server component — no "use client" directive
// Renders static SEO content visible to Googlebot in initial HTML

export default function SeoContent() {
  return (
    <section className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="space-y-8 text-sm text-slate-500 leading-relaxed glass-card p-8 lg:p-10">

        {/* How it works */}
        <div id="how-it-works">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            How This Bitcoin Mining Farm Calculator Works
          </h2>

          <p>
            Most Bitcoin mining calculators ask for three inputs: hashrate, power
            consumption, and electricity price. They return a single daily profit
            number. That approach works for evaluating one miner on your desk. It
            fails completely when planning a mining farm.
          </p>

          <p className="mt-3">
            Real mining operations require capital expenditure modeling across
            10+ cost categories, ongoing operational expense tracking, and multi-year
            financial projections that account for difficulty adjustments, halving
            events, and energy price inflation. This calculator handles all of that.
          </p>
        </div>

        {/* What makes it different */}
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-3">
            What Makes This Different From Other Mining Calculators
          </h3>

          <p>
            CoinWarz, NiceHash, and WhatToMine calculate profitability for a
            single mining rig. They assume you already own the hardware, have free
            cooling, and pay a flat electricity rate. Those tools answer &ldquo;is my
            miner profitable today?&rdquo; &mdash; not &ldquo;should I invest $2M in a mining farm?&rdquo;
          </p>

          <p className="mt-3">This simulator answers the second question. It models:</p>

          <ul className="mt-3 space-y-2 list-disc list-inside">
            <li>
              <strong className="text-slate-900">Hardware CAPEX</strong> &mdash; Select
              from 50+ real ASIC miners (Antminer, Whatsminer, Avalon) with current
              market pricing. Mix different models in the same farm to optimize
              hashrate-per-watt.
            </li>
            <li>
              <strong className="text-slate-900">Import taxes</strong> &mdash; Apply
              country-specific import duties that add 5&ndash;30% to hardware cost
              depending on jurisdiction. Includes pre-configured rates for 20+ countries.
            </li>
            <li>
              <strong className="text-slate-900">Deployment labor</strong> &mdash;
              Calculate installation hours per miner, per rack, per container, and per
              transformer. Set your local hourly labor rate. The simulator computes total
              deployment cost including cables, breakers, and electrical infrastructure.
            </li>
            <li>
              <strong className="text-slate-900">Energy modeling</strong> &mdash; Set
              electricity price per kWh by region, apply energy inflation rates
              (compounded monthly over your forecast horizon), and optionally model solar
              panel offset to reduce grid dependency.
            </li>
            <li>
              <strong className="text-slate-900">Thermal management</strong> &mdash;
              Size ventilation fans and dry coolers based on total heat output. Select
              from 26 real dry cooler models with accurate capacity ratings. The
              calculator accounts for local ambient temperature using ERA5 climate data
              for any location on earth.
            </li>
            <li>
              <strong className="text-slate-900">Mining pool parameters</strong> &mdash;
              Choose PPS, FPPS, PPLNS, or PPS+ payout schemes with accurate default
              pool fee percentages for each. Pool fees directly impact revenue projections.
            </li>
            <li>
              <strong className="text-slate-900">Multi-year ROI forecasting</strong>
              &mdash; Project revenue, expenses, and cumulative profit over 12&ndash;60
              months. The forecast engine uses the Bitcoin Stock-to-Flow model for price
              projection, applies difficulty adjustment estimates, and compounds energy
              inflation &mdash; giving you a realistic payback timeline.
            </li>
          </ul>
        </div>

        {/* CAPEX components */}
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-3">
            CAPEX Components Explained
          </h3>

          <p>
            Total capital expenditure in this calculator includes 10 line items
            that match what a real mining operator budgets for:
          </p>

          <ol className="mt-3 space-y-2 list-decimal list-inside">
            <li>
              <strong className="text-slate-900">Miner hardware cost</strong> &mdash;
              Unit price times quantity for each ASIC model selected
            </li>
            <li>
              <strong className="text-slate-900">Transformer cost</strong> &mdash;
              Electrical transformer sized for total farm power draw
            </li>
            <li>
              <strong className="text-slate-900">Cabling cost</strong> &mdash;
              Per-miner cable and breaker budget
            </li>
            <li>
              <strong className="text-slate-900">Rack cost</strong> &mdash; Mining
              racks calculated at 10 miners per rack
            </li>
            <li>
              <strong className="text-slate-900">Container cost</strong> &mdash;
              Shipping containers at 100 miners per container
            </li>
            <li>
              <strong className="text-slate-900">Cooling infrastructure</strong>
              &mdash; Fans, ducting, or dry cooler hardware and installation
            </li>
            <li>
              <strong className="text-slate-900">Solar CAPEX</strong> &mdash; Panel
              and inverter cost for optional solar offset
            </li>
            <li>
              <strong className="text-slate-900">Deployment labor</strong> &mdash;
              Total installation hours times hourly rate
            </li>
            <li>
              <strong className="text-slate-900">Cables and breakers</strong> &mdash;
              Per-unit electrical infrastructure
            </li>
            <li>
              <strong className="text-slate-900">Dry cooler CAPEX</strong> &mdash;
              Hardware + plumbing + installation labor for liquid cooling
            </li>
          </ol>

          <p className="mt-3">
            Each component updates in real-time as you adjust your farm
            configuration. The metrics dashboard shows individual line items and
            totals so you can identify which cost categories dominate your budget.
          </p>
        </div>

        {/* OPEX methodology */}
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-3">
            OPEX Modeling Methodology
          </h3>

          <p>
            Monthly operating expenses include grid electricity cost (adjusted for
            solar offset), pool fees as a percentage of gross revenue, and optional
            solar panel maintenance. The forecast tab compounds energy price
            inflation monthly, reflecting real-world tariff escalation that most
            simple calculators ignore.
          </p>

          <p className="mt-3">
            Revenue is calculated from total farm hashrate against current network
            difficulty, with difficulty adjustments modeled across the forecast
            period. Bitcoin price uses the Stock-to-Flow model &mdash; a quantitative
            framework based on BTC&apos;s fixed supply schedule and halving cycles.
          </p>
        </div>

        {/* S2F model */}
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-3">
            Stock-to-Flow Forecasting Model
          </h3>

          <p>
            The Stock-to-Flow (S2F) model values Bitcoin based on its scarcity
            ratio: existing supply (stock) divided by annual production rate (flow).
            After each halving, the flow drops 50%, doubling the S2F ratio and
            historically correlating with significant price appreciation.
          </p>

          <p className="mt-3">
            This calculator integrates the S2F model into its multi-year projections
            so you can evaluate farm ROI under a scarcity-driven price thesis rather
            than assuming a flat BTC price. This is particularly relevant for miners
            evaluating 3&ndash;5 year investment horizons that span one or more halving
            events.
          </p>
        </div>

        {/* Who it's for */}
        <div>
          <h3 className="text-xl font-semibold text-slate-900 mb-3">
            Who This Tool Is For
          </h3>

          <p>
            This calculator is built for mining operators, fund managers evaluating
            mining investments, and anyone planning a Bitcoin mining operation beyond
            hobby scale. If you are comparing hosting contracts, sizing a facility,
            or building a pitch deck for mining investors, this gives you the numbers
            you need &mdash; free, private, and instant.
          </p>
        </div>

        {/* FAQ */}
        <div id="faq">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Is this Bitcoin mining calculator free?
              </h3>
              <p>
                Yes. No account, no payment, no trial period. All calculations are
                performed server-side via our free API. Your farm configuration
                stays in your browser — nothing is stored.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                How accurate are the profitability projections?
              </h3>
              <p>
                The projections are estimates based on current network difficulty,
                the Stock-to-Flow price model, and your input parameters. Real
                results depend on actual BTC price movement, difficulty changes,
                hardware reliability, and electricity rate changes. Use this as a
                planning tool, not a guarantee.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Can I model a large-scale industrial mining farm?
              </h3>
              <p>
                Yes. The simulator supports any farm size &mdash; from 1 miner to
                10,000+. It calculates racks, containers, transformers, cooling, and
                labor costs that scale with your operation. Most competing calculators
                only handle single-rig scenarios.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Does this calculator account for Bitcoin halving events?
              </h3>
              <p>
                Yes. The Stock-to-Flow model inherently accounts for halving events
                in its price projection. The forecast engine also adjusts block reward
                in revenue calculations when a halving occurs within your projection
                window.
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                How is electricity cost modeled?
              </h3>
              <p>
                You set a base electricity rate ($/kWh) and an annual energy inflation
                percentage. The forecast engine compounds inflation monthly, giving a
                realistic cost curve over multi-year horizons. Solar offset reduces the
                effective grid consumption.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
