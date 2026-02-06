import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from "../components/Title";
import { Table, ScrollArea } from '@mantine/core';
import apiClient from "../lib/axios";
import styles from '../styles/TableScrollArea.module.css';
import { useSystemConfig } from "../lib/api/system";

export default function ContactAssistants() {
  const router = useRouter();
  const { data: systemConfig } = useSystemConfig();
  const systemName = systemConfig?.name || 'Demo Attendance System';
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assistants, setAssistants] = useState([]);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiClient.get("/api/auth/me");
        if (res.status === 200) {
          setHasToken(true);
        } else {
          setHasToken(false);
        }
      } catch (err) {
        setHasToken(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        setIsLoadingAssistants(true);
        const response = await apiClient.get('/api/contact_assistants');
        setAssistants(response.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching assistants:', err);
        setError('Failed to load assistants. Please try again later.');
        setAssistants([]);
      } finally {
        setIsLoadingAssistants(false);
      }
    };
    fetchAssistants();
  }, []);

  // Get first name from full name
  const getFirstName = (fullName) => {
    if (!fullName) return '';
    return fullName.trim().split(/\s+/)[0] || '';
  };

  // Format phone number for WhatsApp (remove any non-numeric characters)
  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  };

  // Create WhatsApp message
  const createWhatsAppMessage = (assistantName) => {
    const firstName = getFirstName(assistantName);
    const message = `Hello, ${firstName}. I'm having a problem with the ${systemName}. Can you help me?`;
    return encodeURIComponent(message);
  };

  if (loading || isLoadingAssistants) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}>
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
        }}>
          <div style={{
            width: "50px",
            height: "50px",
            border: "4px solid rgba(31, 168, 220, 0.2)",
            borderTop: "4px solid #1FA8DC",
            borderRadius: "50%",
            margin: "0 auto 20px",
            animation: "spin 1s linear infinite"
          }} />
          <p style={{ color: "#666", fontSize: "1rem" }}>Loading assistants...</p>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px"
    }}>
      <div style={{ 
        maxWidth: 900, 
        margin: "40px auto", 
        padding: "20px 5px 20px 5px"
      }}>
        <Title 
          backText={"Back"}
          href={null}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/message.svg" alt="Message" width={32} height={32} />
            Contact Assistants
          </div>
        </Title>

        <div style={{
          background: "white",
          borderRadius: "16px",
          padding: "30px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
        }} className="contact-assistants-container">
          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 600,
              border: '1.5px solid #fca5a5',
              fontSize: '1.1rem',
              boxShadow: '0 4px 16px rgba(220, 53, 69, 0.08)'
            }}>
              {error}
            </div>
          )}

          {assistants.length === 0 && !error ? (
            <div style={{
              padding: '40px 24px',
              background: 'linear-gradient(135deg, rgba(254, 185, 84, 0.1) 0%, rgba(31, 168, 220, 0.1) 100%)',
              borderRadius: '12px',
              border: '1px solid rgba(254, 185, 84, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '16px'
              }}>
                😔
              </div>
              <h3 style={{
                color: '#FEB954',
                fontSize: '1.4rem',
                fontWeight: '700',
                marginBottom: '12px',
                marginTop: 0
              }}>
                We're Sorry
              </h3>
              <p style={{
                color: '#495057',
                fontSize: '1rem',
                lineHeight: '1.6',
                margin: 0,
                fontWeight: '500'
              }}>
                Unfortunately, no assistants are available for contact at this time. We apologize for any inconvenience. Please try again later or contact the{' '}
                <a
                  href="/contact_developer"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/contact_developer');
                  }}
                  style={{
                    color: '#1FA8DC',
                    textDecoration: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderBottom: '1px solid #1FA8DC',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = '#0d5a7a';
                    e.target.style.borderBottomColor = '#0d5a7a';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = '#1FA8DC';
                    e.target.style.borderBottomColor = '#1FA8DC';
                  }}
                >
                  developer
                </a>
                {' '}for assistance.
              </p>
            </div>
          ) : (
            <>
              {/* Help Note - at the top before table - only show when assistants are available */}
              <div style={{
                marginBottom: '24px',
                padding: '24px',
                background: 'linear-gradient(135deg, rgba(31, 168, 220, 0.08) 0%, rgba(254, 185, 84, 0.08) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(31, 168, 220, 0.2)',
                textAlign: 'center'
              }}>
                <h3 style={{
                  color: '#1FA8DC',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  marginBottom: '12px',
                  marginTop: 0
                }}>
                  Need Help?
                </h3>
                <p style={{
                  color: '#495057',
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  margin: 0,
                  fontWeight: '500'
                }}>
                  Our assistants are here to support you with system access, technical issues, and general questions. Feel free to reach out if you face any problems or need guidance—we're happy to help 😊❤️.
                </p>
              </div>

              <ScrollArea h="calc(20rem * var(--mantine-scale))" type="hover" className={styles.scrolled}>
                <Table striped highlightOnHover withTableBorder withColumnBorders className="contact-assistants-table">
                  <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                    <Table.Tr>
                      <Table.Th style={{ width: '33%', textAlign: 'center' }}>Name</Table.Th>
                      <Table.Th style={{ width: '33%', textAlign: 'center' }}>Phone No.</Table.Th>
                      <Table.Th style={{ width: '34%', textAlign: 'center' }}>Send WhatsApp</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {assistants.map((assistant) => {
                      const phoneNumber = formatPhoneForWhatsApp(assistant.phone);
                      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${createWhatsAppMessage(assistant.name)}`;
                      
                      return (
                        <Table.Tr key={assistant.id || assistant._id}>
                          <Table.Td style={{ textAlign: 'center', fontWeight: '600' }}>
                            {assistant.name}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                            {assistant.phone}
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="whatsapp-button-link"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '10px 20px',
                                background: '#25d366',
                                color: 'white',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '0.95rem',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 211, 102, 0.4)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)';
                              }}
                            >
                              <Image src="/whatsapp.svg" alt="WhatsApp" width={30} height={30} style={{ flexShrink: 0 }} />
                              Send
                            </a>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .contact-assistants-container {
            padding: 20px !important;
          }

          .contact-assistants-table {
            font-size: 0.85rem !important;
          }

          .contact-assistants-table th,
          .contact-assistants-table td {
            padding: 10px 8px !important;
          }

          .whatsapp-button-link {
            padding: 8px 12px !important;
            font-size: 0.85rem !important;
          }

          .whatsapp-icon {
            width: 16px !important;
            height: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .contact-assistants-container {
            padding: 15px !important;
            border-radius: 12px !important;
          }

          .contact-assistants-table {
            font-size: 0.8rem !important;
          }

          .contact-assistants-table th,
          .contact-assistants-table td {
            padding: 8px 6px !important;
          }

          .whatsapp-button-link {
            padding: 6px 10px !important;
            font-size: 0.8rem !important;
            gap: 6px !important;
          }

          .whatsapp-icon {
            width: 14px !important;
            height: 14px !important;
          }
        }

        @media (max-width: 360px) {
          .contact-assistants-table {
            font-size: 0.75rem !important;
          }

          .contact-assistants-table th,
          .contact-assistants-table td {
            padding: 6px 4px !important;
          }

          .whatsapp-button-link {
            padding: 5px 8px !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>
    </div>
  );
}

