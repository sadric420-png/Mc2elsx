
export interface Outlet {
  id: string;
  name: string;
  contactNo: string;
  isProductive: boolean;
  skus: Record<string, number>;
  dbName: string;
  beatName: string;
  contactPerson: string;
}

export interface SKUDefinition {
  id: string;
  label: string;
  price: number;
}

export interface F2Row extends Outlet {
  date: string;
  salesPerson: string;
  desig: string;
  manager: string;
  city: string;
  ss: string;
  totalQuantity: number;
  totalValue: number;
}

export interface F1Row {
  date: string;
  timeSlot: string;
  name: string;
  tc: number;
  pc: number;
  salesInBox: number;
  salesValue: number;
  skus: Record<string, number>;
  dbConfirmation: string;
  openingKm: string;
  closingKm: string;
}

export enum ReportStep {
  TC_ENTRY = 'TC_ENTRY',
  PC_ENTRY = 'PC_ENTRY',
  F2_PREVIEW = 'F2_PREVIEW',
  F1_PREVIEW = 'F1_PREVIEW'
}
