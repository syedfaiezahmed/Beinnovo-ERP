import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Plus as LuPlus,
  Box as LuBox,
  Search as LuSearch,
  Printer as LuPrinter,
  Download as LuDownload,
  FileText as LuFileText,
  History as LuHistory,
  TrendingUp as LuTrendingUp,
  TrendingDown as LuTrendingDown,
  Layers as LuLayers,
  DollarSign as LuDollarSign,
  Trash2 as LuTrash2,
  ScanBarcode as LuScanBarcode,
  Warehouse as LuWarehouse,
  Image as LuImage,
  Pencil as LuPencil,
  MapPin as LuMapPin,
  X as LuX,
  Package as LuPackage,
  AlertCircle as LuAlertCircle,
  CheckCircle2 as LuCheckCircle2
} from 'lucide-react';

import {
  handlePrint,
  exportToPDF,
  exportToExcel,
  formatCurrency,
  formatNumber
} from '../utils/exportUtils';

import {
  calculateInventoryValue
} from '../utils/inventoryValuation';

const Inventory = () => {
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'warehouses'
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Forms & Modals
  const [showProductForm, setShowProductForm] = useState(false);
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  // Transaction State
  const [transactionType, setTransactionType] = useState('IN');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);

  // New Product State
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    barcode: '',
    brand: '',
    image: '',
    category: 'General',
    salesPrice: '',
    valuationMethod: 'FIFO',
    initialQty: '',
    initialCost: '',
    reorderLevel: 10
  });

  // New Warehouse State
  const [newWarehouse, setNewWarehouse] = useState({
    name: '',
    location: '',
    contactPerson: '',
    contactNumber: ''
  });

  // Transaction Data
  const [transactionData, setTransactionData] = useState({
    qty: 1,
    unitCost: 0,
    date: new Date().toISOString().split('T')[0],
    reason: ''
  });

  // ================= FETCH DATA =================
  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, warehouseRes] = await Promise.all([
        api.get('/products'),
        api.get('/warehouses')
      ]);

      const prods = Array.isArray(prodRes.data) ? prodRes.data : [];
      setProducts(prods);
      setWarehouses(Array.isArray(warehouseRes.data) ? warehouseRes.data : []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================= STATS =================
  const totalInventoryValue = products.reduce(
    (sum, p) => sum + calculateInventoryValue(p),
    0
  );

  const lowStockCount = products.filter(
    p => p.quantityOnHand < p.reorderLevel
  ).length;

  // ================= EXPORT HANDLERS =================
  const handleExportPDF = () => exportToPDF(products);
  const handleExportExcel = () => exportToExcel(products);

  // ================= PRODUCT SAVE =================
  const handleSaveProduct = async () => {
    try {
      const payload = {
        name: newProduct.name,
        sku: newProduct.sku || `P-${Date.now()}`,
        barcode: newProduct.barcode,
        brand: newProduct.brand,
        image: newProduct.image,
        category: newProduct.category,
        salesPrice: Number(newProduct.salesPrice),
        costPrice: Number(newProduct.initialCost),
        valuationMethod: newProduct.valuationMethod,
        reorderLevel: Number(newProduct.reorderLevel)
      };

      if (editingId) {
        await api.put(
          `/products/${editingId}`,
          payload
        );
      } else {
        payload.quantityOnHand = Number(newProduct.initialQty) || 0;
        payload.batches = [];
        // If initial qty > 0, we might want to create a batch/transaction, but keeping it simple for now
        await api.post('/products', payload);
      }

      fetchData();
      setShowProductForm(false);
      setEditingId(null);
      resetProductForm();
    } catch (err) {
      alert('Save failed');
      console.error(err);
    }
  };

  const resetProductForm = () => {
    setNewProduct({
      name: '',
      sku: '',
      type: 'Goods',
      barcode: '',
      brand: '',
      image: '',
      category: 'General',
      salesPrice: '',
      valuationMethod: 'FIFO',
      initialQty: '',
      initialCost: '',
      reorderLevel: 10
    });
  };

  const handleEditProduct = (p) => {
    setEditingId(p._id);
    setNewProduct({
      name: p.name,
      sku: p.sku,
      type: p.type || 'Goods',
      barcode: p.barcode || '',
      brand: p.brand || '',
      image: p.image || '',
      category: p.category,
      salesPrice: p.salesPrice,
      valuationMethod: p.valuationMethod,
      initialQty: p.quantityOnHand,
      initialCost: p.costPrice,
      reorderLevel: p.reorderLevel
    });
    setShowProductForm(true);
  };

  // ================= WAREHOUSE SAVE =================
  const handleSaveWarehouse = async () => {
    try {
      if (editingWarehouseId) {
        await api.put(`/warehouses/${editingWarehouseId}`, newWarehouse);
      } else {
        await api.post('/warehouses', newWarehouse);
      }
      setShowWarehouseForm(false);
      setEditingWarehouseId(null);
      setNewWarehouse({ name: '', location: '', contactPerson: '', contactNumber: '' });
      fetchData(); // Refresh warehouse list
    } catch (error) {
      console.error(error);
      alert('Failed to save warehouse');
    }
  };

  // ================= TRANSACTION =================
  const openTransactionModal = (product, type) => {
    setSelectedProduct(product);
    setTransactionType(type);
    setTransactionData({
      qty: 1,
      unitCost: product.costPrice || 0,
      date: new Date().toISOString().split('T')[0],
      reason: ''
    });
    // Default to first warehouse if available
    if (warehouses.length > 0) setSelectedWarehouseId(warehouses[0]._id);
    setShowTransactionForm(true);
  };

  const handleTransaction = async () => {
    try {
      await api.post('/inventory/adjust', {
        productId: selectedProduct._id,
        type: transactionType,
        quantity: Number(transactionData.qty),
        unitCost: Number(transactionData.unitCost),
        date: transactionData.date,
        reason: transactionData.reason,
        warehouseId: selectedWarehouseId
      });

      fetchData();
      setShowTransactionForm(false);
    } catch (err) {
      alert('Transaction failed');
      console.error(err);
    }
  };

  // ================= DELETE =================
  const handleDeleteProduct = async id => {
    if (!window.confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    fetchData();
  };

  const handleDeleteWarehouse = async id => {
    if (!window.confirm('Deactivate this warehouse?')) return;
    await api.delete(`/warehouses/${id}`);
    fetchData();
  };

  // ================= RENDER =================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-[var(--color-text-muted)] animate-pulse text-sm">Loading Inventory System...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-8">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-[var(--color-text-heading)] tracking-tight">Inventory</h2>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Manage products, stock levels, and warehouses</p>
        </div>
        
        <div className="flex gap-3">
           <button
            onClick={() => { setActiveTab('list'); setShowProductForm(true); }}
            className="btn-primary shadow-lg shadow-primary/20 text-sm py-2.5 px-4 flex items-center gap-2"
          >
            <LuPlus className="size-[14px]" /> New Product
          </button>
          <button
            onClick={() => { setActiveTab('warehouses'); setShowWarehouseForm(true); }}
            className="btn-secondary text-sm py-2.5 px-4 flex items-center gap-2"
          >
            <LuWarehouse className="size-[14px]" /> New Warehouse
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 border-b border-[var(--color-border)] mb-6">
        <button
          onClick={() => setActiveTab('list')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'list' 
              ? 'text-primary' 
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Product List
          {activeTab === 'list' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('warehouses')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'warehouses' 
              ? 'text-primary' 
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Warehouses
          {activeTab === 'warehouses' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
          {/* STATS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={<LuPackage className="size-[14px] text-primary" />} 
              label="Total Products" 
              value={products.length} 
              bg="bg-primary/10"
              border="border-primary/20"
            />
            <StatCard 
              icon={<LuDollarSign className="size-[14px] text-success" />} 
              label="Total Value" 
              value={formatCurrency(totalInventoryValue)} 
              bg="bg-success/10"
              border="border-success/20"
            />
            <StatCard 
              icon={<LuAlertCircle className="size-[14px] text-danger" />} 
              label="Low Stock" 
              value={lowStockCount} 
              bg="bg-danger/10"
              border="border-danger/20"
            />
            <StatCard 
              icon={<LuWarehouse className="size-[14px] text-secondary" />} 
              label="Warehouses" 
              value={warehouses.length} 
              bg="bg-secondary/10"
              border="border-secondary/20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Stock Distribution</h3>
                <select className="bg-[var(--color-surface-hover)] border-none text-sm rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-[var(--color-primary)]">
                  <option>By Category</option>
                  <option>By Location</option>
                </select>
              </div>
              <div className="h-32 flex items-center justify-center bg-[var(--color-surface-hover)] rounded-lg border-2 border-[var(--color-border)] border-dashed text-[var(--color-text-muted)] text-sm">
                Chart Visualization
              </div>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Low Stock Alerts</h3>
                <button className="text-sm font-medium text-[var(--color-primary)] hover:underline">View All</button>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-[var(--color-danger)]/10 text-[var(--color-danger)] flex items-center justify-center">
                        <LuAlertCircle className="size-[14px]" />
                      </div>
                      <div>
                        <div className="font-bold text-[var(--color-text-heading)] text-sm">Product Name {item}</div>
                        <div className="text-sm text-[var(--color-text-muted)]">SKU: PRD-00{item}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[var(--color-danger)] text-sm">5 Left</div>
                      <button className="text-sm font-medium text-[var(--color-primary)] hover:underline">Restock</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LIST */}
          <div className="card-base overflow-hidden">
            <div className="p-3 flex flex-col sm:flex-row justify-between items-center gap-4 bg-[var(--color-surface-hover)]/50 border-b border-[var(--color-border)]/50">
              <div className="relative w-full sm:w-auto">
                <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] size-[14px] pointer-events-none" />
                <input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="input-base pl-12 w-full sm:w-64 bg-[var(--color-surface)] text-sm py-2.5"
                />
              </div>

              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button onClick={handlePrint} className="btn-ghost px-3 py-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Print">
                    <LuPrinter className="size-[14px]" />
                </button>
                <button onClick={handleExportPDF} className="btn-ghost px-3 py-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Export PDF">
                    <LuFileText className="size-[14px]" />
                </button>
                <button onClick={handleExportExcel} className="btn-ghost px-3 py-2.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Export Excel">
                    <LuDownload className="size-[14px]" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left">
                <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] font-medium uppercase tracking-wider text-sm">
                    <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">SKU / Barcode</th>
                    <th className="px-4 py-2.5">Brand</th>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Value</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-center">Actions</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-border)]">
                    {products
                    .filter(p =>
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(p => (
                        <tr key={p._id} className="group hover:bg-[var(--color-surface-hover)]/30 transition-colors">
                        <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                            {p.image ? (
                                <img src={p.image} alt="" className="size-8 rounded-lg object-cover border border-[var(--color-border)] shadow-sm" />
                            ) : (
                                <div className="size-8 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] border border-[var(--color-border)]">
                                <LuImage className="size-[14px]" />
                                </div>
                            )}
                            <div>
                                <p className="font-bold text-[var(--color-text)] group-hover:text-primary transition-colors text-sm">{p.name}</p>
                                <p className="text-sm text-[var(--color-text-muted)]">{p.type}</p>
                            </div>
                            </div>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                            <div className="flex flex-col">
                            <span className="font-mono text-sm">{p.sku}</span>
                            {p.barcode && (
                                <span className="text-sm flex items-center gap-1 text-[var(--color-text-muted)] mt-0.5">
                                    <LuScanBarcode className="size-[14px]" /> {p.barcode}
                                </span>
                            )}
                            </div>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)] text-sm">{p.brand || '-'}</td>
                        <td className="px-4 py-2.5">
                            <span className="px-1.5 py-0.5 rounded text-sm font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                                {p.category}
                            </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-[var(--color-text)] text-sm">
                            <div className="flex items-center justify-end gap-1.5">
                                {p.quantityOnHand}
                                {p.reorderLevel > p.quantityOnHand && (
                                <span className="size-1.5 rounded-full bg-danger animate-pulse" title="Low Stock"></span>
                                )}
                            </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)] font-mono text-sm">
                            {formatNumber(calculateInventoryValue(p))}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold border ${
                                p.quantityOnHand > 0 
                                    ? 'bg-success/10 text-success border-success/20' 
                                    : 'bg-danger/10 text-danger border-danger/20'
                            }`}>
                                {p.quantityOnHand > 0 ? (
                                    <>
                                        <LuCheckCircle2 className="size-[14px]" /> In Stock
                                    </>
                                ) : (
                                    <>
                                        <LuAlertCircle className="size-[14px]" /> Out of Stock
                                    </>
                                )}
                            </span>
                        </td>
                        <td className="px-4 py-2.5">
                            <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openTransactionModal(p, 'IN')} className="p-2 hover:bg-success/10 text-success rounded transition-colors" title="Stock In">
                                <LuTrendingUp className="size-[14px]" />
                            </button>
                            <button onClick={() => openTransactionModal(p, 'OUT')} className="p-2 hover:bg-danger/10 text-danger rounded transition-colors" title="Stock Out">
                                <LuTrendingDown className="size-[14px]" />
                            </button>
                            <button onClick={() => handleEditProduct(p)} className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors">
                                <LuPencil className="size-[14px]" />
                            </button>
                            <button onClick={() => handleDeleteProduct(p._id)} className="p-2 hover:bg-danger/10 text-danger rounded-md transition-colors">
                                <LuTrash2 className="size-[14px]" />
                            </button>
                            </div>
                        </td>
                        </tr>
                    ))}
                </tbody>
                </table>
            </div>
            
            {products.length === 0 && (
                <div className="p-8 text-center text-[var(--color-text-muted)]">
                    <LuBox className="size-8 mx-auto mb-2 opacity-20"/>
                    <p className="text-sm font-medium">No products found</p>
                    <p className="text-sm">Create a new product to get started.</p>
                </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'warehouses' && (
        <div className="card-base p-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Warehouse Locations</h3>
            <button
              onClick={() => { setNewWarehouse({ name: '', location: '', contactPerson: '', contactNumber: '' }); setShowWarehouseForm(true); }}
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <LuPlus className="size-[14px]" /> Add New Warehouse
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehouses.map(w => (
              <div key={w._id} className="group border border-[var(--color-border)] rounded-xl p-4 hover:shadow-lg transition-all duration-300 bg-[var(--color-surface)] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-gradient-to-l from-[var(--color-surface)] via-[var(--color-surface)] to-transparent pl-6">
                    <button 
                        onClick={() => { setEditingWarehouseId(w._id); setNewWarehouse(w); setShowWarehouseForm(true); }}
                        className="p-2 hover:bg-primary/10 text-primary rounded-md transition-colors"
                    >
                        <LuPencil className="size-[14px]" />
                    </button>
                    <button onClick={() => handleDeleteWarehouse(w._id)} className="p-2 hover:bg-danger/10 text-danger rounded-md transition-colors">
                        <LuTrash2 className="size-[14px]" />
                    </button>
                </div>

                <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
                        <LuWarehouse className="size-[14px]" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-[var(--color-text-heading)]">{w.name}</h4>
                        <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] mt-0.5">
                            <LuMapPin className="size-[14px]" />
                            <span>{w.location || 'No address provided'}</span>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-1 text-sm border-t border-[var(--color-border)] pt-2 mt-2">
                    {w.contactPerson && (
                        <div className="flex justify-between text-[var(--color-text-muted)]">
                            <span>Contact Person</span>
                            <span className="font-medium text-[var(--color-text)]">{w.contactPerson}</span>
                        </div>
                    )}
                    {w.contactNumber && (
                        <div className="flex justify-between text-[var(--color-text-muted)]">
                            <span>Phone</span>
                            <span className="font-medium text-[var(--color-text)]">{w.contactNumber}</span>
                        </div>
                    )}
                </div>
              </div>
            ))}
            
            <button 
                onClick={() => { setNewWarehouse({ name: '', location: '', contactPerson: '', contactNumber: '' }); setShowWarehouseForm(true); }}
                className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 flex flex-col items-center justify-center text-[var(--color-text-muted)] hover:border-primary hover:text-primary transition-all duration-300 min-h-[100px]"
            >
                <LuPlus className="size-[14px] mb-1 opacity-50" />
                <span className="font-medium text-sm">Add Warehouse</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: PRODUCT FORM */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-[var(--color-border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-[var(--color-border)]">
                <h3 className="text-lg font-bold text-[var(--color-text-heading)]">{editingId ? 'Edit Product' : 'New Product'}</h3>
                <button onClick={() => setShowProductForm(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    <LuX className="size-[14px]" />
                </button>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Product Name</label>
                  <input
                    className="input-base w-full text-sm py-2.5 px-3"
                    value={newProduct.name}
                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g. Office Chair"
                  />
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">SKU</label>
                  <input
                    className="input-base w-full font-mono text-sm py-2.5 px-3"
                    value={newProduct.sku}
                    onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                    placeholder="Auto-generated if empty"
                  />
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Barcode (ISBN/UPC)</label>
                  <div className="relative">
                    <LuScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] size-[14px]" />
                    <input
                        className="input-base w-full pl-9 font-mono text-sm py-2.5 px-3"
                        value={newProduct.barcode}
                        onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })}
                        placeholder="Scan or type..."
                    />
                  </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Brand</label>
                  <input
                    className="input-base w-full text-sm py-2.5 px-3"
                    value={newProduct.brand}
                    onChange={e => setNewProduct({ ...newProduct, brand: e.target.value })}
                    placeholder="e.g. Herman Miller"
                  />
              </div>
              <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Image URL</label>
                  <input
                    className="input-base w-full text-sm py-2.5 px-3"
                    placeholder="https://example.com/image.jpg"
                    value={newProduct.image}
                    onChange={e => setNewProduct({ ...newProduct, image: e.target.value })}
                  />
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Category</label>
                  <select
                    className="input-base w-full text-sm py-2.5 px-3"
                    value={newProduct.category}
                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  >
                    <option>General</option>
                    <option>Electronics</option>
                    <option>Office Supplies</option>
                    <option>Furniture</option>
                    <option>Services</option>
                  </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                  <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Valuation Method</label>
                  <select
                    className="input-base w-full text-sm py-2.5 px-3"
                    value={newProduct.valuationMethod}
                    onChange={e => setNewProduct({ ...newProduct, valuationMethod: e.target.value })}
                  >
                    <option value="FIFO">FIFO (First-In, First-Out)</option>
                    <option value="LIFO">LIFO (Last-In, First-Out)</option>
                    <option value="AVCO">Weighted Average Cost</option>
                  </select>
              </div>

              <div className="col-span-2 border-t border-[var(--color-border)] pt-4 mt-2">
                <h4 className="text-sm font-bold text-[var(--color-text-heading)] mb-3 uppercase tracking-wider">Initial Stock & Pricing</h4>
                <div className="grid grid-cols-3 gap-4">
                    {!editingId && (
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Initial Qty</label>
                        <input
                            type="number"
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newProduct.initialQty}
                            onChange={e => setNewProduct({ ...newProduct, initialQty: e.target.value })}
                        />
                    </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Cost Price</label>
                        <input
                            type="number"
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newProduct.initialCost}
                            onChange={e => setNewProduct({ ...newProduct, initialCost: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Selling Price</label>
                        <input
                            type="number"
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newProduct.salesPrice}
                            onChange={e => setNewProduct({ ...newProduct, salesPrice: e.target.value })}
                        />
                    </div>
                </div>
              </div>

              <div className="col-span-2 border-t border-[var(--color-border)] pt-4 mt-2">
                <h4 className="text-sm font-bold text-[var(--color-text-heading)] mb-3 uppercase tracking-wider">Inventory Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Reorder Level</label>
                        <input
                            type="number"
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newProduct.reorderLevel}
                            onChange={e => setNewProduct({ ...newProduct, reorderLevel: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Default Warehouse</label>
                        <select
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newProduct.warehouse || ''}
                            onChange={e => setNewProduct({ ...newProduct, warehouse: e.target.value })}
                        >
                            <option value="">Select Warehouse...</option>
                            {warehouses.map(w => <option key={w._id} value={w.name}>{w.name}</option>)}
                        </select>
                    </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 flex justify-end gap-3 rounded-b-xl">
              <button 
                onClick={() => setShowProductForm(false)}
                className="btn-ghost text-sm py-2.5 px-4"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProduct}
                className="btn-primary text-sm font-medium py-2.5 px-4 shadow-lg shadow-primary/20"
              >
                {editingId ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* MODAL: WAREHOUSE FORM */}
      {showWarehouseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 border border-[var(--color-border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-[var(--color-border)]">
                <h3 className="text-lg font-bold text-[var(--color-text-heading)]">Manage Warehouses</h3>
                <button onClick={() => setShowWarehouseForm(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    <LuX className="size-[14px]" />
                </button>
            </div>
            
            <div className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Warehouse Name</label>
                    <input
                        className="input-base w-full text-sm py-2.5 px-3"
                        value={newWarehouse.name}
                        onChange={e => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                        placeholder="e.g. Main Warehouse"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Location/Address</label>
                    <input
                        className="input-base w-full text-sm py-2.5 px-3"
                        value={newWarehouse.location}
                        onChange={e => setNewWarehouse({ ...newWarehouse, location: e.target.value })}
                        placeholder="e.g. 123 Storage St"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Contact Person</label>
                        <input
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newWarehouse.contactPerson}
                            onChange={e => setNewWarehouse({ ...newWarehouse, contactPerson: e.target.value })}
                            placeholder="Optional"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-heading)]">Contact Number</label>
                        <input
                            className="input-base w-full text-sm py-2.5 px-3"
                            value={newWarehouse.contactNumber}
                            onChange={e => setNewWarehouse({ ...newWarehouse, contactNumber: e.target.value })}
                            placeholder="Optional"
                        />
                    </div>
                </div>
            </div>
            
            <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 flex justify-end gap-3 rounded-b-xl">
                <button 
                    onClick={() => setShowWarehouseForm(false)}
                    className="btn-ghost text-sm py-2.5 px-4"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSaveWarehouse}
                    className="btn-primary text-sm font-medium py-2.5 px-4 shadow-lg shadow-primary/20"
                >
                    Add Warehouse
                </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSACTION FORM */}
      {showTransactionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-[var(--color-surface)] rounded-xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 border border-[var(--color-border)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-[var(--color-border)]">
                <h3 className="text-lg font-bold text-[var(--color-text-heading)] flex items-center gap-2">
                    {transactionType === 'IN' ? <LuTrendingUp className="text-success size-[14px]" /> : <LuTrendingDown className="text-danger size-[14px]" />}
                    {transactionType === 'IN' ? 'Stock In' : 'Stock Out'} 
                    <span className="text-[var(--color-text-muted)] font-normal text-sm ml-1">- {selectedProduct?.name}</span>
                </h3>
                <button onClick={() => setShowTransactionForm(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    <LuX className="size-[14px]" />
                </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Warehouse</label>
                <select
                    className="input-base w-full text-sm py-2.5 px-3"
                    value={selectedWarehouseId}
                    onChange={e => setSelectedWarehouseId(e.target.value)}
                >
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map(w => (
                        <option key={w._id} value={w._id}>{w.name}</option>
                    ))}
                </select>
                <p className="text-sm text-[var(--color-text-muted)] mt-1.5">Select where stock is moving {transactionType === 'IN' ? 'to' : 'from'}.</p>
              </div>
            
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Quantity</label>
                  <input
                    type="number"
                    className="input-base w-full text-sm py-2.5 px-3"
                    value={transactionData.qty}
                    onChange={e => setTransactionData({ ...transactionData, qty: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Unit Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm">$</span>
                    <input
                        type="number"
                        className="input-base w-full pl-7 text-sm py-2.5 px-3"
                        value={transactionData.unitCost}
                        onChange={e => setTransactionData({ ...transactionData, unitCost: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Date</label>
                <input
                  type="date"
                  className="input-base w-full text-sm py-2.5 px-3"
                  value={transactionData.date}
                  onChange={e => setTransactionData({ ...transactionData, date: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Reason / Reference</label>
                <input
                  type="text"
                  className="input-base w-full text-sm py-2.5 px-3"
                  placeholder="e.g. PO-123 or Adjustment"
                  value={transactionData.reason}
                  onChange={e => setTransactionData({ ...transactionData, reason: e.target.value })}
                />
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setShowTransactionForm(false)}
                className="btn-ghost text-sm py-2 px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleTransaction}
                className={`btn-primary text-sm py-2 px-4 shadow-lg shadow-primary/20 ${transactionType === 'OUT' ? 'bg-danger hover:bg-danger/90 border-danger/20' : ''}`}
              >
                Confirm {transactionType === 'IN' ? 'Stock In' : 'Stock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ================= SMALL STAT CARD =================
const StatCard = ({ icon, label, value, bg, border }) => (
  <div className={`p-4 rounded-xl border flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow ${bg} ${border}`}>
    <div className="bg-[var(--color-surface)] dark:bg-black/20 p-2 rounded-lg shadow-sm border border-[var(--color-border)]/50">
        {icon}
    </div>
    <div>
      <p className="text-[var(--color-text-muted)] text-sm font-bold uppercase tracking-wide">{label}</p>
      <p className="text-sm font-black text-[var(--color-text-heading)] leading-none mt-1">{value}</p>
    </div>
  </div>
);

export default Inventory;
