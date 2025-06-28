import { BeliefCardGrid } from '@/components/feed/BeliefCardGrid';
import { Search, Filter, TrendingUp, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#B9D9EB]/10 via-transparent to-[#0C1D51]/5" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-br from-[#B9D9EB]/20 to-[#0C1D51]/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6">
              <span className="text-gradient-primary">Truth Through</span>
              <br />
              <span className="text-gradient-secondary">Collective Intelligence</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Discover accurate information through economic incentives and community consensus. 
              Submit beliefs, earn rewards, and shape the future of truth-finding.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button className="btn-primary px-8 py-4 text-lg">
                Explore Beliefs
              </button>
              <button className="btn-secondary px-8 py-4 text-lg">
                How It Works
              </button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {[
                { label: 'Active Beliefs', value: '1,234', icon: TrendingUp },
                { label: 'Total Participants', value: '12.5K', icon: Users },
                { label: 'Consensus Reached', value: '892', icon: Search },
                { label: 'Rewards Distributed', value: '$2.1M', icon: Filter },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B9D9EB]/20 to-[#0C1D51]/10 mb-3">
                      <Icon className="w-6 h-6 text-[#0C1D51] dark:text-[#B9D9EB]" />
                    </div>
                    <div className="text-2xl md:text-3xl font-bold text-[#0C1D51] dark:text-[#B9D9EB] mb-1">
                      {stat.value}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {stat.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-6 pb-16">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gradient-primary mb-3">
              Active Beliefs
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Explore ongoing predictions and contribute your insights
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-4 mt-6 md:mt-0">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#B9D9EB] transition-colors duration-300">
              <Filter className="w-4 h-4" />
              <span>Filter</span>
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-[#B9D9EB] transition-colors duration-300">
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </div>

        {/* Belief Cards Grid */}
        <BeliefCardGrid />
      </div>
    </div>
  );
}