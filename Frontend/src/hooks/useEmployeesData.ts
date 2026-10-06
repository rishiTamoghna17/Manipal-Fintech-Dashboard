import { useState, useEffect, useCallback, useRef } from 'react';
import { Employee } from '../types';
import { getApiBaseUrl, getAuthHeaders } from '../utils/apiAuth';

interface UseEmployeesDataReturn {
  employees: Employee[];
  loading: boolean;
  isPolling: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
  lastSync: Date | null;
}

const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export const useEmployeesData = (): UseEmployeesDataReturn => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmployees = useCallback(async (background = false) => {
    if (background) {
      setIsPolling(true);
    } else {
      setLoading(true);
    }

    const baseUrl = getApiBaseUrl();

    try {
      const headers = await getAuthHeaders();
      const buildUrl = (base: string, path: string) => {
        const cleanBase = base.replace(/\/+$/, '');
        const cleanPath = path.replace(/^\/+/, '');
        return `${cleanBase}/${cleanPath}`;
      };

      // Fetch all pages to ensure complete dataset (no truncation)
      let currentUrl: string | null = buildUrl(baseUrl, 'user/employee?limit=100');
      const allRawEmployees: any[] = [];
      let apiTotalCount = 0;
      let pagesFetched = 0;
      const MAX_PAGES = 10;

      while (currentUrl && pagesFetched < MAX_PAGES) {
        pagesFetched++;
        const response = await fetch(currentUrl, { headers });

        if (response.status === 401) {
          throw new Error('Authentication required: Bearer token is missing or invalid.');
        }

        if (!response.ok) {
          throw new Error(`API returned ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const pageEmployees = data?.data?.results || data?.data || data?.results || (Array.isArray(data) ? data : []);
        apiTotalCount = data?.count ?? data?.data?.count ?? apiTotalCount;

        if (Array.isArray(pageEmployees)) {
          for (const item of pageEmployees) {
            allRawEmployees.push(item);
          }
        }

        const rawNext: string | null = data?.next ?? data?.data?.next ?? null;
        if (rawNext && pagesFetched < MAX_PAGES) {
          try {
            const parsedNext = new URL(rawNext, baseUrl);
            const baseParsed = new URL(baseUrl);
            parsedNext.protocol = baseParsed.protocol;
            parsedNext.host = baseParsed.host;
            currentUrl = parsedNext.toString();
          } catch {
            currentUrl = rawNext;
          }
        } else {
          currentUrl = null;
        }
      }

      // Deduplicate strictly by unique user_id
      const uniqueEmployees: Employee[] = [];
      const seenUserIds = new Set<string>();

      for (const item of allRawEmployees) {
        const uid = String(item.user_id || item.id || item.employee_id || '');
        if (uid && !seenUserIds.has(uid)) {
          seenUserIds.add(uid);
          
          let branchName = 'N/A';
          let branchCode = 'N/A';
          if (item.branch && typeof item.branch === 'object') {
            const bInfo = item.branch.branch || item.branch;
            branchName = bInfo.branch_name || bInfo.name || 'N/A';
            branchCode = bInfo.branch_code || bInfo.code || 'N/A';
          }

          uniqueEmployees.push({
            user_id: uid,
            username: item.username || item.employee_id || 'N/A',
            employee_id: item.employee_id || item.username || undefined,
            first_name: item.first_name || '',
            last_name: item.last_name || '',
            phone: item.phone ? String(item.phone) : 'N/A',
            email: item.email || undefined,
            role: (item.role || 'SALES_OFFICER').toUpperCase(),
            designation: item.designation || undefined,
            team: item.team || undefined,
            is_active: item.is_active !== false,
            date_of_joining: item.date_of_joining || undefined,
            state: item.state || undefined,
            district: item.district || undefined,
            city: item.city || undefined,
            pincode: item.pincode || undefined,
            assigned_to: item.assigned_to || item.assign_so || undefined,
            assign_so: item.assign_so || item.assigned_to || undefined,
            branch_name: branchName,
            branch_code: branchCode,
          });
        }
      }

      setEmployees(uniqueEmployees);
      setTotalCount(apiTotalCount || uniqueEmployees.length);
      setLastSync(new Date());
      setError(null);
    } catch (err: any) {
      console.error('[EmployeesData] Failed to fetch employees from API:', err.message);
      setError(err.message || 'Failed to fetch employee data');
      setLastSync(new Date());
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees(false);

    timerRef.current = setInterval(() => {
      fetchEmployees(true);
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchEmployees]);

  return { employees, loading, isPolling, error, totalCount, refetch: () => fetchEmployees(false), lastSync };
};
