import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, TrendingUp, Map as MapIcon, Loader2 } from 'lucide-react';
import { ComprehensiveDashboardStats } from '../types';
import { getApiBaseUrl, getAuthHeaders } from '../utils/apiAuth';

interface MapSectionProps {
  stats?: ComprehensiveDashboardStats | any;
  darkMode: boolean;
}

// Fallback city coordinates in India
const CITY_COORD_MAP: Record<string, [number, number]> = {
  karnataka: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  maharashtra: [19.076, 72.8777],
  mumbai: [19.076, 72.8777],
  pune: [18.5204, 73.8567],
  delhi: [28.7041, 77.1025],
  haryana: [28.4595, 77.0266],
  gurgaon: [28.4595, 77.0266],
  'west bengal': [22.5726, 88.3639],
  kolkata: [22.5726, 88.3639],
  'tamil nadu': [13.0827, 80.2707],
  chennai: [13.0827, 80.2707],
  telangana: [17.385, 78.4867],
  hyderabad: [17.385, 78.4867],
  kerala: [10.8505, 76.2711],
};

export const MapSection: React.FC<MapSectionProps> = ({ stats, darkMode }) => {
  const [viewMode, setViewMode] = useState<'map' | 'states'>('map');
  const [selectedState, setSelectedState] = useState<any>(null);
  const [stateLiveMetrics, setStateLiveMetrics] = useState<Record<string, { leads: number; apps: number; branches: number; convRate: number }>>({});
  const [loadingStateMetrics, setLoadingStateMetrics] = useState<string | null>(null);

  const leadsByState = stats?.leadsStats?.byState || [];
  const appsByState = stats?.applicationsStats?.byState || [];

  // Combine initial state list from API overview stats
  const stateMetricsMap = new Map<string, { state: string; leads: number; apps: number; convRate: number }>();

  leadsByState.forEach((item: any) => {
    const stName = (item.state || 'KARNATAKA').toUpperCase();
    if (!stateMetricsMap.has(stName)) {
      stateMetricsMap.set(stName, { state: stName, leads: item.count, apps: 0, convRate: 0 });
    } else {
      stateMetricsMap.get(stName)!.leads += item.count;
    }
  });

  appsByState.forEach((item: any) => {
    const stName = (item.state || 'KARNATAKA').toUpperCase();
    if (!stateMetricsMap.has(stName)) {
      stateMetricsMap.set(stName, { state: stName, leads: 0, apps: item.count, convRate: 0 });
    } else {
      stateMetricsMap.get(stName)!.apps += item.count;
    }
  });

  const stateDataList = Array.from(stateMetricsMap.values()).map((st) => {
    const rate = st.leads > 0 ? Math.round((st.apps / st.leads) * 100) : 0;
    return { ...st, convRate: rate };
  });

  const maxLeadsInState = Math.max(1, ...stateDataList.map((s) => s.leads));

  // Dynamic API Fetching for state-filtered leads, applications, and bank-branches
  const fetchLiveStateMetrics = useCallback(async (stName: string) => {
    if (!stName) return;
    const uppercaseState = stName.toUpperCase();
    setLoadingStateMetrics(uppercaseState);

    const baseUrl = getApiBaseUrl();

    try {
      const headers = await getAuthHeaders();
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const makeUrl = (path: string) => {
        const endpoint = path.replace(/^\/+/, '');
        return `${cleanBase}/${endpoint}`;
      };

      const leadsUrl = makeUrl(`api/v2/onboarding/leads/list/?state=${encodeURIComponent(uppercaseState)}`);
      const appsUrl = makeUrl(`api/v2/onboarding/applications/list/?state=${encodeURIComponent(uppercaseState)}`);
      const branchesUrl = makeUrl(`api/v2/onboarding/bank-branches/filter/?state=${encodeURIComponent(stName.toLowerCase())}`);

      const [leadsRes, appsRes, branchesRes] = await Promise.all([
        fetch(leadsUrl, { headers }).catch(() => null),
        fetch(appsUrl, { headers }).catch(() => null),
        fetch(branchesUrl, { headers }).catch(() => null),
      ]);

      let liveLeads = 0;
      if (leadsRes && leadsRes.ok) {
        const json = await leadsRes.json();
        liveLeads = json?.data?.count ?? json?.count ?? json?.data?.results?.leads?.length ?? json?.data?.results?.length ?? 0;
      }

      let liveApps = 0;
      if (appsRes && appsRes.ok) {
        const json = await appsRes.json();
        liveApps = json?.data?.count ?? json?.count ?? json?.data?.results?.applications?.length ?? json?.data?.results?.length ?? 0;
      }

      let liveBranches = 0;
      if (branchesRes && branchesRes.ok) {
        const json = await branchesRes.json();
        liveBranches = json?.data?.count ?? json?.count ?? json?.data?.results?.length ?? 0;
      }

      const convRate = liveLeads > 0 ? Math.round((liveApps / liveLeads) * 100) : 0;

      setStateLiveMetrics((prev) => ({
        ...prev,
        [uppercaseState]: {
          leads: liveLeads,
          apps: liveApps,
          branches: liveBranches,
          convRate,
        },
      }));
    } catch (err) {
      console.error(`[MapSection] Failed to fetch live state metrics for ${stName}:`, err);
    } finally {
      setLoadingStateMetrics((prev) => (prev === uppercaseState ? null : prev));
    }
  }, []);

  // Fetch when a state is selected
  useEffect(() => {
    if (selectedState?.state) {
      const stName = selectedState.state.toUpperCase();
      if (stateLiveMetrics[stName] === undefined) {
        fetchLiveStateMetrics(selectedState.state);
      }
    }
  }, [selectedState, stateLiveMetrics, fetchLiveStateMetrics]);

  // Pre-fetch live state metrics for active states in map
  useEffect(() => {
    stateDataList.forEach((st) => {
      const stName = st.state.toUpperCase();
      if (stateLiveMetrics[stName] === undefined) {
        fetchLiveStateMetrics(st.state);
      }
    });
  }, [stateDataList.map((s) => s.state).join(','), fetchLiveStateMetrics]);

  const createMarkerIcon = (intensityPct: number) => {
    const color = intensityPct > 60 ? '#10b981' : intensityPct > 30 ? '#0076eb' : '#f59e0b';
    return L.divIcon({
      html: `
        <div style="position: relative; width: 24px; height: 24px; cursor: pointer;">
          <div style="position: absolute; top: 0; left: 0; width: 24px; height: 24px; background: ${color}; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 2;"></div>
          <div style="position: absolute; top: 0; left: 0; width: 24px; height: 24px; background: ${color}; border-radius: 50%; animation: ping 1.5s infinite; opacity: 0.4; z-index: 1;"></div>
        </div>
        <style>
          @keyframes ping {
            0% { transform: scale(1); opacity: 0.5; }
            100% { transform: scale(1.8); opacity: 0; }
          }
        </style>
      `,
      className: '',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const getCoordinatesForState = (stName: string, idx: number): [number, number] => {
    const key = stName.toLowerCase();
    for (const [cityKey, coords] of Object.entries(CITY_COORD_MAP)) {
      if (key.includes(cityKey)) return coords;
    }
    return [20.5937 + (idx % 5) * 1.5, 78.9629 - (idx % 4) * 1.5];
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} shadow-sm`}>
      {/* Header with View Switcher */}
      <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <div>
          <h3 className={`text-sm font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            <MapIcon size={16} className="text-brand-blue" />
            Geographic Footprint & State Intensity
          </h3>
          <p className={`text-xs mt-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            State distribution calculated from active API records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              viewMode === 'map'
                ? 'bg-brand-blue text-white'
                : darkMode
                ? 'bg-gray-800 text-gray-400'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Interactive Map
          </button>
          <button
            onClick={() => setViewMode('states')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              viewMode === 'states'
                ? 'bg-brand-blue text-white'
                : darkMode
                ? 'bg-gray-800 text-gray-400'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            State Intensity Table
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="flex flex-col lg:flex-row">
          {/* Leaflet Map */}
          <div className="flex-1 h-96 relative z-10">
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={4.5}
              style={{ width: '100%', height: '100%', background: darkMode ? '#111827' : '#f8fafc' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url={
                  darkMode
                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                }
              />
              {stateDataList.map((st, idx) => {
                const coords = getCoordinatesForState(st.state, idx);
                const intensity = Math.round((st.leads / maxLeadsInState) * 100);
                const stUpper = st.state.toUpperCase();
                const liveData = stateLiveMetrics[stUpper];
                const displayLeads = liveData?.leads ?? st.leads;
                const displayApps = liveData?.apps ?? st.apps;
                const displayBranches = liveData?.branches ?? 0;
                const displayConv = liveData?.convRate ?? st.convRate;

                return (
                  <Marker
                    key={st.state}
                    position={coords}
                    icon={createMarkerIcon(intensity)}
                    eventHandlers={{
                      click: () => {
                        setSelectedState(st);
                        fetchLiveStateMetrics(st.state);
                      },
                    }}
                  >
                    <Popup>
                      <div className="p-1 font-sans text-xs">
                        <strong className="text-gray-900 font-bold block mb-1">{st.state}</strong>
                        <div className="text-gray-600 space-y-0.5">
                          <p>Leads: {displayLeads.toLocaleString()}</p>
                          <p>Applications: {displayApps.toLocaleString()}</p>
                          <p>Total Branches: {displayBranches.toLocaleString()}</p>
                          <p className="text-indigo-600 font-bold">Conversion Rate: {displayConv}%</p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Sidebar */}
          <div
            className={`w-full lg:w-80 p-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l ${
              darkMode ? 'border-gray-800 bg-gray-900/40' : 'border-gray-100 bg-gray-50/50'
            }`}
          >
            <div>
              <h4 className={`text-xs font-bold uppercase tracking-wider mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                State Analytics
              </h4>

              {selectedState ? (
                <div className="space-y-4">
                  <div>
                    <h3 className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedState.state}</h3>
                    <p className="text-xs text-brand-blue font-semibold mt-0.5">Verified API State Metrics</p>
                  </div>

                  {(() => {
                    const stUpper = selectedState.state.toUpperCase();
                    const liveData = stateLiveMetrics[stUpper];
                    const isLoading = loadingStateMetrics === stUpper;

                    const activeLeads = liveData?.leads ?? selectedState.leads;
                    const activeApps = liveData?.apps ?? selectedState.apps;
                    const activeBranches = liveData?.branches ?? 0;
                    const activeConv = liveData?.convRate ?? selectedState.convRate;

                    return (
                      <>
                        <div className="grid grid-cols-3 gap-2 pt-2">
                          <div className={`p-2.5 rounded-xl border ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Leads</p>
                            <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {isLoading ? <Loader2 size={13} className="animate-spin text-brand-blue mt-1" /> : activeLeads.toLocaleString()}
                            </p>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Applications</p>
                            <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {isLoading ? <Loader2 size={13} className="animate-spin text-brand-blue mt-1" /> : activeApps.toLocaleString()}
                            </p>
                          </div>
                          <div className={`p-2.5 rounded-xl border ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <p className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Branches</p>
                            <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                              {isLoading ? <Loader2 size={13} className="animate-spin text-brand-blue mt-1" /> : activeBranches.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                            darkMode ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'
                          }`}
                        >
                          <TrendingUp className="text-emerald-500 flex-shrink-0" size={20} />
                          <div>
                            <p className={`text-xs ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>Conversion Rate</p>
                            <p className={`text-base font-bold ${darkMode ? 'text-white' : 'text-emerald-900'}`}>{activeConv}%</p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <MapPin className={`mx-auto mb-2 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} size={32} />
                  <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Click any state marker on the map to inspect leads, applications, total branches, and conversion rates.
                  </p>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className={`mt-6 pt-4 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="text-[11px] font-bold mb-2 text-gray-400">STATE INTENSITY LEGEND</div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> High</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Medium</span>
                <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Moderate</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stateDataList.map((st) => {
              const intensity = Math.round((st.leads / maxLeadsInState) * 100);
              const stUpper = st.state.toUpperCase();
              const liveData = stateLiveMetrics[stUpper];
              const displayLeads = liveData?.leads ?? st.leads;
              const displayApps = liveData?.apps ?? st.apps;
              const displayBranches = liveData?.branches ?? 0;
              const displayConv = liveData?.convRate ?? st.convRate;

              return (
                <div key={st.state} className={`p-4 rounded-xl border ${darkMode ? 'bg-gray-800/40 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{st.state}</span>
                    <span className="text-xs font-bold text-brand-blue">{displayConv}% Conv</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Leads: {displayLeads.toLocaleString()}</span>
                    <span>Apps: {displayApps.toLocaleString()}</span>
                    <span>Branches: {displayBranches.toLocaleString()}</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div className="h-full bg-brand-blue rounded-full" style={{ width: `${Math.max(10, intensity)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapSection;
