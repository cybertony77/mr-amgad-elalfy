# 🚀 React Query Implementation for Attendance System

This document outlines the comprehensive React Query (TanStack Query) implementation that replaces manual `useEffect + axios` patterns with automatic caching, background updates, and optimistic updates.

## 📋 **Overview**

The system now uses React Query for:
- **Automatic data caching** across all pages
- **Background refetching** for fresh data
- **Optimistic updates** for better UX
- **Automatic error handling** and retries
- **Loading states** management
- **Data synchronization** across components

## 🏗️ **Architecture**

### **1. Query Client Configuration**
```javascript
// frontend/lib/queryClient.js
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // Data fresh for 5 minutes
      gcTime: 10 * 60 * 1000,      // Cache for 10 minutes
      retry: 3,                     // Retry failed requests 3 times
      refetchOnWindowFocus: true,   // Refetch when window gains focus
      refetchOnReconnect: true,     // Refetch when internet reconnects
      refetchOnMount: true,         // Refetch when component mounts
    },
    mutations: {
      retry: 1,                     // Retry failed mutations once
    },
  },
});
```

### **2. API Service Layer**
- **`/lib/api/students.js`** - All student-related operations
- **`/lib/api/assistants.js`** - All assistant-related operations  
- **`/lib/api/auth.js`** - Authentication operations

### **3. Query Keys Structure**
```javascript
// Students
studentKeys = {
  all: ['students'],
  lists: () => [...studentKeys.all, 'list'],
  list: (filters) => [...studentKeys.lists(), { filters }],
  details: () => [...studentKeys.all, 'detail'],
  detail: (id) => [...studentKeys.details(), id],
  history: () => [...studentKeys.all, 'history'],
}

// Assistants
assistantKeys = {
  all: ['assistants'],
  lists: () => [...assistantKeys.all, 'list'],
  list: (filters) => [...assistantKeys.lists(), { filters }],
  details: () => [...assistantKeys.all, 'detail'],
  detail: (id) => [...assistantKeys.details(), id],
}
```

## 🔄 **Data Fetching & State Management**

### **Queries (Read Operations)**
```javascript
// Fetch all students
const { data: students, isLoading, error, refetch } = useStudents();

// Fetch specific student
const { data: student, isLoading, error } = useStudent(studentId);

// Fetch students history
const { data: history, isLoading, error } = useStudentsHistory();

// Fetch all assistants
const { data: assistants, isLoading, error } = useAssistants();

// Fetch specific assistant
const { data: assistant, isLoading, error } = useAssistant(assistantId);
```

### **Mutations (Write Operations)**
```javascript
// Create student
const createStudentMutation = useCreateStudent();
createStudentMutation.mutate(studentData, {
  onSuccess: (data) => console.log('Student created:', data),
  onError: (error) => console.error('Error:', error)
});

// Update student
const updateStudentMutation = useUpdateStudent();
updateStudentMutation.mutate({ id, updateData });

// Delete student
const deleteStudentMutation = useDeleteStudent();
deleteStudentMutation.mutate(studentId);
```

## ✨ **Key Features**

### **1. Automatic Caching**
- **Shared cache** across all pages
- **Smart invalidation** when data changes
- **Background updates** keep data fresh
- **Optimistic updates** for instant UI feedback

### **2. Loading & Error States**
```javascript
const { data, isLoading, error, isError } = useStudents();

if (isLoading) return <LoadingSkeleton type="table" />;
if (isError) return <ErrorMessage error={error} />;
```

### **3. Optimistic Updates**
```javascript
export const useUpdateStudent = () => {
  return useMutation({
    mutationFn: ({ id, updateData }) => studentsApi.update(id, updateData, token),
    onMutate: async ({ id, updateData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: studentKeys.detail(id) });
      
      // Snapshot previous value
      const previousStudent = queryClient.getQueryData(studentKeys.detail(id));
      
      // Optimistically update
      queryClient.setQueryData(studentKeys.detail(id), { ...previousStudent, ...updateData });
      
      return { previousStudent };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousStudent) {
        queryClient.setQueryData(studentKeys.detail(id), context.previousStudent);
      }
    },
    onSettled: (data, error, { id }) => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: studentKeys.detail(id) });
    },
  });
};
```

### **4. Background Refetching**
- **Window focus** triggers refetch
- **Internet reconnection** triggers refetch
- **Component mount** triggers refetch
- **Manual refetch** available via `refetch()` function

## 📱 **Component Integration**

### **Before (Manual State Management)**
```javascript
const [students, setStudents] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

useEffect(() => {
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/students');
      setStudents(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  fetchStudents();
}, []);
```

### **After (React Query)**
```javascript
const { data: students = [], isLoading, error } = useStudents();

// That's it! React Query handles everything automatically
```

## 🎯 **Performance Benefits**

### **1. Reduced API Calls**
- **Shared cache** prevents duplicate requests
- **Smart refetching** only when needed
- **Background updates** don't block UI

### **2. Better User Experience**
- **Instant updates** with optimistic UI
- **Smooth loading states** with skeletons
- **Automatic error handling** and retries
- **Offline support** with cached data

### **3. Developer Experience**
- **Less boilerplate** code
- **Automatic state management**
- **Built-in error boundaries**
- **DevTools** for debugging

## 🔧 **Implementation Examples**

### **Students List Page**
```javascript
export default function AllStudents() {
  const { data: students = [], isLoading, error, refetch } = useStudents();
  
  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [refetch]);
  
  if (isLoading) return <LoadingSkeleton type="table" />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div>
      <Title>All Students ({students.length})</Title>
      <StudentTable students={students} />
    </div>
  );
}
```

### **Add Student Form**
```javascript
export default function AddStudent() {
  const createStudentMutation = useCreateStudent();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    createStudentMutation.mutate(formData, {
      onSuccess: (data) => {
        setSuccess(true);
        setNewId(data.id);
      },
      onError: (err) => setError(err.message)
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button 
        type="submit" 
        disabled={createStudentMutation.isPending}
      >
        {createStudentMutation.isPending ? "Adding..." : "Add Student"}
      </button>
    </form>
  );
}
```

## 🚨 **Error Handling**

### **Error Boundaries**
```javascript
// Wraps entire app for graceful error handling
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</ErrorBoundary>
```

### **Query Error Handling**
```javascript
const { data, error, isError } = useStudents();

if (isError) {
  return (
    <div className="error-container">
      <h3>Failed to load students</h3>
      <p>{error.message}</p>
      <button onClick={() => refetch()}>Retry</button>
    </div>
  );
}
```

## 📊 **DevTools Integration**

React Query DevTools are automatically included:
```javascript
<ReactQueryDevtools initialIsOpen={false} />
```

**Features:**
- **Query cache** inspection
- **Mutation history** tracking
- **Performance metrics**
- **Cache manipulation**

## 🔄 **Data Synchronization**

### **Automatic Invalidation**
When a student is updated, all related queries are automatically invalidated:
```javascript
// After updating a student
queryClient.invalidateQueries({ queryKey: studentKeys.detail(id) });
queryClient.invalidateQueries({ queryKey: studentKeys.lists() });
```

### **Cross-Page Updates**
- **Students list** updates when student is added/edited/deleted
- **History page** reflects attendance changes immediately
- **Session info** shows real-time updates
- **All pages** stay in sync automatically

## 🚀 **Migration Guide**

### **Step 1: Replace Manual State**
```javascript
// Before
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// After
const { data = [], isLoading, error } = useQuery();
```

### **Step 2: Replace Manual Fetching**
```javascript
// Before
useEffect(() => {
  fetchData();
}, []);

// After
// React Query handles this automatically!
```

### **Step 3: Replace Manual Mutations**
```javascript
// Before
const handleSubmit = async () => {
  try {
    setLoading(true);
    const response = await axios.post('/api/endpoint', data);
    // Handle success
  } catch (error) {
    // Handle error
  } finally {
    setLoading(false);
  }
};

// After
const mutation = useMutation();
mutation.mutate(data, {
  onSuccess: (data) => { /* Handle success */ },
  onError: (error) => { /* Handle error */ }
});
```

## 📈 **Performance Monitoring**

### **Query Metrics**
- **Cache hit rate** - How often data is served from cache
- **Refetch frequency** - How often data is updated
- **Error rates** - API failure statistics
- **Loading times** - Query performance metrics

### **Optimization Tips**
1. **Use appropriate `staleTime`** for different data types
2. **Implement pagination** for large datasets
3. **Use `select` option** to transform data
4. **Implement `keepPreviousData`** for smooth transitions

## 🔮 **Future Enhancements**

### **Planned Features**
- **Infinite queries** for pagination
- **Prefetching** for better UX
- **Offline support** with service workers
- **Real-time updates** with WebSockets
- **Advanced caching** strategies

### **Scalability**
- **Query deduplication** for concurrent requests
- **Background sync** for offline changes
- **Smart retry** strategies
- **Performance monitoring** and analytics

## 📚 **Resources**

- [React Query Documentation](https://tanstack.com/query/latest)
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools)
- [Best Practices](https://tanstack.com/query/latest/docs/react/guides/best-practices)
- [Performance Tips](https://tanstack.com/query/latest/docs/react/guides/performance)

---

**🎉 Congratulations!** Your attendance system now has enterprise-grade data management with React Query. Enjoy the improved performance, better UX, and reduced development time!

