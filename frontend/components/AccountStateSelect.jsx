import { useState, useRef, useEffect } from 'react';

const AccountStateSelect = ({ 
  value, 
  onChange, 
  placeholder = "Select Account State", 
  required = false,
  disabled = false,
  style = {} 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const options = [
    { value: '', label: '✕ Clear selection', color: '#dc3545', isClear: true },
    { value: 'Activated', label: '✅ Activated', color: '#28a745' },
    { value: 'Deactivated', label: '❌ Deactivated', color: '#dc3545' }
  ];

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option.value === '' ? null : option.value);
    setIsOpen(false);
  };


  return (
    <div className="form-group" style={{ ...style, marginBottom: '16px', textAlign: 'left' }}>
      {!style.hideLabel && (
      <label style={{ textAlign: 'left' }}>
        Account State {required && <span style={{color: 'red'}}>*</span>}
      </label>
      )}
      <div 
        ref={dropdownRef}
        style={{
          position: 'relative',
          width: '100%'
        }}
      >
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          style={{
            padding: '14px 16px',
            border: isOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '1rem',
            color: selectedOption ? '#000000' : '#adb5bd',
            transition: 'all 0.3s ease',
            boxShadow: isOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
          }}
        >
          <span style={{ color: selectedOption ? selectedOption.color : '#adb5bd' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        
        {isOpen && (
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
            {options.map((option) => (
              <div
                key={option.value === '' ? 'clear' : option.value}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f8f9fa',
                  transition: 'background-color 0.2s ease',
                  color: option.isClear ? '#dc3545' : '#000000',
                  fontWeight: option.isClear ? '500' : 'normal'
                }}
                onClick={() => handleSelect(option)}
                onMouseEnter={(e) => e.target.style.backgroundColor = option.isClear ? '#fff5f5' : '#f8f9fa'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountStateSelect;
