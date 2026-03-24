/**
 * Live Bitcoin network data fetched from public APIs.
 * Falls back to hardcoded approximations when offline.
 */

export interface NetworkData {
  btcPriceUsd: number;
  networkHashrateEh: number;
  difficulty: number;
  blockReward: number;
  hashpriceUsdPhDay: number; // $/PH/day
  lastUpdated: Date;
  isLive: boolean;
}

const BLOCKS_PER_DAY = 144;

const FALLBACK: NetworkData = {
  btcPriceUsd: 0,
  networkHashrateEh: 750,
  difficulty: 108e12,
  blockReward: 3.125,
  hashpriceUsdPhDay: 0,
  lastUpdated: new Date(),
  isLive: false,
};

/**
 * Calculate hashprice in $/PH/day.
 * hashprice = (blocks_per_day * block_reward * btc_price) / (network_hashrate_eh * 1000)
 * where 1 EH = 1000 PH
 */
function calcHashprice(btcPrice: number, networkHashrateEh: number, blockReward: number): number {
  if (networkHashrateEh <= 0) return 0;
  const dailyBtc = BLOCKS_PER_DAY * blockReward;
  const dailyRevenueUsd = dailyBtc * btcPrice;
  const networkPh = networkHashrateEh * 1000;
  return dailyRevenueUsd / networkPh;
}

/**
 * Fetch live BTC network stats from mempool.space and CoinGecko.
 * Returns fallback values if any request fails.
 */
export async function fetchNetworkData(): Promise<NetworkData> {
  try {
    const [priceRes, hashrateRes] = await Promise.allSettled([
      fetch("https://mempool.space/api/v1/prices"),
      fetch("https://mempool.space/api/v1/mining/hashrate/1m"),
    ]);

    let btcPriceUsd = FALLBACK.btcPriceUsd;
    let networkHashrateEh = FALLBACK.networkHashrateEh;
    let difficulty = FALLBACK.difficulty;
    let isLive = false;

    if (priceRes.status === "fulfilled" && priceRes.value.ok) {
      const priceData = await priceRes.value.json();
      if (priceData.USD && priceData.USD > 0) {
        btcPriceUsd = priceData.USD;
        isLive = true;
      }
    }

    if (hashrateRes.status === "fulfilled" && hashrateRes.value.ok) {
      const hashrateData = await hashrateRes.value.json();
      // currentHashrate is in H/s, convert to EH/s
      if (hashrateData.currentHashrate && hashrateData.currentHashrate > 0) {
        networkHashrateEh = hashrateData.currentHashrate / 1e18;
        isLive = true;
      }
      if (hashrateData.currentDifficulty && hashrateData.currentDifficulty > 0) {
        difficulty = hashrateData.currentDifficulty;
      }
    }

    // If mempool price failed, try CoinGecko as backup
    if (btcPriceUsd === 0) {
      try {
        const cgRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
        );
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          if (cgData.bitcoin?.usd) {
            btcPriceUsd = cgData.bitcoin.usd;
            isLive = true;
          }
        }
      } catch {
        // silent fallback
      }
    }

    const blockReward = FALLBACK.blockReward;
    const hashpriceUsdPhDay = calcHashprice(btcPriceUsd, networkHashrateEh, blockReward);

    return {
      btcPriceUsd,
      networkHashrateEh,
      difficulty,
      blockReward,
      hashpriceUsdPhDay,
      lastUpdated: new Date(),
      isLive,
    };
  } catch {
    return { ...FALLBACK, lastUpdated: new Date() };
  }
}
