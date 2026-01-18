import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Helper to get settings
const getSettings = () => {
  const defaults = {
    companyName: 'My Company',
    companyAddress: '',
    currencySymbol: '$',
    invoiceFooter: 'Thank you for your business!',
    dateFormat: 'YYYY-MM-DD'
  };
  try {
    const saved = localStorage.getItem('appSettings');
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
};

export const getCurrencySymbol = () => {
  const s = getSettings();
  return s.currencySymbol || '$';
};

export const formatCurrency = (value) => {
  const symbol = getCurrencySymbol();
  const num = Number(value) || 0;
  // Use Intl.NumberFormat for better localization (commas)
  return `${symbol}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)}`;
};

export const formatNumber = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

// Print the current window
export const handlePrint = () => {
  window.print();
};

// Export data to PDF
export const exportToPDF = (columns, data, title = 'Report', fileName = 'report.pdf') => {
  try {
    const settings = getSettings();
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text(settings.companyName, 14, 15);
    
    doc.setFontSize(14);
    doc.text(title, 14, 25);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 32);

    // Table
    autoTable(doc, {
      startY: 40,
      head: [columns.map(col => col.header)],
      body: data.map(row => columns.map(col => row[col.dataKey])),
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] }, // Dark gray
    });

    doc.save(fileName);
  } catch (error) {
    console.error("Export to PDF failed:", error);
    alert("Failed to generate PDF. Please check the console for details.");
  }
};

// Generate Individual Invoice PDF
export const generateInvoicePDF = (invoice) => {
  try {
    const settings = getSettings();
    const doc = new jsPDF();
    const currency = settings.currencySymbol;

    // Company Header
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(settings.companyName, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let yPos = 28;
    
    if (settings.companyAddress) {
      const addressLines = doc.splitTextToSize(settings.companyAddress, 80);
      doc.text(addressLines, 14, yPos);
      yPos += (addressLines.length * 5);
    }
    if (settings.companyPhone) {
      doc.text(settings.companyPhone, 14, yPos);
      yPos += 5;
    }
    if (settings.companyEmail) {
      doc.text(settings.companyEmail, 14, yPos);
    }

    // Invoice Details
    doc.text("INVOICE", 140, 22);
    doc.text(`Invoice #: ${invoice.id}`, 140, 30);
    doc.text(`Date: ${invoice.date}`, 140, 35);
    doc.text(`Status: ${invoice.status}`, 140, 40);

    // Bill To
    doc.text("Bill To:", 14, 55);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice.customer, 14, 62);
    
    // Table of Items
    const tableColumn = ["Description", "Quantity", "Unit Price", "Total"];
    const tableRows = [];

    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach(item => {
        const itemData = [
          item.description,
          item.quantity,
          `${currency}${item.price.toFixed(2)}`,
          `${currency}${(item.quantity * item.price).toFixed(2)}`
        ];
        tableRows.push(itemData);
      });
    } else {
      // Fallback if no items data exists in the row object yet (legacy data)
      tableRows.push(["Service Fee (Consolidated)", "1", `${currency}${invoice.total}`, `${currency}${invoice.total}`]);
    }

    autoTable(doc, {
      startY: 75,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
    });

    // Totals
    const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || 85;
    
    doc.setFontSize(10);
    doc.text(`Subtotal:`, 140, finalY + 10);
    doc.text(`${currency}${(invoice.subtotal || invoice.total).toFixed(2)}`, 180, finalY + 10, { align: 'right' });
    
    doc.text(`Tax:`, 140, finalY + 15);
    doc.text(`${currency}${(invoice.tax || 0).toFixed(2)}`, 180, finalY + 15, { align: 'right' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total:`, 140, finalY + 22);
    doc.text(`${currency}${Number(invoice.total).toFixed(2)}`, 180, finalY + 22, { align: 'right' });

    // Footer
    if (settings.invoiceFooter) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(settings.invoiceFooter, 105, 280, { align: "center" });
    }

    doc.save(`Invoice_${invoice.id}.pdf`);
  } catch (error) {
    console.error("Export Invoice PDF failed:", error);
    alert("Failed to generate PDF");
  }
};

// Generate Payslip PDF
export const generatePayslipPDF = (payslip) => {
  try {
    const settings = getSettings();
    const doc = new jsPDF();
    const currency = settings.currencySymbol;

    // Header
    doc.setFillColor(63, 81, 181); // Indigo color
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("PAYSLIP", 14, 25);
    
    doc.setFontSize(12);
    doc.text(settings.companyName, 196, 25, { align: 'right' });

    // Employee Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    
    doc.text(`Employee: ${payslip.employeeName}`, 14, 55);
    doc.text(`ID: ${payslip.employeeId || '-'}`, 14, 62);
    
    doc.text(`Month: ${payslip.month}`, 120, 55);
    doc.text(`Department: ${payslip.department || '-'}`, 120, 62);

    // Earnings Table
    autoTable(doc, {
      startY: 70,
      head: [['Earnings', 'Amount']],
      body: [
        ['Base Salary', `${currency}${payslip.baseSalary.toFixed(2)}`],
        ['Bonus', `${currency}${payslip.bonus.toFixed(2)}`],
        ['Total Earnings', `${currency}${(payslip.baseSalary + payslip.bonus).toFixed(2)}`],
      ],
      theme: 'plain',
      headStyles: { fillColor: [240, 240, 240], textColor: 80, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 50, halign: 'right' }
      }
    });

    // Deductions Table
    const firstTableY = doc.lastAutoTable?.finalY || 100;
    autoTable(doc, {
      startY: firstTableY + 10,
      head: [['Deductions', 'Amount']],
      body: [
        ['Tax & Deductions', `${currency}${payslip.deductions.toFixed(2)}`],
        ['Total Deductions', `${currency}${payslip.deductions.toFixed(2)}`],
      ],
      theme: 'plain',
      headStyles: { fillColor: [240, 240, 240], textColor: 80, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 50, halign: 'right' }
      }
    });

    // Net Pay
    const finalY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 15 : firstTableY + 50;
    
    doc.setFillColor(240, 248, 255); // AliceBlue
    doc.rect(14, finalY, 182, 15, 'F');
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("NET PAY", 20, finalY + 10);
    doc.text(`${currency}${payslip.netSalary.toFixed(2)}`, 190, finalY + 10, { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This is a system generated payslip.", 105, 280, { align: "center" });

    doc.save(`Payslip_${payslip.employeeName}_${payslip.month}.pdf`);
  } catch (error) {
    console.error("Generate Payslip PDF failed:", error);
    alert("Failed to generate PDF: " + error.message);
  }
};

// Export data to Excel
export const exportToExcel = (data, sheetName = 'Sheet1', fileName = 'report.xlsx') => {
  // Convert JSON to Worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Create Workbook and add Worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Write Workbook to buffer
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  
  // Save file
  const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  saveAs(dataBlob, fileName);
};
