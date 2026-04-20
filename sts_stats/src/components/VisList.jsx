import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../lib/supabase';

const VisualizationsList = forwardRef((props, ref) => {
  const [visualizations, setVisualizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState('all');
  const [recentUserHash, setRecentUserHash] = useState(null);
  const [stats, setStats] = useState({ totalRuns: 0, myRuns: 0 });

  // Expose refreshData method to parent component
  useImperativeHandle(ref, () => ({
    refreshData: () => {
      fetchVisualizations();
      fetchUserStats(recentUserHash);
    }
  }));

  // Fetch statistics - accept hash as parameter to avoid closure issues
  const fetchUserStats = async (hash = recentUserHash) => {
    const { data, error } = await supabase
      .from('game_runs')
      .select('user_id_hash');
    
    if (!error && data) {
      setStats({
        totalRuns: data.length,
        myRuns: hash ? data.filter(r => r.user_id_hash === hash).length : 0
      });
    }
  };

  // Load the saved user hash from localStorage on component mount
  useEffect(() => {
    const savedUserHash = localStorage.getItem('recent_user_hash');
    if (savedUserHash) {
      setRecentUserHash(savedUserHash);
      fetchUserStats(savedUserHash); // Pass the hash directly
    } else {
      fetchUserStats(); // No hash, myRuns will be 0
    }
  }, []);

  // Fetch visualizations based on selected data source
  const fetchVisualizations = async () => {
    setLoading(true);
    setError(null);
    
    let query = supabase.from('game_runs').select('*');
    
    if (dataSource === 'my_recent' && recentUserHash) {
      query = query.eq('user_id_hash', recentUserHash);
    }
    
    const { data, error } = await query.order('start_time', { ascending: false });

    if (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } else {
      setVisualizations(data || []);
    }
    setLoading(false);
  };

  // Save the current user hash to localStorage and update state
  const saveUserHashToLocal = (hash) => {
    if (hash && hash !== recentUserHash) {
      localStorage.setItem('recent_user_hash', hash);
      setRecentUserHash(hash);
      fetchUserStats(hash); // Pass the new hash directly
      if (dataSource === 'my_recent') {
        fetchVisualizations();
      }
    }
  };

  // Listen for new uploads
  useEffect(() => {
    const channel = supabase
      .channel('game_runs_changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'game_runs' }, 
        (payload) => {
          const newRun = payload.new;
          if (newRun.user_id_hash) {
            saveUserHashToLocal(newRun.user_id_hash);
          }
          fetchVisualizations();
          fetchUserStats(recentUserHash);
        }
      )
      .subscribe();

    const getMostRecentUserHash = async () => {
      const { data, error } = await supabase
        .from('game_runs')
        .select('user_id_hash')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0 && data[0].user_id_hash) {
        saveUserHashToLocal(data[0].user_id_hash);
      }
    };
    
    getMostRecentUserHash();
    fetchVisualizations();

    return () => {
      channel.unsubscribe();
    };
  }, [dataSource]); // Remove fetchUserStats from dependencies

  // Manual refresh function
  const handleRefresh = () => {
    fetchVisualizations();
    fetchUserStats(recentUserHash);
  };

  // Clear saved user hash
  const clearSavedUserHash = () => {
    localStorage.removeItem('recent_user_hash');
    setRecentUserHash(null);
    fetchUserStats(null); // Pass null to reset myRuns to 0
    if (dataSource === 'my_recent') {
      fetchVisualizations();
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '20px' }}>Loading visualizations...</div>;
  
  if (error) return <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ margin: 0 }}>Game Runs</h1>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', background: '#f5f5f5', padding: '5px', borderRadius: '8px' }}>
            <button
              onClick={() => setDataSource('all')}
              style={{
                padding: '8px 16px',
                background: dataSource === 'all' ? '#646cff' : 'transparent',
                color: dataSource === 'all' ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              All Data ({stats.totalRuns} runs)
            </button>
            <button
              onClick={() => setDataSource('my_recent')}
              disabled={!recentUserHash}
              style={{
                padding: '8px 16px',
                background: dataSource === 'my_recent' ? '#646cff' : 'transparent',
                color: dataSource === 'my_recent' ? 'white' : (recentUserHash ? '#333' : '#999'),
                border: 'none',
                borderRadius: '6px',
                cursor: recentUserHash ? 'pointer' : 'not-allowed'
              }}
            >
              My Recent Upload ({stats.myRuns} runs)
            </button>
          </div>
          
          <button
            onClick={handleRefresh}
            style={{
              padding: '8px 16px',
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
          
          {recentUserHash && (
            <button
              onClick={clearSavedUserHash}
              style={{
                padding: '8px 16px',
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Clear My Data
            </button>
          )}
        </div>
      </div>
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          background: '#fff3e0',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <strong>Debug:</strong> User Hash: {recentUserHash || 'None'} | My Runs: {stats.myRuns} | Total: {stats.totalRuns}
        </div>
      )}
      
      {visualizations.length === 0 ? (
        <p>No runs found. Upload your first ZIP file!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {visualizations.map((viz, index) => {
            const rawData = viz.raw_data;
            const player = rawData?.players?.[0];
            const deckSize = player?.deck?.length || 0;
            const relicsCount = player?.relics?.length || 0;
            const totalDamage = rawData?.map_point_history?.reduce((total, act) => {
              return total + act.reduce((actTotal, point) => {
                return actTotal + (point.player_stats?.[0]?.damage_taken || 0);
              }, 0);
            }, 0) || 0;
            
            const startTime = viz.start_time ? new Date(viz.start_time) : null;
            const isCurrentUser = recentUserHash && viz.user_id_hash === recentUserHash;
            
            return (
              <li key={viz.run_hash || index} style={{ 
                border: '1px solid #ddd', 
                marginBottom: '10px', 
                padding: '15px',
                borderRadius: '8px',
                background: isCurrentUser ? '#f8f9ff' : 'white',
                borderLeft: isCurrentUser ? '4px solid #646cff' : '1px solid #ddd'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{viz.title || `Run ${viz.run_hash?.substring(0, 8)}`}</h3>
                  {isCurrentUser && (
                    <span style={{ 
                      fontSize: '11px', 
                      background: '#646cff', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '12px'
                    }}>
                      Your Upload
                    </span>
                  )}
                </div>
                <p><strong>Character:</strong> {viz.character || player?.character?.replace('CHARACTER.', '') || 'Unknown'}</p>
                <p><strong>Result:</strong> {viz.win ? 'Victory' : 'Defeat'}</p>
                <p><strong>Ascension:</strong> {viz.ascension}</p>
                <p><strong>Duration:</strong> {Math.floor(viz.run_time / 60)}m {viz.run_time % 60}s</p>
                
                <details>
                  <summary style={{ cursor: 'pointer', color: '#646cff' }}>Run Details</summary>
                  <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <p><strong>Deck Size:</strong> {deckSize} cards</p>
                    <p><strong>Relics:</strong> {relicsCount}</p>
                    <p><strong>Total Damage Taken:</strong> {totalDamage}</p>
                    <p><strong>Seed:</strong> {rawData?.seed || viz.seed || 'N/A'}</p>
                    <p><strong>Build:</strong> {rawData?.build_id || 'Unknown'}</p>
                  </div>
                </details>
                
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                  Started: {startTime ? startTime.toLocaleString() : 'Unknown'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

export default VisualizationsList;