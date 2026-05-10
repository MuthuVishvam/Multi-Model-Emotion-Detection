import React, { useState, useEffect, useRef } from 'react';
import { PowerBIEmbed } from 'powerbi-client-react';
import { models } from 'powerbi-client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

export default function PowerBIDashboard({ reportId, embedUrl, accessToken, tokenType = "Embed", title = "Advanced Analytics", activeFilters = [] }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportRef = useRef(null);

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

  useEffect(() => {
    if (reportRef.current && activeFilters && activeFilters.length > 0) {
      reportRef.current.setFilters(activeFilters).catch(err => {
        console.error("Error applying Power BI filters", err);
      });
    } else if (reportRef.current) {
      reportRef.current.removeFilters().catch(err => {
        console.error("Error removing Power BI filters", err);
      });
    }
  }, [activeFilters]);

  return (
    <Card className="w-full overflow-hidden border-brand-500/20 shadow-2xl">
      <CardHeader className="bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 pb-4">
        <CardTitle className="flex items-center gap-3 text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          {title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0 relative min-h-[500px] flex flex-col bg-slate-950">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-10">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-brand-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Loading Power BI Workspace...</p>
          </div>
        )}

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-900/50">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Integration Not Configured</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-8">{error}</p>
            <button className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all">
              Configure Integration
            </button>
          </div>
        ) : (
          <div className="w-full h-[700px]">
            <PowerBIEmbed
              embedConfig={{
                type: 'report',
                id: reportId || 'dummy-report-id',
                embedUrl: embedUrl || 'https://app.powerbi.com/reportEmbed?reportId=dummy',
                accessToken: accessToken || 'dummy-token',
                tokenType: tokenType === "Aad" ? models.TokenType.Aad : models.TokenType.Embed,
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
