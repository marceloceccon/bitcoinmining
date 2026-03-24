import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number as USD currency
 */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format number as BTC
 */
export function formatBtc(amount: number, decimals: number = 8): string {
  return `${amount.toFixed(decimals)} ₿`;
}

/**
 * Format hash rate with appropriate unit
 */
export function formatHashRate(ths: number): string {
  if (ths < 1000) {
    return `${ths.toFixed(2)} TH/s`;
  } else if (ths < 1_000_000) {
    return `${(ths / 1000).toFixed(2)} PH/s`;
  } else {
    return `${(ths / 1_000_000).toFixed(2)} EH/s`;
  }
}

/**
 * Format power with appropriate unit
 */
export function formatPower(kw: number): string {
  if (kw < 1000) {
    return `${kw.toFixed(2)} kW`;
  } else {
    return `${(kw / 1000).toFixed(2)} MW`;
  }
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format date
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
  }).format(date);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Calculate ROI color based on value
 */
export function getRoiColor(roi: number): string {
  if (roi < 0) return "text-red-500";
  if (roi < 50) return "text-yellow-500";
  if (roi < 100) return "text-orange-500";
  return "text-green-500";
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
