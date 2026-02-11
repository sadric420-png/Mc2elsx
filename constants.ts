
import { SKUDefinition } from './types';

export const REPORTING_CONSTANTS = {
  SALES_PERSON: "Shubham",
  DESIGNATION: "SO",
  MANAGER: "Sanjay Sharma Ji",
  CITY: "Amritsar",
  SS_NAME: "Sumit Enterprises"
};

/**
 * SKU List based on the specific F2 columns and Pricing Matrix provided.
 * Pricing mappings based on product categories:
 * 160ml: 165
 * 200ml (Apple, Sparkel, Soda, Zeera, Energy): 155
 * 300ml (Nimbu Pani): 300
 * JUICE 300/500/600ml: 300 (standardized)
 * 1L: 400
 * 2L: 370
 * Coconut Water: 1280
 * MC2: 420
 */
export const SKU_LIST: SKUDefinition[] = [
  { id: 'sku_160ml', label: '160 ML Juice', price: 165 },
  { id: 'sku_apple', label: 'APPLE', price: 155 },
  { id: 'sku_sparkel200', label: 'SPARKEL 200 ML', price: 155 },
  { id: 'sku_nimbu_soda200', label: 'Nimbu Soda 200 ml', price: 155 },
  { id: 'sku_nimbu_pani300', label: 'Nimbu Pani 300 ml', price: 300 },
  { id: 'sku_zeera', label: 'Mr. Fresh Zeera', price: 155 },
  { id: 'sku_juice_misc', label: 'JUICE 300/500/600 ML', price: 300 },
  { id: 'sku_1ltr', label: '1 Ltr', price: 400 },
  { id: 'sku_2ltr', label: '2 Ltr', price: 370 },
  { id: 'sku_coconut', label: 'Coconut Water', price: 1280 },
  { id: 'sku_mc2', label: 'MC2', price: 420 },
  { id: 'sku_energy', label: 'D1 CAN ENERGY DRINK/ BASIL SEEDS', price: 155 }
];

export const TIME_SLOTS = [
  { label: '9 AM - 12 PM', ratio: 0.3 },
  { label: '12:01 PM - 3 PM', ratio: 0.4 },
  { label: '3 PM - 6 PM', ratio: 0.3 }
];
