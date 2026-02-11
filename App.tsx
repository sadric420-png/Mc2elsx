
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Outlet, ReportStep, F2Row, F1Row, SKUDefinition } from './types';
import { REPORTING_CONSTANTS, SKU_LIST, TIME_SLOTS } from './constants';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

// Dynamically import PDF.js
let pdfjsLib: any = null;

export default function App() {
  const [step, setStep] = useState<ReportStep>(ReportStep.TC_ENTRY);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Input states for TC Entry
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletContact, setNewOutletContact] = useState('');
  const [newOutletDB, setNewOutletDB] = useState('');
  const [newOutletBeat, setNewOutletBeat] = useState('');
  const [newOutletContactPerson, setNewOutletContactPerson] = useState('');

  // KM states for F1
  const [openingKm, setOpeningKm] = useState('12450');
  const [closingKm, setClosingKm] = useState('12510');

  // Handle PDF worker on mount for Vercel performance
  useEffect(() => {
    const loadPdfLib = async () => {
      if (!pdfjsLib) {
        try {
          pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
        } catch (e) {
          console.error("PDF.js worker load failed", e);
        }
      }
    };
    loadPdfLib();
  }, []);

  const handleReset = () => {
    if (window.confirm("Are you sure you want to start a new report? All current data will be cleared.")) {
      setStep(ReportStep.TC_ENTRY);
      setOutlets([]);
      setNewOutletName('');
      setNewOutletContact('');
      setNewOutletDB('');
      setNewOutletBeat('');
      setNewOutletContactPerson('');
    }
  };

  const handleAddOutlet = () => {
    if (!newOutletName || !newOutletContact) {
      alert("Please provide 'Name of Outlet' and 'Contact No' for TC (Total Calls).");
      return;
    }
    const newOutlet: Outlet = {
      id: uuidv4(),
      name: newOutletName,
      contactNo: newOutletContact,
      isProductive: false,
      skus: SKU_LIST.reduce((acc: Record<string, number>, sku) => ({ ...acc, [sku.id]: 0 }), {}),
      dbName: newOutletDB || "N/A",
      beatName: newOutletBeat || "Main Beat",
      contactPerson: newOutletContactPerson || "Owner"
    };
    setOutlets([...outlets, newOutlet]);
    setNewOutletName('');
    setNewOutletContact('');
    setNewOutletContactPerson('');
    setNewOutletDB('');
    setNewOutletBeat('');
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingPdf(true);
    try {
      if (!pdfjsLib) {
        pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      const updatedOutlets = [...outlets];
      let matchesCount = 0;

      updatedOutlets.forEach(outlet => {
        const hasMatch = fullText.toLowerCase().includes(outlet.name.toLowerCase()) || 
                         fullText.includes(outlet.contactNo);

        if (hasMatch) {
          outlet.isProductive = true;
          matchesCount++;

          SKU_LIST.forEach(sku => {
            const skuLabel = sku.label.split(' ')[0].toLowerCase();
            if (fullText.toLowerCase().includes(skuLabel)) {
              outlet.skus[sku.id] = 1; 
            }
          });
          
          if (fullText.toLowerCase().includes("mc2 yellow")) {
            const mc2Sku = SKU_LIST.find(s => s.id === 'sku_mc2');
            if (mc2Sku) outlet.skus[mc2Sku.id] = 1;
          }
        }
      });

      setOutlets(updatedOutlets);
      alert(`PDF Processed! Automatically updated ${matchesCount} productive calls.`);
    } catch (error) {
      console.error("PDF processing error:", error);
      alert("Error reading PDF. Please ensure it's a valid sales report file.");
    } finally {
      setIsProcessingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const downloadSampleXLSX = () => {
    const data = [
      ["Name of Outlet", "Contact No", "DB Name", "Beat Name", "Contact Person"],
      ["Sample Outlet Name", "9876543210", "Sumit Enterprises", "Amritsar Main", "Rahul Sharma"],
      ["Bisht sweet shop", "9888425863", "Sumit Enterprises", "Beas", "Owner"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TC List");
    XLSX.writeFile(wb, 'TC_Upload_Format.xlsx');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (!jsonData || jsonData.length < 2) {
          alert("File is empty or missing data rows.");
          return;
        }

        const importedOutlets: Outlet[] = jsonData
          .slice(1)
          .filter(row => row && row.length >= 2 && row[0] && row[1])
          .map(row => ({
            id: uuidv4(),
            name: String(row[0]).trim(),
            contactNo: String(row[1]).trim(),
            isProductive: false,
            skus: SKU_LIST.reduce((acc: Record<string, number>, sku) => ({ ...acc, [sku.id]: 0 }), {}),
            dbName: row[2] ? String(row[2]).trim() : "N/A",
            beatName: row[3] ? String(row[3]).trim() : "Main Beat",
            contactPerson: row[4] ? String(row[4]).trim() : "Owner"
          }));

        if (importedOutlets.length > 0) {
          setOutlets(prev => [...prev, ...importedOutlets]);
          alert(`Imported ${importedOutlets.length} outlets!`);
        }
      } catch (error) {
        alert("Error reading file.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleProductive = (id: string) => {
    setOutlets(outlets.map(o => o.id === id ? { ...o, isProductive: !o.isProductive } : o));
  };

  const handleUpdateSKU = (outletId: string, skuId: string, value: number) => {
    setOutlets(outlets.map(o => o.id === outletId ? { ...o, skus: { ...o.skus, [skuId]: value } } : o));
  };

  const f2Data: F2Row[] = useMemo(() => {
    return outlets.map(o => {
      const totalQuantity = Object.values(o.skus).reduce((a: number, b: number) => a + b, 0);
      const totalValue = SKU_LIST.reduce((acc: number, sku: SKUDefinition) => acc + (o.skus[sku.id] * sku.price), 0);
      return {
        ...o,
        date: currentDate,
        salesPerson: REPORTING_CONSTANTS.SALES_PERSON,
        desig: REPORTING_CONSTANTS.DESIGNATION,
        manager: REPORTING_CONSTANTS.MANAGER,
        city: REPORTING_CONSTANTS.CITY,
        ss: REPORTING_CONSTANTS.SS_NAME,
        totalQuantity,
        totalValue
      };
    });
  }, [outlets, currentDate]);

  const f1Data: F1Row[] = useMemo(() => {
    const totalTC = outlets.length;
    const totalPC = outlets.filter(o => o.isProductive).length;
    const totalQty = f2Data.reduce((acc, r) => acc + r.totalQuantity, 0);
    const totalVal = f2Data.reduce((acc, r) => acc + r.totalValue, 0);

    return TIME_SLOTS.map((slot, index) => {
      let tc = Math.round(totalTC * slot.ratio);
      let pc = Math.round(totalPC * slot.ratio);
      let qty = Math.round(totalQty * slot.ratio);
      let val = Math.round(totalVal * slot.ratio);

      if (index === 2) {
        const currentSumTC = Math.round(totalTC * 0.3) + Math.round(totalTC * 0.4);
        tc = totalTC - currentSumTC;
        const currentSumPC = Math.round(totalPC * 0.3) + Math.round(totalPC * 0.4);
        pc = totalPC - currentSumPC;
        const currentSumQty = Math.round(totalQty * 0.3) + Math.round(totalQty * 0.4);
        qty = totalQty - currentSumQty;
        const currentSumVal = Math.round(totalVal * 0.3) + Math.round(totalVal * 0.4);
        val = totalVal - currentSumVal;
      }

      return {
        date: currentDate,
        timeSlot: slot.label,
        name: REPORTING_CONSTANTS.SALES_PERSON,
        tc,
        pc,
        salesInBox: qty,
        salesValue: val,
        dbConfirmation: "Received & Dispatched",
        openingKm: index === 0 ? openingKm : "---",
        closingKm: index === 2 ? closingKm : "---"
      };
    });
  }, [outlets, f2Data, currentDate, openingKm, closingKm]);

  const exportXLSX = (data: any[], fileName: string, sheetName: string, isF2: boolean = false) => {
    const flatData = data.map(row => {
      const { skus, id, isProductive, ...rest } = row;
      
      if (isF2) {
        const f2Map: Record<string, any> = {
          "Date": rest.date,
          "Name of Sales Person": rest.salesPerson,
          "Desig.": rest.desig,
          "Reporting Manager Name": rest.manager,
          "City Name": rest.city,
          "SS Name": rest.ss,
          "DB Name": rest.dbName,
          "Beat Name": rest.beatName,
          "Name of Out Let": rest.name,
          "Contact Person Name": rest.contactPerson,
          "Contact No.": rest.contactNo,
        };

        SKU_LIST.forEach(s => {
          f2Map[s.label] = skus[s.id] || 0;
        });

        f2Map["Total Order Quantity (in )"] = rest.totalQuantity;
        f2Map["Total Order Value ( in Amount)"] = rest.totalValue;

        return f2Map;
      }

      if (skus) {
        const skuCols = SKU_LIST.reduce((acc, s) => ({ ...acc, [s.label]: skus[s.id] }), {});
        return { ...rest, ...skuCols };
      }
      return rest;
    });

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
  };

  const handleStepClick = (targetStep: ReportStep) => {
    if (targetStep !== ReportStep.TC_ENTRY && outlets.length === 0) {
      alert("Pehle TC entry kijiye!");
      return;
    }
    setStep(targetStep);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 selection:bg-indigo-100 selection:text-indigo-900">
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-xl border-b-4 border-indigo-500 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg transition-transform hover:rotate-3"><i className="fas fa-chart-line text-xl"></i></div>
          <div>
            <h1 className="text-lg font-bold tracking-tight uppercase">Sales Operations Analyst</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-tighter">Automation Specialist | Excel Automation v4.2.0</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="flex flex-col items-end">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Active SO</span>
            <span className="font-bold text-indigo-400">{REPORTING_CONSTANTS.SALES_PERSON}</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-700"></div>
          <div className="flex flex-col items-end">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Status</span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              VERCEL_ONLINE
            </span>
          </div>
        </div>
      </nav>

      <main className="flex-grow container mx-auto p-4 lg:p-10 max-w-7xl">
        <div className="mb-10 relative">
          <div className="flex justify-between items-center max-w-3xl mx-auto">
            {[
              { id: ReportStep.TC_ENTRY, label: "TC Entry", icon: "fa-phone-volume" },
              { id: ReportStep.PC_ENTRY, label: "PC & SKUs", icon: "fa-shopping-cart" },
              { id: ReportStep.F2_PREVIEW, label: "F2 Detail", icon: "fa-table" },
              { id: ReportStep.F1_PREVIEW, label: "F1 Summary", icon: "fa-file-alt" }
            ].map((s) => (
              <button 
                key={s.id} 
                onClick={() => handleStepClick(s.id)}
                className="flex flex-col items-center relative z-10 focus:outline-none group transition"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-4 shadow-sm ${
                  step === s.id ? 'bg-indigo-600 border-indigo-200 text-white scale-110 shadow-indigo-200/50 shadow-lg' : 'bg-white border-slate-200 text-slate-400 group-hover:border-indigo-300'
                }`}>
                  <i className={`fas ${s.icon}`}></i>
                </div>
                <span className={`text-[10px] font-bold mt-2 uppercase tracking-tighter ${step === s.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`}>
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-full max-w-2xl h-1 bg-slate-200 -z-0"></div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden ring-1 ring-slate-900/5">
          
          {step === ReportStep.TC_ENTRY && (
            <div className="p-8">
              <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <i className="fas fa-file-excel text-indigo-600"></i> Phase 1: TC Data Ingestion
                  </h2>
                  <p className="text-slate-500 mt-1">Upload call list or enter manual calls for automated processing.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadSampleXLSX} className="bg-white text-indigo-600 border-2 border-indigo-600 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-50 transition flex items-center gap-2 shadow-sm">
                    <i className="fas fa-download"></i> SAMPLE XLSX
                  </button>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
                  <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg hover:shadow-emerald-200/50">
                    <i className="fas fa-upload"></i> UPLOAD TC DATA
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-xl border border-dashed border-slate-300">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">Outlet Name *</label>
                  <input className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition" value={newOutletName} onChange={e => setNewOutletName(e.target.value)} placeholder="Outlet Name" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 uppercase">Contact No *</label>
                  <input className="w-full p-3 border-2 border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition" value={newOutletContact} onChange={e => setNewOutletContact(e.target.value)} placeholder="Phone" />
                </div>
                <div className="flex items-end">
                  <button onClick={handleAddOutlet} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-lg hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95">
                    <i className="fas fa-plus"></i> Add Entry
                  </button>
                </div>
              </div>

              <div className="mt-10 overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 border-b">
                    <tr><th className="px-6 py-4">#</th><th className="px-6 py-4">Outlet Name</th><th className="px-6 py-4">Contact</th><th className="px-6 py-4 text-center">Action</th></tr>
                  </thead>
                  <tbody className="text-sm divide-y">
                    {outlets.map((o, i) => (
                      <tr key={o.id} className="hover:bg-indigo-50/50 transition">
                        <td className="px-6 py-4 text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-6 py-4 font-bold text-slate-800">{o.name}</td>
                        <td className="px-6 py-4 text-slate-600">{o.contactNo}</td>
                        <td className="px-6 py-4 text-center"><button onClick={() => setOutlets(outlets.filter(x => x.id !== o.id))} className="text-red-400 hover:text-red-600 transition"><i className="fas fa-trash-alt"></i></button></td>
                      </tr>
                    ))}
                    {outlets.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Pehle outlets add kijiye ya excel upload kijiye.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-10 flex justify-end">
                <button disabled={outlets.length === 0} onClick={() => setStep(ReportStep.PC_ENTRY)} className={`px-10 py-4 rounded-xl font-black text-white shadow-xl flex items-center gap-3 transition ${outlets.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
                  NEXT: PRODUCTIVE CALLS <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>
          )}

          {step === ReportStep.PC_ENTRY && (
            <div className="p-8">
              <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Step 2: PC & SKU Automation</h2>
                  <p className="text-slate-500 mt-1">Mark productive calls manually or use our PDF AI to extract data automatically.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" ref={pdfInputRef} />
                  <button 
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isProcessingPdf}
                    className={`bg-indigo-900 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-3 hover:bg-slate-800 transition shadow-lg ${isProcessingPdf ? 'opacity-50' : ''}`}
                  >
                    {isProcessingPdf ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-file-pdf"></i>}
                    {isProcessingPdf ? 'READING PDF...' : 'UPLOAD SALES PDF (AUTO-FILL)'}
                  </button>
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">Analyst Logic: Multi-Page Support Active</span>
                </div>
              </div>

              <div className="space-y-6">
                {outlets.map((o) => (
                  <div key={o.id} className={`border-2 rounded-xl overflow-hidden transition-all duration-300 ${o.isProductive ? 'border-green-200 shadow-lg scale-[1.01]' : 'border-slate-100 shadow-sm opacity-80'}`}>
                    <div className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${o.isProductive ? 'bg-green-50/50' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white transition-all ${o.isProductive ? 'bg-green-600 shadow-green-200 shadow-lg' : 'bg-slate-400'}`}>{o.name.charAt(0)}</div>
                        <div>
                          <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">{o.name}</h3>
                          <div className="text-xs text-slate-500">Phone: {o.contactNo}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border shadow-inner">
                        <span className="text-[10px] font-black uppercase text-slate-500">Productive?</span>
                        <button onClick={() => handleToggleProductive(o.id)} className={`w-14 h-7 rounded-full flex items-center transition-all duration-300 p-1 ${o.isProductive ? 'bg-green-600' : 'bg-slate-300'}`}>
                          <div className={`w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${o.isProductive ? 'translate-x-7' : 'translate-x-0'}`}></div>
                        </button>
                      </div>
                    </div>
                    {o.isProductive && (
                      <div className="p-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 bg-white animate-in zoom-in-95 duration-200">
                        {SKU_LIST.map(sku => (
                          <div key={sku.id} className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase block">{sku.label}</label>
                            <input type="number" min="0" value={o.skus[sku.id]} onChange={e => handleUpdateSKU(o.id, sku.id, Math.max(0, parseInt(e.target.value) || 0))} className="w-full p-2 border-2 border-slate-100 rounded text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 outline-none transition" placeholder="0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-10 pt-10 border-t flex justify-between items-center">
                <button onClick={() => setStep(ReportStep.TC_ENTRY)} className="px-8 py-3 rounded-xl font-bold text-slate-600 border-2 hover:bg-slate-50 transition uppercase text-xs">BACK TO TC</button>
                <button onClick={() => setStep(ReportStep.F2_PREVIEW)} className="px-10 py-4 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl uppercase tracking-widest text-xs transition active:scale-95 shadow-indigo-200">GENERATE F2 DETAIL</button>
              </div>
            </div>
          )}

          {step === ReportStep.F2_PREVIEW && (
            <div className="p-8">
              <div className="mb-8 flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-slate-800">F2: Daily Sales Detail</h2>
                  <p className="text-slate-500">Cross-verified audit logs for individual outlet performance.</p>
                </div>
                <button onClick={() => exportXLSX(f2Data, `F2_Report_${currentDate.replace(/\//g, '-')}.xlsx`, "F2", true)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-xs hover:bg-slate-800 transition shadow-lg uppercase tracking-widest">
                  DOWNLOAD F2 XLSX
                </button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-inner">
                <table className="w-full border-collapse min-w-[2000px]">
                  <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-tighter">
                    <tr>
                      <th className="p-3 border border-slate-700 bg-slate-900 sticky left-0 z-10 shadow-md">Date</th>
                      <th className="p-3 border border-slate-700">Name of Sales Person</th>
                      <th className="p-3 border border-slate-700">Desig.</th>
                      <th className="p-3 border border-slate-700">Reporting Manager Name</th>
                      <th className="p-3 border border-slate-700">City Name</th>
                      <th className="p-3 border border-slate-700">SS Name</th>
                      <th className="p-3 border border-slate-700">DB Name</th>
                      <th className="p-3 border border-slate-700">Beat Name</th>
                      <th className="p-3 border border-slate-700">Name of Out Let</th>
                      <th className="p-3 border border-slate-700">Contact Person Name</th>
                      <th className="p-3 border border-slate-700">Contact No.</th>
                      {SKU_LIST.map(s => (<th key={s.id} className="p-3 border border-slate-700 text-center">{s.label}</th>))}
                      <th className="p-3 border border-slate-700 bg-emerald-900">Total Order Quantity (in )</th>
                      <th className="p-3 border border-slate-700 bg-emerald-900">Total Order Value ( in Amount)</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold">
                    {f2Data.map((row, i) => (
                      <tr key={i} className={`transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}>
                        <td className="p-3 border sticky left-0 bg-inherit shadow-sm font-mono">{row.date}</td>
                        <td className="p-3 border">{row.salesPerson}</td>
                        <td className="p-3 border">{row.desig}</td>
                        <td className="p-3 border">{row.manager}</td>
                        <td className="p-3 border">{row.city}</td>
                        <td className="p-3 border">{row.ss}</td>
                        <td className="p-3 border font-black text-indigo-900">{row.dbName}</td>
                        <td className="p-3 border">{row.beatName}</td>
                        <td className="p-3 border text-indigo-700 uppercase font-black">{row.name}</td>
                        <td className="p-3 border">{row.contactPerson}</td>
                        <td className="p-3 border font-mono">{row.contactNo}</td>
                        {SKU_LIST.map(s => (<td key={s.id} className={`p-3 border text-center font-bold ${row.skus[s.id] > 0 ? 'text-indigo-600 bg-indigo-50/20' : 'text-slate-400'}`}>{row.skus[s.id] || '-'}</td>))}
                        <td className="p-3 border text-center font-black bg-emerald-50 text-emerald-800">{row.totalQuantity}</td>
                        <td className="p-3 border text-right font-black bg-emerald-50 text-emerald-800 whitespace-nowrap">₹{row.totalValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-12 bg-indigo-50 border-2 border-indigo-200 p-8 rounded-2xl flex items-center justify-between gap-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg"><i className="fas fa-calculator"></i></div>
                  <p className="text-indigo-900 font-bold">Calculations verified. Proceed to F1 Summary (3:4:3 Distribution)?</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setStep(ReportStep.PC_ENTRY)} className="px-6 py-2 bg-white text-slate-700 font-bold rounded-lg border hover:bg-slate-50 transition shadow-sm uppercase text-xs">NO, EDIT</button>
                  <button onClick={() => setStep(ReportStep.F1_PREVIEW)} className="px-8 py-2 bg-slate-900 text-white font-black rounded-lg shadow-lg hover:bg-slate-800 transition uppercase text-xs">YES, PROCEED</button>
                </div>
              </div>
            </div>
          )}

          {step === ReportStep.F1_PREVIEW && (
            <div className="p-8 text-center">
              <div className="mb-10 text-left flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-black text-slate-800">F1: Time-Slot Summary</h2>
                  <p className="text-slate-500">Weighted shift distribution for organizational consistency.</p>
                </div>
                <button onClick={() => exportXLSX(f1Data, `F1_Summary_${currentDate.replace(/\//g, '-')}.xlsx`, "F1")} className="bg-emerald-700 text-white px-8 py-4 rounded-xl font-black text-xs hover:bg-emerald-800 transition shadow-2xl uppercase tracking-widest shadow-emerald-100">
                  DOWNLOAD F1 XLSX
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border-4 border-slate-100 shadow-xl mb-10 text-left bg-white">
                <table className="w-full">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                    <tr><th className="p-5 border">TIME SLOT</th><th className="p-5 border text-center">TC</th><th className="p-5 border text-center">PC</th><th className="p-5 border text-center">SALES (BOX)</th><th className="p-5 border text-right">VALUE (₹)</th></tr>
                  </thead>
                  <tbody className="text-sm font-bold">
                    {f1Data.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors"><td className="p-5"><span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">{row.timeSlot}</span></td><td className="p-5 text-center font-mono">{row.tc}</td><td className="p-5 text-center text-green-600 font-mono">{row.pc}</td><td className="p-5 text-center font-mono">{row.salesInBox}</td><td className="p-5 text-right text-emerald-700 font-black">₹{row.salesValue.toLocaleString()}</td></tr>
                    ))}
                    <tr className="bg-slate-900 text-white">
                      <td className="p-6 text-right font-black uppercase text-sm">TOTAL PERFORMANCE</td>
                      <td className="p-6 text-center text-sm font-mono">{f1Data.reduce((acc, r) => acc + r.tc, 0)}</td>
                      <td className="p-6 text-center text-sm font-mono">{f1Data.reduce((acc, r) => acc + r.pc, 0)}</td>
                      <td className="p-6 text-center text-sm font-mono">{f1Data.reduce((acc, r) => acc + r.salesInBox, 0)}</td>
                      <td className="p-6 text-right text-sm font-black">₹{f1Data.reduce((acc, r) => acc + r.salesValue, 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-12 bg-slate-900 rounded-2xl text-white shadow-2xl transition-all hover:ring-8 hover:ring-indigo-500/10">
                <i className="fas fa-check-circle text-6xl mb-6 text-emerald-400"></i>
                <h3 className="text-3xl font-black mb-2 uppercase tracking-widest">Reporting Cycle Complete</h3>
                <p className="text-slate-400 mb-10 max-w-lg mx-auto font-medium">Data integrity confirmed for {currentDate}. Excel artifacts are ready for DB dispatch.</p>
                <button onClick={handleReset} className="bg-white text-slate-900 px-12 py-4 rounded-xl font-black hover:bg-indigo-50 transition-all shadow-xl uppercase tracking-widest text-xs transform hover:-translate-y-1">Start New Cycle</button>
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="bg-slate-900 border-t-8 border-indigo-600 p-8 text-center text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] uppercase tracking-[0.2em] font-black">Sales Ops Automation Hub v4.2.0 | Senior Analyst Preferred</p>
          <div className="flex gap-4">
            <span className="text-[9px] bg-slate-800 px-3 py-1 rounded text-slate-400 font-mono">FRAMEWORK: VERCEL_VITE</span>
            <span className="text-[9px] bg-indigo-900/50 px-3 py-1 rounded text-indigo-300 font-mono">DEPLOY_ENV: PRODUCTION</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
