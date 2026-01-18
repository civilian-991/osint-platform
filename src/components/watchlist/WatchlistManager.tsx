'use client';

import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useWatchlists } from '@/hooks/useWatchlists';
import type { WatchlistWithItems, WatchlistItem } from '@/lib/types/watchlist';
import { MATCH_TYPE_LABELS, getPriorityBadgeClass, PRIORITY_LABELS } from '@/lib/types/watchlist';
import WatchlistItemForm from './WatchlistItemForm';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface WatchlistManagerProps {
  onSelectItem?: (item: WatchlistItem) => void;
}

export default function WatchlistManager({ onSelectItem }: WatchlistManagerProps) {
  const {
    watchlists,
    loading,
    error,
    createWatchlist,
    updateWatchlist,
    deleteWatchlist,
    addItem,
    deleteItem,
  } = useWatchlists();

  const [expandedWatchlists, setExpandedWatchlists] = useState<Set<string>>(new Set());
  const [editingWatchlistId, setEditingWatchlistId] = useState<string | null>(null);
  const [showAddWatchlistForm, setShowAddWatchlistForm] = useState(false);
  const [addingItemToWatchlist, setAddingItemToWatchlist] = useState<string | null>(null);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [newWatchlistDescription, setNewWatchlistDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedWatchlists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreateWatchlist = async () => {
    if (!newWatchlistName.trim()) {
      setFormError('Name is required');
      return;
    }

    try {
      setFormError(null);
      await createWatchlist({
        name: newWatchlistName.trim(),
        description: newWatchlistDescription.trim() || undefined,
      });
      setNewWatchlistName('');
      setNewWatchlistDescription('');
      setShowAddWatchlistForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create watchlist');
    }
  };

  const handleToggleActive = async (watchlist: WatchlistWithItems) => {
    try {
      await updateWatchlist(watchlist.id, { is_active: !watchlist.is_active });
    } catch (err) {
      console.error('Failed to toggle watchlist:', err);
    }
  };

  const handleDeleteWatchlist = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watchlist? This cannot be undone.')) {
      return;
    }

    try {
      await deleteWatchlist(id);
    } catch (err) {
      console.error('Failed to delete watchlist:', err);
    }
  };

  const handleDeleteItem = async (watchlistId: string, itemId: string) => {
    if (!confirm('Are you sure you want to remove this item?')) {
      return;
    }

    try {
      await deleteItem(watchlistId, itemId);
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>Error loading watchlists: {error.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Watchlists</h2>
        <button
          onClick={() => setShowAddWatchlistForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Watchlist
        </button>
      </div>

      {/* Add Watchlist Form */}
      {showAddWatchlistForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h3 className="font-medium">Create New Watchlist</h3>
          <input
            type="text"
            value={newWatchlistName}
            onChange={(e) => setNewWatchlistName(e.target.value)}
            placeholder="Watchlist name"
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
          <textarea
            value={newWatchlistDescription}
            onChange={(e) => setNewWatchlistDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setShowAddWatchlistForm(false);
                setFormError(null);
                setNewWatchlistName('');
                setNewWatchlistDescription('');
              }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateWatchlist}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Watchlists */}
      {watchlists.length === 0 && !showAddWatchlistForm ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No watchlists yet</p>
          <p className="text-sm mt-1">Create one to start tracking aircraft</p>
        </div>
      ) : (
        <div className="space-y-3">
          {watchlists.map((watchlist) => (
            <div
              key={watchlist.id}
              className={cn(
                'bg-card border rounded-lg overflow-hidden transition-all',
                watchlist.is_active ? 'border-border' : 'border-border/50 opacity-60'
              )}
            >
              {/* Watchlist Header */}
              <div
                onClick={() => toggleExpanded(watchlist.id)}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {expandedWatchlists.has(watchlist.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{watchlist.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      ({watchlist.items?.length || 0} items)
                    </span>
                  </div>
                  {watchlist.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {watchlist.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(watchlist);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title={watchlist.is_active ? 'Disable watchlist' : 'Enable watchlist'}
                  >
                    {watchlist.is_active ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWatchlist(watchlist.id);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete watchlist"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedWatchlists.has(watchlist.id) && (
                <div className="border-t border-border bg-muted/30">
                  {/* Items */}
                  {watchlist.items && watchlist.items.length > 0 ? (
                    <div className="divide-y divide-border">
                      {watchlist.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => onSelectItem?.(item)}
                          className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium">
                                {item.match_value}
                              </span>
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded-full',
                                getPriorityBadgeClass(item.priority)
                              )}>
                                {PRIORITY_LABELS[item.priority]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{MATCH_TYPE_LABELS[item.match_type]}</span>
                              {item.notes && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{item.notes}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {!item.alert_on_detection && (
                              <span className="text-xs text-muted-foreground">Alerts off</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(watchlist.id, item.id);
                              }}
                              className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No items in this watchlist
                    </div>
                  )}

                  {/* Add Item */}
                  {addingItemToWatchlist === watchlist.id ? (
                    <div className="p-4 border-t border-border">
                      <WatchlistItemForm
                        watchlistId={watchlist.id}
                        onSubmit={async (input) => {
                          await addItem(watchlist.id, input);
                          setAddingItemToWatchlist(null);
                        }}
                        onCancel={() => setAddingItemToWatchlist(null)}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingItemToWatchlist(watchlist.id)}
                      className="w-full p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 border-t border-border transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Item
                    </button>
                  )}

                  {/* Footer */}
                  <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/50">
                    Updated {formatDistanceToNow(new Date(watchlist.updated_at), { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
