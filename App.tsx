
import React, { useState, useMemo, useRef } from 'react';
import { Outlet, ReportStep, F2Row, F1Row, SKUDefinition } from './types';
import { REPORTING_CONSTANTS, SKU_LIST, TIME_SLOTS } from './constants';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

export default function App() {
  const [step, setStep] = useState<ReportStep>(ReportStep.TC_ENTRY);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [currentDate] = useState(new Date().toLocaleDateString('en-GB'));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Text Processing State
  const [pastedText, setPastedText] = useState('');
  const [bulkPasteText, setBulkPasteText] = useState('');
  
  // Input states for TC Entry
  const [newOutletName, setNewOutletName] = useState('');
  const [newOutletContact, setNewOutletContact] = useState('');

  // KM states for F1 (Kept in state but not used in calculation as per request)
  const [openingKm, setOpeningKm] = useState('12450');
  const [closingKm, setClosingKm] = useState('12510');

  const handleReset = () => {
    if (window.confirm("Pura data clear ho jayega. Kya aap naya report start karna chahte hain?")) {
      setStep(ReportStep.TC_ENTRY);
      setOutlets([]);
      setNewOutletName('');
      setNewOutletContact('');
      setPastedText('');
      setBulkPasteText('');
    }
  };

  const handleAddOutlet = () => {
    if (!newOutletName || !newOutletContact) {
      alert("Outlet Name aur Contact No mandatory hai!");
      return;
    }
    const newOutlet: Outlet = {
      id: uuidv4(),
      name: newOutletName.trim(),
      contactNo: newOutletContact.trim(),
      isProductive: false,
      skus: SKU_LIST.reduce((acc: Record<string, number>, sku) => ({ ...acc, [sku.id]: 0 }), {}),
      dbName: REPORTING_CONSTANTS.SS_NAME,
      beatName: "Main Beat",
      contactPerson: "Owner"
    };
    setOutlets([...outlets, newOutlet]);
    setNewOutletName('');
    setNewOutletContact('');
  };

  const handleBulkPaste = () => {
    if (!bulkPasteText.trim()) {
        alert("Paste data first!");
        return;
    }
    
    const rows = bulkPasteText.split(/\r?\n/);
    const newOutlets: Outlet[] = [];
    
    rows.forEach(row => {
        // Excel copy usually separates columns with tabs
        let parts = row.split('\t');
        
        // Fallback: If user pasted pipe separated
        if (parts.length < 2 && row.includes('|')) {
            parts = row.split('|');
        }

        const name = parts[0]?.trim();
        const contact = parts[1]?.trim() || "";

        // Skip potential headers or empty lines
        if (!name || name.toLowerCase().includes('name of out let') || name.toLowerCase() === 'name') return;

        newOutlets.push({
            id: uuidv4(),
            name: name,
            contactNo: contact,
            isProductive: false,
            skus: SKU_LIST.reduce((acc: Record<string, number>, sku) => ({ ...acc, [sku.id]: 0 }), {}),
            dbName: REPORTING_CONSTANTS.SS_NAME,
            beatName: "Main Beat",
            contactPerson: "Owner"
        });
    });

    if (newOutlets.length > 0) {
        setOutlets(prev => [...prev, ...newOutlets]);
        setBulkPasteText('');
        alert(`Successfully added ${newOutlets.length} outlets from paste!`);
    } else {
        alert("Could not parse data. Ensure you copied 'Name' and 'Contact' columns from Excel.");
    }
  };

  // Smart Math Parser: Handles "30 + 3", "30+3", "10", etc.
  const parseQuantity = (str: string): number => {
    try {
      // First, normalize space around plus signs
      const sanitized = str.replace(/\s+/g, '').replace(/[^\d+]/g, ''); 
      // sanitized is now "30+3" or "10"
      if (sanitized.includes('+')) {
        return sanitized.split('+').reduce((acc, val) => acc + (parseInt(val) || 0), 0);
      }
      return parseInt(sanitized) || 0;
    } catch (e) { return 0; }
  };

  // Normalizer: Removes spaces and lowercases for fuzzy matching
  const normalize = (str: string) => str.toLowerCase().replace(/[\s\-_.]/g, '');

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      // Iterate through all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // Join items with space to preserve basic layout flow
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- [PDF Page ${i}] ---\n` + pageText;
      }

      setPastedText(prev => prev ? prev + "\n" + fullText : fullText);
      
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      alert(`PDF Successfully Read! ${pdf.numPages} pages extracted.\nThe text has been added to the box below. Click 'AUTO-FILL' to process.`);
    } catch (error) {
      console.error("PDF Reading Error:", error);
      alert("Error reading PDF. Please ensure the file is not corrupted.");
    }
  };

  const handleTextProcess = () => {
    if (!pastedText.trim()) {
      alert("Please paste text from WhatsApp or Import a PDF first.");
      return;
    }

    try {
      // 1. SMART SPLIT: Divide Text into "Transaction Blocks"
      const invoiceBlocks = pastedText.split(/FY25-|Invoice|Bill No/i);
      
      const updatedOutlets = [...outlets];
      let matchCount = 0;

      updatedOutlets.forEach(outlet => {
        // 2. FUZZY MATCH: Find which block belongs to this outlet
        const normName = normalize(outlet.name);
        const normContact = normalize(outlet.contactNo);

        const targetBlock = invoiceBlocks.find(block => {
            const normBlock = normalize(block);
            return (normContact.length > 5 && normBlock.includes(normContact)) || 
                   (normName.length > 3 && normBlock.includes(normName));
        });

        if (targetBlock) {
          outlet.isProductive = true;
          matchCount++;
          
          // Reset SKUs for this outlet before filling
          SKU_LIST.forEach(s => outlet.skus[s.id] = 0);

          // 3. GREEDY SKU SCAN WITH UNIT CONVERSION
          SKU_LIST.forEach(sku => {
            const escapedLabel = sku.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // Regex Strategy:
            // Group 1: Quantity (e.g. "30 + 3" or "10")
            // Group 2: Unit (e.g. "Btl", "Box", "Pcs") - OPTIONAL
            const pattern = new RegExp(`${escapedLabel}.*?(\\d+(?:\\s*\\+\\s*\\d+)?)\\s*(Box|Cs|Case|Btl|Bottle|Bt|Unit|Pcs|Ltr|Pc)?`, 'gi');
            
            const matches = [...targetBlock.matchAll(pattern)];
            
            if (matches.length > 0) {
              const totalQty = matches.reduce((sum, match) => {
                const rawQty = parseQuantity(match[1]);
                const unit = (match[2] || '').toLowerCase();
                
                let finalQty = rawQty;
                
                // === CONVERSION LOGIC ===
                // Check if the unit implies "Bottles" or "Pieces"
                const isBottle = ['btl', 'bottle', 'bt', 'pc', 'pcs'].includes(unit);
                
                if (isBottle) {
                  if (sku.id === 'sku_mc2') {
                    // MC2: 30 Bottles = 1 Case
                    finalQty = rawQty / 30;
                  } else if (sku.id.startsWith('sku_2l')) {
                    // 2L: 6 Bottles = 1 Case
                    finalQty = rawQty / 6;
                  }
                }
                // If unit is "Box", "Cs", or empty, we assume it's already in Cases.
                
                return sum + finalQty;
              }, 0);

              if (totalQty > 0) {
                 // Store with 2 decimal precision for broken cases (e.g. 1.5)
                 outlet.skus[sku.id] = parseFloat(totalQty.toFixed(2));
              }
            }
          });
        }
      });

      setOutlets(updatedOutlets);
      alert(`Text Analysis Complete: ${matchCount} outlets matched.\n\nUnit Conversion Applied:\n- MC2 Btl / 30 = Box\n- 2L Btl / 6 = Box`);
    } catch (e) {
      console.error(e);
      alert("Error parsing text.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target?.result, { type: 'binary' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const imported = data.slice(1).filter(r => r[0] && r[1]).map(r => ({
        id: uuidv4(),
        name: String(r[0]),
        contactNo: String(r[1]),
        isProductive: false,
        skus: SKU_LIST.reduce((acc: Record<string, number>, sku) => ({ ...acc, [sku.id]: 0 }), {}),
        dbName: r[2] || REPORTING_CONSTANTS.SS_NAME,
        beatName: r[3] || "Main Beat",
        contactPerson: r[4] || "Owner"
      }));
      setOutlets(prev => [...prev, ...imported]);
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const f2Data: F2Row[] = useMemo(() => outlets.map(o => {
    const totalQuantity = (Object.values(o.skus) as number[]).reduce((a: number, b: number) => a + b, 0);
    const totalValue = SKU_LIST.reduce((acc: number, sku) => acc + (o.skus[sku.id] * sku.price), 0);
    return {
      ...o,
      date: currentDate,
      salesPerson: REPORTING_CONSTANTS.SALES_PERSON,
      desig: REPORTING_CONSTANTS.DESIGNATION,
      manager: REPORTING_CONSTANTS.MANAGER,
      city: REPORTING_CONSTANTS.CITY,
      ss: REPORTING_CONSTANTS.SS_NAME,
      totalQuantity: parseFloat(totalQuantity.toFixed(2)),
      totalValue: Math.round(totalValue)
    };
  }), [outlets, currentDate]);

  const f1Data: F1Row[] = useMemo(() => {
    const totalTC = outlets.length;
    const totalPC = outlets.filter(o => o.isProductive).length;
    const totalQty = f2Data.reduce((acc: number, r: F2Row) => acc + r.totalQuantity, 0);
    const totalVal = f2Data.reduce((acc: number, r: F2Row) => acc + r.totalValue, 0);
    return TIME_SLOTS.map((slot, i) => {
      let tc = Math.round(totalTC * slot.ratio);
      let pc = Math.round(totalPC * slot.ratio);
      let qty = Math.round(totalQty * slot.ratio);
      let val = Math.round(totalVal * slot.ratio);
      if (i === 2) {
        tc = totalTC - (Math.round(totalTC * 0.3) + Math.round(totalTC * 0.4));
        pc = totalPC - (Math.round(totalPC * 0.3) + Math.round(totalPC * 0.4));
        qty = totalQty - (Math.round(totalQty * 0.3) + Math.round(totalQty * 0.4));
        val = totalVal - (Math.round(totalVal * 0.3) + Math.round(totalVal * 0.4));
      }
      return {
        date: currentDate, timeSlot: slot.label, name: REPORTING_CONSTANTS.SALES_PERSON,
        tc, pc, salesInBox: qty, salesValue: val, dbConfirmation: "OK",
        // Force empty strings as per user request to NOT fill KM
        openingKm: "", 
        closingKm: ""
      };
    });
  }, [outlets, f2Data, currentDate]);

  const copyWhatsAppSummary = () => {
    const totalTC = outlets.length;
    const totalPC = outlets.filter(o => o.isProductive).length;
    const totalVal = f2Data.reduce((acc: number, r) => acc + r.totalValue, 0);
    const summaryText = `📊 *DAILY SALES REPORT*\n📅 Date: ${currentDate}\n👤 SO: ${REPORTING_CONSTANTS.SALES_PERSON}\n\n📞 *Calls:* TC: ${totalTC} | PC: ${totalPC}\n💰 *Value:* ₹${totalVal.toLocaleString()}\n📍 *Travel:* KM ${openingKm} to ${closingKm}\n\n✅ *Report Verified.*`;
    navigator.clipboard.writeText(summaryText).then(() => alert("Summary Copied!"));
  };

  const getF1ExportRows = () => {
    return f1Data.map(r => ({
      "DATE": r.date,
      "TIME": r.timeSlot,
      "Name of SO/TSI": r.name,
      "TC": r.tc,
      "PC": r.pc,
      "SALES IN BOX": r.salesInBox,
      "SALES VALUE": r.salesValue,
      "DB Confirmation aboutOrder Receiveng & Dispatch Status": r.dbConfirmation,
      "OPENING KM": "", 
      "CLOSING KM": ""
    }));
  };

  const getF2ExportRows = () => {
    return f2Data.map((r, index) => {
      // Aggregate 2L variants
      const val2L = (r.skus['sku_2l_mix'] || 0) + 
                    (r.skus['sku_2l_lichi'] || 0) + 
                    (r.skus['sku_2l_guava'] || 0) + 
                    (r.skus['sku_2l_mango'] || 0);

      const isFirst = index === 0;

      return {
        "Date": isFirst ? r.date : "",
        "Name of Sales Person": isFirst ? r.salesPerson : "",
        "Desig.": isFirst ? r.desig : "",
        "Reporting Manager Name": isFirst ? r.manager : "",
        "City Name": isFirst ? r.city : "",
        "SS Name": isFirst ? r.ss : "",
        "DB Name": isFirst ? r.dbName : "",
        "Beat Name": isFirst ? r.beatName : "",
        "Name of Out Let": r.name,
        "Contact Person Name": r.contactPerson,
        "Contact No.": r.contactNo,
        "160 ML Juice": r.skus['sku_160ml'] || 0,
        "APPLE SPARKEL 200 ML": r.skus['sku_apple_sparkel'] || 0,
        "Nimbu Soda 200 ml": r.skus['sku_nimbu_soda'] || 0,
        "Nimbu Pani 300 ml": r.skus['sku_nimbu_pani'] || 0,
        "Mr. Fresh Zeera": r.skus['sku_200ml_jeera'] || 0,
        "JUICE 300/500/600 ML": r.skus['sku_juice_misc'] || 0,
        "1 Ltr": r.skus['sku_1ltr'] || 0,
        "2 Ltr": val2L,
        "Coconut Water": r.skus['sku_coconut'] || 0,
        "MC2": r.skus['sku_mc2'] || 0,
        "D1 CAN ENERGY DRINK/ BASIL SEEDS": r.skus['sku_d1_energy'] || 0,
        "Total Order Quantity (in )": r.totalQuantity,
        "Total Order Value ( in Amount)": r.totalValue
      };
    });
  };

  const exportMasterReport = () => {
    const wb = XLSX.utils.book_new();
    
    // F1 Sheet
    const f1Sheet = XLSX.utils.json_to_sheet(getF1ExportRows());
    XLSX.utils.book_append_sheet(wb, f1Sheet, "F1 Summary");
    
    // F2 Sheet
    const f2Sheet = XLSX.utils.json_to_sheet(getF2ExportRows());
    XLSX.utils.book_append_sheet(wb, f2Sheet, "F2 Daily Sales");
    
    XLSX.writeFile(wb, `Final_Sales_Report_${currentDate.replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-xl border-b-4 border-indigo-500">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg"><i className="fas fa-chart-line text-xl"></i></div>
          <h1 className="text-lg font-bold tracking-tight uppercase">Sales Ops Automation Hub</h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 font-black uppercase">Analyst Mode Active</p>
          <p className="font-bold text-sm">{REPORTING_CONSTANTS.SALES_PERSON} ({REPORTING_CONSTANTS.DESIGNATION})</p>
        </div>
      </nav>

      <main className="flex-grow container mx-auto p-4 lg:p-10 max-w-7xl">
        <div className="mb-10 flex justify-between items-center max-w-3xl mx-auto">
          {[
            { id: ReportStep.TC_ENTRY, label: "TC ENTRY", icon: "fa-phone-volume" },
            { id: ReportStep.PC_ENTRY, label: "PC & SKUs", icon: "fa-shopping-cart" },
            { id: ReportStep.F2_PREVIEW, label: "F2 RESULT", icon: "fa-table" },
            { id: ReportStep.F1_PREVIEW, label: "F1 SUMMARY", icon: "fa-file-alt" }
          ].map((s) => (
            <button key={s.id} onClick={() => (outlets.length > 0 || s.id === ReportStep.TC_ENTRY) && setStep(s.id)} className={`flex flex-col items-center transition ${step === s.id ? 'scale-110' : 'opacity-50 hover:opacity-100'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 shadow-sm ${step === s.id ? 'bg-indigo-600 border-indigo-200 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                <i className={`fas ${s.icon}`}></i>
              </div>
              <span className={`text-[9px] font-black mt-2 uppercase tracking-widest ${step === s.id ? 'text-indigo-600' : 'text-slate-400'}`}>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden min-h-[500px]">
          {step === ReportStep.TC_ENTRY && (
            <div className="p-8">
              <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic">Phase 1: Total Calls List</h2>
                <div className="flex gap-2">
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" ref={fileInputRef} />
                  <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg uppercase tracking-widest hover:bg-emerald-700 transition"><i className="fas fa-file-excel mr-2"></i> IMPORT TC XLSX</button>
                </div>
              </div>

              {/* NEW: Bulk Paste Section */}
              <div className="bg-slate-900 p-6 rounded-2xl border-4 border-indigo-600 shadow-2xl mb-8">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-white font-black uppercase tracking-widest text-sm"><i className="fas fa-paste mr-2"></i> Bulk Paste from Excel</h3>
                   <span className="text-indigo-400 text-[10px] font-bold">Format: Name [Tab] Contact</span>
                </div>
                <textarea
                  value={bulkPasteText}
                  onChange={e => setBulkPasteText(e.target.value)}
                  className="w-full h-32 bg-slate-800 text-white font-mono text-xs p-4 rounded-xl border-2 border-slate-700 focus:border-indigo-500 outline-none resize-y mb-4 placeholder-slate-600"
                  placeholder={`Copy columns from Excel and paste here...\n\nExample:\nOm Sai Ram Shop    9876543210\nGupta General Store    8877665544`}
                />
                <button onClick={handleBulkPaste} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-500 transition shadow-xl uppercase text-xs border-b-4 border-indigo-800 active:translate-y-1 active:border-b-0">
                  <i className="fas fa-upload mr-2"></i> UPLOAD PASTED DATA
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-100 p-6 rounded-2xl border-2 border-slate-200 shadow-inner">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Name of Out Let</label>
                  <input className="w-full p-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-indigo-400 outline-none transition font-bold" value={newOutletName} onChange={e => setNewOutletName(e.target.value)} placeholder="Type Outlet Name..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contact No.</label>
                  <input className="w-full p-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:border-indigo-400 outline-none transition font-bold" value={newOutletContact} onChange={e => setNewOutletContact(e.target.value)} placeholder="Type Phone No..." />
                </div>
                <div className="flex items-end">
                  <button onClick={handleAddOutlet} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl hover:bg-indigo-500 transition shadow-xl uppercase text-xs border-b-4 border-indigo-800 active:translate-y-1 active:border-b-0"><i className="fas fa-plus mr-2"></i> ADD MANUALLY</button>
                </div>
              </div>

              <div className="mt-10 rounded-xl overflow-hidden border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b">
                    <tr><th className="p-4">#</th><th className="p-4">OUTLET NAME</th><th className="p-4">CONTACT</th><th className="p-4 text-right">ACTION</th></tr>
                  </thead>
                  <tbody className="divide-y text-sm font-bold">
                    {outlets.map((o, i) => (
                      <tr key={o.id} className="hover:bg-indigo-50/50 transition">
                        <td className="p-4 text-slate-400 font-mono">{i + 1}</td>
                        <td className="p-4 uppercase">{o.name}</td>
                        <td className="p-4">{o.contactNo}</td>
                        <td className="p-4 text-right"><button onClick={() => setOutlets(outlets.filter(x => x.id !== o.id))} className="text-red-400 hover:text-red-600"><i className="fas fa-trash-alt"></i></button></td>
                      </tr>
                    ))}
                    {outlets.length === 0 && (
                      <tr><td colSpan={4} className="p-20 text-center text-slate-300 uppercase font-black tracking-widest opacity-30 text-2xl italic">Empty Call List</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-10 flex justify-end">
                <button disabled={outlets.length === 0} onClick={() => setStep(ReportStep.PC_ENTRY)} className={`px-12 py-4 rounded-2xl font-black text-white shadow-2xl flex items-center gap-3 transition ${outlets.length === 0 ? 'bg-slate-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}>NEXT: FILL PC & SKUs <i className="fas fa-arrow-right"></i></button>
              </div>
            </div>
          )}

          {step === ReportStep.PC_ENTRY && (
            <div className="p-8">
              <div className="mb-8 flex justify-between items-center">
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">Phase 2: Productive Detail</h2>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">WhatsApp Text Mode</div>
              </div>

              <div className="bg-slate-900 p-6 rounded-2xl shadow-xl border-4 border-indigo-500 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center mb-4 gap-4">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">
                    <i className="fas fa-database mr-2"></i> Source Data (WhatsApp Text or PDF)
                  </label>
                  <div>
                    <input type="file" accept="application/pdf" ref={pdfInputRef} className="hidden" onChange={handlePdfUpload} />
                    <button onClick={() => pdfInputRef.current?.click()} className="bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition shadow-lg border-b-2 border-indigo-900 active:translate-y-1 active:border-b-0">
                      <i className="fas fa-file-pdf mr-2"></i> Import Invoice PDF
                    </button>
                  </div>
                </div>
                <textarea 
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full h-40 bg-slate-800 text-green-400 font-mono text-xs p-4 rounded-xl border-2 border-slate-700 focus:border-green-500 outline-none resize-y mb-4"
                  placeholder={`You can paste WhatsApp text here OR click 'Import Invoice PDF' to read a file.\n\nExample Data:\nInvoice FY25-101\nBisht Sweet Shop\nMC2 YELLOW 30 Btl\n2L mix 6 Btl`}
                />
                <button onClick={handleTextProcess} className="w-full bg-green-600 text-white font-black py-4 rounded-xl shadow-lg uppercase text-xs hover:bg-green-500 transition border-b-4 border-green-800 active:translate-y-1 active:border-b-0">
                  <i className="fas fa-magic mr-2"></i> AUTO-FILL FROM DATA BOX
                </button>
              </div>

              <div className="space-y-6">
                {outlets.map((o) => (
                  <div key={o.id} className={`border-2 rounded-2xl overflow-hidden transition-all duration-300 ${o.isProductive ? 'border-green-300 shadow-xl bg-white' : 'border-slate-100 bg-slate-50'}`}>
                    <div className={`p-5 flex items-center justify-between ${o.isProductive ? 'bg-green-50/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-sm ${o.isProductive ? 'bg-green-600' : 'bg-slate-400'}`}>{o.name[0]}</div>
                        <div><h4 className="font-black text-slate-800 uppercase text-xs">{o.name}</h4><p className="text-[10px] text-slate-500 font-bold">{o.contactNo}</p></div>
                      </div>
                      <button onClick={() => setOutlets(outlets.map(x => x.id === o.id ? { ...x, isProductive: !x.isProductive } : x))} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition ${o.isProductive ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-slate-400 border shadow-sm'}`}>
                        {o.isProductive ? 'Productive ✓' : 'Non-Productive'}
                      </button>
                    </div>
                    {o.isProductive && (
                      <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 bg-slate-900 border-t-2 border-green-200">
                        {SKU_LIST.map(sku => (
                          <div key={sku.id} className="space-y-1">
                            <label className="text-[9px] font-black text-indigo-300 uppercase tracking-tighter">{sku.label}</label>
                            <input 
                              type="number" 
                              min="0" 
                              step="0.01"
                              value={o.skus[sku.id]} 
                              onChange={e => setOutlets(outlets.map(x => x.id === o.id ? { ...x, skus: { ...x.skus, [sku.id]: Math.max(0, parseFloat(e.target.value) || 0) } } : x))} 
                              className="w-full p-2 bg-slate-800 text-white border border-slate-700 rounded-lg text-sm font-bold focus:border-green-400 outline-none transition" 
                              placeholder="0" 
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-12 flex justify-between items-center border-t pt-8">
                <button onClick={() => setStep(ReportStep.TC_ENTRY)} className="font-black text-slate-400 uppercase text-xs tracking-widest hover:text-indigo-600 transition">Back to TC</button>
                <button onClick={() => setStep(ReportStep.F2_PREVIEW)} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl uppercase text-xs hover:bg-indigo-700 transition">VIEW F2 REPORT</button>
              </div>
            </div>
          )}

          {step === ReportStep.F2_PREVIEW && (
            <div className="p-8">
              <div className="mb-10 flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">F2 Daily Sales Report</h2>
                  <p className="text-slate-500 font-bold mt-1">Smart-verified quantities and rate-synced values.</p>
                </div>
                <button onClick={exportMasterReport} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs shadow-2xl uppercase border-b-4 border-indigo-600 hover:-translate-y-1 transition active:translate-y-0 active:border-b-0"><i className="fas fa-file-export mr-2"></i> EXPORT MASTER XLSX</button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-inner bg-white">
                <table className="w-full border-collapse min-w-[2500px]">
                  <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-tighter sticky top-0 z-20">
                    <tr>
                      <th className="p-4 border border-slate-700 bg-slate-900 sticky left-0 shadow-xl">Date</th>
                      <th className="p-4 border border-slate-700">Sales Person</th>
                      <th className="p-4 border border-slate-700">Desig.</th>
                      <th className="p-4 border border-slate-700">Manager</th>
                      <th className="p-4 border border-slate-700">City</th>
                      <th className="p-4 border border-slate-700">SS Name</th>
                      <th className="p-4 border border-slate-700">DB Name</th>
                      <th className="p-4 border border-slate-700">Beat</th>
                      <th className="p-4 border border-slate-700 bg-slate-900 sticky left-[60px] shadow-xl">Outlet Name</th>
                      <th className="p-4 border border-slate-700">Contact No.</th>
                      {SKU_LIST.map(s => <th key={s.id} className="p-4 border border-slate-700 text-center">{s.label}</th>)}
                      <th className="p-4 border border-slate-700 bg-emerald-900">Total Qty</th>
                      <th className="p-4 border border-slate-700 bg-emerald-900">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold divide-y">
                    {f2Data.map((r, i) => (
                      <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/50 transition-colors`}>
                        <td className="p-4 border bg-inherit sticky left-0 shadow-sm">{r.date}</td>
                        <td className="p-4 border">{r.salesPerson}</td>
                        <td className="p-4 border">{r.desig}</td>
                        <td className="p-4 border">{r.manager}</td>
                        <td className="p-4 border">{r.city}</td>
                        <td className="p-4 border">{r.ss}</td>
                        <td className="p-4 border">{r.dbName}</td>
                        <td className="p-4 border font-black text-indigo-700 uppercase">{r.beatName}</td>
                        <td className="p-4 border font-black uppercase bg-inherit sticky left-[60px] shadow-sm">{r.name}</td>
                        <td className="p-4 border">{r.contactNo}</td>
                        {SKU_LIST.map(s => <td key={s.id} className={`p-4 border text-center font-black ${r.skus[s.id] > 0 ? 'text-indigo-600 bg-indigo-50/40' : 'text-slate-300'}`}>{r.skus[s.id] || '-'}</td>)}
                        <td className="p-4 border text-center bg-emerald-50 text-emerald-800 font-black">{r.totalQuantity}</td>
                        <td className="p-4 border text-right bg-emerald-50 text-emerald-800 font-black whitespace-nowrap">₹{r.totalValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-12 flex justify-center">
                <button onClick={() => setStep(ReportStep.F1_PREVIEW)} className="bg-indigo-900 text-white px-16 py-5 rounded-2xl font-black shadow-2xl uppercase tracking-widest hover:scale-105 transition-transform">FINALIZE & VIEW F1 SUMMARY</button>
              </div>
            </div>
          )}

          {step === ReportStep.F1_PREVIEW && (
            <div className="p-8">
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight">F1 Time-Slot Summary</h2>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Automated 30%:40%:30% Ratio Logic</p>
              </div>

              <div className="max-w-4xl mx-auto overflow-hidden rounded-3xl border-8 border-slate-50 shadow-2xl mb-12">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                    <tr><th className="p-6">DATE</th><th className="p-6">TIME</th><th className="p-6">Name of SO/TSI</th><th className="p-6 text-center">TC</th><th className="p-6 text-center">PC</th><th className="p-6 text-center">SALES IN BOX</th><th className="p-6 text-right">SALES VALUE</th><th className="p-6">DB Confirmation...</th><th className="p-6">OPENING KM</th><th className="p-6">CLOSING KM</th></tr>
                  </thead>
                  <tbody className="text-sm font-black divide-y">
                    {f1Data.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6">{r.date}</td>
                        <td className="p-6"><span className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-[10px] shadow-sm">{r.timeSlot}</span></td>
                        <td className="p-6 text-slate-500 uppercase">{r.name}</td>
                        <td className="p-6 text-center text-slate-400 font-mono">{r.tc}</td>
                        <td className="p-6 text-center text-green-600 font-mono">{r.pc}</td>
                        <td className="p-6 text-center font-mono">{r.salesInBox.toFixed(2)}</td>
                        <td className="p-6 text-right text-emerald-700 font-black">₹{r.salesValue.toLocaleString()}</td>
                        <td className="p-6 text-center text-slate-400 text-[10px]">{r.dbConfirmation}</td>
                        {/* KM Columns are intentionally empty as per user request */}
                        <td className="p-6 text-center text-slate-300 italic">{r.openingKm || "-"}</td>
                        <td className="p-6 text-center text-slate-300 italic">{r.closingKm || "-"}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-900 text-white font-black uppercase italic">
                      <td colSpan={3} className="p-6 text-right tracking-widest">GRAND TOTAL</td>
                      <td className="p-6 text-center">{f1Data.reduce((a: number, b: F1Row) => a + b.tc, 0)}</td>
                      <td className="p-6 text-center text-green-400">{f1Data.reduce((a: number, b: F1Row) => a + b.pc, 0)}</td>
                      <td className="p-6 text-center">{f1Data.reduce((a: number, b: F1Row) => a + b.salesInBox, 0).toFixed(2)}</td>
                      <td className="p-6 text-right text-indigo-300">₹{f1Data.reduce((a: number, b: F1Row) => a + b.salesValue, 0).toLocaleString()}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="text-center p-12 bg-indigo-900 rounded-3xl text-white shadow-2xl">
                <i className="fas fa-check-double text-6xl text-indigo-400 mb-6 animate-pulse"></i>
                <h3 className="text-2xl font-black uppercase mb-2 tracking-widest">Reports Finalized</h3>
                <p className="text-indigo-200 font-bold mb-10 opacity-90 italic">Data accurately extracted and distributed.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
                  <button onClick={copyWhatsAppSummary} className="bg-green-600 text-white px-6 py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest hover:bg-green-500 transition-all border-b-4 border-green-800 active:translate-y-1 active:border-b-0 text-[10px] flex items-center justify-center gap-2"><i className="fab fa-whatsapp text-lg"></i> WHATSAPP SUMMARY</button>
                  
                  <button onClick={exportMasterReport} className="bg-white text-indigo-900 px-6 py-5 rounded-2xl font-black shadow-xl uppercase tracking-widest border-b-4 border-slate-200 hover:scale-105 transition-all text-[10px] flex items-center justify-center gap-2"><i className="fas fa-file-excel text-lg"></i> MASTER EXCEL</button>

                  <button onClick={handleReset} className="px-6 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-indigo-500 hover:bg-indigo-800 transition-colors flex items-center justify-center gap-2">NEW REPORT</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <footer className="bg-slate-900 p-8 text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] border-t-8 border-indigo-600">
        Professional Senior Sales Operations Analyst Tool v7.5 | STRICT Corporate Formatting Active
      </footer>
    </div>
  );
}
