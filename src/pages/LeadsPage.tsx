import React, { useState } from 'react';
import { useLead } from '../context/LeadContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Search, Flame, Thermometer, Snowflake, Download } from 'lucide-react';

export default function LeadsPage() {
  const { leads } = useLead();
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('Todos');

  const getMaturityIcon = (maturity: string) => {
    switch (maturity) {
      case 'Quente': return <Flame className="w-4 h-4 text-red-500" />;
      case 'Morno': return <Thermometer className="w-4 h-4 text-amber-500" />;
      case 'Frio': return <Snowflake className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const getMaturityBadgeColor = (maturity: string) => {
    switch (maturity) {
      case 'Quente': return 'bg-red-100 text-red-700 border-red-200';
      case 'Morno': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Frio': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          lead.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'Todos' || lead.maturity === filter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => b.timestamp - a.timestamp); // Sort by newest

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(timestamp));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="font-bold text-xl text-slate-800">Gestão de Leads</h1>
            </div>
          </div>
          <button className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="relative w-full sm:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm"
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            {['Todos', 'Quente', 'Morno', 'Frio', 'Não Classificado'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border ${
                  filter === status 
                    ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <div className="text-slate-500 text-sm font-medium mb-1">Total de Leads</div>
            <div className="text-3xl font-black text-slate-800">{leads.length}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] opacity-5">
              <Flame className="w-32 h-32 text-red-500" />
            </div>
            <div className="text-red-600/80 text-sm font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Flame className="w-4 h-4"/> Quentes</div>
            <div className="text-3xl font-black text-red-600">{leads.filter(l => l.maturity === 'Quente').length}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] opacity-5">
              <Thermometer className="w-32 h-32 text-amber-500" />
            </div>
            <div className="text-amber-600/80 text-sm font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Thermometer className="w-4 h-4"/> Mornos</div>
            <div className="text-3xl font-black text-amber-600">{leads.filter(l => l.maturity === 'Morno').length}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] opacity-5">
              <Snowflake className="w-32 h-32 text-blue-500" />
            </div>
            <div className="text-blue-600/80 text-sm font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Snowflake className="w-4 h-4"/> Frios</div>
            <div className="text-3xl font-black text-blue-600">{leads.filter(l => l.maturity === 'Frio').length}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Nome do Lead</th>
                  <th className="px-6 py-4">Intenção</th>
                  <th className="px-6 py-4">Maturidade</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Duração</th>
                  <th className="px-6 py-4 w-full">Detalhes Coletados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{formatDate(lead.timestamp)}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{lead.name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{lead.id.split('-')[1]}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {lead.intent}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getMaturityBadgeColor(lead.maturity)}`}>
                          {getMaturityIcon(lead.maturity)}
                          {lead.maturity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-black text-slate-700">{lead.score} <span className="font-normal text-slate-400 text-xs">pts</span></div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {lead.durationInSeconds !== undefined ? `${Math.floor(lead.durationInSeconds / 60)}m ${lead.durationInSeconds % 60}s` : '--'}
                      </td>
                      <td className="px-6 py-4 w-full">
                        <div className="flex flex-wrap gap-2 max-w-xl">
                          {Object.keys(lead.details).length > 0 ? (
                            Object.entries(lead.details).map(([k, v]) => (
                              <span key={k} className="inline-flex items-center px-2 py-1 rounded bg-slate-50 text-slate-600 border border-slate-100 text-xs truncate max-w-[200px]" title={`${k}: ${v}`}>
                                <strong className="mr-1 capitalize font-semibold">{k.replace(/_/g, ' ')}:</strong> {v}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs italic">Nenhum dado extra</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Users className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-base font-medium text-slate-600">Nenhum lead encontrado.</p>
                        <p className="text-sm">Tente ajustar seus filtros ou aguarde novas interações.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
