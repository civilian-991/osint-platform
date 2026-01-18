'use client';

import { useState } from 'react';
import { useCorrelations } from '@/hooks/useCorrelations';
import CorrelationCard from '@/components/correlations/CorrelationCard';
import Timeline from '@/components/correlations/Timeline';
import type { CorrelationWithRelations, CorrelationStatus } from '@/lib/types/correlation';
import { Link2, Filter, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const STATUS_OPTIONS: { value: CorrelationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'flagged', label: 'Flagged' },
];

export default function CorrelationsPage() {
  const [statusFilter, setStatusFilter] = useState<CorrelationStatus | 'all'>('all');
  const [selectedCorrelation, setSelectedCorrelation] =
    useState<CorrelationWithRelations | null>(null);

  const { correlations, loading, error, refresh, updateStatus } = useCorrelations({
    status: statusFilter === 'all' ? undefined : statusFilter,
    refreshInterval: 60000,
  });

  const handleVerify = async (id: string, status: CorrelationStatus) => {
    try {
      await updateStatus(id, status);
    } catch (err) {
      console.error('Failed to update correlation status:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="h-6 w-6" />
            Correlations
          </h1>

          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Status:</span>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={cn(
                'px-3 py-1 rounded text-sm transition-colors',
                statusFilter === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Timeline and List */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Timeline */}
          <div className="mb-6">
            <Timeline
              correlations={correlations}
              onCorrelationClick={setSelectedCorrelation}
              selectedCorrelationId={selectedCorrelation?.id}
              hours={24}
            />
          </div>

          {/* Correlations Grid */}
          <h2 className="font-semibold text-lg mb-4">
            Recent Correlations ({correlations.length})
          </h2>

          {loading && correlations.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : correlations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Link2 className="h-10 w-10 mb-2 opacity-50" />
              <p>No correlations found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {correlations.map((correlation) => (
                <CorrelationCard
                  key={correlation.id}
                  correlation={correlation}
                  onClick={() => setSelectedCorrelation(correlation)}
                  isSelected={selectedCorrelation?.id === correlation.id}
                  onVerify={(status) => handleVerify(correlation.id, status)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        {selectedCorrelation && (
          <div className="w-96 border-l border-border overflow-y-auto p-4">
            <CorrelationDetails
              correlation={selectedCorrelation}
              onClose={() => setSelectedCorrelation(null)}
              onVerify={(status) => handleVerify(selectedCorrelation.id, status)}
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border-t border-destructive text-destructive text-sm">
          {error.message}
        </div>
      )}
    </div>
  );
}

function CorrelationDetails({
  correlation,
  onClose,
  onVerify,
}: {
  correlation: CorrelationWithRelations;
  onClose: () => void;
  onVerify: (status: CorrelationStatus) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Correlation Details</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          &times;
        </button>
      </div>

      <CorrelationCard
        correlation={correlation}
        onVerify={onVerify}
        isSelected={false}
      />
    </div>
  );
}
