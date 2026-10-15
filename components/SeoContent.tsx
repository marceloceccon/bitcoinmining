// Server component — no "use client" directive
// Renders static SEO content visible to Googlebot in initial HTML.
// Figures come from the engine and catalogs so the copy can't drift from the code.
import Link from "next/link";
import { MINERS, DRY_COOLERS } from "@/lib/catalog";
import { CONTAINER_MINERS_CAPACITY, RACK_MINERS_CAPACITY } from "@/lib/calculations";

export default function SeoContent() {
  return (
    <section>
      <div className="space-y-8 text-sm text-fg-2 leading-relaxed panel p-6 lg:p-8">

        {/* How it works */}
        <div id="how-it-works">
          <h2 className="text-2xl font-bold text-fg mb-4">
            What This Bitcoin Mining Farm Calculator Models
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
          <h3 className="text-xl font-semibold text-fg mb-3">
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
              <strong className="text-fg">Hardware CAPEX</strong> &mdash; Select
              from {MINERS.length} real ASIC miners (Antminer, Whatsminer, Avalon, SealMiner) with
              sourced, dated prices. Mix different models in the same farm to optimize
              hashrate-per-watt.
            </li>
            <li>
              <strong className="text-fg">Import taxes</strong> &mdash; Apply
              your country&apos;s import duty to hardware cost, with a separate rate for
              miners, racks, containers, fans and dry coolers. Duties typically add
              5&ndash;30% depending on jurisdiction.
            </li>
            <li>
              <strong className="text-fg">Deployment labor</strong> &mdash;
              Calculate installation hours per miner, per rack, per container, and per
              transformer. Set your local hourly labor rate. The simulator computes total
              deployment cost including cables, breakers, and electrical infrastructure.
            </li>
            <li>
              <strong className="text-fg">Energy modeling</strong> &mdash; Set
              electricity price per kWh by region, apply energy inflation rates
              (compounded monthly over your forecast horizon), and optionally model solar
              panel offset to reduce grid dependency.
            </li>
            <li>
              <strong className="text-fg">Thermal management</strong> &mdash;
              Size ventilation fans and dry coolers based on total heat output. Select
              from {DRY_COOLERS.length} real dry cooler models with accurate capacity ratings. The
              calculator accounts for local ambient temperature using ERA5 climate data
              for any location on earth.
            </li>
            <li>
              <strong className="text-fg">Mining pool parameters</strong> &mdash;
              Choose PPS, FPPS, PPLNS, or PPS+ payout schemes with accurate default
              pool fee percentages for each. Pool fees directly impact revenue projections.
            </li>
            <li>
              <strong className="text-fg">Multi-year ROI forecasting</strong>
              &mdash; Project revenue, expenses, and cumulative profit over 12&ndash;72
              months. The forecast starts from live network hashrate, subsidy and fees,
              applies your hashrate-growth estimate and halvings by block height, and
              compounds energy inflation &mdash; giving you a realistic payback timeline.
            </li>
          </ul>
        </div>

        {/* CAPEX components */}
        <div>
          <h3 className="text-xl font-semibold text-fg mb-3">
            CAPEX Components Explained
          </h3>

          <p>
            Total capital expenditure in this calculator includes 10 line items
            that match what a real mining operator budgets for:
          </p>

          <ol className="mt-3 space-y-2 list-decimal list-inside">
            <li>
              <strong className="text-fg">Miner hardware cost</strong> &mdash;
              Unit price times quantity for each ASIC model selected
            </li>
            <li>
              <strong className="text-fg">Transformer cost</strong> &mdash;
              Electrical transformer sized for total farm power draw
            </li>
            <li>
              <strong className="text-fg">Cabling cost</strong> &mdash;
              Per-miner cable and breaker budget
            </li>
            <li>
              <strong className="text-fg">Rack cost</strong> &mdash; Mining
              racks calculated at {RACK_MINERS_CAPACITY} miners per rack
            </li>
            <li>
              <strong className="text-fg">Container cost</strong> &mdash;
              20 ft containers at up to {CONTAINER_MINERS_CAPACITY} miners each
            </li>
            <li>
              <strong className="text-fg">Cooling infrastructure</strong>
              &mdash; Fans, ducting, or dry cooler hardware and installation
            </li>
            <li>
              <strong className="text-fg">Solar CAPEX</strong> &mdash; Panel
              and inverter cost for optional solar offset
            </li>
            <li>
              <strong className="text-fg">Deployment labor</strong> &mdash;
              Total installation hours times hourly rate
            </li>
            <li>
              <strong className="text-fg">Cables and breakers</strong> &mdash;
              Per-unit electrical infrastructure
            </li>
            <li>
              <strong className="text-fg">Dry cooler CAPEX</strong> &mdash;
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
          <h3 className="text-xl font-semibold text-fg mb-3">
            OPEX Modeling Methodology
          </h3>

          <p>
            Monthly operating expenses include grid electricity cost (net of solar
            offset, plus any electricity tax), hardware maintenance as a yearly
            percentage of CAPEX, maintenance labor hours, and optional solar panel
            maintenance. Pool fees come off gross revenue. The forecast tab compounds
            energy price inflation monthly, reflecting real-world tariff escalation
            that most simple calculators ignore.
          </p>

          <p className="mt-3">
            Revenue is your farm&apos;s share of the live network hashrate times the
            block subsidy plus transaction fees, with network growth and halvings
            modeled across the forecast period. The BTC price follows a scenario you
            choose &mdash; flat, a yearly percentage change, or a target price.
          </p>
        </div>

        {/* Price scenarios */}
        <div>
          <h3 className="text-xl font-semibold text-fg mb-3">
            BTC Price Scenarios, Not Predictions
          </h3>

          <p>
            Nobody can forecast the Bitcoin price, so the calculator doesn&apos;t
            pretend to. You pick a scenario: hold today&apos;s price flat, apply a
            yearly change (the Bear and Bull presets are &minus;30% and +30% per
            year), or draw a straight line to a target price of your own.
          </p>

          <p className="mt-3">
            Comparing scenarios shows how sensitive a farm is to price. The
            break-even BTC price tells you how far the market can fall before the
            farm stops covering its operating costs &mdash; the number that matters
            for 3&ndash;5 year horizons that span a halving.
          </p>
        </div>

        {/* Who it's for */}
        <div>
          <h3 className="text-xl font-semibold text-fg mb-3">
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

        <p>
          Common questions are answered in the{" "}
          <Link href="/#faq" className="text-fg underline underline-offset-2">Bitcoin mining calculator FAQ</Link>.
        </p>
      </div>
    </section>
  );
}
