'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAircraft } from '@/hooks/useAircraft';
import { RadarHeader } from '@/components/radar/RadarHeader';
import { RadarTable } from '@/components/radar/RadarTable';
import { AircraftInfoPanel } from '@/components/radar/AircraftInfoPanel';
import { CategoryTabs, type CategoryFilter } from '@/components/radar/CategoryTabs';
import type { PositionLatest } from '@/lib/types/aircraft';

// Dynamically import map to avoid SSR issues with Mapbox
const AircraftMap = dynamic(() => import('@/components/map/AircraftMap'), {
  ssr: false,
  loading: () => (
    <div className="radar-map-loading">
      <div className="radar-map-loading-spinner" />
    </div>
  ),
});

export default function RadarPage() {
  const [selectedAircraft, setSelectedAircraft] = useState<PositionLatest | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const { positions, loading, error } = useAircraft({
    live: true,
    refreshInterval: 15000, // 15 second refresh like IntelSky
    military: true,
  });

  const handleAircraftSelect = useCallback((position: PositionLatest) => {
    setSelectedAircraft(position);
  }, []);

  const handleMapClick = useCallback(() => {
    // Don't deselect on map click - keep selection persistent
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedAircraft(null);
  }, []);

  const handleCategoryChange = useCallback((category: CategoryFilter) => {
    setCategoryFilter(category);
  }, []);

  // Map category filter to military category for table
  const getMilitaryCategory = () => {
    switch (categoryFilter) {
      case 'strat': return 'strat';
      case 'recon': return 'recon';
      case 'tank': return 'tanker' as const;
      case 'cargo': return 'transport' as const;
      case 'oth': return 'other' as const;
      default: return 'all';
    }
  };

  return (
    <div className="radar-page">
      {/* Header */}
      <RadarHeader
        trackingCount={positions.length}
        updateInterval={15}
        isConnected={!error}
      />

      {/* Main Content */}
      <div className="radar-content">
        {/* Left Panel - Table */}
        <div className="radar-left-panel">
          <RadarTable
            positions={positions}
            selectedId={selectedAircraft?.aircraft_id || null}
            onSelect={handleAircraftSelect}
            filter=""
            categoryFilter={getMilitaryCategory()}
          />
        </div>

        {/* Right Panel - Map + Info */}
        <div className="radar-right-panel">
          <div className="radar-map-container">
            <AircraftMap
              positions={positions}
              onAircraftClick={handleAircraftSelect}
              onMapClick={handleMapClick}
              selectedAircraftId={selectedAircraft?.icao_hex}
              showRegions={true}
              strikesEnabled={false}
            />
          </div>

          {/* Aircraft Info Panel */}
          <AircraftInfoPanel
            position={selectedAircraft}
            onClose={handleClosePanel}
          />
        </div>
      </div>

      {/* Bottom Category Tabs */}
      <CategoryTabs
        activeCategory={categoryFilter}
        onCategoryChange={handleCategoryChange}
        isLive={true}
      />
    </div>
  );
}
