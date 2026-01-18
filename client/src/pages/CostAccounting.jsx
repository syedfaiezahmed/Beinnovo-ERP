import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Briefcase as BiBriefcase, Building as BiBuilding, Plus as BiPlus, BarChart3 as BiBarChart, X as BiX, Clock as BiTime, FileText as BiDetail } from 'lucide-react';
import * as XLSX from 'xlsx';

const CostAccounting = () => {
  const [activeTab, setActiveTab] = useState('projects'); // projects, cost-centers, reports, timesheets
  const [projects, setProjects] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [partners, setPartners] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Modals
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showCostCenterModal, setShowCostCenterModal] = useState(false);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  // Data for Modals
  const [selectedProjectAnalytics, setSelectedProjectAnalytics] = useState(null);

  // Form States
  const [newProject, setNewProject] = useState({ 
    code: '', name: '', client: '', budget: 0, status: 'Not Started',
    budgetBreakdown: { labor: 0, material: 0, overhead: 0 }
  });
  const [newCostCenter, setNewCostCenter] = useState({ code: '', name: '', budget: 0, manager: '' });
  const [newTimesheet, setNewTimesheet] = useState({ 
    employee: '', project: '', date: new Date().toISOString().split('T')[0], hours: 0, taskDescription: '' 
  });

  const fetchData = async () => {
    try {
      const results = await Promise.allSettled([
        api.get('/projects'),
        api.get('/cost-centers'),
        api.get('/reports/project-profitability'),
        api.get('/timesheets')
      ]);

      if (results[0].status === 'fulfilled') {
        setProjects(Array.isArray(results[0].value.data) ? results[0].value.data : []);
      } else {
        console.error('Projects fetch failed', results[0].reason);
        setProjects([]);
      }

      if (results[1].status === 'fulfilled') {
        setCostCenters(Array.isArray(results[1].value.data) ? results[1].value.data : []);
      } else {
        console.error('Cost Centers fetch failed', results[1].reason);
        setCostCenters([]);
      }

      if (results[2].status === 'fulfilled') {
        setReportData(Array.isArray(results[2].value.data) ? results[2].value.data : []);
      } else {
        console.error('Report fetch failed', results[2].reason);
        setReportData([]);
      }

      if (results[3].status === 'fulfilled') {
        setTimesheets(Array.isArray(results[3].value.data) ? results[3].value.data : []);
      } else {
        console.error('Timesheets fetch failed', results[3].reason);
        setTimesheets([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchPartners = async () => {
    try {
      const res = await api.get('/partners');
      setPartners(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setPartners([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
      await fetchPartners();
      await fetchEmployees();
    };
    loadData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', newProject);
      setShowProjectModal(false);
      fetchData();
      setNewProject({ 
        code: '', name: '', client: '', budget: 0, status: 'Not Started',
        budgetBreakdown: { labor: 0, material: 0, overhead: 0 }
      });
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating project');
    }
  };

  const handleCreateCostCenter = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cost-centers', newCostCenter);
      setShowCostCenterModal(false);
      fetchData();
      setNewCostCenter({ code: '', name: '', budget: 0, manager: '' });
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating cost center');
    }
  };

  const handleCreateTimesheet = async (e) => {
    e.preventDefault();
    try {
      await api.post('/timesheets', newTimesheet);
      setShowTimesheetModal(false);
      fetchData(); // Refresh timesheets and report data potentially
      setNewTimesheet({ employee: '', project: '', date: new Date().toISOString().split('T')[0], hours: 0, taskDescription: '' });
    } catch (error) {
      alert(error.response?.data?.message || 'Error logging time');
    }
  };

  const openProjectAnalytics = async (projectId) => {
    try {
      const res = await api.get(`/projects/${projectId}/analytics`);
      setSelectedProjectAnalytics(res.data);
      setShowAnalyticsModal(true);
    } catch (error) {
      console.error("Error fetching analytics", error);
    }
  };

  const exportReport = () => {
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Project Profitability");
      XLSX.writeFile(wb, "Project_Profitability.xlsx");
  };

  return (
    <div className="p-2.5 bg-[var(--color-background)] min-h-screen text-[var(--color-text)] font-sans">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text-heading)] flex items-center gap-2">
          <BiBarChart className="size-[16px]" /> Cost Accounting
        </h1>
        <div className="flex gap-2.5">
            {activeTab === 'projects' && (
                <button onClick={() => setShowProjectModal(true)} className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm shadow-sm">
                    <BiPlus className="size-[14px]" /> New Project
                </button>
            )}
            {activeTab === 'timesheets' && (
                <button onClick={() => setShowTimesheetModal(true)} className="btn-warning flex items-center gap-2 py-2.5 px-4 text-sm shadow-sm">
                    <BiTime className="size-[14px]" /> Log Time
                </button>
            )}
            {activeTab === 'cost-centers' && (
                <button onClick={() => setShowCostCenterModal(true)} className="btn-success flex items-center gap-2 py-2.5 px-4 text-sm shadow-sm">
                    <BiPlus className="size-[14px]" /> New Cost Center
                </button>
            )}
            {activeTab === 'reports' && (
                <button onClick={exportReport} className="btn-secondary flex items-center gap-2 py-2.5 px-4 text-sm font-medium shadow-sm">
                     Export Report
                </button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-[var(--color-border)] mb-6 overflow-x-auto">
        <button 
          className={`pb-3 px-2 text-sm whitespace-nowrap transition-colors relative ${activeTab === 'projects' ? 'text-primary font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          onClick={() => setActiveTab('projects')}
        >
          Projects
          {activeTab === 'projects' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
        </button>
        <button 
          className={`pb-3 px-2 text-sm whitespace-nowrap transition-colors relative ${activeTab === 'centers' ? 'text-primary font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          onClick={() => setActiveTab('centers')}
        >
          Cost Centers
          {activeTab === 'centers' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
        </button>
        <button 
          className={`pb-3 px-2 text-sm whitespace-nowrap transition-colors relative ${activeTab === 'allocation' ? 'text-primary font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          onClick={() => setActiveTab('allocation')}
        >
          Allocation
          {activeTab === 'allocation' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
        </button>
        <button 
          className={`pb-3 px-2 text-sm whitespace-nowrap transition-colors relative ${activeTab === 'reports' ? 'text-primary font-bold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
          {activeTab === 'reports' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />}
        </button>
      </div>

      {/* Content */}
      <div className="bg-[var(--color-surface)] rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        {activeTab === 'projects' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-hover)]">
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Code</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Project Name</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Client</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-right">Budget</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {projects.map(p => (
                  <tr key={p._id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)]">{p.code}</td>
                    <td className="px-4 py-2.5 text-sm text-[var(--color-text)]">{p.name}</td>
                    <td className="px-4 py-2.5 text-sm text-[var(--color-text)]">{p.client?.name || '-'}</td>
                    <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-sm font-bold border ${
                            p.status === 'In Progress' ? 'bg-primary/10 text-primary border-primary/20' :
                            p.status === 'Completed' ? 'bg-success/10 text-success border-success/20' :
                            'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-border)]'
                        }`}>
                            {p.status}
                        </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-right text-[var(--color-text)] font-mono">${(Number(p.budget) || 0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center">
                        <button onClick={() => openProjectAnalytics(p._id)} className="text-primary hover:text-primary-dark p-1.5 hover:bg-primary/10 rounded transition-colors" title="View Analytics">
                            <BiDetail className="size-[14px]" />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'timesheets' && (
          <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-hover)]">
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Date</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Employee</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Project</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Task</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] text-right">Hours</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map(t => (
                  <tr key={t._id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{t.date ? new Date(t.date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{t.employee?.firstName} {t.employee?.lastName}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{t.project?.name}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">{t.taskDescription}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-right text-[var(--color-text)]">{t.hours}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-right font-medium text-[var(--color-text-muted)]">${(Number(t.totalCost) || 0).toLocaleString()}</td>
                  </tr>
                ))}
                 {timesheets.length === 0 && (
                        <tr><td colSpan="6" className="p-4 text-center text-sm text-[var(--color-text-muted)]">No timesheets recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cost-centers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-hover)]">
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Code</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Name</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Manager</th>
                  <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)] text-right">Budget</th>
                </tr>
              </thead>
              <tbody>
                {costCenters.map(c => (
                  <tr key={c._id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-medium text-[var(--color-text)]">{c.code}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{c.name}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{c.manager || '-'}</td>
                    <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-right text-[var(--color-text)]">${(Number(c.budget) || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'reports' && (
          <div>
            <h3 className="text-lg font-bold mb-2 text-[var(--color-text-heading)]">Project Profitability Analysis</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-[var(--color-surface-hover)]">
                    <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Project Code</th>
                    <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-[var(--color-text-muted)]">Project Name</th>
                    <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-right text-[var(--color-success)]">Revenue</th>
                    <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-right text-[var(--color-danger)]">Expenses</th>
                    <th className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm font-bold text-right text-[var(--color-text-muted)]">Net Profit</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map(r => (
                    <tr key={r.id} className="hover:bg-[var(--color-surface-hover)] transition-colors">
                        <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{r.code}</td>
                        <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-[var(--color-text)]">{r.name}</td>
                        <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-right text-[var(--color-success)]">${(Number(r.revenue) || 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-right text-[var(--color-danger)]">${(Number(r.expense) || 0).toLocaleString()}</td>
                        <td className={`px-4 py-2.5 border-b border-[var(--color-border)] text-sm text-right font-bold ${r.profit >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            ${(Number(r.profit) || 0).toLocaleString()}
                        </td>
                    </tr>
                    ))}
                    {reportData.length === 0 && (
                        <tr><td colSpan="5" className="p-4 text-center text-sm text-[var(--color-text-muted)]">No transaction data available for projects.</td></tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-2xl w-full max-w-[500px] max-h-[90vh] overflow-y-auto border border-[var(--color-border)] animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]">
              <h2 className="text-xl font-bold text-[var(--color-text-heading)]">Create New Project</h2>
              <button onClick={() => setShowProjectModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-1.5 rounded-full hover:bg-[var(--color-surface)] transition-colors"><BiX size={16} /></button>
            </div>
            <form onSubmit={handleCreateProject} className="p-4 space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                    <label className="block text-sm font-bold mb-1.5 text-[var(--color-text)]">Project Code</label>
                    <input type="text" required className="input-base text-sm py-2.5 w-full" 
                    value={newProject.code} onChange={e => setNewProject({...newProject, code: e.target.value})} placeholder="e.g. PRJ-001" />
                </div>
                <div>
                    <label className="block text-sm font-bold mb-1.5 text-[var(--color-text)]">Status</label>
                    <select className="input-base text-sm py-2.5 w-full bg-[var(--color-input-bg)]"
                        value={newProject.status} onChange={e => setNewProject({...newProject, status: e.target.value})}>
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                    </select>
                </div>
              </div>
              <div>
                  <label className="block text-sm font-bold mb-1.5 text-[var(--color-text)]">Project Name</label>
                  <input type="text" required className="input-base text-sm py-2.5 w-full" 
                  value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} placeholder="Project Title" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                  <div>
                      <label className="block text-sm font-bold mb-1.5 text-[var(--color-text)]">Client</label>
                      <select className="input-base text-sm py-2.5 w-full bg-[var(--color-input-bg)]"
                          value={newProject.client} onChange={e => setNewProject({...newProject, client: e.target.value})}>
                          <option value="">Select Client</option>
                          {partners.filter(p => p.type === 'Customer').map(p => (
                              <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-bold mb-1.5 text-[var(--color-text)]">Total Budget</label>
                      <input type="number" required className="input-base text-sm py-2.5 w-full" 
                      value={newProject.budget} onChange={e => setNewProject({...newProject, budget: e.target.value})} placeholder="0.00" />
                  </div>
              </div>
              
              <div className="border-t border-[var(--color-border)] pt-4 mt-2">
                  <h4 className="text-sm font-bold text-[var(--color-text-muted)] uppercase mb-3">Budget Breakdown</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                      <div>
                          <label className="block text-sm font-medium mb-1 text-[var(--color-text-muted)]">Labor</label>
                          <input type="number" className="input-base text-sm py-2.5 w-full" 
                          value={newProject.budgetBreakdown.labor} onChange={e => setNewProject({...newProject, budgetBreakdown: {...newProject.budgetBreakdown, labor: e.target.value}})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1 text-[var(--color-text-muted)]">Material</label>
                          <input type="number" className="input-base text-sm py-2.5 w-full" 
                          value={newProject.budgetBreakdown.material} onChange={e => setNewProject({...newProject, budgetBreakdown: {...newProject.budgetBreakdown, material: e.target.value}})} />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1 text-[var(--color-text-muted)]">Overhead</label>
                          <input type="number" className="input-base text-sm py-2.5 w-full" 
                          value={newProject.budgetBreakdown.overhead} onChange={e => setNewProject({...newProject, budgetBreakdown: {...newProject.budgetBreakdown, overhead: e.target.value}})} />

                      </div>
                  </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowProjectModal(false)} className="btn-secondary py-2.5 px-4 text-sm">Cancel</button>
                  <button type="submit" className="btn-primary py-2.5 px-4 text-sm font-medium">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timesheet Modal */}
      {showTimesheetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-2xl p-5 w-full max-w-md border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-heading)]">Log Time</h2>
              <button onClick={() => setShowTimesheetModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><BiX size={16} /></button>
            </div>
            <form onSubmit={handleCreateTimesheet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Employee</label>
                <select className="input-base text-sm py-2.5" required
                    value={newTimesheet.employee} onChange={e => setNewTimesheet({...newTimesheet, employee: e.target.value})}>
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                        <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Project</label>
                <select className="input-base text-sm py-2.5" required
                    value={newTimesheet.project} onChange={e => setNewTimesheet({...newTimesheet, project: e.target.value})}>
                    <option value="">Select Project</option>
                    {projects.map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Date</label>
                    <input type="date" required className="input-base text-sm py-2.5"
                    value={newTimesheet.date} onChange={e => setNewTimesheet({...newTimesheet, date: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Hours</label>
                    <input type="number" required step="0.5" className="input-base text-sm py-2.5"
                    value={newTimesheet.hours} onChange={e => setNewTimesheet({...newTimesheet, hours: Number(e.target.value)})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Task Description</label>
                <textarea className="input-base text-sm py-2.5" rows="2"
                    value={newTimesheet.taskDescription} onChange={e => setNewTimesheet({...newTimesheet, taskDescription: e.target.value})}></textarea>
              </div>
              <button type="submit" className="w-full btn-warning py-2.5 text-sm font-medium">Submit Timesheet</button>
            </form>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && selectedProjectAnalytics && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--color-surface)] rounded-lg p-5 w-full max-w-xl max-h-[90vh] overflow-y-auto border border-[var(--color-border)]">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text-heading)]">{selectedProjectAnalytics.project.name}</h2>
                        <p className="text-[var(--color-text-muted)] text-sm">Project Code: {selectedProjectAnalytics.project.code}</p>
                    </div>
                    <button onClick={() => setShowAnalyticsModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><BiX size={16} /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    {/* Key Metrics */}
                    <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                        <h4 className="text-primary font-semibold mb-0 text-sm">Total Revenue</h4>
                        <p className="text-sm font-bold text-primary dark:text-primary-light">${selectedProjectAnalytics.actuals.revenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-danger/10 p-3 rounded-lg border border-danger/20">
                        <h4 className="text-danger font-semibold mb-0 text-sm">Total Cost</h4>
                        <p className="text-sm font-bold text-danger">${selectedProjectAnalytics.actuals.totalCost.toLocaleString()}</p>
                        <div className="text-sm text-danger/80 mt-1">
                            Labor: ${selectedProjectAnalytics.actuals.labor.toLocaleString()} <br/>
                            Material: ${selectedProjectAnalytics.actuals.material.toLocaleString()}
                        </div>
                    </div>
                    <div className={`p-3 rounded-lg border ${selectedProjectAnalytics.actuals.profit >= 0 ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                        <h4 className={`${selectedProjectAnalytics.actuals.profit >= 0 ? 'text-success' : 'text-danger'} font-semibold mb-0 text-sm`}>Net Profit</h4>
                        <p className={`text-sm font-bold ${selectedProjectAnalytics.actuals.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                            ${selectedProjectAnalytics.actuals.profit.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Budget vs Actual Visualization */}
                <div className="mb-2.5">
                    <h3 className="text-lg font-bold mb-2 text-[var(--color-text-heading)]">Budget vs Actual</h3>
                    
                    <div className="space-y-2.5">
                        {/* Total Budget */}
                        <div>
                            <div className="flex justify-between text-sm mb-1 text-[var(--color-text)]">
                                <span>Total Budget Consumption</span>
                                <span className="font-semibold">
                                    ${selectedProjectAnalytics.actuals.totalCost.toLocaleString()} / ${selectedProjectAnalytics.project.budget.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full bg-[var(--color-border)] rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full ${
                                    (selectedProjectAnalytics.actuals.totalCost / selectedProjectAnalytics.project.budget) > 1 ? 'bg-danger' : 'bg-primary'
                                }`}
                                    style={{ width: `${Math.min((selectedProjectAnalytics.actuals.totalCost / (selectedProjectAnalytics.project.budget || 1)) * 100, 100)}%` }}>
                                </div>
                            </div>
                        </div>

                         {/* Labor Budget */}
                         <div>
                            <div className="flex justify-between text-sm mb-1 text-[var(--color-text)]">
                                <span>Labor Budget (Actual: {selectedProjectAnalytics.actuals.hours} hrs)</span>
                                <span className="font-semibold">
                                    ${selectedProjectAnalytics.actuals.labor.toLocaleString()} / ${(selectedProjectAnalytics.project.budgetBreakdown?.labor || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full bg-[var(--color-border)] rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-warning"
                                    style={{ width: `${Math.min((selectedProjectAnalytics.actuals.labor / (selectedProjectAnalytics.project.budgetBreakdown?.labor || 1)) * 100, 100)}%` }}>
                                </div>
                            </div>
                        </div>

                        {/* Material Budget */}
                        <div>
                            <div className="flex justify-between text-sm mb-1 text-[var(--color-text)]">
                                <span>Material & Other Budget</span>
                                <span className="font-semibold">
                                    ${selectedProjectAnalytics.actuals.material.toLocaleString()} / ${(selectedProjectAnalytics.project.budgetBreakdown?.material || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full bg-[var(--color-border)] rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-primary"
                                    style={{ width: `${Math.min(((selectedProjectAnalytics.actuals.material || 0) / (selectedProjectAnalytics.project.budgetBreakdown?.material || 1)) * 100, 100)}%` }}>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[var(--color-border)] pt-4 flex justify-end">
                    <button onClick={() => setShowAnalyticsModal(false)} className="btn-secondary py-2.5 px-3 text-sm">Close</button>
                </div>
            </div>
          </div>
      )}

      {/* Cost Center Modal */}
      {showCostCenterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--color-surface)] rounded-xl shadow-2xl p-4 w-full max-w-sm border border-[var(--color-border)]">
            <div className="flex justify-between items-center mb-2.5">
              <h2 className="text-xl font-bold text-[var(--color-text-heading)]">Create Cost Center</h2>
              <button onClick={() => setShowCostCenterModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"><BiX size={16} /></button>
            </div>
            <form onSubmit={handleCreateCostCenter} className="space-y-2.5">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Code</label>
                <input type="text" required className="input-base text-sm py-2.5" 
                  value={newCostCenter.code} onChange={e => setNewCostCenter({...newCostCenter, code: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Name</label>
                <input type="text" required className="input-base text-sm py-2.5" 
                  value={newCostCenter.name} onChange={e => setNewCostCenter({...newCostCenter, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Manager</label>
                <input type="text" className="input-base text-sm py-2.5" 
                  value={newCostCenter.manager} onChange={e => setNewCostCenter({...newCostCenter, manager: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-[var(--color-text)]">Budget</label>
                <input type="number" className="input-base text-sm py-2.5" 
                  value={newCostCenter.budget} onChange={e => setNewCostCenter({...newCostCenter, budget: Number(e.target.value)})} />
              </div>
              <button type="submit" className="w-full btn-success py-2.5 text-sm font-medium">Create Cost Center</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostAccounting;