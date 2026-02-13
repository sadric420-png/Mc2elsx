
import { SKUDefinition } from './types';

export const REPORTING_CONSTANTS = {
  SALES_PERSON: "Shubham",
  DESIGNATION: "SO",
  MANAGER: "Sanjay Sharma Ji",
  CITY: "Amritsar",
  SS_NAME: "Sumit Enterprises"
};

/**
 * SKU List synchronized with the user's "Sale Report" PDF text labels AND 
 * the user's strict Rate Card.
 * 
 * Rates & Packaging Logic:
 * - MC2 YELLOW: ₹420 per Case (1 Case = 30 Btl)
 * - 2L Variants: ₹350 per Case (1 Case = 6 Btl)
 * - 1 Ltr: ₹390
 * - Small Packs (160ml/200ml): ₹155 - ₹165
 * - Nimbu Series: ₹300
 * - Coconut Water: ₹1280
 */
export const SKU_LIST: SKUDefinition[] = [
  // MC2 YELLOW matches PDF text. Rate synced to 420 (30 Btl/Cs).
  { id: 'sku_mc2', label: 'MC2 YELLOW', price: 420 },
  
  // 2L Variants found in PDF. Updated to ₹350 (6 Btl/Cs).
  { id: 'sku_2l_mix', label: '2L mix', price: 350 },
  { id: 'sku_2l_lichi', label: '2L lichi', price: 350 },
  { id: 'sku_2l_guava', label: '2L guava', price: 350 },
  { id: 'sku_2l_mango', label: '2L mango', price: 350 },
  
  // 1 Ltr Variants
  { id: 'sku_1ltr', label: '1 Ltr', price: 390 },

  // Small Packs & Zeera
  { id: 'sku_200ml_jeera', label: '200ml jeera', price: 155 }, // Matches "Mr. Fresh Zeera" rate
  { id: 'sku_apple_sparkel', label: 'APPLE SPARKEL 200 ML', price: 155 },
  { id: 'sku_160ml', label: '160 ML Juice', price: 165 },
  
  // Nimbu / Lemon Series (Rate: 300)
  { id: 'sku_nimbu_soda', label: 'Nimbu Soda 200 ml', price: 300 }, 
  { id: 'sku_nimbu_pani', label: 'Nimbu Pani 300 ml', price: 300 },
  
  // Juices & Others
  { id: 'sku_juice_misc', label: 'JUICE 300/500/600 ML', price: 300 },
  { id: 'sku_coconut', label: 'Coconut Water', price: 1280 },
  { id: 'sku_d1_energy', label: 'D1 CAN ENERGY DRINK', price: 400 }
];

export const TIME_SLOTS = [
  { label: '9 AM - 12 PM', ratio: 0.3 },
  { label: '12:01 PM - 3 PM', ratio: 0.4 },
  { label: '3 PM - 6 PM', ratio: 0.3 }
];
