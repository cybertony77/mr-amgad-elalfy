import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import CenterSelect from "../../components/CenterSelect";
import BackToDashboard from "../../components/BackToDashboard";
import GradeSelect from '../../components/GradeSelect';
import AccountStateSelect from '../../components/AccountStateSelect';
import GenderSelect from '../../components/GenderSelect';
import Title from '../../components/Title';
import { useStudents, useStudent, useUpdateStudent } from '../../lib/api/students';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { formatPhoneForDB, validateEgyptPhone, handleEgyptPhoneKeyDown } from '../../lib/phoneUtils';

// Helper to normalize grade values to match select options
function normalizeGrade(grade) {
  if (!grade) return "";
  const g = grade.toLowerCase().replace(/\s+/g, "");
  if (g === "1stsecondary" || g === "1stsec") return "1st Secondary";
  if (g === "2ndsecondary" || g === "2ndsec") return "2nd Secondary";
  if (g === "3rdsecondary" || g === "3rdsec") return "3rd Secondary";
  return "";
}

export default function EditStudent() {
  const containerRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [formData, setFormData] = useState({}); // Local form state for editing
  const [originalStudent, setOriginalStudent] = useState(null); // Store original data for comparison
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'grade', 'center', 'gender', or null
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results

  // React Query hooks
  const { data: allStudents } = useStudents();
  const { data: student, isLoading: studentLoading, error: studentError } = useStudent(searchId, { enabled: !!searchId });
  const updateStudentMutation = useUpdateStudent();
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

  // Handle student errors from React Query
  useEffect(() => {
    if (studentError) {
      setError("Student not found or unauthorized.");
    }
  }, [studentError]);

  // Set original student and form data when student data loads
  useEffect(() => {
    if (student && !originalStudent) {
      const studentData = {
        name: student.name,
        grade: normalizeGrade(student.grade),
        phone: student.phone,
        parents_phone: student.parents_phone,
        main_center: student.main_center,
        school: student.school || "",
        age: student.age || "",
        gender: student.gender || "",
        comment: student.main_comment || student.comment || "",
        account_state: student.account_state || "Activated"
      };
      setOriginalStudent({ ...studentData });
      setFormData({ ...studentData }); // Also set the form data
    }
  }, [student, originalStudent]);

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

  const [center, setCenter] = useState("");
  const [hwDone, setHwDone] = useState(false);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    setError("");
    setSuccess(false);
    setOriginalStudent(null);
    setSearchResults([]);
    setShowSearchResults(false);
    
    const searchTerm = studentId.trim();
    
    // Check if it's a numeric ID
    if (/^\d+$/.test(searchTerm)) {
      // It's a numeric ID, search directly
      setSearchId(searchTerm);
    } else {
      // It's a name, search through all students (case-insensitive, includes)
      if (allStudents) {
        const matchingStudents = allStudents.filter(student => 
          student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        if (matchingStudents.length === 1) {
          // Single match, use it directly
          const foundStudent = matchingStudents[0];
          setSearchId(foundStudent.id.toString());
          setStudentId(foundStudent.id.toString());
        } else if (matchingStudents.length > 1) {
          // Multiple matches, show selection
          setSearchResults(matchingStudents);
          setShowSearchResults(true);
          setError(`Found ${matchingStudents.length} students. Please select one.`);
        } else {
          setError(`No student found with name starting with "${searchTerm}"`);
          setSearchId("");
        }
      } else {
        setError("Student data not loaded. Please try again.");
      }
    }
  };

  // Clear student data when ID input is emptied
  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    setSearchId(""); // Clear search ID to prevent auto-fetch
    if (!value.trim()) {
      setFormData({});
      setOriginalStudent(null);
      setError("");
      setSuccess(false);
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Helper function to get only changed fields
  const getChangedFields = () => {
    if (!formData || !originalStudent) return {};
    
    const changes = {};
    Object.keys(formData).forEach(key => {
      // Special handling: allow clearing comment (empty string) -> send as null
      if (key === 'comment') {
        if (formData[key] !== originalStudent[key]) {
          changes[key] = formData[key];
        }
        return;
      }
      // Special handling: allow clearing age (empty string) -> send as null
      if (key === 'age') {
        if (formData[key] !== originalStudent[key]) {
          changes[key] = formData[key];
        }
        return;
      }
      // Only include fields that have actually changed and are not undefined/null/empty
      if (formData[key] !== originalStudent[key] &&
          formData[key] !== undefined &&
          formData[key] !== null &&
          formData[key] !== '') {
        changes[key] = formData[key];
      }
    });
    return changes;
  };

  // Helper function to check if any fields have changed
  const hasChanges = () => {
    if (!formData || !originalStudent) return false;
    
    return Object.keys(formData).some(key => formData[key] !== originalStudent[key]);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    // Check if there are any changes
    if (!hasChanges()) {
      setError("No changes detected. Please modify at least one field before saving.");
      return;
    }
    
    const changedFields = getChangedFields();
    
    // Validate phone numbers if they were changed
    if (changedFields.phone) {
      const studentPhone = formatPhoneForDB(changedFields.phone);
      // Check if it's valid (not just country code)
      if (!studentPhone || studentPhone.length <= 2) {
        setError("Please enter a valid student phone number");
        return;
      }
      changedFields.phone = studentPhone; // Save with country code
    }
    
    // Validate gender if it was changed (required)
    if (changedFields.gender !== undefined) {
      if (!changedFields.gender || changedFields.gender.trim() === '') {
        setError("Please select a gender");
        return;
      }
    }
    
    if (changedFields.parents_phone) {
      const parentPhone = formatPhoneForDB(changedFields.parents_phone);
      // Check if it's valid (not just country code)
      if (!parentPhone || parentPhone.length <= 2) {
        setError("Please enter a valid parent phone number");
        return;
      }
      changedFields.parents_phone = parentPhone; // Save with country code
    }
    
    // Check if student phone number is the same as parent phone number
    const currentStudentPhone = changedFields.phone || originalStudent.phone;
    const currentParentPhone = changedFields.parents_phone || originalStudent.parents_phone;
    
    if (currentStudentPhone === currentParentPhone) {
      setError("Student phone number cannot be the same as parent phone number");
      return;
    }
    
    // Debug logging
    console.log('🔍 Original student data:', originalStudent);
    console.log('✏️ Current form data:', formData);
    console.log('📤 Fields to be sent:', changedFields);
    
    // Only send changed fields
    const updatedStudent = { ...changedFields };
    
    // Handle special field transformations
    if (changedFields.grade) {
      updatedStudent.grade = changedFields.grade.toLowerCase().replace(/\./g, '');
    }
    if (Object.prototype.hasOwnProperty.call(changedFields, 'age')) {
      // Handle empty string or null age - set to null in database
      if (changedFields.age === '' || changedFields.age === null || changedFields.age === undefined) {
        updatedStudent.age = null;
      } else {
        updatedStudent.age = Number(changedFields.age);
      }
    }
    // Normalize comment: empty string -> null, trim non-empty
    if (Object.prototype.hasOwnProperty.call(changedFields, 'comment')) {
      const c = changedFields.comment;
      updatedStudent.main_comment = (typeof c === 'string' && c.trim() === '') ? null : (typeof c === 'string' ? c.trim() : c);
      delete updatedStudent.comment;
    }
    
    console.log('🚀 Final payload being sent:', updatedStudent);
    
    updateStudentMutation.mutate(
      { id: searchId, updateData: updatedStudent },
      {
        onSuccess: () => {
          setSuccess(true);
          // Update original data to reflect the new state
          setOriginalStudent({ ...formData });
        },
        onError: (err) => {
          setError("Failed to edit student.");
        }
      }
    );
  };

  const goBack = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "20px 5px 20px 5px"
    }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
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
          margin-bottom: 10px;
          font-weight: 600;
          color: #495057;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .form-input {
          width: 100%;
          padding: 16px 18px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.3s ease;
          box-sizing: border-box;
          background: #ffffff;
          color: #000000;
        }
        .form-input:focus {
          outline: none;
          border-color: #1FA8DC;
          background: white;
          box-shadow: 0 0 0 3px rgba(31, 168, 220, 0.1);
        }
        .form-input::placeholder {
          color: #adb5bd;
        }
        .submit-btn {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          margin-top: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .submit-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
          background: linear-gradient(135deg, #1e7e34 0%, #17a2b8 100%);
        }
        .submit-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
        }
        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }
        .select-styled {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          background: #fff;
          color: #222;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-top: 4px;
          box-sizing: border-box;
        }
        .select-styled:focus {
          outline: none;
          border-color: #87CEEB;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
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
        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
            gap: 16px;
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
          .form-container {
            padding: 24px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-input, .fetch-input {
            padding: 14px 16px;
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
      `}</style>

      <Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/user-edit2.svg" alt="Edit Student" width={32} height={32} />
          Edit Student
        </div>
      </Title>

      <div className="form-container">
        
        <form onSubmit={handleIdSubmit} className="fetch-form">
          <input
            className="fetch-input"
            type="text"
            placeholder="Enter student ID or Name"
            value={studentId}
            onChange={handleIdChange}
          />
          <button type="submit" className="fetch-btn" disabled={studentLoading}>
            {studentLoading ? "Loading..." : "🔍 Search"}
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
              Select a student:
            </div>
            {searchResults.map((student) => (
              <button
                key={student.id}
                onClick={() => handleStudentSelect(student)}
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
                  {student.name} (ID: {student.id})
                </div>
                <div style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                  {student.grade} • {student.main_center}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {student && (
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
          
          <form onSubmit={handleEdit}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                className="form-input"
                name="name"
                placeholder="Enter student's full name"
                value={formData.name || ''}
                onChange={handleChange}
                autocomplete="off"
              />
            </div>
            <div className="form-group">
              <label>Age</label>
              <input
                className="form-input"
                name="age"
                type="number"
                min="10"
                max="30"
                placeholder="Enter student's age"
                value={formData.age || ''}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>Gender <span style={{color: 'red'}}>*</span></label>
              <GenderSelect
                selectedGender={formData.gender || ''}
                onGenderChange={(gender) => handleChange({ target: { name: 'gender', value: gender } })}
                required={true}
                isOpen={genderDropdownOpen}
                onToggle={() => {
                  setOpenDropdown(null);
                  setGenderDropdownOpen(!genderDropdownOpen);
                }}
                onClose={() => setGenderDropdownOpen(false)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Grade</label>
                <GradeSelect 
                  selectedGrade={formData.grade || ''} 
                  onGradeChange={(grade) => handleChange({ target: { name: 'grade', value: grade } })} 
                  isOpen={openDropdown === 'grade'}
                  onToggle={() => setOpenDropdown(openDropdown === 'grade' ? null : 'grade')}
                  onClose={() => setOpenDropdown(null)}
                />
              </div>
              <div className="form-group">
                <label>School</label>
                <input
                  className="form-input"
                  name="school"
                  placeholder="Enter student's school"
                  value={formData.school || ''}
                  onChange={handleChange}
                  autocomplete="off"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Student Phone</label>
                <PhoneInput
                  country="eg"
                  enableSearch
                  value={formData.phone || ''}
                  onChange={(value) => {
                    const validation = validateEgyptPhone(value);
                    setFormData({ ...formData, phone: validation.value });
                  }}
                  onKeyDown={(e) => handleEgyptPhoneKeyDown(e, formData.phone)}
                  containerClass="phone-container"
                  inputClass="phone-input"
                  buttonClass="phone-flag-btn"
                  dropdownClass="phone-dropdown"
                  placeholder="Enter Phone Number"
                />
              </div>
              <div className="form-group">
                <label>Parent's Phone (Whatsapp)</label>
                <PhoneInput
                  country="eg"
                  enableSearch
                  value={formData.parents_phone || ''}
                  onChange={(value) => {
                    const validation = validateEgyptPhone(value);
                    setFormData({ ...formData, parents_phone: validation.value });
                  }}
                  onKeyDown={(e) => handleEgyptPhoneKeyDown(e, formData.parents_phone)}
                  containerClass="phone-container"
                  inputClass="phone-input"
                  buttonClass="phone-flag-btn"
                  dropdownClass="phone-dropdown"
                  placeholder="Enter Parent Number"
                />
              </div>
            </div>
            <div className="form-group" style={{ width: '100%' }}>
              <label>Main Center</label>
              <CenterSelect 
                selectedCenter={formData.main_center || ''} 
                onCenterChange={(center) => handleChange({ target: { name: 'main_center', value: center } })} 
                style={{ width: '100%' }}
                isOpen={openDropdown === 'center'}
                onToggle={() => setOpenDropdown(openDropdown === 'center' ? null : 'center')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <AccountStateSelect
              value={formData.account_state || 'Activated'}
              onChange={(value) => handleChange({ target: { name: 'account_state', value } })}
              required={false}
            />
            <div className="form-group">
              <label>Main Comment</label>
              <textarea
                className="form-input"
                name="comment"
                placeholder="Enter any notes about this student"
                value={formData.comment || ''}
                onChange={handleChange}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="submit-btn" disabled={!hasChanges() || updateStudentMutation.isPending}>
              {updateStudentMutation.isPending ? "Saving..." : "✏️ Update Student"}
            </button>
          </form>
        </div>
      )}
      
      {success && (
        <div className="success-message">
          ✅ Student updated successfully!
        </div>
      )}
      
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
      </div>
    </div>
  );
}
