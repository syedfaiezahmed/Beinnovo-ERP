const { GoogleGenerativeAI } = require('@google/generative-ai');
const Account = require('../models/Account');
const Partner = require('../models/Partner');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');
const Transaction = require('../models/Transaction');
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const Lead = require('../models/Lead');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const pendingTransactions = new Map();

const getPendingKey = (context) => {
    const tenantPart = context && context.tenantId ? String(context.tenantId) : 'noTenant';
    const userPart = context && context.userId ? String(context.userId) : 'noUser';
    return `${tenantPart}:${userPart}`;
};

let genAI = null;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

const callGemini = async (fullPrompt, userPromptOnly) => {
    if (!genAI) throw new Error('Gemini API Key is missing');
    
    try {
        const modelName = 'gemini-2.0-flash'; 
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 512,
                topP: 0.8,
                topK: 40
            }
        });
        const result = await model.generateContent(fullPrompt);
        const text = result.response.text();
        return text;
    } catch (error) {
        console.error('Gemini API Error:', error);
        
        // --- MOCK FALLBACK FOR OFFLINE/DEV MODE ---
        console.log('⚠️ Switching to Rules-Based AI Fallback (Offline/Dev Mode)');
        
        const lowerPrompt = (userPromptOnly || '').toLowerCase();
        
        if (lowerPrompt === 'hi' || lowerPrompt === 'hello' || lowerPrompt === 'hey' || lowerPrompt === 'salam' || lowerPrompt === 'salaam' || lowerPrompt.includes('kya haal')) {
             return JSON.stringify({
                intent: 'general_chat',
                readyToExecute: false,
                data: {},
                message: "Please enter a business transaction to record."
            });
        }
        
        if (lowerPrompt.includes('help') || lowerPrompt.includes('what can you do') || lowerPrompt.includes('explain invoice') || lowerPrompt.includes('explain bill')) {
             return JSON.stringify({
                intent: 'general_chat',
                readyToExecute: false,
                data: {},
                message: "Please enter a business transaction to record."
            });
        }

        // Purchase Order (Pre-Transaction) – Only when user explicitly mentions PO / purchase order
        if (
            lowerPrompt.includes('purchase order') ||
            lowerPrompt.includes(' create po') ||
            lowerPrompt.startsWith('po ') ||
            lowerPrompt.includes(' po for') ||
            lowerPrompt.includes('order goods') ||
            lowerPrompt.includes('send order to vendor')
        ) {
            let qty = 1;
            let unitPrice = null;

            const qtyMatch = lowerPrompt.match(/(\d+)\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)/i);
            if (qtyMatch) {
                qty = parseFloat(qtyMatch[1]);
            }

            const unitPriceMatch =
                lowerPrompt.match(/(?:at|@)\s*(\d+(\.\d+)?)/i) ||
                lowerPrompt.match(/(\d+(\.\d+)?)\s*(pkr|rs|inr|rupees)/i);
            if (unitPriceMatch) {
                unitPrice = parseFloat(unitPriceMatch[1]);
            }

            let extractedProduct = "Item";
            let cleanPrompt = lowerPrompt
                .replace(/purchase order|po|create|make|order goods|send order to vendor|for|to|from|vendor|supplier/g, '')
                .replace(/@\s*\d+/g, '')
                .replace(/\d+\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)/g, '')
                .replace(/\d+/g, '')
                .replace(/[^\w\s]/g, '')
                .replace(/\bsku\b/g, '')
                .trim();

            if (cleanPrompt.length > 2) {
                extractedProduct = cleanPrompt.replace(/\b\w/g, c => c.toUpperCase());
            }

            let supplierName = null;
            const supplierMatch =
                lowerPrompt.match(/for\s+([a-zA-Z\s]+?)(?:\s+sku\b|\s+at\b|$)/i) ||
                lowerPrompt.match(/to\s+([a-zA-Z\s]+?)(?:\s+sku\b|\s+at\b|$)/i) ||
                lowerPrompt.match(/supplier\s+(?:is\s+)?([a-zA-Z\s]+?)(?:\s+sku\b|\s+at\b|$)/i);
            if (supplierMatch) {
                supplierName = supplierMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
            }

            let skuValue = null;
            const skuMatch = lowerPrompt.match(/sku\s*(?:is|=|:)?\s*([a-zA-Z0-9\-]+)/i);
            if (skuMatch) {
                skuValue = skuMatch[1].trim();
            }

            const items = [];
            if (unitPrice != null && qty > 0) {
                items.push({
                    productName: extractedProduct,
                    description: userPromptOnly,
                    quantity: qty,
                    unitPrice: unitPrice,
                    sku: skuValue || undefined,
                    lineTotal: qty * unitPrice
                });
            }

            if (items.length) {
                const poTotal = items.reduce((sum, it) => sum + (it.lineTotal || 0), 0);
                return JSON.stringify({
                    intent: 'create_purchase_order',
                    readyToExecute: true,
                    data: {
                        supplierName,
                        date: new Date().toISOString().split('T')[0],
                        expectedDeliveryDate: null,
                        items,
                        currency: 'PKR'
                    },
                    message: `Purchase Order detected: ${items[0].quantity} × ${items[0].unitPrice} = ${poTotal} PKR for ${supplierName || 'Unknown Supplier'}. No accounting or inventory entries will be posted until goods are received.`
                });
            }
        }

        // Convert PO -> Bill (Goods Received)
        if (
            lowerPrompt.includes('receive goods') ||
            lowerPrompt.includes('goods received') ||
            lowerPrompt.includes('convert po to bill') ||
            lowerPrompt.includes('convert purchase order')
        ) {
            const poMatch = lowerPrompt.match(/(po[-\s]?\d{4}-\d{3,4})/i);
            const poNumberRaw = poMatch ? poMatch[1] : null;
            const poNumber = poNumberRaw
                ? poNumberRaw.replace(/\s+/g, '-').toUpperCase()
                : null;

            return JSON.stringify({
                intent: 'convert_po_to_bill',
                readyToExecute: !!poNumber,
                data: {
                    poNumber: poNumber || undefined
                },
                message: poNumber
                    ? `Goods received against ${poNumber}. Ready to convert Purchase Order to Bill with full accounting and inventory update.`
                    : 'Please provide the Purchase Order number (e.g., PO-2025-0001) to convert it to a bill.'
            });
        }

        if (lowerPrompt.includes('invest') || lowerPrompt.includes('capital') || lowerPrompt.includes('started business') || lowerPrompt.includes('funding')) {
            const amountMatch = lowerPrompt.match(/(\d+)(\s*lac)?/);
            let amount = 0;
            if (amountMatch) {
                const num = parseInt(amountMatch[1]);
                if (amountMatch[2] && amountMatch[2].trim() === 'lac') {
                    amount = num * 100000;
                } else {
                    amount = num;
                }
            }
            
            return JSON.stringify({
                intent: 'create_journal',
                readyToExecute: true,
                data: {
                    description: "Capital Investment",
                    date: new Date().toISOString().split('T')[0],
                    entries: [
                        { accountCode: "101", debit: amount, credit: 0 },
                        { accountCode: "301", debit: 0, credit: amount }
                    ]
                },
                message: `Transaction Detected:\n• Type: Capital Investment\n• Amount: ${amount}\n• Mode (Cash / Credit): Cash\n• Party: Owner\n\nAccounting Entry:\n• Debit: Cash (101) ${amount}\n• Credit: Capital (301) ${amount}\n\nInventory Update:\n• Stock In / Stock Out: None\n• Quantity Impact: None\n\nCRM Update:\n• Customer / Supplier: None\n• Balance Updated: None\n\nHR Update:\n• Employee (if applicable): None\n\nStatus:\nTransaction recorded successfully.`
            });
        }

        if (
            (lowerPrompt.includes('rent') ||
                lowerPrompt.includes('expense') ||
                lowerPrompt.includes('utility') ||
                lowerPrompt.includes('bill')) &&
            !lowerPrompt.includes('salary') &&
            !lowerPrompt.includes('payroll')
        ) {
            const amountMatch = lowerPrompt.match(/(\d+)(\s*lac)?/);
            let amount = 0;
            if (amountMatch) {
                const num = parseInt(amountMatch[1]);
                if (amountMatch[2] && amountMatch[2].trim() === 'lac') {
                    amount = num * 100000;
                } else {
                    amount = num;
                }
            }

            // Determine Expense Account Code (Mock logic)
            let expenseCode = "506"; // General Expense
            let expenseName = "General Expense";
            
            if (lowerPrompt.includes('rent')) { expenseCode = "502"; expenseName = "Rent Expense"; }
            else if (lowerPrompt.includes('utility') || lowerPrompt.includes('electric')) { expenseCode = "503"; expenseName = "Utilities Expense"; }

            if (amount > 0) {
                return JSON.stringify({
                    intent: 'create_journal',
                    readyToExecute: true,
                    data: {
                        description: userPromptOnly || "Expense Payment",
                        date: new Date().toISOString().split('T')[0],
                        entries: [
                            { accountCode: expenseCode, accountName: expenseName, debit: amount, credit: 0 },
                            { accountCode: "101", accountName: "Cash", debit: 0, credit: amount }
                        ]
                    },
                    message: `Expense payment of ${amount} detected for ${expenseName}.`
                });
            }
        }

        if (
            (lowerPrompt.includes('purchase') ||
                lowerPrompt.includes('purchased') ||
                lowerPrompt.includes('buy') ||
                lowerPrompt.includes('bought') ||
                lowerPrompt.includes('inventory') ||
                lowerPrompt.includes('stock')) &&
            !lowerPrompt.includes('purchase order') &&
            !lowerPrompt.includes(' po ')
        ) {
             let amount = 0;
             let qty = 1;
             let unitPrice = null;

             const qtyForwardMatch = lowerPrompt.match(/(\d+)\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)/i);
             const qtyReverseMatch = !qtyForwardMatch
                 ? lowerPrompt.match(/(units?|unit|pieces?|pc|pcs|items?|qty|quantity)\s*(?:are|is|:)?\s*(\d+)/i)
                 : null;
             if (qtyForwardMatch) {
                 qty = parseFloat(qtyForwardMatch[1]);
             } else if (qtyReverseMatch) {
                 qty = parseFloat(qtyReverseMatch[2]);
             }

             const unitPriceMatch =
                 lowerPrompt.match(/(?:at|@)\s*(\d+(\.\d+)?)/i) ||
                 lowerPrompt.match(/(\d+(\.\d+)?)\s*(pkr|rs|inr|rupees)/i) ||
                 lowerPrompt.match(/(\d+(\.\d+)?)\s*(per\s*unit|per\s*piece|per\s*pc|per\s*kg|per\s*item)/i);
             if (unitPriceMatch) {
                 unitPrice = parseFloat(unitPriceMatch[1]);
             }

             if ((qtyForwardMatch || qtyReverseMatch) && unitPriceMatch) {
                 amount = qty * unitPrice;
             } else {
                 const amountMatch = lowerPrompt.match(/(\d+(\.\d+)?)(\s*lac)?/);
                 if (amountMatch) {
                     const base = parseFloat(amountMatch[1]);
                     amount = amountMatch[3] && amountMatch[3].trim() === 'lac' ? base * 100000 : base;
                 }
             }

             let extractedProduct = "Inventory Item";
             let purchaseIndex = -1;
             const purchaseKeywords = ['purchase ', 'purchased ', 'buy ', 'bought '];
             for (const kw of purchaseKeywords) {
                 const idx = lowerPrompt.indexOf(kw);
                 if (idx !== -1 && (purchaseIndex === -1 || idx < purchaseIndex)) {
                     purchaseIndex = idx;
                 }
             }
             let afterText = lowerPrompt;
             if (purchaseIndex >= 0) {
                 afterText = lowerPrompt.slice(purchaseIndex);
                 afterText = afterText.replace(/^(purchase|purchased|buy|bought)\s+/, '');
             }
             let endIdx = afterText.length;
             const cutTokens = [' at ', ' @', ' per unit', ' per ', ' from ', ' supplier ', ' vendor '];
             for (const token of cutTokens) {
                 const idx = afterText.indexOf(token);
                 if (idx !== -1 && idx < endIdx) {
                     endIdx = idx;
                 }
             }
             let productRaw = afterText.slice(0, endIdx).trim();
             let productClean = productRaw
                 .replace(/^\d+\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)\s*(of\s+)?/i, '')
                 .replace(/\d+\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)\s*$/i, '')
                 .replace(/\bsku\s*[a-zA-Z0-9\-]+\b/gi, '')
                 .replace(/[^\w\s]/g, '')
                 .trim();
             if (productClean.length > 2) {
                 extractedProduct = productClean.replace(/\b\w/g, c => c.toUpperCase());
             }

             let vendorName = null;
             const vendorFromMatch = lowerPrompt.match(/from\s+([a-zA-Z\s]+?)(?:\s+and|\s+sku\b|$)/i);
             if (vendorFromMatch) {
                 vendorName = vendorFromMatch[1].replace(/purchase|buy|bought|stock|inventory/gi, '').trim();
             }

             if (!vendorName) {
                 const vendorKeywordMatch = lowerPrompt.match(/vendor\s+(?:is\s+)?([a-zA-Z\s]+?)(?:\s+and|\s+sku\b|$)/i) 
                     || lowerPrompt.match(/supplier\s+(?:is\s+)?([a-zA-Z\s]+?)(?:\s+and|\s+sku\b|$)/i);
                 if (vendorKeywordMatch) {
                     vendorName = vendorKeywordMatch[1].trim();
                 }
             }

             if (vendorName) {
                 vendorName = vendorName.replace(/\b\w/g, c => c.toUpperCase());
                 if (vendorName.length < 2) vendorName = null;
             }

             let skuValue = null;
             const skuMatch = lowerPrompt.match(/sku\s*(?:is|=|:)?\s*([a-zA-Z0-9\-]+)/i);
             if (skuMatch) {
                 skuValue = skuMatch[1].trim();
             }

             let paymentMethod = "Credit";
            if (lowerPrompt.includes('cash') || lowerPrompt.includes('paid')) {
                 paymentMethod = "Cash";
             }

             if (amount > 0) {
                 return JSON.stringify({
                     intent: 'create_bill', 
                     readyToExecute: true,
                     data: {
                         partnerName: vendorName, 
                         date: new Date().toISOString().split('T')[0],
                         paymentMethod: paymentMethod,
                        items: [
                            {
                                productName: extractedProduct,
                                description: userPromptOnly,
                                quantity: qty,
                                price: amount / qty,
                                accountCode: "140",
                                sku: skuValue || undefined
                            }
                        ]
                    },
                    message: `Inventory purchase of ${amount} detected for ${vendorName || 'Unknown Vendor'}.`
                 });
            }
        }

             if (
                 lowerPrompt.includes('sold') ||
                 lowerPrompt.includes(' sale') ||
                 lowerPrompt.includes('sell ') ||
                 lowerPrompt.includes('invoice customer')
             ) {
                  const qtyForwardMatch = lowerPrompt.match(/(\d+)\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)/i);
                  const qtyReverseMatch = !qtyForwardMatch
                      ? lowerPrompt.match(/(units?|unit|pieces?|pc|pcs|items?|qty|quantity)\s*(?:are|is|was|were|:)?\s*(\d+)/i)
                      : null;
                  let qty = 1;
                  if (qtyForwardMatch) {
                      qty = parseFloat(qtyForwardMatch[1]);
                  } else if (qtyReverseMatch) {
                      qty = parseFloat(qtyReverseMatch[2]);
                  }

                  let unitPrice = null;
                  const unitPriceMatch =
                      lowerPrompt.match(/(?:at|@)\s*(\d+(\.\d+)?)/i) ||
                      lowerPrompt.match(/(\d+(\.\d+)?)\s*(pkr|rs|inr|rupees)/i) ||
                      lowerPrompt.match(/(\d+(\.\d+)?)\s*(per\s*unit|per\s*piece|per\s*pc|per\s*kg|per\s*item)/i);
                  if (unitPriceMatch) {
                      unitPrice = parseFloat(unitPriceMatch[1]);
                  }

                  let amount = 0;
                  if ((qtyForwardMatch || qtyReverseMatch) && unitPriceMatch) {
                      amount = qty * unitPrice;
                  }

                  let extractedProduct = "Service/Item";
                  let soldIndex = -1;
                  const saleKeywords = ['sold ', ' sale', 'sell ', 'invoice customer '];
                  for (const kw of saleKeywords) {
                      const idx = lowerPrompt.indexOf(kw);
                      if (idx !== -1 && (soldIndex === -1 || idx < soldIndex)) {
                          soldIndex = idx;
                      }
                  }
                  let afterText = lowerPrompt;
                  if (soldIndex >= 0) {
                      afterText = lowerPrompt.slice(soldIndex);
                      afterText = afterText.replace(/^(sold|sale|sell|invoice customer)\s+/, '');
                  }
                  let endIdx = afterText.length;
                  const cutTokens = [' at ', ' @', ' per unit', ' per ', ' to ', ' customer ', ' sku ', ' on cash', ' on credit'];
                  for (const token of cutTokens) {
                      const idx = afterText.indexOf(token);
                      if (idx !== -1 && idx < endIdx) {
                          endIdx = idx;
                      }
                  }
                  let productRaw = afterText.slice(0, endIdx).trim();
                  let productClean = productRaw
                      .replace(/^\d+\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)\s*(of\s+)?/i, '')
                      .replace(/\d+\s*(units?|unit|pieces?|pc|pcs|items?|qty|quantity)\s*$/i, '')
                      .replace(/\bsku\s*[a-zA-Z0-9\-]+\b/gi, '')
                      .replace(/[^\w\s]/g, '')
                      .trim();
                  if (productClean.length > 2) {
                      extractedProduct = productClean.replace(/\b\w/g, c => c.toUpperCase());
                  }

                  let customerName = null;
                  const customerMatch = lowerPrompt.match(/to\s+([a-zA-Z\s]+)/i);
                  if (customerMatch) {
                      customerName = customerMatch[1].replace(/sold|sell|sale|customer|invoice/gi, '').trim();
                      if (customerName.length < 2) customerName = null;
                      else customerName = customerName.replace(/\b\w/g, c => c.toUpperCase());
                  }

                  let skuValue = null;
                  const skuMatch = lowerPrompt.match(/sku\s*(?:is|=|:)?\s*([a-zA-Z0-9\-]+)/i);
                  if (skuMatch) {
                      skuValue = skuMatch[1].trim();
                  }

                  let paymentMethod = "Credit";
                  if (lowerPrompt.includes('on cash') || lowerPrompt.includes('cash sale')) {
                      paymentMethod = "Cash";
                  } else if (lowerPrompt.includes('on credit') || lowerPrompt.includes('credit sale')) {
                      paymentMethod = "Credit";
                  }

                  if (qty > 0 || unitPrice != null || customerName || skuValue) {
                      return JSON.stringify({
                          intent: 'create_invoice',
                          readyToExecute: true,
                          data: {
                              partnerName: customerName,
                              date: new Date().toISOString().split('T')[0],
                              paymentMethod,
                              items: [
                                  {
                                      productName: extractedProduct,
                                      description: userPromptOnly,
                                      quantity: qty,
                                      price: unitPrice != null ? unitPrice : undefined,
                                      accountCode: "401",
                                      sku: skuValue || undefined
                                  }
                              ]
                          },
                          message: amount > 0
                              ? `Sale of ${amount} detected for customer ${customerName || 'Unknown Customer'}.`
                              : `Sales transaction detected for customer ${customerName || 'Unknown Customer'}.`
                      });
                  }
             }

        if (lowerPrompt.includes('gj') || lowerPrompt.includes('journal') || lowerPrompt.includes('record')) {
             return JSON.stringify({
                intent: 'create_journal',
                readyToExecute: false,
                data: {},
                message: "Please provide debit and credit lines including account codes and amounts."
             });
        }

        if (lowerPrompt.includes('invoice')) {
            return JSON.stringify({
                intent: 'create_invoice',
                readyToExecute: false,
                data: {},
                message: "Please provide the customer name and item details to create the invoice."
            });
        }
        if (lowerPrompt.includes('bill')) {
            return JSON.stringify({
                intent: 'create_bill',
                readyToExecute: false,
                data: {},
                message: "Please provide the vendor name and item details to create the bill."
            });
        }
        
        return JSON.stringify({
             intent: 'general_chat',
             readyToExecute: false,
             data: {},
             message: "Please enter a business transaction to record."
        });
    }
};

const safeJsonParse = (text) => {
    try {
        const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('JSON Parse Error:', e);
        return null;
    }
};

const enforceRequiredFields = (response, userPrompt, context) => {
    if (!response || typeof response !== 'object') return response;
    if (!response.data || typeof response.data !== 'object') return response;
    if (!response.intent || response.readyToExecute === false) return response;

    const r = { ...response };
    const data = { ...r.data };
    const intent = r.intent;
    const missing = [];

    if (intent === 'create_invoice') {
        const items = Array.isArray(data.items) ? data.items : [];
        if (!data.partnerName || !String(data.partnerName).trim()) missing.push('customer name');
        if (!items.length) {
            missing.push('item details');
        } else {
            const item = items[0] || {};
            if (!(item.productName && String(item.productName).trim()) && !(item.description && String(item.description).trim())) {
                missing.push('product or goods name');
            }
            if (!item.quantity || Number(item.quantity) <= 0) {
                missing.push('quantity');
            }
            if (!item.price || Number(item.price) <= 0) {
                missing.push('price or amount');
            }
            if (!item.sku || !String(item.sku).trim()) {
                missing.push('sku');
            }
        }
        if (!data.paymentMethod || !String(data.paymentMethod).trim()) {
            missing.push('cash or credit');
        }
    } else if (intent === 'create_bill') {
        const items = Array.isArray(data.items) ? data.items : [];
        if (!data.partnerName || !String(data.partnerName).trim()) missing.push('supplier name');
        if (!items.length) {
            missing.push('item details');
        } else {
            const item = items[0] || {};
            if (!(item.productName && String(item.productName).trim()) && !(item.description && String(item.description).trim())) {
                missing.push('product or inventory name');
            }
            if (!item.quantity || Number(item.quantity) <= 0) {
                missing.push('quantity');
            }
            if (!item.price || Number(item.price) <= 0) {
                missing.push('cost price or amount');
            }
            if (!item.sku || !String(item.sku).trim()) {
                missing.push('sku');
            }
        }
        if (!data.paymentMethod || !String(data.paymentMethod).trim()) {
            missing.push('cash or credit');
        }
    } else if (intent === 'receive_payment' || intent === 'pay_bill') {
        if (!data.partnerName || !String(data.partnerName).trim()) {
            missing.push('party name');
        }
        if (!data.amount || Number(data.amount) <= 0) {
            missing.push('amount');
        }
        if (!data.method || !String(data.method).trim()) {
            missing.push('cash or credit');
        }
    } else if (intent === 'run_payroll') {
        if (!data.month || !String(data.month).trim()) {
            missing.push('month');
        }
        if (!data.year || !String(data.year).trim()) {
            missing.push('year');
        }
    } else if (intent === 'record_salary_payment') {
        if (!data.employeeName || !String(data.employeeName).trim()) {
            missing.push('employee name');
        }
        if (!data.amount || Number(data.amount) <= 0) {
            missing.push('salary amount');
        }
        if (!data.salaryType || !String(data.salaryType).trim()) {
            missing.push('salary type');
        }
        if (!data.paymentMethod || !String(data.paymentMethod).trim()) {
            missing.push('cash or credit');
        }
        if (!data.period || !String(data.period).trim()) {
            missing.push('salary period');
        }
    } else if (intent === 'create_purchase_order') {
        const items = Array.isArray(data.items) ? data.items : [];
        if (!data.supplierName || !String(data.supplierName).trim()) {
            missing.push('supplier name');
        }
        if (!items.length) {
            missing.push('item details');
        } else {
            const item = items[0] || {};
            if (!(item.productName && String(item.productName).trim())) {
                missing.push('product name');
            }
            if (!item.quantity || Number(item.quantity) <= 0) {
                missing.push('quantity');
            }
            if (!item.unitPrice || Number(item.unitPrice) <= 0) {
                missing.push('unit price');
            }
            if (!item.sku || !String(item.sku).trim()) {
                missing.push('sku');
            }
        }
    } else if (intent === 'convert_po_to_bill') {
        if (!data.poNumber || !String(data.poNumber).trim()) {
            missing.push('po number');
        }
    }

    if (!missing.length) {
        if (intent === 'create_purchase_order') {
            const hasExpectedDelivery =
                data.expectedDeliveryDate != null &&
                String(data.expectedDeliveryDate).trim() !== '';
            if (!hasExpectedDelivery) {
                const baseMessage = r.message || '';
                const suffix = '\n(Optional) You can also provide an expected delivery date for this Purchase Order.';
                r.message = baseMessage.includes(suffix) ? baseMessage : baseMessage + suffix;
            }
        }
        return r;
    }

    const primaryMissing = missing[0];
    let status = null;
    if (intent === 'create_bill' && primaryMissing === 'supplier name') {
        status = 'waiting_for_supplier';
    } else if (intent === 'create_bill' && primaryMissing === 'product or inventory name') {
        status = 'waiting_for_bill_product';
    } else if (intent === 'create_bill' && primaryMissing === 'quantity') {
        status = 'waiting_for_bill_quantity';
    } else if (intent === 'create_bill' && primaryMissing === 'cost price or amount') {
        status = 'waiting_for_bill_price';
    } else if (intent === 'create_bill' && primaryMissing === 'item details') {
        status = 'waiting_for_bill_item';
    } else if (intent === 'create_invoice' && primaryMissing === 'customer name') {
        status = 'waiting_for_customer';
    } else if (intent === 'create_invoice' && primaryMissing === 'product or goods name') {
        status = 'waiting_for_invoice_product';
    } else if (intent === 'create_invoice' && primaryMissing === 'quantity') {
        status = 'waiting_for_invoice_quantity';
    } else if (intent === 'create_invoice' && primaryMissing === 'price or amount') {
        status = 'waiting_for_invoice_price';
    } else if (intent === 'create_invoice' && primaryMissing === 'item details') {
        status = 'waiting_for_invoice_item';
    } else if ((intent === 'receive_payment' || intent === 'pay_bill') && primaryMissing === 'party name') {
        status = 'waiting_for_party';
    } else if (primaryMissing === 'cash or credit') {
        status = 'waiting_for_payment_method';
    } else if (intent === 'run_payroll' && primaryMissing === 'month') {
        status = 'waiting_for_payroll_month';
    } else if (intent === 'run_payroll' && primaryMissing === 'year') {
        status = 'waiting_for_payroll_year';
    } else if (intent === 'record_salary_payment' && primaryMissing === 'employee name') {
        status = 'waiting_for_salary_employee';
    } else if (intent === 'record_salary_payment' && primaryMissing === 'salary amount') {
        status = 'waiting_for_salary_amount';
    } else if (intent === 'record_salary_payment' && primaryMissing === 'salary type') {
        status = 'waiting_for_salary_type';
    } else if (intent === 'record_salary_payment' && primaryMissing === 'salary period') {
        status = 'waiting_for_salary_period';
    } else if ((intent === 'create_bill' || intent === 'create_invoice') && primaryMissing === 'sku') {
        status = 'waiting_for_sku';
    } else if (intent === 'create_purchase_order' && primaryMissing === 'supplier name') {
        status = 'waiting_for_po_supplier';
    } else if (intent === 'create_purchase_order' && primaryMissing === 'product name') {
        status = 'waiting_for_po_product';
    } else if (intent === 'create_purchase_order' && primaryMissing === 'quantity') {
        status = 'waiting_for_po_quantity';
    } else if (intent === 'create_purchase_order' && primaryMissing === 'unit price') {
        status = 'waiting_for_po_price';
    } else if (intent === 'create_purchase_order' && primaryMissing === 'sku') {
        status = 'waiting_for_po_sku';
    } else if (intent === 'create_purchase_order' && primaryMissing === 'item details') {
        status = 'waiting_for_po_item';
    } else if (intent === 'convert_po_to_bill' && primaryMissing === 'po number') {
        status = 'waiting_for_po_number';
    }

    if (status && context) {
        const key = getPendingKey(context);

        let itemName = null;
        let quantity = null;
        let unitPrice = null;
        let total = null;

        if (Array.isArray(data.items) && data.items.length > 0) {
            const item = data.items[0] || {};
            itemName = item.productName || item.description || null;
            if (item.quantity != null) quantity = Number(item.quantity);
            if (item.price != null) {
                unitPrice = Number(item.price);
            } else if (item.unitPrice != null) {
                unitPrice = Number(item.unitPrice);
            }
            if (quantity != null && unitPrice != null) {
                total = quantity * unitPrice;
            }
        }

        pendingTransactions.set(key, {
            intent,
            data,
            status,
            missing,
            summary: {
                item: itemName,
                quantity,
                unit_price: unitPrice,
                total
            }
        });
    }

    let message = 'Missing required information. Please provide the requested value.';
    if (primaryMissing === 'supplier name') {
        message = 'Supplier name is missing. Please provide supplier name.';
    } else if (primaryMissing === 'customer name') {
        message = 'Customer name is missing. Please provide customer name.';
    } else if (primaryMissing === 'product or inventory name' || primaryMissing === 'product or goods name') {
        message = 'Item name is missing. Please provide item name.';
    } else if (primaryMissing === 'quantity') {
        if (intent === 'create_bill') {
            message = 'Please specify quantity purchased.';
        } else if (intent === 'create_invoice') {
            message = 'Please specify quantity sold.';
        } else {
            message = 'Quantity is missing. Please provide quantity.';
        }
    } else if (primaryMissing === 'cost price or amount' || primaryMissing === 'price or amount') {
        if (intent === 'create_bill') {
            message = 'Unit price is missing. Please provide unit price.';
        } else if (intent === 'create_invoice') {
            message = 'Unit selling price is missing. Please provide unit price.';
        } else {
            message = 'Unit price is missing. Please provide unit price or amount.';
        }
    } else if (primaryMissing === 'cash or credit') {
        message = 'Payment method is missing. Please specify Cash or Credit.';
    } else if (primaryMissing === 'party name') {
        message = 'Party name is missing. Please provide party name.';
    } else if (primaryMissing === 'month') {
        message = 'Month is missing. Please provide month.';
    } else if (primaryMissing === 'year') {
        message = 'Year is missing. Please provide year.';
    } else if (primaryMissing === 'employee name') {
        message = 'Employee name is missing. Please provide employee name.';
    } else if (primaryMissing === 'salary amount') {
        message = 'Salary amount is missing. Please provide salary amount.';
    } else if (primaryMissing === 'salary type') {
        message = 'Salary type is missing. Please specify Monthly or Advance.';
    } else if (primaryMissing === 'salary period') {
        message = 'Salary period is missing. Please provide month and year (e.g., January 2025).';
    } else if (primaryMissing === 'sku') {
        const itemLabel = (Array.isArray(data.items) && data.items[0] && (data.items[0].productName || data.items[0].description)) || 'this product';
        message = `SKU is missing for product "${itemLabel}". Please provide SKU.`;
    } else if (primaryMissing === 'product name') {
        message = 'Product name is missing for the Purchase Order. Please provide product name.';
    } else if (primaryMissing === 'unit price') {
        message = 'Unit price is missing for the Purchase Order. Please provide unit price.';
    } else if (primaryMissing === 'item details') {
        message = 'Item details are missing for the Purchase Order. Please provide product, quantity, price and SKU.';
    } else if (primaryMissing === 'po number') {
        message = 'PO Number is missing. Please provide the Purchase Order number (e.g., PO-2025-0001).';
    }

    return {
        ...r,
        intent: 'general_chat',
        readyToExecute: false,
        data: {},
        message
    };
};

const resolvePendingTransaction = (pending, userPrompt) => {
    if (!pending || !pending.intent || !pending.data) return null;
    const answer = (userPrompt || '').trim();
    if (!answer) {
        return {
            intent: 'general_chat',
            confidence: 1,
            readyToExecute: false,
            data: {},
            message: 'Please provide the requested information.'
        };
    }

    const data = { ...pending.data };

    if (pending.status === 'waiting_for_supplier' || pending.status === 'waiting_for_customer' || pending.status === 'waiting_for_party') {
        data.partnerName = answer;
    } else if (pending.status === 'waiting_for_month' || pending.status === 'waiting_for_payroll_month') {
        data.month = answer;
    } else if (pending.status === 'waiting_for_payroll_year') {
        data.year = answer;
    } else if (pending.status === 'waiting_for_salary_employee') {
        data.employeeName = answer;
    } else if (pending.status === 'waiting_for_salary_amount') {
        const amt = Number(answer);
        data.amount = isNaN(amt) ? data.amount : amt;
    } else if (pending.status === 'waiting_for_salary_type') {
        const lower = answer.toLowerCase();
        if (lower.includes('advance')) {
            data.salaryType = 'Advance';
        } else if (lower.includes('month')) {
            data.salaryType = 'Monthly';
        } else {
            data.salaryType = answer;
        }
    } else if (pending.status === 'waiting_for_salary_period') {
        data.period = answer;
    } else if (pending.status === 'waiting_for_sku') {
        let finalSku = answer;
        const lowerAnswer = answer.toLowerCase();
        if (lowerAnswer === 'auto' || lowerAnswer === 'autogen' || lowerAnswer === 'generate') {
            finalSku = `SKU-${Date.now()}`;
        }
        if (Array.isArray(data.items) && data.items.length > 0) {
            const item = { ...data.items[0], sku: finalSku };
            data.items = [item, ...data.items.slice(1)];
        }
    } else if (pending.status === 'waiting_for_payment_method') {
        const lower = answer.toLowerCase();
        if (lower.includes('cash')) {
            data.paymentMethod = 'Cash';
        } else if (lower.includes('credit')) {
            data.paymentMethod = 'Credit';
        } else {
            data.paymentMethod = answer;
        }
    } else if (pending.status === 'waiting_for_bill_product' || pending.status === 'waiting_for_bill_item') {
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, productName: answer };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_bill_quantity') {
        const qty = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, quantity: isNaN(qty) ? baseItem.quantity : qty };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_bill_price') {
        const price = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, price: isNaN(price) ? baseItem.price : price };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_invoice_product' || pending.status === 'waiting_for_invoice_item') {
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, productName: answer };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_invoice_quantity') {
        const qty = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, quantity: isNaN(qty) ? baseItem.quantity : qty };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_invoice_price') {
        const price = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, price: isNaN(price) ? baseItem.price : price };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_bill_product' || pending.status === 'waiting_for_bill_item') {
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, productName: answer };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_bill_quantity') {
        const qty = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, quantity: isNaN(qty) ? baseItem.quantity : qty };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_bill_price') {
        const price = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, price: isNaN(price) ? baseItem.price : price };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_po_supplier') {
        data.supplierName = answer;
    } else if (pending.status === 'waiting_for_po_product' || pending.status === 'waiting_for_po_item') {
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, productName: answer };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_po_quantity') {
        const qty = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, quantity: isNaN(qty) ? baseItem.quantity : qty };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_po_price') {
        const price = Number(answer);
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, unitPrice: isNaN(price) ? baseItem.unitPrice : price };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_po_sku') {
        let finalSku = answer;
        const lowerAnswer = answer.toLowerCase();
        if (lowerAnswer === 'auto' || lowerAnswer === 'autogen' || lowerAnswer === 'generate') {
            finalSku = `SKU-${Date.now()}`;
        }
        const items = Array.isArray(data.items) ? data.items.slice() : [];
        const baseItem = items[0] || {};
        const updatedItem = { ...baseItem, sku: finalSku };
        if (!items.length) {
            items.push(updatedItem);
        } else {
            items[0] = updatedItem;
        }
        data.items = items;
    } else if (pending.status === 'waiting_for_po_number') {
        data.poNumber = answer.toUpperCase();
    } else {
        return null;
    }

    let message = 'Transaction Recorded Successfully.\nAccounting + Inventory + CRM updated.';
    if (pending.intent === 'create_purchase_order') {
        const items = Array.isArray(data.items) ? data.items : [];
        const first = items[0] || {};
        const qty = first.quantity != null ? Number(first.quantity) : null;
        const unitPrice = first.unitPrice != null ? Number(first.unitPrice) : null;
        let lineTotal = null;
        if (qty != null && unitPrice != null) {
            lineTotal = qty * unitPrice;
            first.lineTotal = first.lineTotal || lineTotal;
            items[0] = first;
        }
        const poTotal = items.reduce((sum, it) => {
            const lt = it.lineTotal != null ? Number(it.lineTotal) : (it.quantity && it.unitPrice ? Number(it.quantity) * Number(it.unitPrice) : 0);
            return sum + (isNaN(lt) ? 0 : lt);
        }, 0);
        const supplier = data.supplierName || 'Unknown Supplier';
        const skuText = first.sku || 'N/A';
        const qtyText = qty != null ? qty : '?';
        const priceText = unitPrice != null ? unitPrice : '?';

        message = `Purchase Order Draft Completed\n• Supplier: ${supplier}\n• Item: ${(first.productName || first.description || 'Item')} | SKU: ${skuText} Qty: ${qtyText} × ${priceText} = ${lineTotal != null ? lineTotal : '?'}\n• PO Total: ${poTotal} PKR\n• Status: DRAFT (Pending Save)\n(No accounting or inventory entries will be posted until goods are received.)`;
    } else if (pending.intent === 'convert_po_to_bill') {
        message = 'Purchase Order reference received. Ready to convert PO to Bill with inventory and accounting updates.';
    }

    return {
        intent: pending.intent,
        confidence: 0.99,
        readyToExecute: true,
        data,
        message
    };
};

/**
 * Main Entry Point for AI Assistance
 * @param {string} userPrompt - The user's natural language request
 * @param {object} context - { tenantId, userId, currentPath }
 */
const processUserRequest = async (userPrompt, context) => {
    const { tenantId } = context;
    const key = getPendingKey(context);
    const existingPending = pendingTransactions.get(key);
    if (existingPending && existingPending.status) {
        const lowerFollowup = (userPrompt || '').toLowerCase();
        if (
            lowerFollowup === 'cancel' ||
            lowerFollowup.includes('cancel transaction') ||
            lowerFollowup.includes('cancel po') ||
            lowerFollowup.includes('cancel purchase order') ||
            lowerFollowup.includes('never mind') ||
            lowerFollowup.includes('nevermind')
        ) {
            pendingTransactions.delete(key);
            const isPo = existingPending.intent === 'create_purchase_order';
            const label = isPo ? 'Purchase Order draft' : 'pending transaction';
            return {
                intent: 'general_chat',
                confidence: 1,
                readyToExecute: false,
                data: {},
                message: `${label} cancelled.`
            };
        }
        pendingTransactions.delete(key);
        const resolved = resolvePendingTransaction(existingPending, userPrompt);
        if (resolved) {
            const finalResponse = enforceRequiredFields(resolved, userPrompt, context);
            return finalResponse;
        }
    }

    const lowerPrompt = (userPrompt || '').toLowerCase();

    if (
        lowerPrompt === 'hi' ||
        lowerPrompt === 'hello' ||
        lowerPrompt === 'hey' ||
        lowerPrompt === 'salam' ||
        lowerPrompt === 'salaam' ||
        lowerPrompt.includes('kya haal') ||
        lowerPrompt.includes('help') ||
        lowerPrompt.includes('what can you do') ||
        lowerPrompt.includes('explain invoice') ||
        lowerPrompt.includes('explain bill')
    ) {
        return {
            intent: 'general_chat',
            confidence: 1,
            readyToExecute: false,
            data: {},
            message: 'Please enter a business transaction to record.'
        };
    }

    // 1. Fetch Contextual Data (Hints) - Resilient to DB Failures
    let accounts = [], partners = [], products = [], employees = [], leads = [];
    let dbError = null;

    try {
        if (context.dbStatus !== 'disconnected') { // Optimization: Don't try if we already know it's down
             [accounts, partners, products, employees, leads] = await Promise.all([
                Account.find({ tenantId }).select('code name type category balance'),
                Partner.find({ tenantId }).select('name type email'),
                Product.find({ tenantId }).select('name price type'),
                Employee.find({ tenantId }).select('firstName lastName department position'),
                Lead.find({ tenantId }).select('name status')
            ]);
        }
    } catch (err) {
        console.warn('AI Service: Could not fetch context data (DB might be down):', err.message);
        dbError = "Database Connection Unavailable";
    }

    const accountHints = accounts.map(a => `${a.code}:${a.name} (${a.type})`).join('\n') || "(No accounts available)";
    const partnerHints = partners.map(p => `${p.name} (${p.type})`).join(', ') || "(No partners available)";
    const productHints = products.map(p => `${p.name} ($${p.price})`).join(', ') || "(No products available)";
    const employeeHints = employees.map(e => `${e.firstName} ${e.lastName} (${e.department})`).join(', ') || "(No employees available)";
    const leadHints = leads.map(l => `${l.name} (${l.status})`).join(', ') || "(No leads available)";

    // 2. Construct System Prompt (Fixed ERP AI Agent)
    const systemPrompt = `
You are a BUSINESS-CRITICAL ERP ACCOUNTING AI AGENT integrated with the Beinnovo ERP system.
You are not a chatbot. You must behave as a deterministic, rule-based accounting officer.
Focus only on Accounting, Inventory, Sales, Purchase, CRM and HR. No creative text, no stories, no emojis.
Keep responses short and structured.

MODULES:
1. Accounting: Chart of Accounts, journal entries, ledgers, trial balance, P&L, balance sheet. Use 'create_journal'.
2. Inventory: Products, stock in, stock out, quantity on hand, cost price, valuation. Use 'create_bill' for purchases and 'create_invoice' for sales.
3. Sales: Sales invoices, cash and credit sales, receivables. Use 'create_invoice'.
4. Purchase: Purchase invoices, cash and credit purchases, payables. Use 'create_bill'.
5. CRM: Customers, suppliers, transaction history, outstanding balances, leads. Use 'create_lead' and 'follow_up_client'.
6. HR: Employees, salaries and wages, payroll expenses, advances and deductions. Use 'create_employee', 'run_payroll' and 'record_salary_payment'.

CORE RULES:
- Automatic multi-module processing: any transaction must update Accounting and, when relevant, Inventory, CRM or HR.
- Chaining: Sales reduce stock and update customer balances. Purchases increase stock and update supplier balances. Payroll updates salary expense and cash/bank.
- Validation: Amounts must be numeric and greater than zero. Debits must equal credits.
- Account selection is NOT done by you. You only classify intent and extract structured fields. The backend maps each intent to fixed Chart of Accounts codes and validates accounts before posting.
- Missing data: If essential fields are missing (amount, party, cash/credit, goods vs expense vs salary), set readyToExecute:false and ask a precise question. Do not guess party names.
- Determinism: Follow standard accounting rules. Do not generate creative explanations. Use short, factual language.

AVAILABLE INTENTS & JSON FORMATS:

1. Create Invoice (Sales):
   Intent: "create_invoice"
   Data: { partnerName: "Client Y", items: [{ productName: "Product X", quantity: 10, price: 100 }] }
   Effect: Updates Inventory (stock out), Accounting (revenue and COGS), CRM (customer history and balance).
   Required: partnerName, items (productName, quantity, price).

2. Create Bill (Purchase):
   Intent: "create_bill"
   Data: { partnerName: "Supplier A", items: [{ productName: "Product Z", quantity: 100, price: 50 }] }
   Effect: Updates Inventory (stock in), Accounting (inventory or expense and payables), CRM (supplier history and balance).
   Required: partnerName, items (productName, quantity, price).

3. HR - Add Employee:
   Intent: "create_employee"
   Data: { firstName, lastName, position, department, salary, email }
   Effect: Updates HR records and enables payroll processing.

4. HR - Run Payroll (All Active Employees):
   Intent: "run_payroll"
   Data: { month: "January", year: "2025" }
   Effect: Creates payroll records for all active employees and posts salary expense vs bank.

5. HR - Salary Payment / Advance (Single Employee):
   Intent: "record_salary_payment"
   Data: { employeeName: "Ali Khan", amount: 50000, salaryType: "Monthly" or "Advance", paymentMethod: "Cash" or "Bank", period: "January 2025" }
   Effect: Creates a payroll record for the employee and posts salary expense vs cash/bank.

6. CRM - Create Lead:
   Intent: "create_lead"
   Data: { name, email, phone, notes: [{ text: "Initial contact" }] }
   Effect: Adds a lead to CRM pipeline.

7. CRM - Follow Up:
   Intent: "follow_up_client"
   Data: { partnerName, message: "Reminder about overdue invoice..." }
   Effect: Logs interaction for CRM history.

8. General Journal (Financials):
   Intent: "create_journal"
   Data: { description, date, entries: [{ accountCode, debit, credit }] }
   Rules: Total Debit must equal Total Credit. Use Chart of Accounts codes wherever possible.

9. General Chat / Clarification:
   Intent: "general_chat"
   Data: {}
   Use only to ask clarifying questions when data is incomplete.

EXISTING DATA CONTEXT:
- Accounts (COA): ${accountHints}
- Partners (CRM): ${partnerHints}
- Products: ${productHints}
- Employees: ${employeeHints}
- Leads: ${leadHints}

OUTPUT FORMAT (JSON ONLY):
{
  "intent": "intent_name",
  "confidence": 0.95,
  "readyToExecute": true,
  "data": { ... },
  "message": "Short human summary for the user following this structure:\nTransaction Detected:\n• Type: ...\n• Amount: ...\n• Mode (Cash / Credit): ...\n• Party: ...\n\nAccounting Entry:\n• Debit: ...\n• Credit: ...\n\nInventory Update:\n• Stock In / Stock Out: ...\n• Quantity Impact: ...\n\nCRM Update:\n• Customer / Supplier: ...\n• Balance Updated: ...\n\nHR Update:\n• Employee (if applicable): ...\n\nStatus:\n..."
}
`;

    // 3. Call AI
    const fullPrompt = `${systemPrompt}\n\nUSER REQUEST: "${userPrompt}"`;
    const responseText = await callGemini(fullPrompt, userPrompt);
    const parsedResponse = safeJsonParse(responseText);

    if (!parsedResponse) {
        return {
            intent: 'general_chat',
            message: "I understood your request but couldn't format the response correctly. Please try again.",
            data: {}
        };
    }

    const validatedResponse = enforceRequiredFields(parsedResponse, userPrompt, context);
    return validatedResponse;
};

module.exports = {
    processUserRequest
};
