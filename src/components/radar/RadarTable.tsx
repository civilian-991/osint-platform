'use client';

import { useMemo, useState } from 'react';
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getFlagFromHex } from '@/lib/utils/country-flags';
import type { PositionLatest } from '@/lib/types/aircraft';
import type { MilitaryCategory } from '@/lib/types/aircraft';

type SortField = 'hex' | 'callsign' | 'type' | 'squawk' | 'altitude' | 'speed' | 'track' | 'lat' | 'lon';
type SortDirection = 'asc' | 'desc';

interface RadarTableProps {
  positions: PositionLatest[];
  selectedId: string | null;
  onSelect: (position: PositionLatest) => void;
  filter: string;
  categoryFilter: MilitaryCategory | 'all' | 'strat' | 'recon' | 'cargo';
}

const CATEGORY_COLORS: Record<string, string> = {
  tanker: 'text-amber-400',
  awacs: 'text-purple-400',
  isr: 'text-cyan-400',
  transport: 'text-green-400',
  fighter: 'text-red-400',
  helicopter: 'text-blue-400',
  trainer: 'text-pink-400',
  other: 'text-gray-400',
};

// Map filter categories to actual military categories
const CATEGORY_MAP: Record<string, MilitaryCategory[]> = {
  strat: ['awacs', 'isr'],
  recon: ['isr'],
  tank: ['tanker'],
  cargo: ['transport'],
};

export function RadarTable({ positions, selectedId, onSelect, filter, categoryFilter }: RadarTableProps) {
  const [sortField, setSortField] = useState<SortField>('altitude');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let filtered = positions;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.icao_hex?.toLowerCase().includes(term) ||
        p.callsign?.toLowerCase().includes(term) ||
        p.aircraft?.registration?.toLowerCase().includes(term) ||
        p.aircraft?.type_code?.toLowerCase().includes(term)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      const categories = CATEGORY_MAP[categoryFilter] || [categoryFilter];
      filtered = filtered.filter(p => {
        const cat = p.aircraft?.military_category as MilitaryCategory;
        return categories.includes(cat);
      });
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case 'hex':
          aVal = a.icao_hex || '';
          bVal = b.icao_hex || '';
          break;
        case 'callsign':
          aVal = a.callsign || '';
          bVal = b.callsign || '';
          break;
        case 'type':
          aVal = a.aircraft?.type_code || '';
          bVal = b.aircraft?.type_code || '';
          break;
        case 'squawk':
          aVal = a.squawk || '';
          bVal = b.squawk || '';
          break;
        case 'altitude':
          aVal = a.altitude || 0;
          bVal = b.altitude || 0;
          break;
        case 'speed':
          aVal = a.ground_speed || 0;
          bVal = b.ground_speed || 0;
          break;
        case 'track':
          aVal = a.track || 0;
          bVal = b.track || 0;
          break;
        case 'lat':
          aVal = a.latitude || 0;
          bVal = b.latitude || 0;
          break;
        case 'lon':
          aVal = a.longitude || 0;
          bVal = b.longitude || 0;
          break;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return sorted;
  }, [positions, searchTerm, categoryFilter, sortField, sortDirection]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const getTypeColor = (category?: string) => {
    return CATEGORY_COLORS[category || 'other'] || CATEGORY_COLORS.other;
  };

  return (
    <div className="radar-table-container">
      {/* Search */}
      <div className="radar-search">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="HEX / CALL / REG / TYPE"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="radar-search-input"
        />
      </div>

      {/* Table */}
      <div className="radar-table-wrapper">
        <table className="radar-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('hex')}>
                HEX ID <SortIcon field="hex" />
              </th>
              <th onClick={() => handleSort('callsign')}>
                CALLSIGN <SortIcon field="callsign" />
              </th>
              <th>REG</th>
              <th onClick={() => handleSort('type')}>
                TYPE <SortIcon field="type" />
              </th>
              <th onClick={() => handleSort('squawk')}>
                SQUAWK <SortIcon field="squawk" />
              </th>
              <th onClick={() => handleSort('altitude')}>
                ALT. (FT) <SortIcon field="altitude" />
              </th>
              <th onClick={() => handleSort('speed')}>
                SPD. (KT) <SortIcon field="speed" />
              </th>
              <th onClick={() => handleSort('track')}>
                TRACK <SortIcon field="track" />
              </th>
              <th onClick={() => handleSort('lat')}>
                LATITUDE <SortIcon field="lat" />
              </th>
              <th onClick={() => handleSort('lon')}>
                LONGITUDE <SortIcon field="lon" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((position) => {
              const isSelected = position.aircraft_id === selectedId;
              const flag = getFlagFromHex(position.icao_hex || '');
              const category = position.aircraft?.military_category || undefined;
              const typeColor = getTypeColor(category);

              return (
                <tr
                  key={position.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onSelect(position)}
                >
                  <td className="hex-cell">
                    <span className="flag">{flag}</span>
                    <span className="hex">{position.icao_hex || '------'}</span>
                  </td>
                  <td className="callsign-cell">
                    {position.callsign || '-------'}
                  </td>
                  <td className="reg-cell">
                    {position.aircraft?.registration || ''}
                  </td>
                  <td className={`type-cell ${typeColor}`}>
                    {position.aircraft?.type_code || ''}
                  </td>
                  <td className="squawk-cell">
                    {position.squawk || '----'}
                  </td>
                  <td className="alt-cell">
                    <strong>{position.altitude?.toLocaleString() || '-'}</strong>
                  </td>
                  <td className="speed-cell">
                    {position.ground_speed || '-'}
                  </td>
                  <td className="track-cell">
                    {position.track ? `${position.track.toFixed(1)}°` : '-'}
                  </td>
                  <td className="coord-cell">
                    {position.latitude?.toFixed(2) || '-'}
                  </td>
                  <td className="coord-cell">
                    {position.longitude?.toFixed(2) || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
