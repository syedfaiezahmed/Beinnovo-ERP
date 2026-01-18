import React, { useState, useEffect } from 'react';
import { Plus as BiPlus, User as BiUser, Phone as BiPhone, Mail as BiEnvelope, Printer as BiPrinter, Download as BiDownload, FileText as BiFile } from 'lucide-react';
import { handlePrint, exportToPDF, exportToExcel } from '../utils/exportUtils';
import api from '../services/api';

const Partners = () => {
  const [showForm, setShowForm] = useState(false);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [newPartner, setNewPartner] = useState({
    name: '',
    type: 'Customer',
    email: '',
    phone: '',
    address: {
        street: '',
        city: '',
        state: '',
        zip: '',
        country: ''
    },
    taxId: ''
  });

  // Fetch Partners
  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await api.get('/partners');
      setPartners(res.data);
    } catch (error) {
      console.error("Error fetching partners:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPartner({ ...newPartner, [name]: value });
  };

  const handleSubmit = async () => {
      if (!newPartner.name) {
          alert("Name is required");
          return;
      }
      try {
          await api.post('/partners', newPartner);
          fetchPartners();
          setShowForm(false);
          setNewPartner({
            name: '',
            type: 'Customer',
            email: '',
            phone: '',
            address: {
                street: '',
                city: '',
                state: '',
                zip: '',
                country: ''
            },
            taxId: ''
          });
      } catch (error) {
          console.error("Error creating partner", error);
          alert("Failed to create partner");
      }
  };

  const handleExportPDF = () => {
    const columns = [
      { header: 'Name', dataKey: 'name' },
      { header: 'Type', dataKey: 'type' },
      { header: 'Email', dataKey: 'email' },
      { header: 'Phone', dataKey: 'phone' },
      { header: 'Balance', dataKey: 'balance' }
    ];
    
    const data = partners.map(partner => ({
      ...partner,
      balance: `$${Math.abs(partner.balance || 0).toFixed(2)} ${(partner.balance || 0) >= 0 ? 'DR' : 'CR'}`
    }));

    exportToPDF(columns, data, 'Partners Report', 'partners.pdf');
  };

  const handleExportExcel = () => {
    const data = partners.map(partner => ({
      Name: partner.name,
      Type: partner.type,
      Email: partner.email,
      Phone: partner.phone,
      Balance: partner.balance || 0
    }));
    exportToExcel(data, 'Partners', 'partners.xlsx');
  };

  return (
    <div className="p-2.5 transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2.5 gap-2.5">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-heading)] transition-colors duration-300">Partners (CRM)</h2>
          <p className="text-sm text-[var(--color-text-muted)] transition-colors duration-300 mt-0.5">Manage customers and vendors</p>
        </div>
        <div className="flex gap-2.5">
             <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium" title="Print">
              <BiPrinter size={16} />
            </button>
            <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium" title="Export PDF">
              <BiDownload size={16} />
            </button>
             <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-2 px-4 py-2.5 text-sm font-medium" title="Export Excel">
              <BiFile size={16} />
            </button>
            <button 
              onClick={() => setShowForm(!showForm)}
              className="btn-primary flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-bold"
            >
              <BiPlus size={16} /> Add Partner
            </button>
        </div>
      </div>

      {showForm ? (
        <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)] p-4 mb-4 transition-colors duration-300">
            <h3 className="text-lg font-bold mb-4 text-[var(--color-text-heading)] transition-colors duration-300">Add New Partner</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5 transition-colors duration-300">Name</label>
                    <input 
                        type="text" 
                        name="name"
                        value={newPartner.name}
                        onChange={handleInputChange}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                        placeholder="Company or Person Name" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5 transition-colors duration-300">Type</label>
                    <select 
                        name="type"
                        value={newPartner.type}
                        onChange={handleInputChange}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300"
                    >
                        <option value="Customer">Customer</option>
                        <option value="Vendor">Vendor</option>
                        <option value="Both">Both</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5 transition-colors duration-300">Email</label>
                    <input 
                        type="email" 
                        name="email"
                        value={newPartner.email}
                        onChange={handleInputChange}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                        placeholder="email@example.com" 
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5 transition-colors duration-300">Phone</label>
                    <input 
                        type="text" 
                        name="phone"
                        value={newPartner.phone}
                        onChange={handleInputChange}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                        placeholder="(555) 555-5555" 
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[var(--color-text-muted)] mb-1.5 transition-colors duration-300">Address</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <input 
                            type="text" 
                            name="street"
                            value={newPartner.address.street}
                            onChange={(e) => setNewPartner({...newPartner, address: {...newPartner.address, street: e.target.value}})}
                            className="col-span-2 w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                            placeholder="Street Address" 
                        />
                        <input 
                            type="text" 
                            name="city"
                            value={newPartner.address.city}
                            onChange={(e) => setNewPartner({...newPartner, address: {...newPartner.address, city: e.target.value}})}
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                            placeholder="City" 
                        />
                        <input 
                            type="text" 
                            name="state"
                            value={newPartner.address.state}
                            onChange={(e) => setNewPartner({...newPartner, address: {...newPartner.address, state: e.target.value}})}
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                            placeholder="State" 
                        />
                        <input 
                            type="text" 
                            name="zip"
                            value={newPartner.address.zip}
                            onChange={(e) => setNewPartner({...newPartner, address: {...newPartner.address, zip: e.target.value}})}
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                            placeholder="ZIP Code" 
                        />
                         <input 
                            type="text" 
                            name="country"
                            value={newPartner.address.country}
                            onChange={(e) => setNewPartner({...newPartner, address: {...newPartner.address, country: e.target.value}})}
                            className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] rounded-lg py-2.5 px-3 text-sm focus:border-primary outline-none transition-colors duration-300" 
                            placeholder="Country" 
                        />
                    </div>
                </div>
            </div>
             <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2.5 text-sm">Cancel</button>
                <button onClick={handleSubmit} className="btn-primary px-4 py-2.5 text-sm font-medium">Save Partner</button>
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {loading ? <div className="col-span-3 text-center text-[var(--color-text-muted)] transition-colors duration-300 text-sm">Loading partners...</div> : 
             partners.length === 0 ? <div className="col-span-3 text-center text-[var(--color-text-muted)] transition-colors duration-300 text-sm">No partners found. Add one!</div> :
             partners.map(partner => (
                <div key={partner._id} className="bg-[var(--color-surface)] p-2.5 rounded-xl shadow-sm border border-[var(--color-border)] hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold transition-colors duration-300">
                            {(partner.name || '?').charAt(0)}
                        </div>
                        <span className={`px-2 py-1 rounded text-sm font-semibold ${
                            partner.type === 'Customer' ? 'bg-success/10 text-success' :
                            partner.type === 'Vendor' ? 'bg-warning/10 text-warning' :
                            'bg-secondary/10 text-secondary'
                        }`}>
                            {partner.type}
                        </span>
                    </div>
                    <h3 className="font-bold text-lg mb-1 text-[var(--color-text-heading)] transition-colors duration-300 truncate">{partner.name}</h3>
                    <div className="space-y-1 text-sm text-[var(--color-text-muted)] mb-2.5 transition-colors duration-300">
                        <div className="flex items-center gap-1.5 truncate">
                            <BiEnvelope size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
                            {partner.email || 'No email'}
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                            <BiPhone size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
                            {partner.phone || 'No phone'}
                        </div>
                    </div>
                    <div className="border-t border-[var(--color-border)] pt-2.5 flex justify-between items-center transition-colors duration-300">
                        <span className="text-sm text-[var(--color-text-muted)] transition-colors duration-300">Balance</span>
                        <span className={`font-bold text-sm ${partner.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                            ${Math.abs(partner.balance || 0).toFixed(2)}
                        </span>
                    </div>
                </div>
             ))
            }
        </div>
      )}
    </div>
  );
};

export default Partners;