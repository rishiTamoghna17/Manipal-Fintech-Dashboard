import { useState, useEffect, useCallback, useRef } from 'react';
import { Lead } from '../types';
import { getApiBaseUrl, getAuthHeaders } from '../utils/apiAuth';

interface UseLeadsDataReturn {
  leads: Lead[];
  loading: boolean;
  isPolling: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
  lastSync: Date | null;
}

const POLL_INTERVAL_MS = 15 * 1000; // 15 seconds

const mapBackendLeadToFrontend = (lead: any): Lead => {
  const status = (lead.status || 'DRAFT').toUpperCase();
  const leadId = String(lead.id || lead.lead_id || lead.lead_code || '');

  // Calculate health score based on actual backend lead status
  const healthMap: Record<string, number> = {
    CONVERTED: 95,
    DISBURSED: 95,
    APPROVED: 90,
    APPLICATION_CREATED: 85,
    ACTIVE: 80,
    UNVERIFIED: 60,
    NOT_ELIGIBLE: 20,
    AUTO_CLOSED: 10,
    REJECTED: 15,
  };
  const health_score = healthMap[status] ?? 50;

  const rawAmount = Number(lead.amount || 0);

  return {
    id: leadId,
    lead_code: lead.lead_code || undefined,
    customer_id: lead.customer_id || undefined,
    name: lead.customer_name || lead.first_name || `Lead ${lead.lead_code || leadId}`,
    email: lead.email_address || lead.email || '',
    phone: lead.contact_number || lead.phone || '',
    product_category: lead.product_category || 'LOAN',
    product_subcategory: lead.product_subcategory || 'GOLD_LOAN',
    product_display: lead.product_display || lead.product_subcategory || 'Gold Loan',
    lead_type: lead.lead_type || 'FRESH',
    source: lead.source || 'MoneyPal',
    crm_type: lead.crm_type || undefined,
    state: lead.state || 'KARNATAKA',
    pincode: lead.pincode || undefined,
    amount: rawAmount,
    status: status,
    created_at: lead.created_at || lead.created_on || new Date().toISOString(),
    modified_at: lead.modified_at || lead.created_at || new Date().toISOString(),
    created_by: lead.created_by ? String(lead.created_by) : undefined,
    assigned_to: lead.assigned_to ? String(lead.assigned_to) : undefined,
    punched_by: lead.punched_by ? String(lead.punched_by) : undefined,
    team: lead.team || undefined,
    application_id: lead.application_id || undefined,
    prescreen_status: Boolean(lead.prescreen_status),
    isFreshOnboardingSubmitted: Boolean(lead.isFreshOnboardingSubmitted),
    lending_partner: lead.lending_partner || 'AXIS_BANK',
    // Display fallbacks
    organization: lead.lending_partner || 'Manipal Fintech',
    industry: lead.product_subcategory || 'Fintech',
    plan: lead.lead_type || 'Fresh',
    region: lead.state || 'South',
    city: lead.district || lead.city || lead.state || 'Unknown',
    revenue: rawAmount,
    health_score: health_score,
  };
};

export const useLeadsData = (): UseLeadsDataReturn => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLeads = useCallback(async (background = false) => {
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

      // Fetch pages up to total count or MAX_PAGES to ensure full dataset
      let currentUrl: string | null = buildUrl(baseUrl, 'api/v2/onboarding/leads/list/?page_size=100');
      const allRawLeads: any[] = [];
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
        const pageLeads = data?.data?.results?.leads || data?.data?.leads || data?.results?.leads || data?.results || (Array.isArray(data?.data) ? data.data : []);
        apiTotalCount = data?.data?.count ?? data?.count ?? apiTotalCount;

        if (Array.isArray(pageLeads)) {
          for (const item of pageLeads) {
            allRawLeads.push(item);
          }
        }

        const rawNext: string | null = data?.data?.next ?? data?.next ?? null;
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

      // Deduplicate strictly by unique lead ID
      const uniqueRawLeads: any[] = [];
      const seenIds = new Set<string>();

      for (const item of allRawLeads) {
        const itemKey = String(item.id || item.lead_id || item.lead_code || '');
        if (itemKey) {
          if (!seenIds.has(itemKey)) {
            seenIds.add(itemKey);
            uniqueRawLeads.push(item);
          }
        } else {
          uniqueRawLeads.push(item);
        }
      }

      const enriched = uniqueRawLeads.map((lead: any) => mapBackendLeadToFrontend(lead));

      setLeads(enriched);
      setTotalCount(apiTotalCount || enriched.length);
      setLastSync(new Date());
      setError(null);
    } catch (err: any) {
      console.error('[LeadsData] Failed to fetch leads from API:', err.message);
      setError(err.message || 'Failed to fetch live leads data');
      setLastSync(new Date());
    } finally {
      setLoading(false);
      setIsPolling(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads(false);

    timerRef.current = setInterval(() => {
      fetchLeads(true);
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchLeads]);

  return { leads, loading, isPolling, error, totalCount, refetch: () => fetchLeads(false), lastSync };
};
