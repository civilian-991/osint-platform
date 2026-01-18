'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { ExportFormat } from '@/lib/services/export';
import ExportModal from './ExportModal';

interface ExportButtonProps {
  type: 'correlations' | 'aircraft';
  className?: string;
  disabled?: boolean;
}

export default function ExportButton({
  type,
  className = '',
  disabled = false,
}: ExportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (options: {
    format: ExportFormat;
    filters?: Record<string, string>;
  }) => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        format: options.format,
        ...options.filters,
      });

      const response = await fetch(`/api/export/${type}?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from content-disposition header
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${type}_export.${options.format}`;

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowModal(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled || exporting}
        className={`flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${className}`}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        Export
      </button>

      {showModal && (
        <ExportModal
          type={type}
          onExport={handleExport}
          onClose={() => setShowModal(false)}
          exporting={exporting}
        />
      )}
    </>
  );
}
