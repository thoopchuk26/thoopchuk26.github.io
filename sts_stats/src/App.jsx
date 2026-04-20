import { useState, useRef, useEffect } from 'react';
import UploadData from './components/UploadData';
import VisualizationsList from './components/VisList';
import CardAnalyticsDashboard from './components/CardAnalyticsDashboard';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('card-analytics');
  const [runData, setRunData] = useState([]);
  const [loading, setLoading] = useState(true);
  const visListRef = useRef();

  // Fetch run data from Supabase on component mount
  useEffect(() => {
    fetchRunData();
  }, []);

  const fetchRunData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('game_runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRunData(data);
    }
    setLoading(false);
  };

  const handleUploadComplete = (userHash) => {
    if (userHash) {
      localStorage.setItem('recent_user_hash', userHash);
      console.log('User hash saved:', userHash);
    }
    
    // Refresh data after upload
    fetchRunData();
    
    if (activeTab === 'view' && visListRef.current) {
      visListRef.current.refreshData();
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'view' && visListRef.current) {
      setTimeout(() => {
        visListRef.current.refreshData();
      }, 100);
    }
  };

  return (
    <div style={{ width: '100%', minWidth: '100vw', overflowX: 'hidden' }}>
      <header style={{ 
        background: '#1a1a1a', 
        padding: '12px 20px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ margin: 0, color: '#ffab00', fontSize: '1.5rem' }}>Slay the Spire 2 Card Dashboard</h1>
        
        {/* Tabs moved to the right side */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('card-analytics')}
            style={{
              padding: '8px 20px',
              background: activeTab === 'card-analytics' ? '#646cff' : 'transparent',
              color: activeTab === 'card-analytics' ? 'white' : '#e0e0e0',
              border: activeTab === 'card-analytics' ? 'none' : '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            Card Analytics
          </button>
          <button
            onClick={() => switchTab('view')}
            style={{
              padding: '8px 20px',
              background: activeTab === 'view' ? '#646cff' : 'transparent',
              color: activeTab === 'view' ? 'white' : '#e0e0e0',
              border: activeTab === 'view' ? 'none' : '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            View Runs
          </button>
          <button
            onClick={() => switchTab('upload')}
            style={{
              padding: '8px 20px',
              background: activeTab === 'upload' ? '#4caf50' : 'transparent',
              color: activeTab === 'upload' ? 'white' : '#e0e0e0',
              border: activeTab === 'upload' ? 'none' : '1px solid #555',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            Upload Data
          </button>
        </div>
      </header>
      
      {/* Remove padding for card-analytics tab, keep for others */}
      {activeTab === 'card-analytics' ? (
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #646cff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '20px' }}>Loading run data...</p>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : (
            <CardAnalyticsDashboard runData={runData} />
          )}
        </div>
      ) : (
        <div style={{ padding: '20px', width: '100%', boxSizing: 'border-box' }}>
          {activeTab === 'view' && <VisualizationsList ref={visListRef} />}
          {activeTab === 'upload' && <UploadData onUploadComplete={handleUploadComplete} />}
        </div>
      )}
    </div>
  );
}

export default App;