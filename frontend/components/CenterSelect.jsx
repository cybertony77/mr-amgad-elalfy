import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/axios';

export default function CenterSelect({ selectedCenter, onCenterChange, required = false, isOpen, onToggle, onClose }) {
  // Handle legacy props (value, onChange) for backward compatibility
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const actualIsOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const actualOnToggle = onToggle || (() => setInternalIsOpen(!internalIsOpen));
  const actualOnClose = onClose || (() => setInternalIsOpen(false));

  // Authentication is now handled by _app.js with HTTP-only cookies

  // Fetch centers from API
  const { data: centers = [], isLoading, error } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      console.log('🔄 CenterSelect: Fetching centers data');
      const response = await apiClient.get('/api/centers');
      const centerNames = response.data.centers.map(center => center.name);
      console.log('🔄 CenterSelect: Received centers:', centerNames);
      return centerNames;
    },
    retry: 3,
    retryDelay: 1000,
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  const handleCenterSelect = (center) => {
    onCenterChange(center);
    actualOnClose();
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          border: actualIsOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedCenter ? '#000000' : '#adb5bd',
          transition: 'all 0.3s ease',
          boxShadow: actualIsOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={actualOnToggle}
        onBlur={() => setTimeout(actualOnClose, 200)}
      >
        <span>
          {isLoading ? 'Loading centers...' : (selectedCenter || 'Select Center')}
        </span>
      </div>
      

      
      {actualIsOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '2px solid #e9ecef',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '4px'
        }}>
          {/* Clear selection option */}
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #f8f9fa',
              transition: 'background-color 0.2s ease',
              color: '#dc3545',
              fontWeight: '500'
            }}
            onClick={() => handleCenterSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {error ? (
            <div
              style={{
                padding: '12px 16px',
                color: '#dc3545',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              Error loading centers
            </div>
          ) : isLoading ? (
            <div
              style={{
                padding: '12px 16px',
                color: '#666',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              Loading centers...
            </div>
          ) : centers.length === 0 ? (
            <div
              style={{
                padding: '12px 16px',
                color: '#666',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}
            >
              No centers available
            </div>
          ) : centers.map((center) => (
            <div
              key={center}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: '#000000'
              }}
              onClick={() => handleCenterSelect(center)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
            >
              {center}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 