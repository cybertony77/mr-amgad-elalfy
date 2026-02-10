import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Title from "../../components/Title";
import RoleSelect from "../../components/RoleSelect";
import AccountStateSelect from "../../components/AccountStateSelect";
import AddToContactAssistants from "../../components/AddToContactAssistants";
import { useAssistant, useAssistants, useUpdateAssistant, useCheckUsername } from '../../lib/api/assistants';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { formatPhoneForDB, validateEgyptPhone, handleEgyptPhoneKeyDown } from '../../lib/phoneUtils';

export default function EditAssistant() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [id, setId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [form, setForm] = useState({ id: "", name: "", phone: "", email: "", password: "", role: "", account_state: "Activated", ATCA: "no" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [originalForm, setOriginalForm] = useState(null); // Store original data for comparison
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results

  // React Query hooks
  const { data: assistant, isLoading: assistantLoading, error: assistantError } = useAssistant(searchId, { enabled: !!searchId });
  const { data: allAssistants } = useAssistants(); // Get all assistants for name search
  const updateAssistantMutation = useUpdateAssistant();
  const usernameCheck = useCheckUsername(form.id);

  useEffect(() => {
    // Only allow admin
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
    // Admin access is now handled by _app.js
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Handle assistant data when it loads
  useEffect(() => {
    if (assistant) {
      const formData = { 
        id: assistant.id, 
        name: assistant.name, 
        phone: assistant.phone, 
        email: assistant.email || "",
        password: "", 
        role: assistant.role || "assistant",
        account_state: assistant.account_state || "Activated",
        ATCA: assistant.ATCA || "no"
      };
      setForm(formData);
      setOriginalForm({ ...formData });
      setConfirmPassword("");
      setStep(2);
    }
  }, [assistant]);

  // Handle assistant error
  useEffect(() => {
    if (assistantError) {
      setError("❌ Assistant not found.");
    }
  }, [assistantError]);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSearchResults([]);
    setShowSearchResults(false);
    
    const searchTerm = id.trim();
    
    // Block editing the reserved username "tony"
    if (searchTerm.toLowerCase() === "tony") {
      setError("❌ You can't Edit tony's account");
      return;
    }
    
    // Allow editing any username, including "tony"
    
    // Check if it's a numeric ID
    if (/^\d+$/.test(searchTerm)) {
      // It's a numeric ID, search directly
      setSearchId(searchTerm);
    } else {
      // It's a name or username, search through all assistants (case-insensitive, includes)
      if (allAssistants) {
        const matchingAssistants = allAssistants.filter(assistant => 
          (assistant.name && assistant.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (assistant.id && assistant.id.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        
        if (matchingAssistants.length === 1) {
          // Single match, use it directly
          const foundAssistant = matchingAssistants[0];
          setSearchId(foundAssistant.id.toString());
          setId(foundAssistant.id.toString());
        } else if (matchingAssistants.length > 1) {
          // Multiple matches, show selection
          setSearchResults(matchingAssistants);
          setShowSearchResults(true);
          setError(`❌ Found ${matchingAssistants.length} assistants. Please select one.`);
        } else {
          setError(`❌ No assistant found with name or username starting with "${searchTerm}"`);
          setSearchId("");
        }
      } else {
        setError("❌ Assistant data not loaded. Please try again.");
      }
    }
  };

  // Clear assistant data when ID input is emptied
  const handleIdChange = (e) => {
    const value = e.target.value;
    setId(value);
    setSearchId(""); // Clear search ID to prevent auto-fetch
    if (!value.trim()) {
      const emptyForm = { id: "", name: "", phone: "", password: "", role: "assistant", account_state: "Activated", ATCA: "no" };
      setForm(emptyForm);
      setOriginalForm(null);
      setConfirmPassword("");
      setStep(1);
      setError("");
      setSuccess(false);
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle assistant selection from search results
  const handleAssistantSelect = (selectedAssistant) => {
    if (selectedAssistant?.id && selectedAssistant.id.toLowerCase() === 'tony') {
      setError("❌ You can't Edit the 'tony' account");
      return;
    }
    setSearchId(selectedAssistant.id.toString());
    setId(selectedAssistant.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // For id (username) field only, remove all spaces
    if (name === 'id') {
      const trimmedValue = value.replace(/\s/g, ''); // Remove all spaces
      setForm({ ...form, [name]: trimmedValue });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Helper function to get only changed fields
  const getChangedFields = () => {
    if (!form || !originalForm) return {};
    
    const changes = {};
    Object.keys(form).forEach(key => {
      // Only include fields that have actually changed and are not undefined/null
      if (form[key] !== originalForm[key] && 
          form[key] !== undefined && 
          form[key] !== null && 
          form[key] !== '') {
        changes[key] = form[key];
      }
    });
    return changes;
  };

  // Helper function to check if any fields have changed
  const hasChanges = () => {
    if (!form || !originalForm) return false;
    
    return Object.keys(form).some(key => form[key] !== originalForm[key]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Block editing the reserved username "tony"
    if (assistant && assistant.id && assistant.id.toLowerCase() === "tony") {
      setError("❌ You can't Edit the 'tony' account");
      return;
    }
    
    // Check if there are any changes
    if (!hasChanges()) {
      setError("❌ No changes detected. Please modify at least one field before saving.");
      return;
    }
    
    setError("");
    setSuccess(false);
    
    const changedFields = getChangedFields();
    
    // Validate email - always required
    if (!form.email || form.email.trim() === '') {
      setError("❌ Email is required");
      return;
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError("❌ Please enter a valid email address");
      return;
    }
    
    // Validate password if user entered one
    if (form.password && form.password.trim() !== "") {
      // Validate password length
      if (form.password.length < 8) {
        setError("❌ Password must be at least 8 characters long");
        return;
      }
      
      // Validate password confirmation
      if (form.password !== confirmPassword) {
        setError("❌ Passwords do not match");
        return;
      }
    }
    
    // Only send changed fields
    let payload = { ...changedFields };
    
    // Validate phone number if it was changed
    if (changedFields.phone) {
      const assistantPhone = formatPhoneForDB(changedFields.phone);
      // Check if it's valid (not just country code)
      if (!assistantPhone || assistantPhone.length <= 2) {
        setError("❌ Please enter a valid phone number");
        return;
      }
      payload.phone = assistantPhone; // Save with country code
    }
    
    // Handle password separately - only include if user entered one
    if (form.password && form.password.trim() !== "") {
      // Send the raw password - backend will hash it
      payload.password = form.password;
    }
    
    updateAssistantMutation.mutate(
      { id, updateData: payload },
      {
        onSuccess: () => {
          setSuccess(true);
          // Update original data to reflect the new state
          setOriginalForm({ ...form });
          // Clear password fields after successful update if password was changed
          if (form.password && form.password.trim() !== "") {
            setForm(prev => ({ ...prev, password: "" }));
            setConfirmPassword("");
          }
        },
        onError: (err) => {
          if (err.response?.status === 409) {
            setError("❌ Assistant ID already exists.");
          } else {
            setError(err.response?.data?.error || "❌ Failed to update assistant.");
          }
        }
      }
    );
  };

  return (
    <div style={{ padding: "20px 5px 20px 5px" }}>
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
        <style jsx>{`
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
          }
          .back-btn {
            background: linear-gradient(90deg, #6c757d 0%, #495057 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px 20px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .back-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          }
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .form-group {
            margin-bottom: 24px;
          }
          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #495057;
            font-size: 0.95rem;
          }
          .form-input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
          }
          .form-input:focus {
            outline: none;
            border-color: #87CEEB;
            background: white;
            box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
          }
          .fetch-form {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 24px;
          }
          .fetch-input {
            flex: 1;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #ffffff;
            color: #000000;
          }
          .fetch-input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          .fetch-btn {
            background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 140px;
            justify-content: center;
          }
          .fetch-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
            background: linear-gradient(135deg, #0d8bc7 0%, #5bb8e6 100%);
          }
          .fetch-btn:active {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          }
          @media (max-width: 768px) {
            .form-container {
              padding: 24px;
            }
            .form-group {
              margin-bottom: 20px;
            }
            .form-input, .fetch-input {
              padding: 14px 16px;
            }
            .fetch-form {
              flex-direction: column;
              gap: 12px;
            }
            .fetch-btn {
              width: 100%;
              padding: 14px 20px;
              font-size: 0.95rem;
            }
            .fetch-input {
              width: 100%;
            }
          }
          @media (max-width: 480px) {
            .form-container {
              padding: 20px;
            }
            .form-group label {
              font-size: 0.9rem;
            }
            .form-input, .fetch-input {
              padding: 12px 14px;
              font-size: 0.95rem;
            }
            .submit-btn {
              padding: 16px;
              font-size: 1rem;
            }
          }
          .form-input::placeholder {
            color: #adb5bd;
          }
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(135, 206, 235, 0.3);
            margin-top: 8px;
          }
          .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(135, 206, 235, 0.4);
          }
          .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: 0 2px 8px rgba(135, 206, 235, 0.2);
          }
          .success-message {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          }
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          .changes-indicator {
            background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(23, 162, 184, 0.3);
          }
          .no-changes {
            background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
            color: white;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(108, 117, 125, 0.3);
          }
          .username-feedback {
            margin-top: 8px;
            font-size: 0.9rem;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: 500;
          }
          .username-feedback.checking {
            background: #f8f9fa;
            color: #6c757d;
            border: 1px solid #dee2e6;
          }
          .username-feedback.taken {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .username-feedback.available {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .error-border {
            border-color: #dc3545 !important;
            box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
          }
        `}</style>
                 <Title 
                   backText="Back" 
                   href="/manage_assistants" 
                   backButtonStyle={{
                     background: 'linear-gradient(90deg, rgb(108, 117, 125) 0%, rgb(73, 80, 87) 100%)',
                     color: 'white',
                     border: 'none',
                     borderRadius: 8,
                     padding: '8px 16px',
                     fontWeight: 600,
                     cursor: 'pointer',
                     transition: '0.3s',
                     boxShadow: 'rgba(0, 0, 0, 0.2) 0px 4px 16px',
                     fontSize: 15,
                     display: 'flex',
                     alignItems: 'center',
                     gap: 8,
                     marginLeft: 25
                   }}
                 >
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <Image src="/user-edit2.svg" alt="Edit Assistant" width={32} height={32} />
                     Edit Assistant
                   </div>
                 </Title>
        
          <div className="form-container">
            
            <form onSubmit={handleIdSubmit} className="fetch-form">
              <input
                className="fetch-input"
                name="id"
                placeholder="Enter assistant Username, Name"
                value={id}
                onChange={handleIdChange}
              />
              <button type="submit" disabled={assistantLoading} className="fetch-btn">
                {assistantLoading ? "Loading..." : "🔍 Search"}
              </button>
            </form>
            
            {/* Show search results if multiple matches found */}
            {showSearchResults && searchResults.length > 0 && (
              <div style={{ 
                marginTop: "16px", 
                padding: "16px", 
                background: "#f8f9fa", 
                borderRadius: "8px", 
                border: "1px solid #dee2e6" 
              }}>
                <div style={{ 
                  marginBottom: "12px", 
                  fontWeight: "600", 
                  color: "#495057" 
                }}>
                  Select an assistant:
                </div>
                {searchResults.map((assistant) => (
                  <button
                    key={assistant.id}
                    onClick={() => handleAssistantSelect(assistant)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 16px",
                      margin: "8px 0",
                      background: "white",
                      border: "1px solid #dee2e6",
                      borderRadius: "6px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#e9ecef";
                      e.target.style.borderColor = "#1FA8DC";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "white";
                      e.target.style.borderColor = "#dee2e6";
                    }}
                  >
                    <div style={{ fontWeight: "600", color: "#1FA8DC" }}>
                      {assistant.name} (ID: {assistant.id})
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                      {assistant.role} • {assistant.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        
        {step === 2 && (
          <div className="form-container" style={{ marginTop: "20px" }}>
            {/* Show changes indicator */}
            {hasChanges() ? (
              <div className="changes-indicator">
                ✏️ Changes detected - Only modified fields will be sent to server
              </div>
            ) : (
              <div className="no-changes">
                ℹ️ No changes detected - Modify at least one field to enable save
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input
                  className={`form-input ${!usernameCheck.isLoading && usernameCheck.data && usernameCheck.data.exists && form.id !== originalForm?.id ? 'error-border' : ''}`}
                  name="id"
                  placeholder="Edit assistant username"
                  value={form.id}
                  onChange={handleChange}
                  onKeyDown={(e) => {
                    // Prevent space key from being entered
                    if (e.key === ' ') {
                      e.preventDefault();
                    }
                  }}
                />
                {/* Username availability feedback */}
                {form.id && form.id !== originalForm?.id && (
                  <div>
                    {usernameCheck.isLoading && (
                      <div className="username-feedback checking">
                        🔍 Checking availability...
                      </div>
                    )}
                    {!usernameCheck.isLoading && usernameCheck.data && usernameCheck.data.exists && (
                      <div className="username-feedback taken">
                        ❌ This username is already taken, use anther one
                      </div>
                    )}
                    {!usernameCheck.isLoading && usernameCheck.data && !usernameCheck.data.exists && (
                      <div className="username-feedback available">
                        ✅ This username is available
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  className="form-input"
                  name="name"
                  placeholder="Edit assistant's name"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <PhoneInput
                  country="eg"
                  enableSearch
                  value={form.phone || ''}
                  onChange={(value) => {
                    const validation = validateEgyptPhone(value);
                    setForm({ ...form, phone: validation.value });
                  }}
                  onKeyDown={(e) => handleEgyptPhoneKeyDown(e, form.phone)}
                  containerClass="phone-container"
                  inputClass="phone-input"
                  buttonClass="phone-flag-btn"
                  dropdownClass="phone-dropdown"
                  placeholder="Enter Phone Number"
                />
              </div>
              <div className="form-group">
                <label>Email <span style={{color: 'red'}}>*</span></label>
                <input
                  className="form-input"
                  name="email"
                  type="email"
                  placeholder="Enter assistant's email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password (leave blank to keep current)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={form.password}
                    onChange={handleChange}
                    style={{ paddingRight: '50px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <img 
                      src={showPassword ? "/hide.svg" : "/show.svg"} 
                      alt={showPassword ? "Hide password" : "Show password"}
                      style={{ width: '20px', height: '20px' }}
                    />
                  </button>
                </div>
                {form.password && form.password.trim() !== "" && (
                  <small style={{ color: '#6c757d', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                    Must be at least 8 characters long
                  </small>
                )}
              </div>
              {form.password && form.password.trim() !== "" && (
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ paddingRight: '50px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <img 
                        src={showConfirmPassword ? "/hide.svg" : "/show.svg"} 
                        alt={showConfirmPassword ? "Hide password" : "Show password"}
                        style={{ width: '20px', height: '20px' }}
                      />
                    </button>
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Role</label>
                <RoleSelect 
                  selectedRole={form.role}
                  onRoleChange={(role) => setForm({ ...form, role })}
                />
              </div>
              <AccountStateSelect
                value={form.account_state || 'Activated'}
                onChange={(value) => setForm({ ...form, account_state: value })}
                required={false}
              />
              <AddToContactAssistants
                value={form.ATCA || 'no'}
                onChange={(value) => setForm({ ...form, ATCA: value })}
                required={false}
              />
              <button type="submit" disabled={updateAssistantMutation.isPending || !hasChanges()} className="submit-btn">
                {updateAssistantMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
            </form>
          </div>
        )}
        {success && <div className="success-message">✅ Assistant updated successfully!</div>}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
} 