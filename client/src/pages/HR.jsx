import React, { useState, useEffect } from 'react';
import { 
  Plus as LuPlus, UserCircle as LuUserCircle, Briefcase as LuBriefcase, Printer as LuPrinter, Download as LuDownload, FileText as LuFileText, 
  DollarSign as LuDollarSign, Calendar as LuCalendar, CheckCircle as LuCheckCircle, XCircle as LuXCircle, Search as LuSearch, Building as LuBuilding,
  UserCheck as LuUserCheck, Clock as LuClock, Eye as LuEye, Trash2 as LuTrash2, Wallet as LuWallet
} from 'lucide-react';
import api from '../services/api';
import { exportToExcel, formatCurrency, getCurrencySymbol, formatNumber } from '../utils/exportUtils';
import PayslipPreviewModal from '../components/PayslipPreviewModal';

const HR = () => {
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, employees, payroll, leaves
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [companyName] = useState(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        return parsed.companyName || '';
      } catch {
        return '';
      }
    }
    return '';
  });

  const [employees, setEmployees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // Fetch Data
  const fetchData = async () => {
      setIsLoading(true);
      try {
          const [empRes, payRes, leaveRes] = await Promise.all([
              api.get('/employees'),
              api.get('/payrolls'),
              api.get('/leaves')
          ]);
          setEmployees(empRes.data);
          setPayrolls(payRes.data);
          setLeaves(leaveRes.data);
      } catch (error) {
          console.error("Error fetching HR data:", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    // Wrap async call to avoid "synchronous setState in effect" warning if linter is confused
    const load = async () => {
      await fetchData();
    };
    load();
  }, []);

  // --- Form States ---
  const [newEmployee, setNewEmployee] = useState({
    firstName: '', lastName: '', email: '', position: '', department: 'General', salary: '', status: 'Active'
  });

  const [newPayroll, setNewPayroll] = useState({
    employeeId: '', month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }), bonus: 0, deductions: 0
  });

  const [newLeave, setNewLeave] = useState({
    employeeId: '', type: 'Vacation', startDate: '', endDate: '', reason: ''
  });

  // --- Actions ---

  const handleAddEmployee = async () => {
    try {
        const emp = {
            ...newEmployee,
            salary: parseFloat(newEmployee.salary),
            hireDate: new Date(),
            leaveBalance: 20
        };
        await api.post('/employees', emp);
        fetchData();
        setShowEmployeeModal(false);
        setNewEmployee({ firstName: '', lastName: '', email: '', position: '', department: 'General', salary: '', status: 'Active' });
    } catch (error) {
        console.error("Error adding employee:", error);
        alert("Failed to add employee");
    }
  };

  const handleRunPayroll = async () => {
    if (!newPayroll.employeeId) return;
    const emp = employees.find(e => e._id === newPayroll.employeeId);
    if (!emp) return;

    const baseSalary = emp.salary / 12;
    const bonus = parseFloat(newPayroll.bonus) || 0;
    const deductions = parseFloat(newPayroll.deductions) || 0;

    const payroll = {
      employee: emp._id,
      month: newPayroll.month,
      baseSalary: baseSalary,
      bonus: bonus,
      deductions: deductions,
      netSalary: baseSalary + bonus - deductions,
      status: 'Paid',
      paymentDate: new Date()
    };

    try {
        await api.post('/payrolls', payroll);
        fetchData();
        setShowPayrollModal(false);
    } catch (error) {
        console.error("Error running payroll:", error);
        alert("Failed to run payroll");
    }
  };

  const handleRequestLeave = async () => {
    if (!newLeave.employeeId || !newLeave.startDate || !newLeave.endDate) return;
    
    // Calculate days diff roughly
    const start = new Date(newLeave.startDate);
    const end = new Date(newLeave.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leave = {
      employee: newLeave.employeeId,
      type: newLeave.type,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      days: diffDays,
      reason: newLeave.reason,
      status: 'Pending'
    };

    try {
        await api.post('/leaves', leave);
        fetchData();
        setShowLeaveModal(false);
    } catch (error) {
        console.error("Error requesting leave:", error);
        alert("Failed to request leave");
    }
  };

  const updateLeaveStatus = async (id, status) => {
    try {
        await api.put(`/leaves/${id}`, { status });
        fetchData();
    } catch (error) {
        console.error("Error updating leave status:", error);
        alert("Failed to update status");
    }
  };

  // --- Helpers ---
  const getEmployeeName = (id) => {
    // Check if employee object is populated or just an ID
    // Payroll populate 'employee', Leaves populate 'employee'
    // But if we use just ID:
    const emp = employees.find(e => e._id === id || e._id === id?._id);
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
  };

  // --- Exports ---
  const handleExportPayroll = () => {
    const data = payrolls.map(pay => ({
      ID: String(pay._id).slice(-6),
      Employee: pay.employee ? `${pay.employee.firstName} ${pay.employee.lastName}` : getEmployeeName(pay.employee),
      Month: pay.month,
      Base_Salary: formatCurrency(pay.baseSalary),
      Bonus: formatCurrency(pay.bonus),
      Deductions: formatCurrency(pay.deductions),
      Net_Salary: formatCurrency(pay.netSalary),
      Status: pay.status
    }));
    exportToExcel(data, 'Payroll_History', 'payroll_history.xlsx');
  };

  const handleViewPayslip = (payslip) => {
    // If populated
    const empObj = payslip.employee; 
    // If not populated, find from list
    const employee = empObj && empObj.firstName ? empObj : employees.find(e => e._id === payslip.employee);
    
    const enrichedPayslip = {
      ...payslip,
      employeeId: employee ? employee._id : payslip.employee, // Ensure ID is passed
      employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
      department: employee ? employee.department : '',
      position: employee ? employee.position : ''
    };
    setSelectedPayslip(enrichedPayslip);
    setShowPayslipModal(true);
  };

  const handleExportEmployees = () => {
    const data = employees.map(emp => ({
      Name: `${emp.firstName} ${emp.lastName}`,
      Role: emp.position,
      Dept: emp.department,
      Salary: `${formatCurrency(emp.salary)}/yr`,
      Status: emp.status
    }));
    exportToExcel(data, 'Employees_List', 'employees.xlsx');
  };

  const handleExportLeaves = () => {
    const data = leaves.map(leave => ({
      Employee: leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : getEmployeeName(leave.employee),
      Type: leave.type,
      Start: new Date(leave.startDate).toLocaleDateString(),
      End: new Date(leave.endDate).toLocaleDateString(),
      Days: leave.days,
      Reason: leave.reason,
      Status: leave.status
    }));
    exportToExcel(data, 'Leave_Requests', 'leaves.xlsx');
  };

  // --- Render Functions ---

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 animate-fade-in">
      <div className="card-base p-3 flex items-center gap-3">
        <div className="p-1.5 bg-primary/10 text-primary rounded-xl"><LuUserCircle size={16} /></div>
        <div>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">Total Employees</p>
          <p className="text-sm font-black text-[var(--color-text-heading)] mt-1">{employees.length}</p>
        </div>
      </div>
      <div className="card-base p-3 flex items-center gap-3">
        <div className="p-1.5 bg-success/10 text-success rounded-xl"><LuDollarSign size={16} /></div>
        <div>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">Monthly Payroll</p>
          <p className="text-sm font-black text-[var(--color-text-heading)] mt-1">
            {formatCurrency(employees.reduce((acc, emp) => acc + emp.salary, 0) / 12)}
          </p>
        </div>
      </div>
      <div className="card-base p-3 flex items-center gap-3">
        <div className="p-1.5 bg-warning/10 text-warning rounded-xl"><LuUserCheck size={16} /></div>
        <div>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">On Leave</p>
          <p className="text-sm font-black text-[var(--color-text-heading)] mt-1">{employees.filter(e => e.status === 'On Leave').length}</p>
        </div>
      </div>
      <div className="card-base p-3 flex items-center gap-3">
        <div className="p-1.5 bg-secondary/10 text-secondary rounded-xl"><LuBuilding size={16} /></div>
        <div>
          <p className="text-sm text-[var(--color-text-muted)] font-medium">Departments</p>
          <p className="text-sm font-black text-[var(--color-text-heading)] mt-1">{new Set(employees.map(e => e.department)).size}</p>
        </div>
      </div>

      {/* Recent Activity / Charts Placeholder */}
      <div className="md:col-span-2 card-base p-3">
        <h3 className="font-bold text-[var(--color-text-heading)] mb-3 flex items-center gap-2 text-lg">
          <LuBriefcase className="text-primary" size={16} /> Department Distribution
        </h3>
        <div className="space-y-3">
          {Object.entries(employees.reduce((acc, emp) => {
            acc[emp.department] = (acc[emp.department] || 0) + 1;
            return acc;
          }, {})).map(([dept, count]) => (
            <div key={dept}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[var(--color-text-heading)] font-medium">{dept}</span>
                <span className="font-bold text-primary">{count}</span>
              </div>
              <div className="w-full bg-[var(--color-surface-hover)] rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${(count / employees.length) * 100}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 card-base p-3">
        <h3 className="font-bold text-[var(--color-text-heading)] mb-3 flex items-center gap-2 text-lg">
          <LuCalendar className="text-warning" size={16} /> Pending Leave Requests
        </h3>
        <div className="space-y-2">
          {leaves.filter(l => l.status === 'Pending').length === 0 ? (
             <div className="flex flex-col items-center justify-center py-4 text-[var(--color-text-muted)]">
                <LuCalendar size={20} className="mb-2 opacity-20" />
                <p className="text-sm">No pending requests.</p>
             </div>
          ) : (
            leaves.filter(l => l.status === 'Pending').map(leave => (
              <div key={leave._id} className="flex items-center justify-between p-2 bg-[var(--color-surface-hover)] rounded-lg border border-[var(--color-border)]">
                 <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-muted)] font-bold border border-[var(--color-border)] text-sm">
                        {getEmployeeName(leave.employee).charAt(0)}
                    </div>
                    <div>
                        <p className="font-bold text-sm text-[var(--color-text-heading)]">{getEmployeeName(leave.employee)}</p>
                        <p className="text-sm text-[var(--color-text-muted)] flex items-center gap-1.5">
                            <span className="font-medium text-primary">{leave.type}</span> • {leave.days} Days
                        </p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => updateLeaveStatus(leave._id, 'Approved')} className="text-success hover:bg-success/10 p-1.5 rounded transition-colors"><LuCheckCircle size={16}/></button>
                    <button onClick={() => updateLeaveStatus(leave._id, 'Rejected')} className="text-danger hover:bg-danger/10 p-1.5 rounded transition-colors"><LuXCircle size={16}/></button>
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderEmployees = () => (
      <div className="card-base overflow-hidden animate-fade-in">
        <div className="p-3 border-b border-[var(--color-border)] flex flex-col md:flex-row justify-between items-center gap-3 bg-[var(--color-surface-hover)]">
           <div className="relative w-full md:w-64">
              <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
              <input 
                type="text" 
                placeholder="Search employees..." 
                className="input-base pl-12 py-2.5 w-full text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="flex gap-2">
              <button onClick={handleExportEmployees} className="btn-secondary flex items-center gap-2 text-sm font-medium px-4 py-2.5">
              <LuDownload size={16} /> Export
          </button>
          <button onClick={() => setShowEmployeeModal(true)} className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5">
              <LuPlus size={16} /> Add Employee
          </button>
           </div>
        </div>
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] font-semibold border-b border-[var(--color-border)] uppercase text-sm">
              <tr>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Salary</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
              {employees.filter(e => 
                  e.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  e.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (e.department && e.department.toLowerCase().includes(searchTerm.toLowerCase()))
              ).map((emp) => (
                  <tr key={emp._id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                  <td className="px-4 py-2.5 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black shadow-sm border border-primary/20 text-sm">
                          {emp.firstName ? emp.firstName[0] : ''}{emp.lastName ? emp.lastName[0] : ''}
                      </div>
                      <div>
                          <div className="font-bold text-[var(--color-text-heading)] text-sm">{emp.firstName} {emp.lastName}</div>
                          <div className="text-sm text-[var(--color-text-muted)]">{emp.email}</div>
                      </div>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-heading)] font-medium text-sm">{emp.position}</td>
                  <td className="px-4 py-2.5">
                      <span className="px-2 py-1 rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] text-sm font-medium border border-[var(--color-border)]">
                          {emp.department}
                      </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-[var(--color-text-heading)] text-sm">{`${formatCurrency(emp.salary)}/yr`}</td>
                  <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-1 rounded-full text-sm font-bold border ${
                          emp.status === 'Active' ? 'bg-success/10 text-success border-success/20' :
                          emp.status === 'On Leave' ? 'bg-warning/10 text-warning border-warning/20' :
                          'bg-danger/10 text-danger border-danger/20'
                      }`}>
                          {emp.status}
                      </span>
                  </td>
                  </tr>
              ))}
              {employees.length === 0 && (
                  <tr>
                      <td colSpan="5" className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                          <div className="flex flex-col items-center justify-center">
                              <LuUserCircle size={24} className="mb-2 opacity-20" />
                              <p className="text-sm">No employees found.</p>
                          </div>
                      </td>
                  </tr>
              )}
              </tbody>
          </table>
        </div>
      </div>
    );

  const renderPayroll = () => (
    <div className="card-base overflow-hidden animate-fade-in">
       <div className="p-2.5 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]/30">
            <h3 className="font-bold text-[var(--color-text-heading)] text-lg flex items-center gap-2">
                <LuClock className="text-primary" size={16} /> Payroll History
            </h3>
            <div className="flex gap-2">
              <button onClick={handleExportPayroll} className="btn-outline flex items-center gap-2 bg-[var(--color-surface)] text-sm font-medium px-4 py-2.5">
              <LuDownload size={16} /> Export
          </button>
          <button onClick={() => setShowPayrollModal(true)} className="btn-primary flex items-center gap-2 bg-success hover:bg-success-light border-success shadow-success/20 text-sm px-4 py-2.5">
              <LuWallet size={16} /> Run Payroll
          </button>
            </div>
       </div>
       <div className="overflow-x-auto min-h-[200px]">
        <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] font-semibold border-b border-[var(--color-border)] uppercase text-sm">
            <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">Month</th>
                <th className="px-4 py-2.5 text-right">Base</th>
                <th className="px-4 py-2.5 text-right">Bonus</th>
                <th className="px-4 py-2.5 text-right">Deductions</th>
                <th className="px-4 py-2.5 text-right">Net Pay</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-center">Action</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
                {payrolls.map((pay) => (
                    <tr key={pay._id} className="hover:bg-[var(--color-surface-hover)]/80 transition-colors">
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)] text-sm font-mono">PAY-{String(pay._id).slice(-4)}</td>
                        <td className="px-4 py-2.5 font-bold text-[var(--color-text-heading)] text-sm">{getEmployeeName(pay.employee)}</td>
                        <td className="px-4 py-2.5 text-[var(--color-text-heading)] text-sm">{pay.month}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--color-text-muted)] text-sm">{formatCurrency(pay.baseSalary)}</td>
                        <td className="px-4 py-2.5 text-right text-success text-sm">{formatCurrency(pay.bonus)}</td>
                        <td className="px-4 py-2.5 text-right text-danger text-sm">{formatCurrency(pay.deductions)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[var(--color-text-heading)] text-sm">{formatCurrency(pay.netSalary)}</td>
                        <td className="px-4 py-2.5 text-center">
                            <span className="px-2 py-1 rounded-full bg-success/10 text-success text-sm font-bold border border-success/20">
                                {pay.status}
                            </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                            <button onClick={() => handleViewPayslip(pay)} className="text-primary hover:text-primary-dark transition-colors p-1.5 hover:bg-primary/10 rounded">
                                <LuEye size={16} />
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
       </div>
    </div>
  );

  // Render Header
  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-1 gap-1">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-heading)] transition-colors duration-300">Human Resources</h2>
        <p className="text-sm text-[var(--color-text-muted)] transition-colors duration-300 mt-0.5">Manage employees and payroll</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-1 w-full md:w-auto">
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-1 px-4 py-2 text-sm font-medium" title="Print">
          <LuPrinter size={16} />
        </button>
        <button onClick={handleExportPDF} className="btn-secondary flex items-center gap-1 px-4 py-2 text-sm font-medium" title="Export PDF">
          <LuDownload size={16} />
        </button>
        <button onClick={handleExportExcel} className="btn-secondary flex items-center gap-1 px-4 py-2 text-sm font-medium" title="Export Excel">
          <LuFileText size={16} />
        </button>
      </div>
    </div>
  );

  const renderLeaves = () => (
    <div className="card-base overflow-hidden animate-fade-in">
        <div className="p-3 border-b border-[var(--color-border)] flex justify-between items-center bg-[var(--color-surface-hover)]/30">
            <h3 className="font-bold text-[var(--color-text-heading)] text-lg flex items-center gap-1.5">
                <LuCalendar className="text-primary" size={16} /> Leave Management
            </h3>
            <div className="flex gap-2">
              <button onClick={handleExportLeaves} className="btn-outline flex items-center gap-1.5 bg-[var(--color-surface)] text-sm font-medium px-4 py-2">
                  <LuDownload size={16} /> Export
              </button>
              <button onClick={() => setShowLeaveModal(true)} className="btn-primary flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 border-amber-500 shadow-amber-200 text-sm px-4 py-2">
                  <LuPlus size={16} /> Request Leave
              </button>
            </div>
       </div>
       <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] font-semibold border-b border-[var(--color-border)] uppercase text-sm">
            <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Reason</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-center">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
                {leaves.map((leave) => (
                    <tr key={leave._id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                        <td className="px-4 py-2 font-bold text-[var(--color-text-heading)] text-sm">{leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : 'Unknown'}</td>
                        <td className="px-4 py-2">
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-sm font-medium border border-primary/20">
                                {leave.type}
                            </span>
                        </td>
                        <td className="px-4 py-2 text-[var(--color-text-heading)] text-sm">
                            <div className="font-medium">{new Date(leave.startDate).toLocaleDateString()}</div>
                            <div className="text-[var(--color-text-muted)] text-sm uppercase tracking-wide">to</div>
                            <div className="font-medium">{new Date(leave.endDate).toLocaleDateString()}</div>
                            <div className="font-bold mt-0.5 text-primary">{leave.days} Days</div>
                        </td>
                        <td className="px-4 py-2 text-[var(--color-text-muted)] italic max-w-xs truncate text-sm">{leave.reason}</td>
                        <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-sm font-bold border ${
                                leave.status === 'Approved' ? 'bg-success/10 text-success border-success/20' :
                                leave.status === 'Rejected' ? 'bg-danger/10 text-danger border-danger/20' :
                                'bg-warning/10 text-warning border-warning/20'
                            }`}>
                                {leave.status}
                            </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                            {leave.status === 'Pending' && (
                                <div className="flex justify-center gap-1">
                                    <button onClick={() => updateLeaveStatus(leave._id, 'Approved')} className="text-success hover:bg-success/10 p-1 rounded-lg transition-colors"><LuCheckCircle size={16}/></button>
                                    <button onClick={() => updateLeaveStatus(leave._id, 'Rejected')} className="text-danger hover:bg-danger/10 p-1 rounded-lg transition-colors"><LuXCircle size={16}/></button>
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
                {leaves.length === 0 && (
                    <tr>
                        <td colSpan="6" className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                            <div className="flex flex-col items-center justify-center">
                                <LuCalendar size={24} className="mb-2 opacity-20" />
                                <p className="text-sm">No leave requests found.</p>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
       </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-1">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
        <div>
          <h2 className="text-xl font-black text-dark tracking-tight">{companyName ? `${companyName} - ` : ''}HR Management</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">End-to-end Employee, Payroll & Leave System</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-[var(--color-surface)] p-0.5 rounded-xl border border-border shadow-sm">
            {['dashboard', 'employees', 'payroll', 'leaves'].map(tab => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2 py-1 rounded-lg font-bold transition-all duration-200 text-sm ${
                        activeTab === tab 
                        ? 'bg-primary text-white shadow-sm shadow-primary/20' 
                        : 'text-muted-foreground hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-heading)]'
                    }`}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'employees' && renderEmployees()}
            {activeTab === 'payroll' && renderPayroll()}
            {activeTab === 'leaves' && renderLeaves()}
        </>
      )}

      {/* --- Modals --- */}

      {/* Add Employee Modal */}
      {showEmployeeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-[var(--color-surface)] rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-slide-up border border-[var(--color-border)]">
                  <div className="bg-primary/5 p-3 border-b border-primary/10 flex justify-between items-center">
                      <h3 className="font-black text-lg text-primary flex items-center gap-2">
                          <LuUserCircle size={16} /> Add New Employee
                      </h3>
                      <button onClick={() => setShowEmployeeModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1 rounded-full hover:bg-[var(--color-surface-hover)] transition-colors">
                        <LuXCircle size={16} />
                      </button>
                  </div>
                  <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">First Name</label>
                          <input type="text" value={newEmployee.firstName} onChange={e => setNewEmployee({...newEmployee, firstName: e.target.value})} className="input-base w-full py-2.5 text-sm" placeholder="e.g. John" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Last Name</label>
                          <input type="text" value={newEmployee.lastName} onChange={e => setNewEmployee({...newEmployee, lastName: e.target.value})} className="input-base w-full py-2.5 text-sm" placeholder="e.g. Doe" />
                      </div>
                      <div className="col-span-2">
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Email</label>
                          <input type="email" value={newEmployee.email} onChange={e => setNewEmployee({...newEmployee, email: e.target.value})} className="input-base w-full py-2.5 text-sm" placeholder="john.doe@company.com" />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Department</label>
                          <select value={newEmployee.department} onChange={e => setNewEmployee({...newEmployee, department: e.target.value})} className="input-base w-full bg-[var(--color-input-bg)] py-2.5 text-sm">
                              <option value="General">General</option>
                              <option value="IT">IT</option>
                              <option value="HR">HR</option>
                              <option value="Finance">Finance</option>
                              <option value="Sales">Sales</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Position</label>
                          <input type="text" value={newEmployee.position} onChange={e => setNewEmployee({...newEmployee, position: e.target.value})} className="input-base w-full py-2.5 text-sm" placeholder="e.g. Senior Developer" />
                      </div>
                      <div className="col-span-2">
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Annual Salary ({getCurrencySymbol()})</label>
                          <div className="relative">
                            <LuDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" size={16} />
                            <input type="number" value={newEmployee.salary} onChange={e => setNewEmployee({...newEmployee, salary: e.target.value})} className="input-base w-full pl-10 py-2.5 text-sm" placeholder="0.00" />
                          </div>
                      </div>
                  </div>
                  <div className="p-3 border-t border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface-hover)]">
                      <button onClick={() => setShowEmployeeModal(false)} className="btn-secondary py-2.5 px-4 text-sm">Cancel</button>
                      <button onClick={handleAddEmployee} className="btn-primary py-2.5 px-4 text-sm font-medium">Save Employee</button>
                  </div>
              </div>
          </div>
      )}

      {/* Run Payroll Modal */}
      {showPayrollModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-[var(--color-surface)] rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-slide-up border border-[var(--color-border)]">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 border-b border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center">
                      <h3 className="font-black text-lg text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                          <LuWallet size={16} /> Run Payroll
                      </h3>
                      <button onClick={() => setShowPayrollModal(false)} className="text-success/50 hover:text-success p-1 rounded-full hover:bg-success/10 transition-colors">
                        <LuXCircle size={16} />
                      </button>
                  </div>
                  <div className="p-3 space-y-3">
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Employee</label>
                          <select value={newPayroll.employeeId} onChange={e => setNewPayroll({...newPayroll, employeeId: e.target.value})} className="input-base w-full bg-[var(--color-input-bg)] py-2.5 text-sm">
                              <option value="">Select Employee...</option>
                              {employees.map(emp => (
                                  <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Month</label>
                          <input type="text" value={newPayroll.month} onChange={e => setNewPayroll({...newPayroll, month: e.target.value})} className="input-base w-full py-2.5 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Bonus ({getCurrencySymbol()})</label>
                            <input type="number" value={newPayroll.bonus} onChange={e => setNewPayroll({...newPayroll, bonus: e.target.value})} className="input-base w-full py-2.5 text-sm" placeholder="0" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Deductions ({getCurrencySymbol()})</label>
                            <input type="number" value={newPayroll.deductions} onChange={e => setNewPayroll({...newPayroll, deductions: e.target.value})} className="input-base w-full py-2.5 text-sm" placeholder="0" />
                        </div>
                      </div>
                  </div>
                  <div className="p-3 border-t border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface-hover)]">
                      <button onClick={() => setShowPayrollModal(false)} className="btn-secondary py-2.5 px-4 text-sm">Cancel</button>
                      <button onClick={handleRunPayroll} className="btn-success py-2.5 px-4 text-sm font-medium">Process Payment</button>
                  </div>
              </div>
          </div>
      )}

      {/* Request Leave Modal */}
      {showLeaveModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-[var(--color-surface)] rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-slide-up border border-[var(--color-border)]">
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-3 border-b border-amber-100 dark:border-amber-900/30 flex justify-between items-center">
                      <h3 className="font-black text-lg text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <LuCalendar size={16} /> Request Leave
                      </h3>
                      <button onClick={() => setShowLeaveModal(false)} className="text-amber-700/50 hover:text-amber-700 dark:text-amber-400/50 dark:hover:text-amber-400 p-1 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                        <LuXCircle size={16} />
                      </button>
                  </div>
                  <div className="p-3 space-y-3">
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Employee</label>
                          <select value={newLeave.employeeId} onChange={e => setNewLeave({...newLeave, employeeId: e.target.value})} className="input-base w-full bg-[var(--color-input-bg)] text-sm py-2.5">
                              <option value="">Select Employee...</option>
                              {employees.map(emp => (
                                  <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Leave Type</label>
                          <select value={newLeave.type} onChange={e => setNewLeave({...newLeave, type: e.target.value})} className="input-base w-full bg-[var(--color-input-bg)] text-sm py-2.5">
                              <option value="Vacation">Vacation</option>
                              <option value="Sick">Sick</option>
                              <option value="Personal">Personal</option>
                              <option value="Other">Other</option>
                          </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Start Date</label>
                              <input type="date" value={newLeave.startDate} onChange={e => setNewLeave({...newLeave, startDate: e.target.value})} className="input-base w-full text-sm py-2.5" />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">End Date</label>
                              <input type="date" value={newLeave.endDate} onChange={e => setNewLeave({...newLeave, endDate: e.target.value})} className="input-base w-full text-sm py-2.5" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-[var(--color-text-heading)] mb-1">Reason</label>
                          <textarea value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} className="input-base w-full text-sm py-2.5" rows="2" placeholder="Brief reason..."></textarea>
                      </div>
                  </div>
                  <div className="p-3 border-t border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface-hover)]">
                      <button onClick={() => setShowLeaveModal(false)} className="btn-secondary py-2.5 px-4 text-sm">Cancel</button>
                      <button onClick={handleRequestLeave} className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500 py-2.5 px-4 text-sm font-medium">Submit Request</button>
                  </div>
              </div>
          </div>
      )}

      {/* Payslip Preview Modal */}
      {showPayslipModal && (
        <PayslipPreviewModal 
          payslip={selectedPayslip} 
          onClose={() => setShowPayslipModal(false)} 
        />
      )}

    </div>
  );
};

export default HR;
