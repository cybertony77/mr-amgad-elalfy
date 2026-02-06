// Utility function to format phone numbers for database storage
// If number starts with 012, 011, 010, or 015, replace first 0 with 20
// Result: 01211172756 becomes 201211172756 (not 2001211172756)
export function formatPhoneForDB(phoneValue) {
  if (!phoneValue) return '';
  
  // Convert to string and remove all non-numeric characters
  let phone = phoneValue.toString().replace(/[^0-9]/g, '');
  
  // If phone starts with 012, 011, 010, or 015, replace first 0 with 20
  if (phone.match(/^(012|011|010|015)/)) {
    phone = '20' + phone.substring(1);
  }
  
  // If phone doesn't start with country code and doesn't match the pattern above,
  // PhoneInput should have already added the country code, so return as-is
  
  return phone;
}

// Validation and auto-fix function for Egypt phone numbers in react-phone-input-2
// For Egypt (+20), exactly 10 digits (NO leading 0 after country code)
// Valid format: +20 1211172756 (10 digits, no leading 0)
// Auto-fixes: +2001211172756 → +201211172756 (removes extra 0)
// Returns: { isValid: boolean, value: string (fixed), error: string }
export function validateEgyptPhone(value) {
  if (!value) return { isValid: true, value: value, error: '' };
  
  // Remove all non-numeric characters to check the number
  const digitsOnly = value.replace(/[^0-9]/g, '');
  
  // Check if it starts with 20 (Egypt country code)
  if (digitsOnly.startsWith('20')) {
    // Get the part after "20"
    let afterCountryCode = digitsOnly.substring(2);
    
    // Auto-fix: Remove leading 0 if present
    if (afterCountryCode.startsWith('0')) {
      afterCountryCode = afterCountryCode.substring(1);
    }
    
    // Limit to 10 digits maximum
    if (afterCountryCode.length > 10) {
      afterCountryCode = afterCountryCode.substring(0, 10);
    }
    
    // Reconstruct the phone number with +20 prefix
    const fixedDigits = '20' + afterCountryCode;
    
    // Reconstruct the full phone value with + prefix
    // The value from react-phone-input-2 includes the + sign
    const fixedValue = '+' + fixedDigits;
    
    // Return the fixed value
    return { isValid: true, value: fixedValue, error: '' };
  }
  
  return { isValid: true, value: value, error: '' };
}

// Handler to prevent typing beyond 10 digits after +20 for Egypt
// Total limit: 12 digits (20 country code + 10 phone digits)
export function handleEgyptPhoneKeyDown(e, currentValue) {
  // Allow special keys (backspace, delete, arrow keys, tab, etc.)
  const allowedKeys = [
    'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    'Tab', 'Home', 'End', 'Enter', 'Escape'
  ];
  
  if (allowedKeys.includes(e.key)) {
    return; // Allow these keys
  }
  
  // Allow Ctrl/Cmd + A, C, V, X (select all, copy, paste, cut)
  if (e.ctrlKey || e.metaKey) {
    return; // Allow these combinations
  }
  
  // Check if it's an Egyptian number
  if (!currentValue) return;
  
  const digitsOnly = currentValue.replace(/[^0-9]/g, '');
  
  if (digitsOnly.startsWith('20')) {
    const afterCountryCode = digitsOnly.substring(2);
    
    // Remove leading 0 if present for counting
    let phoneDigits = afterCountryCode;
    if (phoneDigits.startsWith('0')) {
      phoneDigits = phoneDigits.substring(1);
    }
    
    // If we already have 10 digits after +20, prevent typing
    if (phoneDigits.length >= 10) {
      // Only prevent if it's a digit or number key
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }
}
