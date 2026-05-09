import React, { useState, useEffect, useRef } from 'react';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { BarChart, Loader2, AlertCircle } from 'lucide-react';

export default function PowerBIDashboard({ reportId, embedUrl, accessToken, title = "Advanced Analytics", activeFilters = [] }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef(null);

  // For demonstration, if no token is provided, we simulate a loading/error state
  useEffect(() => {
    if (!accessToken) {
      const timer = setTimeout(() => {
        setError("Power BI configuration missing. Please connect your Azure AD credentials in the admin settings to view live reports.");
        setIsLoading(false);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setIsLoading(false);
    }
  }, [accessToken]);

  // Apply filters when activeFilters prop changes
  useEffect(() => {
    if (reportRef.current && activeFilters && activeFilters.length > 0) {
      reportRef.current.setFilters(activeFilters).catch(err => {
        console.error("Error applying Power BI filters", err);
      });
    } else if (reportRef.current) {
      // Clear filters if activeFilters is empty
      reportRef.current.removeFilters().catch(err => {
        console.error("Error removing Power BI filters", err);
      });
    }
  }, [activeFilters]);

  return (
    <Card className="w-full overflow-hidden border-indigo-100 shadow-md">
      <CardHeader className="bg-indigo-50/50 border-b border-indigo-100/50 pb-4">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <BarChart className="w-5 h-5 text-indigo-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 relative min-h-[400px] flex flex-col">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm z-10">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-600">Loading Power BI Workspace...</p>
          </div>
        )}

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Integration Not Configured</h3>
            <p className="text-slate-500 max-w-md mx-auto">{error}</p>
            <button className="mt-6 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
              Configure Integration
            </button>
          </div>
        ) : (
          <div className="w-full h-[600px]">
            <PowerBIEmbed
              embedConfig={{
                type: 'report',
                id: reportId || 'dummy-report-id',
                embedUrl: embedUrl || 'https://app.powerbi.com/reportEmbed?reportId=dummy',
                accessToken: accessToken || 'dummy-token',
                tokenType: models.TokenType.Aad,
                settings: {
                  panes: {
                    filters: { expanded: false, visible: false },
                    pageNavigation: { visible: false }
                  },
                  background: models.BackgroundType.Transparent,
                }
              }}
              cssClassName="w-full h-full border-none"
              getEmbeddedComponent={(embeddedReport) => {
                reportRef.current = embeddedReport;
              }}
              eventHandlers={
                new Map([
                  ['loaded', function () { console.log('Power BI Report loaded'); }],
                  ['rendered', function () { console.log('Power BI Report rendered'); }],
                  ['error', function (event) { console.error('Power BI Error', event.detail); }]
                ])
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
