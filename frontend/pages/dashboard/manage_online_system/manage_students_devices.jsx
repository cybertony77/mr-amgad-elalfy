import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Title from "../../../components/Title";
import { IconArrowRight, IconSearch, IconChevronLeft, IconChevronRight, IconTrash } from "@tabler/icons-react";
import { ActionIcon, TextInput, useMantineTheme, ScrollArea } from "@mantine/core";
import { useStudentsDevicesPaginated, useUpdateAllowedDevices, useDeleteStudentDevice } from "../../../lib/api/deviceLimitations";

export function InputWithButton({ onButtonClick, onKeyDown, ...props }) {
  const theme = useMantineTheme();

  const handleKeyDown = (e) => {
    if (onKeyDown) {
      onKeyDown(e);
    }
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };

  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by ID, Name, or Student Phone"
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon
          size={32}
          radius="xl"
          color={theme.primaryColor}
          variant="filled"
          onClick={onButtonClick}
          style={{ cursor: "pointer" }}
          aria-label="Search"
        >
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export default function ManageStudentsDevices() {
  const router = useRouter();
  const containerRef = useRef(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;
  const [showPagePopup, setShowPagePopup] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [allowedDevicesInput, setAllowedDevicesInput] = useState("");
  const [originalAllowedDevices, setOriginalAllowedDevices] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState("");

  const {
    data: devicesResponse,
    isLoading,
    error,
    refetch,
  } = useStudentsDevicesPaginated(
    {
      page: currentPage,
      limit: pageSize,
      search: searchTerm.trim() || undefined,
    },
    {
      refetchOnWindowFocus: true,
      staleTime: 2 * 60 * 1000,
    }
  );

  const updateAllowedDevicesMutation = useUpdateAllowedDevices();
  const deleteDeviceMutation = useDeleteStudentDevice();

  const studentsDevices = devicesResponse?.data || [];
  const pagination =
    devicesResponse?.pagination || {
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Automatically show all when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      setSearchTerm("");
      setCurrentPage(1);
    }
  }, [searchInput, searchTerm]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  // Auto-hide error and success messages after 6 seconds
  useEffect(() => {
    if (modalError) {
      const timer = setTimeout(() => setModalError(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [modalError]);

  useEffect(() => {
    if (modalSuccess) {
      const timer = setTimeout(() => setModalSuccess(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [modalSuccess]);

  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
    setCurrentPage(1);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      setCurrentPage((prev) => Math.max(1, prev - 1));
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setCurrentPage((prev) => prev + 1);
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handlePageClick = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= pagination.totalPages) {
      setCurrentPage(pageNumber);
      setShowPagePopup(false);
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const openManageModal = (student) => {
    setSelectedStudent(student);
    const originalValue = student.allowed_devices != null ? String(student.allowed_devices) : "";
    setAllowedDevicesInput(originalValue);
    setOriginalAllowedDevices(originalValue);
    setModalError("");
    setModalSuccess("");
    setIsModalOpen(true);
  };

  const closeManageModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
    setAllowedDevicesInput("");
    setOriginalAllowedDevices(null);
    setModalError("");
    setModalSuccess("");
  };

  const handleSaveAllowedDevices = async () => {
    if (!selectedStudent) return;
    const value = allowedDevicesInput.trim();
    if (!value) {
      setModalError("❌ Allowed devices is required");
      setModalSuccess("");
      return;
    }
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num <= 0) {
      setModalError("❌ Allowed devices must be a positive number");
      setModalSuccess("");
      return;
    }

    try {
      setModalError("");
      await updateAllowedDevicesMutation.mutateAsync({
        id: selectedStudent.id,
        allowed_devices: num,
      });
      setModalSuccess("✅ Allowed devices updated successfully");
      setSelectedStudent((prev) =>
        prev ? { ...prev, allowed_devices: num } : prev
      );
      setOriginalAllowedDevices(String(num));
      refetch();
    } catch (err) {
      const apiError = err?.response?.data?.error || "Failed to update allowed devices";
      setModalError(`❌ ${apiError}`);
      setModalSuccess("");
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!selectedStudent) return;
    try {
      setModalError("");
      await deleteDeviceMutation.mutateAsync({
        id: selectedStudent.id,
        device_id: deviceId,
      });
      setModalSuccess("✅ Device deleted successfully");
      setSelectedStudent((prev) =>
        prev
          ? {
              ...prev,
              devices: (prev.devices || []).filter((d) => d.device_id !== deviceId),
            }
          : prev
      );
      refetch();
    } catch (err) {
      const apiError = err?.response?.data?.error || "Failed to delete device";
      setModalError(`❌ ${apiError}`);
      setModalSuccess("");
    }
  };

  return (
    <div className="page-wrapper" style={{ padding: "20px 5px 20px 5px" }}>
      <div className="main-container" style={{ maxWidth: 1000, margin: "40px auto", padding: "25px" }}>
        <style jsx>{`
          .page-wrapper {
            padding: 20px 5px 20px 5px;
          }
          .main-container {
            max-width: 1000px;
            margin: 40px auto;
            padding: 24px;
            width: 100%;
          }
          .history-container {
            background: white;
            border-radius: 20px;
            padding: 24px;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
            border: 1px solid rgba(148, 163, 184, 0.25);
          }
          .table-wrapper {
            width: 100%;
            height: 400px;
          }
          .history-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 20px;
            text-align: center;
          }
          @media (max-width: 768px) {
            .history-title {
              font-size: 1.3rem;
            }
          }
          @media (max-width: 480px) {
            .history-title {
              font-size: 1.2rem;
            }
          }
          .table {
            width: 100%;
            min-width: 800px;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .table th,
          .table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e9ecef;
            text-align: center;
            font-size: 0.95rem;
          }
          .table th {
            background-color: #f8f9fa;
            font-weight: 700;
            color: #495057;
            white-space: nowrap;
          }
          .table tbody tr:hover {
            background-color: #f1f3f5;
          }
          .manage-btn {
            padding: 6px 12px;
            border-radius: 8px;
            border: none;
            background: linear-gradient(90deg, #1fa8dc 0%, #87ceeb 100%);
            color: white;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .manage-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(31, 168, 220, 0.4);
          }
          .pagination-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 2px solid #e9ecef;
          }
          .pagination-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border: 2px solid #1fa8dc;
            background: white;
            color: #1fa8dc;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(31, 168, 220, 0.1);
          }
          .pagination-button:hover:not(:disabled) {
            background: #1fa8dc;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(31, 168, 220, 0.3);
          }
          .pagination-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            border-color: #adb5bd;
            color: #adb5bd;
            box-shadow: none;
          }
          .pagination-page-info {
            font-size: 1.1rem;
            font-weight: 600;
            color: #495057;
            min-width: 120px;
            text-align: center;
            padding: 8px 16px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            transition: all 0.2s ease;
          }
          .pagination-page-info.clickable:hover {
            background: #e9ecef;
            border-color: #1fa8dc;
            transform: translateY(-1px);
          }
          .page-popup {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-bottom: 8px;
            z-index: 1000;
          }
          .page-popup-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            border: 2px solid #1fa8dc;
            padding: 16px;
            min-width: 260px;
            max-height: 300px;
            overflow-y: auto;
          }
          .page-popup-header {
            font-size: 1.1rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 12px;
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
          }
          .page-popup-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
            gap: 8px;
          }
          .page-number-btn {
            padding: 8px;
            border: 2px solid #e9ecef;
            background: white;
            color: #495057;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            transition: all 0.2s ease;
          }
          .page-number-btn:hover {
            background: #1fa8dc;
            color: white;
            border-color: #1fa8dc;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(31, 168, 220, 0.3);
          }
          .page-number-btn.active {
            background: #1fa8dc;
            color: white;
            border-color: #1fa8dc;
            font-weight: 700;
          }
          /* Manage Devices Modal Styles - EXACT same structure as Zoom add/edit popup */
          .manage-devices-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.25);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }
          .manage-devices-content {
            background: #fff;
            border-radius: 12px;
            padding: 32px 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            max-width: 500px;
            width: 100%;
            max-height: 95vh;
            overflow-y: auto;
            overflow-x: hidden;
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
          .modal-header h3 {
            margin: 0;
            color: #333;
            font-size: 1.5rem;
            font-weight: 600;
            text-align: left;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .close-modal-btn {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            cursor: pointer;
            font-size: 18px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            padding: 0;
            line-height: 1;
            flex-shrink: 0;
          }
          .close-modal-btn:hover {
            background: #c82333;
            transform: scale(1.1);
          }
          .close-modal-btn:active {
            transform: scale(0.95);
          }
          .manage-devices-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .devices-section {
            background: linear-gradient(135deg, #f8faff 0%, #eef4ff 100%);
            border: 1.5px solid #e0e7ff;
            border-radius: 14px;
            padding: 18px 18px 20px 18px;
          }
          .devices-section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e0e7ff;
          }
          .devices-section-icon {
            width: 38px;
            height: 38px;
            border-radius: 12px;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(31, 168, 220, 0.15);
            flex-shrink: 0;
          }
          .devices-section-title {
            font-size: 0.95rem;
            font-weight: 700;
            color: #1e293b;
            line-height: 1.4;
          }
          .devices-section-desc {
            font-size: 0.78rem;
            color: #64748b;
            margin-top: 2px;
            line-height: 1.4;
            font-weight: 400;
          }
          .devices-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 16px;
          }
          .readonly-field {
            font-size: 0.95rem;
            font-weight: 500;
            color: #495057;
            padding: 12px 16px;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            min-height: 20px;
            line-height: 1.5;
            display: block;
            width: 100%;
            box-sizing: border-box;
          }
          .field-help {
            font-size: 0.8rem;
            color: #6c757d;
            margin-top: 6px;
            line-height: 1.4;
            font-weight: 400;
          }
          .no-devices-box {
            text-align: center;
            padding: 24px 20px;
            color: #6c757d;
            font-style: italic;
            font-size: 0.9rem;
            font-weight: 400;
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            line-height: 1.5;
          }
          .devices-list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .form-field {
            margin-bottom: 16px;
          }
          .form-field label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #333;
            font-size: 0.95rem;
            line-height: 1.5;
          }
          .required-star {
            color: #dc3545 !important;
            font-weight: 700;
            font-size: 1.1rem;
            margin-left: 2px;
          }
          .form-input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
            background: #fff;
            color: #333;
            line-height: 1.5;
          }
          .form-input:focus {
            border-color: #2d8cff;
            box-shadow: 0 0 0 3px rgba(45, 140, 255, 0.1);
            background: #fafbff;
          }
          .form-input:hover:not(:focus) {
            border-color: #ced4da;
            background: #f8f9fa;
          }
          .form-input::placeholder {
            color: #adb5bd;
            font-weight: 400;
          }
          .form-buttons {
            display: flex;
            gap: 12px;
            justify-content: center;
          }
          .save-btn {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
            line-height: 1.5;
            min-width: 120px;
          }
          .save-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            background: linear-gradient(135deg, #218838 0%, #1ea080 100%);
          }
          .save-btn:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 2px 6px rgba(40, 167, 69, 0.25);
          }
          .save-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
            background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          }
          .cancel-form-btn {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
            line-height: 1.5;
            min-width: 120px;
          }
          .cancel-form-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            background: linear-gradient(135deg, #c82333 0%, #dc3545 100%);
          }
          .cancel-form-btn:active:not(:disabled) {
            transform: translateY(0);
            box-shadow: 0 2px 6px rgba(220, 53, 69, 0.25);
          }
          .cancel-form-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
            background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          }
          .error-message-popup {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          .success-message-popup {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          }
          .no-results {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-style: italic;
          }
          @media (max-width: 768px) {
            .main-container {
              padding: 20px;
              margin: 20px auto;
            }
            .history-container {
              padding: 18px;
            }
            .manage-devices-modal {
              padding: 10px;
            }
            .manage-devices-content {
              max-width: 100%;
              max-height: 90vh;
            }
            .modal-header h3 {
              font-size: 1.3rem;
            }
          }
          @media (max-width: 480px) {
            .main-container {
              padding: 16px;
              margin: 15px auto;
            }
            .history-container {
              padding: 12px;
            }
            .table th,
            .table td {
              padding: 8px 6px;
              font-size: 0.85rem;
            }
            .pagination-button {
              width: 40px;
              height: 40px;
            }
            .manage-devices-modal {
              padding: 5px;
            }
            .manage-devices-content {
              max-height: 95vh;
            }
            .modal-header h3 {
              font-size: 1.2rem;
            }
            .form-field {
              margin-bottom: 14px;
            }
            .form-field label {
              font-size: 0.85rem;
            }
            .form-input {
              padding: 10px 14px;
              font-size: 0.95rem;
            }
            .save-btn, .cancel-form-btn {
              padding: 10px 20px;
              font-size: 0.9rem;
            }
          }
        `}</style>

        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Image src="/settings2.svg" alt="Manage Students Devices" width={32} height={32} />
            Manage Students Devices
          </div>
        </Title>

        {/* Search Bar */}
        <div style={{ marginBottom: 20 }}>
          <InputWithButton
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        <div ref={containerRef} className="history-container">
          <div className="history-title">
            Students Devices ({pagination.totalCount} records)
          </div>

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#991b1b",
                borderRadius: 10,
                padding: 16,
                marginBottom: 16,
                textAlign: "center",
                fontWeight: 600,
                border: "1.5px solid #fca5a5",
                fontSize: "1.05rem",
                boxShadow: "0 4px 16px rgba(220, 53, 69, 0.08)",
              }}
            >
              {error.message || "Failed to fetch students devices data"}
            </div>
          )}

          {isLoading ? (
            <div className="no-results">Loading...</div>
          ) : studentsDevices.length === 0 ? (
            <div className="no-results">
              {searchTerm
                ? "No students found with the current search."
                : "No students devices data found."}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <ScrollArea h={400} type="hover">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Student Phone</th>
                        <th>Allowed Devices</th>
                        <th>Last Login</th>
                        <th>Manage Devices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsDevices.map((s) => (
                        <tr key={s.id}>
                          <td>{s.id}</td>
                          <td>{s.name}</td>
                          <td style={{ fontFamily: "monospace" }}>{s.phone}</td>
                          <td>{s.allowed_devices}</td>
                          <td>{s.last_login || "didn't login yet"}</td>
                          <td>
                            <button className="manage-btn" onClick={() => openManageModal(s)}>
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              {pagination.totalCount > 0 && (
                <div className="pagination-container">
                  <button
                    className="pagination-button"
                    onClick={handlePreviousPage}
                    disabled={!pagination.hasPrevPage}
                    aria-label="Previous page"
                  >
                    <IconChevronLeft size={20} stroke={2} />
                  </button>

                  <div
                    className={`pagination-page-info ${pagination.totalPages > 1 ? "clickable" : ""}`}
                    onClick={() => pagination.totalPages > 1 && setShowPagePopup(!showPagePopup)}
                    style={{
                      position: "relative",
                      cursor: pagination.totalPages > 1 ? "pointer" : "default",
                    }}
                  >
                    Page {pagination.currentPage} of {pagination.totalPages}

                    {showPagePopup && pagination.totalPages > 1 && (
                      <div className="page-popup">
                        <div className="page-popup-content">
                          <div className="page-popup-header">Select Page</div>
                          <div className="page-popup-grid">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                              (pageNum) => (
                                <button
                                  key={pageNum}
                                  className={`page-number-btn ${
                                    pageNum === pagination.currentPage ? "active" : ""
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePageClick(pageNum);
                                  }}
                                >
                                  {pageNum}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    className="pagination-button"
                    onClick={handleNextPage}
                    disabled={!pagination.hasNextPage}
                    aria-label="Next page"
                  >
                    <IconChevronRight size={20} stroke={2} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Manage Devices Modal */}
      {isModalOpen && selectedStudent && (
        <div 
          className="manage-devices-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={(e) => {
            if (e.target.classList.contains('manage-devices-modal')) {
              closeManageModal();
            }
          }}
        >
          <div
            className="manage-devices-content"
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "32px 24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              maxWidth: "500px",
              width: "100%",
              maxHeight: "95vh",
              overflowY: "auto",
              overflowX: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h3 style={{
                margin: 0,
                color: '#333',
                fontSize: '1.5rem',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Image src="/settings.svg" alt="Manage Devices" width={24} height={24} />
                Manage Devices
              </h3>
              <button
                type="button"
                onClick={closeManageModal}
                title="Close"
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  padding: 0,
                  lineHeight: 1,
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#c82333';
                  e.target.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#dc3545';
                  e.target.style.transform = 'scale(1)';
                }}
              >
                ✕
              </button>
            </div>
            <div className="manage-devices-form">
              {/* Student Info Header */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%)',
                border: '1.5px solid #c7d2fe',
                borderRadius: '12px',
                padding: '16px 18px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2d8cff 0%, #1a6fdb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(45, 140, 255, 0.25)',
                  flexShrink: 0
                }}>
                  <Image src="/user.svg" alt="Student" width={24} height={24} style={{ filter: 'brightness(0) invert(1)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#1e293b',
                    lineHeight: 1.4,
                    marginBottom: '4px'
                  }}>
                    {selectedStudent.name}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#64748b',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      background: '#fff',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#2d8cff',
                      border: '1px solid #c7d2fe'
                    }}>
                      ID: {selectedStudent.id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="devices-section">
                <div className="devices-section-header">
        
                  <div>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#1e293b',
                      lineHeight: 1.4
                    }}>
                      Devices Settings
                    </div>
                    <div style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                      marginTop: '2px',
                      lineHeight: 1.4,
                      fontWeight: 400
                    }}>
                      Manage how many devices this student can use and review their login devices.
                    </div>
                  </div>
                </div>

                <div className="devices-grid">
                  <div className="form-field">
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 600,
                      color: '#333',
                      fontSize: '0.95rem',
                      lineHeight: 1.5
                    }}>
                      Allowed Devices <span style={{ color: '#dc3545', fontWeight: 700, fontSize: '1.1rem', marginLeft: '2px' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={allowedDevicesInput}
                      onChange={(e) => setAllowedDevicesInput(e.target.value)}
                      className="form-input"
                      placeholder="Enter number of allowed devices"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #e9ecef',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 500,
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        background: '#fff',
                        color: '#333',
                        lineHeight: 1.5
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2d8cff';
                        e.target.style.boxShadow = '0 0 0 3px rgba(45, 140, 255, 0.1)';
                        e.target.style.background = '#fafbff';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.boxShadow = 'none';
                        e.target.style.background = '#fff';
                      }}
                      onMouseEnter={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = '#ced4da';
                          e.target.style.background = '#f8f9fa';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (document.activeElement !== e.target) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.background = '#fff';
                        }
                      }}
                    />
                    <div style={{ 
                      fontSize: '0.8rem',
                      color: '#6c757d',
                      marginTop: '6px',
                      lineHeight: 1.4,
                      fontWeight: 400
                    }}>
                      Number of different devices this student can log in from.
                    </div>
                  </div>

                  <div className="form-field">
                    <label style={{ 
                      display: 'block',
                      marginBottom: '8px',
                      fontWeight: 600,
                      color: '#333',
                      fontSize: '0.95rem',
                      lineHeight: 1.5
                    }}>
                      Last Login
                    </label>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      color: '#495057',
                      padding: '12px 16px',
                      background: '#f8f9fa',
                      border: '2px solid #e9ecef',
                      borderRadius: '8px',
                      minHeight: '20px',
                      lineHeight: 1.5,
                      display: 'block',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      {selectedStudent.last_login || "didn't login yet"}
                    </div>
                  </div>
                </div>

                <div className="form-field">
                  <label style={{ 
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 600,
                    color: '#333',
                    fontSize: '0.95rem',
                    lineHeight: 1.5
                  }}>
                    Devices
                  </label>
                {(!selectedStudent.devices || selectedStudent.devices.length === 0) ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '24px 20px',
                    color: '#6c757d',
                    fontStyle: 'italic',
                    fontSize: '0.9rem',
                    fontWeight: 400,
                    background: '#f8f9fa',
                    border: '2px solid #e9ecef',
                    borderRadius: '10px',
                    lineHeight: 1.5
                  }}>
                    No devices registered yet.
                  </div>
                ) : (
                  <div className="devices-list">
                    {selectedStudent.devices.map((d) => (
                      <div 
                        key={d.device_id} 
                        style={{
                          background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
                          border: '1.5px solid #e0e8f5',
                          borderRadius: '12px',
                          padding: '16px 18px',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e0e8f5';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr auto',
                          gap: '12px',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.6' }}>
                            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ 
                                display: 'inline-block',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#2d8cff',
                                flexShrink: 0
                              }}></span>
                              <strong style={{ color: '#1e3a5f', marginRight: '6px' }}>IP:</strong>
                              <span style={{ fontFamily: 'monospace' }}>{d.ip}</span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <strong style={{ color: '#1e3a5f', marginRight: '6px' }}>Browser:</strong>
                              {d.browser || "Unknown"}
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <strong style={{ color: '#1e3a5f', marginRight: '6px' }}>OS:</strong>
                              {d.os || "Unknown"}
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <strong style={{ color: '#1e3a5f', marginRight: '6px' }}>Device type:</strong>
                              <span style={{ 
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                background: d.device_type === 'mobile' ? '#dbeafe' : d.device_type === 'tablet' ? '#fef3c7' : '#e0e7ff',
                                color: d.device_type === 'mobile' ? '#1e40af' : d.device_type === 'tablet' ? '#92400e' : '#3730a3'
                              }}>
                                {d.device_type || "desktop"}
                              </span>
                            </div>
                            <div style={{ marginBottom: '6px' }}>
                              <strong style={{ color: '#1e3a5f', marginRight: '6px' }}>First login:</strong>
                              {d.first_login || "-"}
                            </div>
                            <div>
                              <strong style={{ color: '#1e3a5f', marginRight: '6px' }}>Last login:</strong>
                              {d.last_login || "-"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteDevice(d.device_id)}
                            disabled={deleteDeviceMutation.isPending}
                            style={{ 
                              flexShrink: 0, 
                              padding: '8px 16px', 
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: deleteDeviceMutation.isPending
                                ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
                                : 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: deleteDeviceMutation.isPending ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)',
                              opacity: deleteDeviceMutation.isPending ? 0.7 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!deleteDeviceMutation.isPending) {
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                                e.target.style.background = 'linear-gradient(135deg, #c82333 0%, #dc3545 100%)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!deleteDeviceMutation.isPending) {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.2)';
                                e.target.style.background = 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)';
                              }
                            }}
                          >
                            <IconTrash size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

              {modalError && (
                <div style={{
                  background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)',
                  fontSize: '0.95rem',
                  lineHeight: 1.5
                }}>
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div style={{
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'center',
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)',
                  fontSize: '0.95rem',
                  lineHeight: 1.5
                }}>
                  {modalSuccess}
                </div>
              )}

              <div style={{ 
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                marginTop: '20px'
              }}>
                <button
                  onClick={handleSaveAllowedDevices}
                  disabled={updateAllowedDevicesMutation.isPending || allowedDevicesInput.trim() === originalAllowedDevices || !allowedDevicesInput.trim()}
                  style={{
                    background: (updateAllowedDevicesMutation.isPending || allowedDevicesInput.trim() === originalAllowedDevices || !allowedDevicesInput.trim())
                      ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
                      : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    cursor: (updateAllowedDevicesMutation.isPending || allowedDevicesInput.trim() === originalAllowedDevices || !allowedDevicesInput.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(40, 167, 69, 0.2)',
                    lineHeight: 1.5,
                    minWidth: '120px',
                    opacity: (updateAllowedDevicesMutation.isPending || allowedDevicesInput.trim() === originalAllowedDevices || !allowedDevicesInput.trim()) ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!updateAllowedDevicesMutation.isPending && allowedDevicesInput.trim() !== originalAllowedDevices && allowedDevicesInput.trim()) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                      e.target.style.background = 'linear-gradient(135deg, #218838 0%, #1ea080 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!updateAllowedDevicesMutation.isPending && allowedDevicesInput.trim() !== originalAllowedDevices && allowedDevicesInput.trim()) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.2)';
                      e.target.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!updateAllowedDevicesMutation.isPending) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 6px rgba(40, 167, 69, 0.25)';
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!updateAllowedDevicesMutation.isPending) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                    }
                  }}
                >
                  {updateAllowedDevicesMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={closeManageModal}
                  disabled={updateAllowedDevicesMutation.isPending || deleteDeviceMutation.isPending}
                  style={{
                    background: (updateAllowedDevicesMutation.isPending || deleteDeviceMutation.isPending)
                      ? 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)'
                      : 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontWeight: 600,
                    fontSize: '1rem',
                    cursor: (updateAllowedDevicesMutation.isPending || deleteDeviceMutation.isPending) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(220, 53, 69, 0.2)',
                    lineHeight: 1.5,
                    minWidth: '120px',
                    opacity: (updateAllowedDevicesMutation.isPending || deleteDeviceMutation.isPending) ? 0.7 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!updateAllowedDevicesMutation.isPending && !deleteDeviceMutation.isPending) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                      e.target.style.background = 'linear-gradient(135deg, #c82333 0%, #dc3545 100%)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!updateAllowedDevicesMutation.isPending && !deleteDeviceMutation.isPending) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.2)';
                      e.target.style.background = 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)';
                    }
                  }}
                  onMouseDown={(e) => {
                    if (!updateAllowedDevicesMutation.isPending && !deleteDeviceMutation.isPending) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 2px 6px rgba(220, 53, 69, 0.25)';
                    }
                  }}
                  onMouseUp={(e) => {
                    if (!updateAllowedDevicesMutation.isPending && !deleteDeviceMutation.isPending) {
                      e.target.style.transform = 'translateY(-1px)';
                      e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                    }
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

