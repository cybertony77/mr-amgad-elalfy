import "@/styles/globals.css";
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getApiBaseUrl } from "../config";
import apiClient from "../lib/axios";
import Image from "next/image";
import ErrorBoundary from "../components/ErrorBoundary";
import CustomHeader from "../components/publicHeader";

// PWA Service Worker Registration handled by next-pwa

// Preloader Component
function Preloader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg,rgba(158, 158, 158, 1) 0%, rgba(99, 191, 191, 1) 50%, rgba(8, 156, 170, 1) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          position: 'relative',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <Image 
            src="/logo.png" 
            alt="Math Academy Logo" 
            width={150}
            height={150}
            style={{
              objectFit: 'cover',
              background: 'transparent',
              borderRadius: '50%'
            }}
          />
        </div>
        
        {/* Loading ring */}
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTop: '4px solid rgb(0, 7, 14)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1; 
          }
          50% { 
            transform: scale(1.05); 
            opacity: 0.8; 
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Access Denied Preloader Component
function AccessDeniedPreloader() {
  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        color: 'white',
        fontSize: '1.2rem',
        fontWeight: 'bold',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTop: '4px solid #1FA8DC',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div>🔒 Access Denied</div>
        <div style={{ fontSize: '1rem', opacity: 0.8 }}>Redirecting to login...</div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        body {
          overflow: hidden !important;
        }
        * {
          pointer-events: none !important;
        }
        body > * {
          filter: blur(15px) !important;
          -webkit-filter: blur(15px) !important;
        }
      `}</style>
    </>
  );
}

// Redirect to Login Preloader Component
function RedirectToLoginPreloader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      color: 'white',
      fontSize: '1.2rem',
      fontWeight: 'bold',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderTop: '4px solid #1FA8DC',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div>🔒 Redirecting to login...</div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Helper functions for route checking
const isDashboardRoute = (path) => {
  return path.startsWith('/dashboard');
};

const isStudentDashboardRoute = (path) => {
  return path.startsWith('/student_dashboard');
};

export default function App({ Component, pageProps }) {
  // Create a new QueryClient instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15 * 60 * 1000, // 15 minutes
        gcTime: 20 * 60 * 1000, // 20 minutes
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        refetchInterval: false, // No auto-refresh - only manual refresh
        refetchIntervalInBackground: false,
      },
      mutations: {
        retry: 1,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
      },
    },
  }));

  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [isCheckingAdminAccess, setIsCheckingAdminAccess] = useState(false);
  const [isRouteChanging, setIsRouteChanging] = useState(false);
  const [showRedirectToLogin, setShowRedirectToLogin] = useState(false);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Define public pages using useMemo to prevent recreation on every render
  const publicPages = useMemo(() => ["/", "/sign-up", "/contact_developer", "/contact_assistants", "/404", "/forgot_password", "/student_not_found", "/dashboard/student_info"], []);
  
  // Define pages that should never show header/footer (even if authenticated)
  const noHeaderFooterPages = useMemo(() => ["/", "/sign-up", "/student_dashboard/my_homeworks/start", "/student_dashboard/my_quizzes/start"], []);
  
  // Define admin-only pages
  const adminPages = useMemo(() => [
    "/manage_assistants", 
    "/manage_assistants/add_assistant", 
    "/manage_assistants/edit_assistant", 
    "/manage_assistants/delete_assistant", 
    "/manage_assistants/all_assistants"
  ], []);

  // Define developer-only pages
  const developerPages = useMemo(() => [
    "/subscription_dashboard",
    "/subscription_dashboard/yearly",
    "/subscription_dashboard/monthly",
    "/subscription_dashboard/daily",
    "/subscription_dashboard/hourly",
    "/subscription_dashboard/minutely",
    "/subscription_dashboard/cancel"
  ], []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check authentication with server (cookies are sent automatically)
        const response = await apiClient.get('/api/auth/me');

        if (response.status === 200) {
          setIsAuthenticated(true);
          setUserRole(response.data.role);
          const role = response.data.role;
          
          // Check if student is trying to access staff dashboard
          if (isDashboardRoute(router.pathname) && role === 'student') {
            setShowAccessDenied(true);
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/student_dashboard");
            }, 1000);
          }

          // Check if staff/admin/developer is trying to access student dashboard
          if (isStudentDashboardRoute(router.pathname) && role !== 'student') {
            setShowAccessDenied(true);
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/dashboard");
            }, 1000);
          }
          
          // Check if user is trying to access admin pages but is not admin or developer
          if (adminPages.includes(router.pathname) && role !== 'admin' && role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }

          // Check if user is trying to access developer pages but is not developer
          if (developerPages.includes(router.pathname) && role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }
        } else {
          // Token invalid
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (error) {
        // Token invalid or expired - only set to false if we're not on a public page
        // This prevents redirect loops when the API call fails temporarily
        if (!publicPages.includes(router.pathname)) {
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router.pathname, adminPages, developerPages, publicPages, router]);

  // Handle route changes for main preloader
  useEffect(() => {
    const handleRouteStart = () => {
      setIsRouteChanging(true);
    };

    const handleRouteComplete = () => {
      setIsRouteChanging(false); // Hide preloader immediately when page loads
    };

    const handleRouteError = () => {
      setIsRouteChanging(false);
    };

    router.events.on('routeChangeStart', handleRouteStart);
    router.events.on('routeChangeComplete', handleRouteComplete);
    router.events.on('routeChangeError', handleRouteError);

    return () => {
      router.events.off('routeChangeStart', handleRouteStart);
      router.events.off('routeChangeComplete', handleRouteComplete);
      router.events.off('routeChangeError', handleRouteError);
    };
  }, [router]);

  // Redirect to login if not authenticated and trying to access protected page
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !publicPages.includes(router.pathname)) {
      // Show redirect to login preloader before redirect
      setShowRedirectToLogin(true);
      
      // Save the current path for redirect after login (except dashboards)
      if (router.pathname !== "/dashboard" && router.pathname !== "/student_dashboard") {
        // Store redirect path in a cookie or use router state
        document.cookie = `redirectAfterLogin=${router.pathname}; path=/; max-age=300`; // 5 minutes
      }
      
      // Redirect after showing preloader for 1 second
      setTimeout(() => {
        setShowRedirectToLogin(false); // Reset the state
        router.push("/");
      }, 1000); // Show preloader for 1 second
    }
  }, [isLoading, isAuthenticated, router.pathname, publicPages, router]);

  // Check admin access for current route
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Only check if user is authenticated and trying to access admin pages
      if (isAuthenticated && adminPages.includes(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          if (response.data.role !== 'admin' && response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (response.data.role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }
        } catch (error) {
          // Handle 401 (Unauthorized) errors gracefully - token expired or invalid
          if (error.response?.status === 401) {
            // Token validation failed, user needs to re-authenticate
            setIsAuthenticated(false);
            setUserRole(null);
            // The redirect to login will be handled by the useEffect that watches isAuthenticated
          } else {
            // For other errors, log them but don't break the flow
          console.error("❌ Error checking admin access:", error);
          }
        }
      }
    };

    // Only check admin access when route changes to an admin page
    if (isAuthenticated && adminPages.includes(router.pathname)) {
      checkAdminAccess();
    }
  }, [router.pathname, isAuthenticated, adminPages, router]);

  // Check developer access for current route
  useEffect(() => {
    const checkDeveloperAccess = async () => {
      // Only check if user is authenticated and trying to access developer pages
      if (isAuthenticated && developerPages.includes(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          if (response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (response.data.role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }
        } catch (error) {
          // Handle 401 (Unauthorized) errors gracefully - token expired or invalid
          if (error.response?.status === 401) {
            // Token validation failed, user needs to re-authenticate
            setIsAuthenticated(false);
            setUserRole(null);
            // The redirect to login will be handled by the useEffect that watches isAuthenticated
          } else {
            // For other errors, log them but don't break the flow
          console.error("❌ Error checking developer access:", error);
          }
        }
      }
    };

    // Only check developer access when route changes to a developer page
    if (isAuthenticated && developerPages.includes(router.pathname)) {
      checkDeveloperAccess();
    }
  }, [router.pathname, isAuthenticated, developerPages, router]);

  // Check dashboard access (staff/admin/developer only)
  useEffect(() => {
    const checkDashboardAccess = async () => {
      // Only check if user is authenticated and trying to access dashboard routes
      if (isAuthenticated && isDashboardRoute(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          // Only allow assistant, admin, or developer roles
          if (response.data.role === 'student') {
            setShowAccessDenied(true);
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/student_dashboard");
            }, 1000);
          }
        } catch (error) {
          // Handle 401 (Unauthorized) errors gracefully - token expired or invalid
          if (error.response?.status === 401) {
            // Token validation failed, user needs to re-authenticate
            setIsAuthenticated(false);
            setUserRole(null);
            // The redirect to login will be handled by the useEffect that watches isAuthenticated
          } else {
            // For other errors, log them but don't break the flow
          console.error("❌ Error checking dashboard access:", error);
          }
        }
      }
    };

    // Only check dashboard access when route changes to a dashboard page
    if (isAuthenticated && isDashboardRoute(router.pathname)) {
      checkDashboardAccess();
    }
  }, [router.pathname, isAuthenticated, router]);


  // Reset Access Denied state when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      setShowAccessDenied(false);
    }
  }, [isAuthenticated]);

  // Fetch subscription data when authenticated
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isAuthenticated || publicPages.includes(router.pathname)) {
        setSubscription(null);
        return;
      }

      try {
        setIsLoadingSubscription(true);
        const response = await apiClient.get('/api/subscription');
        setSubscription(response.data);
      } catch (error) {
        // Handle 401 (Unauthorized) errors silently - user may not be authenticated or token expired
        if (error.response?.status === 401) {
          console.log('Subscription fetch: Unauthorized (401) - user may not be authenticated');
          setSubscription(null);
        } else {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
        }
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    // Initial fetch
    fetchSubscription();
    
    // Manual control: Refetch subscription every 30 minutes (reduced frequency)
    const interval = setInterval(fetchSubscription, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, router.pathname, publicPages]);

  // Subscription countdown timer calculation
  useEffect(() => {
    // Only calculate timer if authenticated and subscription exists
    // Exclude only students, allow assistant, admin, and developer to see timer
    if (!isAuthenticated || !subscription || userRole === 'student') {
      setTimeRemaining(null);
      return;
    }

    // Simple logic: if active = false AND date_of_expiration = null, don't show timer
    if (subscription.active === false && !subscription.date_of_expiration) {
      setTimeRemaining(null);
      return;
    }

    // If date_of_expiration doesn't exist, don't show timer
    if (!subscription.date_of_expiration) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      const diff = expiration - now;

      // Calculate time components (use Math.max to ensure non-negative)
      let days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      let hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
      let minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
      let seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

      // Redistribute time: if hours is 00 and days > 0, borrow 1 day to fill hours
      if (hours === 0 && days > 0) {
        days -= 1;
        hours = 24;
      }
      // If minutes is 00 and hours > 0, borrow 1 hour to fill minutes
      if (minutes === 0 && hours > 0) {
        hours -= 1;
        minutes = 60;
      }
      // If seconds is 00 and minutes > 0, borrow 1 minute to fill seconds
      if (seconds === 0 && minutes > 0) {
        minutes -= 1;
        seconds = 60;
      }

      // Update timer with calculated values (always set, even if zero)
      setTimeRemaining({ days, hours, minutes, seconds });
    };

    // Calculate timer immediately
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [subscription, userRole, isAuthenticated]);

  // Check if we should show subscription warning
  const shouldShowSubscriptionWarning = () => {
    // Don't show if not authenticated
    if (!isAuthenticated) {
      return false;
    }

    // Only hide for student role - show for assistant, admin, and developer
    if (userRole === 'student') {
      return false;
    }

    // Don't show on student_dashboard routes
    if (isStudentDashboardRoute(router.pathname)) {
      return false;
    }

    // Don't show if no subscription data
    if (!subscription) {
      return false;
    }

    // If subscription is expired (active = false and no date_of_expiration)
    if (subscription.active === false && !subscription.date_of_expiration) {
      return true;
    }

    // If subscription is active but expiring within 3 days
    if (subscription.active === true && subscription.date_of_expiration) {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      const fiveDaysBeforeExpiration = new Date(expiration);
      fiveDaysBeforeExpiration.setDate(fiveDaysBeforeExpiration.getDate() - 3);
      
      return now >= fiveDaysBeforeExpiration;
    }

    return false;
  };

  // Format remaining time for display
  const formatRemainingTime = () => {
    if (!timeRemaining) return '';
    const { days, hours, minutes, seconds } = timeRemaining;
    return `${String(days || 0).padStart(2, '0')} days : ${String(hours || 0).padStart(2, '0')} hours : ${String(minutes || 0).padStart(2, '0')} min : ${String(seconds || 0).padStart(2, '0')} sec`;
  };

  // Check subscription expiration and redirect non-developers/non-students to login
  useEffect(() => {
    // Only check if authenticated, not on public pages, and subscription data is loaded
    if (!isAuthenticated || publicPages.includes(router.pathname) || isLoadingSubscription || !subscription) {
      return;
    }

    // Allow developers and students to access regardless of subscription status
    if (userRole === 'developer' || userRole === 'student') {
      return;
    }

    // Check if subscription is inactive
    if (!subscription.active) {
      console.log('⏰ Subscription is inactive, redirecting to login...');
      setShowRedirectToLogin(true);
      setTimeout(() => {
        setShowRedirectToLogin(false);
        router.push("/");
      }, 1000);
      return;
    }

    // Check if subscription has expired (remaining time is 00:00:00:00)
    if (subscription.active && subscription.date_of_expiration) {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      const diff = expiration - now;

      if (diff <= 0) {
        // Subscription has expired
        console.log('⏰ Subscription has expired, redirecting to login...');
        setShowRedirectToLogin(true);
        setTimeout(() => {
          setShowRedirectToLogin(false);
          router.push("/");
        }, 1000);
        return;
      }

      // Calculate remaining time
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Check if all time components are zero
      if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        console.log('⏰ Subscription remaining time is 00:00:00:00, redirecting to login...');
        setShowRedirectToLogin(true);
        setTimeout(() => {
          setShowRedirectToLogin(false);
          router.push("/");
        }, 1000);
      }
    }
  }, [isAuthenticated, subscription, isLoadingSubscription, router.pathname, publicPages, userRole, router]);

  // Note: Token expiry checking removed since we now use HTTP-only cookies
  // The server will handle token validation and expiry

  // Show loading while checking authentication, subscription, or during route changes
  if (isLoading || (isAuthenticated && isLoadingSubscription && !publicPages.includes(router.pathname)) || isRouteChanging) {
    return <Preloader />;
  }

  // Show redirect to login preloader if redirecting due to unauthorized access
  if (showRedirectToLogin) {
    return <RedirectToLoginPreloader />;
  }

  // Show access denied preloader if redirecting due to admin access denied
  if (showAccessDenied) {
    return <AccessDeniedPreloader />;
  }

  // For unauthorized users on protected pages, show loading (will redirect)
  if (!isAuthenticated && !publicPages.includes(router.pathname)) {
    return <Preloader />;
  }

  // Only show Header/Footer if user is authenticated
  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MantineProvider>
            {router.pathname === "/dashboard/student_info" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "100vh",
                }}
              >
                <CustomHeader />
                <div style={{ flex: 1 }}>
                  <Component {...pageProps} />
                </div>
                <Footer />
              </div>
            ) : (
              <Component {...pageProps} />
            )}
            <ReactQueryDevtools initialIsOpen={false} />
          </MantineProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    );
  }

  // Check if current page should not show header/footer
  const shouldHideHeaderFooter = noHeaderFooterPages.includes(router.pathname);
  
  // If page should not show header/footer, render without them (like login page)
  if (shouldHideHeaderFooter) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MantineProvider>
            <Component {...pageProps} />
            <ReactQueryDevtools initialIsOpen={false} />
          </MantineProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    );
  }

  // Only show Header/Footer if user is authenticated
  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MantineProvider>
            {router.pathname === "/dashboard/student_info" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "100vh",
                }}
              >
                <CustomHeader />
                <div style={{ flex: 1 }}>
                  <Component {...pageProps} />
                </div>
                <Footer />
              </div>
            ) : (
              <Component {...pageProps} />
            )}
            <ReactQueryDevtools initialIsOpen={false} />
          </MantineProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <MantineProvider>
          <div className="page-container" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '100vh' 
          }}>
            {router.pathname !== "/" && <Header />}
            
            {/* Subscription Warning - Show for assistant/admin/developer, not on student_dashboard */}
            {shouldShowSubscriptionWarning() && (
              <div className="subscription-warning" style={{
                background: 'linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%)',
                borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                lineHeight: 1.5,
                maxWidth: '100%',
                margin: '10px 10px 0 10px'
              }}>
                <Image src="/alert-triangle.svg" alt="Warning" width={24} height={24} style={{ flexShrink: 0 }} />
                <div style={{ textAlign: 'center' }}>
                  {subscription.active === false && !subscription.date_of_expiration ? (
                    <span>
                      Subscription Expired, to renew contact{' '}
                      <a 
                        href="/contact_developer" 
                        onClick={(e) => {
                          e.preventDefault();
                          router.push('/contact_developer');
                        }}
                        style={{
                          color: '#ffffff',
                          textDecoration: 'underline',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Tony Joseph (developer)
                      </a>
                    </span>
                  ) : (
                    <span>
                      Subscription will expire after {formatRemainingTime()}, to renew contact{' '}
                      <a 
                        href="/contact_developer" 
                        onClick={(e) => {
                          e.preventDefault();
                          router.push('/contact_developer');
                        }}
                        style={{
                          color: '#ffffff',
                          textDecoration: 'underline',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Tony Joseph (developer)
                      </a>
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <style jsx>{`
              .subscription-warning {
                margin: 10px 10px 0 10px;
              }
              
              @media (max-width: 768px) {
                .subscription-warning {
                  margin: 10px 10px 0 10px;
                  padding: 12px 16px;
                  font-size: 14px;
                  gap: 10px;
                }
                .subscription-warning img {
                  width: 20px !important;
                  height: 20px !important;
                }
              }
              
              @media (max-width: 480px) {
                .subscription-warning {
                  margin: 10px 10px 0 10px;
                  padding: 10px 14px;
                  font-size: 13px;
                  gap: 8px;
                  flex-direction: column;
                  align-items: center;
                }
                .subscription-warning img {
                  width: 18px !important;
                  height: 18px !important;
                }
              }
            `}</style>
            
            {/* Session Expiry Warning */}
            {showExpiryWarning && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                backgroundColor: '#ff6b6b',
                color: 'white',
                padding: '10px',
                textAlign: 'center',
                zIndex: 9999,
                fontWeight: 'bold'
              }}>
                ⚠️ Your session will expire soon. Please save your work and log in again.
              </div>
            )}
            
            <div className="content" style={{ flex: 1 }}>
              <Component {...pageProps} />
            </div>
            {router.pathname !== "/" && <Footer />}
          </div>
          <ReactQueryDevtools initialIsOpen={false} />
        </MantineProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
