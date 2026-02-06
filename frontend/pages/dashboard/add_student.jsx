import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import BackToDashboard from "../../components/BackToDashboard";
import CenterSelect from "../../components/CenterSelect";
import GradeSelect from '../../components/GradeSelect';
import AccountStateSelect from '../../components/AccountStateSelect';
import GenderSelect from '../../components/GenderSelect';
import Title from '../../components/Title';
import { useCreateStudent } from '../../lib/api/students';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { formatPhoneForDB, validateEgyptPhone, handleEgyptPhoneKeyDown } from '../../lib/phoneUtils';


export default function AddStudent() {
  const containerRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    grade: "",
    school: "",
    phone: "",
    parentsPhone: "",
    main_center: "",
    comment: "",
    account_state: "Activated", // Default to Activated
  });
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(""); // Separate state for success message text
  const [newId, setNewId] = useState("");
  const [vacCode, setVacCode] = useState("");
  const [showQRButton, setShowQRButton] = useState(false);
  const [error, setError] = useState("");
  const [copiedVac, setCopiedVac] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'grade', 'center', 'gender', or null
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide success message text after 5 seconds, but keep success state for buttons
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
        // Also blur any focused input to close browser autocomplete
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }
    };

    // Also handle when a dropdown opens to close others
    const handleDropdownOpen = () => {
      // Close any open dropdowns when a new one opens
      if (openDropdown) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleDropdownOpen);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleDropdownOpen);
    };
  }, [openDropdown]);

  const router = useRouter();
  
  // React Query hook for creating students
  const createStudentMutation = useCreateStudent();

  const handleChange = (e) => {
    // Reset QR button if user starts entering new data (when form was previously empty)
    if (showQRButton && !form.name && !form.age && !form.grade && !form.school && !form.phone && !form.parentsPhone && !form.main_center) {
      setShowQRButton(false);
      setNewId("");
    }
    setForm({ ...form, [e.target.name]: e.target.value });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    // Validate phone numbers
    const studentPhone = formatPhoneForDB(form.phone);
    const parentPhone = formatPhoneForDB(form.parentsPhone);
    
    // Check if phone numbers are valid (not just country code)
    if (!studentPhone || studentPhone.length <= 2) {
      setError("Please enter a valid student phone number");
      return;
    }
    
    if (!parentPhone || parentPhone.length <= 2) {
      setError("Please enter a valid parent phone number");
      return;
    }
    
    // Check if student phone number is the same as parent phone number
    if (studentPhone === parentPhone) {
      setError("Student phone number cannot be the same as parent phone number");
      return;
    }
    
    // Validate gender (required)
    if (!form.gender || form.gender.trim() === '') {
      setError("Please select a gender");
      return;
    }
    
    // Map parentsPhone to parents_phone for backend
    const payload = { ...form, parents_phone: parentPhone };
    // Handle age - set to null if empty, otherwise convert to number
    payload.age = form.age && form.age.trim() !== '' ? Number(form.age) : null;
    payload.phone = studentPhone; // Save with country code
    let gradeClean = payload.grade.toLowerCase().replace(/\./g, '');
    payload.grade = gradeClean;
    // Optional main_comment: send as main_comment field
    const mc = form.comment && form.comment.trim() !== '' ? form.comment.trim() : null;
    payload.main_comment = mc;
    // Score is automatically set to 10 in the API, no need to send it
    delete payload.comment;
    delete payload.parentsPhone;
    
    createStudentMutation.mutate(payload, {
      onSuccess: (data) => {
        setSuccess(true);
        const generatedId = data.id || data.data?.id;
        const vac = data.vac || data.data?.vac;
        setSuccessMessage(`✅ Student added successfully! ID: ${generatedId}`);
        setNewId(generatedId);
        setVacCode(vac || "");
        setShowQRButton(true); // Show QR button after successful submission
      },
      onError: (err) => {
        setError(err.response?.data?.error || err.message);
      }
    });
  };

  const handleCreateQR = () => {
    if (newId) {
      router.push(`/dashboard/qr_generator?mode=single&id=${newId}`);
    }
  };

  const handleAttendStudent = () => {
    if (newId) {
      router.push(`/dashboard/scan_page?studentId=${newId}&autoSearch=true`);
    }
  };

  const handleAddAnotherStudent = () => {
    setForm({
      name: "",
      age: "",
      gender: "",
      grade: "",
      school: "",
      phone: "",
      parentsPhone: "",
      main_center: "",
      comment: "",
      account_state: "Activated", // Reset to default
    });
    setSuccess(false);
    setSuccessMessage(""); // Clear success message
    setNewId("");
    setVacCode("");
    setShowQRButton(false);
    setError("");
    setCopiedVac(false);
  };

  const handleCopyVac = async () => {
    if (vacCode) {
      try {
        await navigator.clipboard.writeText(vacCode);
        setCopiedVac(true);
        setTimeout(() => setCopiedVac(false), 2000);
      } catch (err) {
        console.error('Failed to copy VAC code:', err);
      }
    }
  };

  const handleSendWhatsApp = () => {
    if (!form.phone) {
      setError('Student phone number not available');
      return;
    }

    if (!vacCode || !newId) {
      setError('VAC code or Student ID not available');
      return;
    }

    // Extract first name from full name
    const firstName = form.name ? form.name.split(' ')[0] : 'Student';
    
    // Get current domain from URL
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    const signUpUrl = `${domain}/sign-up`;

    // Create the message (same format as VAC page)
    const message = `Dear Student, ${firstName}
This is Your Verification Account Code (VAC) :

${vacCode}

*Please do not share this code with anyone.*
To complete your sign-up, click the link below:

🖇 ${signUpUrl}

Note :- 
   • Your ID : ${newId}

Best regards
 – Tony Joseph`;

    // Use phone number as stored in form (already includes country code from PhoneInput)
    const phoneNumber = form.phone.replace(/[^0-9]/g, '');
    
    // Validate phone number exists
    if (!phoneNumber || phoneNumber.length < 3) {
      setError('Invalid phone number format');
      return;
    }
    
    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, '_blank');
  };

  const goBack = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ padding: "20px 5px 20px 5px" }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
        <style jsx>{`
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
            text-align: center;
            margin-bottom: 32px;
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
          .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(135, 206, 235, 0.4);
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
          .vac-container {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%);
            border-radius: 16px;
            padding: 28px;
            margin-top: 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
            border: 2px solid rgba(31, 168, 220, 0.2);
          }
          .vac-title {
            color: #495057;
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .vac-info-item {
            background: #ffffff;
            padding: 16px 20px;
            border-radius: 12px;
            border: 1px solid #e9ecef;
            border-left: 4px solid #1FA8DC;
            margin-bottom: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .vac-info-label {
            font-size: 0.9rem;
            color: #6c757d;
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .vac-info-value {
            font-size: 1.2rem;
            font-weight: 700;
            color: #1FA8DC;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New', monospace;
          }
          .vac-instruction {
            color: #6c757d;
            font-size: 0.95rem;
            font-weight: 500;
            margin-bottom: 20px;
            text-align: center;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .copy-vac-btn {
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 14px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(255, 107, 107, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
          }
          .copy-vac-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.5);
            background: linear-gradient(135deg, #ff5252 0%, #e53935 100%);
          }
          .copy-vac-btn:active {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
          }
          .whatsapp-vac-btn {
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 14px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            margin-top: 12px;
          }
          .whatsapp-vac-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(37, 211, 102, 0.5);
            background: linear-gradient(135deg, #20c85a 0%, #0f7a6b 100%);
          }
          .whatsapp-vac-btn:active {
            transform: translateY(-1px);
            box-shadow: 0 4px 15px rgba(37, 211, 102, 0.4);
          }
        `}</style>
        <Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/user-plus2.svg" alt="Add Student" width={32} height={32} />
            Add Student
          </div>
        </Title>
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="name"
                placeholder="Enter student's full name"
                value={form.name}
                onChange={handleChange}
                required
                autocomplete="off"
              />
            </div>
            <div className="form-group">
              <label>Age (Optional)</label>
              <input
                className="form-input"
                name="age"
                type="number"
                min="10"
                max="30"
                placeholder="Enter student's age (optional)"
                value={form.age}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Gender <span style={{color: 'red'}}>*</span></label>
              <GenderSelect
                selectedGender={form.gender}
                onGenderChange={(gender) => setForm({ ...form, gender })}
                required={true}
                isOpen={genderDropdownOpen}
                onToggle={() => {
                  setOpenDropdown(null);
                  setGenderDropdownOpen(!genderDropdownOpen);
                }}
                onClose={() => setGenderDropdownOpen(false)}
              />
            </div>
            <div className="form-group">
              <label>Grade <span style={{color: 'red'}}>*</span></label>
              <GradeSelect 
                selectedGrade={form.grade} 
                onGradeChange={(grade) => handleChange({ target: { name: 'grade', value: grade } })} 
                required 
                isOpen={openDropdown === 'grade'}
                onToggle={() => setOpenDropdown(openDropdown === 'grade' ? null : 'grade')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <div className="form-group">
              <label>School <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="school"
                placeholder="Enter student's school"
                value={form.school}
                onChange={handleChange}
                required
                autocomplete="off"
              />
            </div>
            <div className="form-group">
              <label>Phone <span style={{color: 'red'}}>*</span></label>
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
              <label>Parent's Phone (Whatsapp) <span style={{color: 'red'}}>*</span></label>
              <PhoneInput
                country="eg"
                enableSearch
                value={form.parentsPhone || ''}
                onChange={(value) => {
                  const validation = validateEgyptPhone(value);
                  setForm({ ...form, parentsPhone: validation.value });
                }}
                onKeyDown={(e) => handleEgyptPhoneKeyDown(e, form.parentsPhone)}
                containerClass="phone-container"
                inputClass="phone-input"
                buttonClass="phone-flag-btn"
                dropdownClass="phone-dropdown"
                placeholder="Enter Parent Number"
              />
            </div>
            <div className="form-group">
              <label>Main Center <span style={{color: 'red'}}>*</span></label>
              <CenterSelect 
                selectedCenter={form.main_center} 
                onCenterChange={(center) => handleChange({ target: { name: 'main_center', value: center } })} 
                required 
                isOpen={openDropdown === 'center'}
                onToggle={() => setOpenDropdown(openDropdown === 'center' ? null : 'center')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <AccountStateSelect
              value={form.account_state}
              onChange={(value) => handleChange({ target: { name: 'account_state', value } })}
              required={true}
            />
          <div className="form-group">
            <label>Main Comment (Optional)</label>
            <textarea
              className="form-input"
              name="comment"
              placeholder="Enter any notes about this student"
              value={form.comment}
              onChange={handleChange}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
            <button 
              type="submit" 
              disabled={createStudentMutation.isPending} 
              className="submit-btn"
            >
              {createStudentMutation.isPending ? "Adding..." : "Add Student"}
            </button>
          </form>
        </div>
        
        {/* Success message and buttons outside form container */}
        {success && (
          <div>
            {successMessage && (
              <div className="success-message">{successMessage}</div>
            )}
            {showQRButton && (
              <div style={{ marginTop: 12 }}>
                <button className="submit-btn" onClick={handleCreateQR}>
                🏷️ Create QR Code for this ID: {newId}
                </button>
              </div>
            )}
            {showQRButton && (
              <div style={{ marginTop: 12 }}>
                <button 
                  className="submit-btn" 
                  onClick={handleAttendStudent}
                  style={{
                    background: 'linear-gradient(250deg, rgb(23, 162, 184) 0%, rgb(32, 201, 151) 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: '1rem',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 123, 255, 0.3)',
                    width: '100%'
                  }}
                >
                  ✅ Attend This Student
                </button>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button 
                className="submit-btn" 
                onClick={handleAddAnotherStudent}
                style={{
                  background: 'linear-gradient(135deg, #17a2b8 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: '1rem',
                  padding: '14px 20px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(23, 162, 184, 0.3)',
                  width: '100%'
                }}
              >
                ➕ Add Another Student
              </button>
            </div>
            
            {/* VAC Section */}
            {showQRButton && vacCode && (
              <div className="vac-container">
                <div className="vac-title">
                  <Image src="/lock-cog.svg" alt="VAC" width={24} height={24} />
                  Verification Account Code (VAC)
                </div>
                <div className="vac-info-item">
                  <div className="vac-info-label">Student ID</div>
                  <div className="vac-info-value">{newId}</div>
                </div>
                <div className="vac-info-item">
                  <div className="vac-info-label">VAC Code</div>
                  <div className="vac-info-value">{vacCode}</div>
                </div>
                <div className="vac-instruction">
                  Use the VAC code to sign up
                </div>
                <button
                  onClick={handleCopyVac}
                  className="copy-vac-btn"
                  title={copiedVac ? 'Copied!' : 'Copy VAC code'}
                >
                  <Image src="/copy2.svg" alt="Copy" width={20} height={20} />
                  {copiedVac ? 'Copied!' : 'Copy VAC Code'}
                </button>
                <button
                  onClick={handleSendWhatsApp}
                  className="whatsapp-vac-btn"
                  title="Send VAC code via WhatsApp"
                >
                  <Image src="/whatsapp2.svg" alt="WhatsApp" width={20} height={20} />
                  Send WhatsApp
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Error message outside form container */}
        {error && (
          <div className="error-message">❌ {error}</div>
        )}
      </div>
    </div>
  );
} 