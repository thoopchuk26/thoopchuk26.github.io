// components/CardAnalyticsDashboard.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AscensionWinRateChart from './vis/WinRateChart';
import CardPairingAnalytics from './vis/CardPairingAnalytics';
import { getCardFromDatabase, processAllRunsData, calculateCardStats } from './utils/CardDataProcessing';
import cardDatabaseArray from './utils/cardDatabase.json';
import UpgradeImpactDashboard from './vis/UpgradeImpact';
import CardPickRatePieChart from './vis/CardPickRate';

// Helper function to render description with [gold] and [energy:X] tags
const renderDescription = (description, upgraded = false) => {
  if (!description) return 'No description available.';
  
  const parts = [];
  const regex = /\[gold\](.*?)\[\/gold\]|\[energy:(\d+)\]/g;
  let match;
  let lastIndex = 0;
  
  while ((match = regex.exec(description)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: description.substring(lastIndex, match.index) });
    }
    
    if (match[1] !== undefined) {
      parts.push({ type: 'gold', content: match[1] });
    } else if (match[2] !== undefined) {
      const energyValue = parseInt(match[2]);
      parts.push({ type: 'energy', content: energyValue });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < description.length) {
    parts.push({ type: 'text', content: description.substring(lastIndex) });
  }
  
  if (parts.length === 0) {
    return <span>{description}</span>;
  }
  
  return (
    <span>
      {parts.map((part, index) => {
        if (part.type === 'gold') {
          return <strong key={index} style={{ fontWeight: 'bold', color: '#ff9800' }}>{part.content}</strong>;
        }
        if (part.type === 'energy') {
          return (
            <strong key={index} style={{ fontWeight: 'bold', color: '#ffd700' }}>
              {part.content} Energy
            </strong>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
};

function CardAnalyticsDashboard({ runData }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardStats, setCardStats] = useState({});
  const [processedRunsData, setProcessedRunsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewUpgraded, setViewUpgraded] = useState(false);
  const [dataSource, setDataSource] = useState('all');
  const [recentUserHash, setRecentUserHash] = useState(null);
  const [stats, setStats] = useState({ totalRuns: 0, myRuns: 0 });
  const [selectedBuildId, setSelectedBuildId] = useState('all');
  const [availableBuildIds, setAvailableBuildIds] = useState([]);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('winRate');
  const [filters, setFilters] = useState({
    color: 'all',
    type: 'all',
    rarity: 'all',
    cost: 'all'
  });
  const [filteredCards, setFilteredCards] = useState([]);

  // Types to exclude from filters
  const EXCLUDED_COLORS = ['status', 'token', 'unknown'];
  const EXCLUDED_TYPES = ['Status', 'Token', 'Unknown', 'Curse', 'Quest'];
  const EXCLUDED_RARITIES = ['Status', 'Token', 'Unknown', 'Curse', 'Quest', 'Event'];

  // Extract unique build_ids from runData
  useEffect(() => {
    if (runData && runData.length > 0) {
      const builds = new Set();
      runData.forEach(run => {
        const buildId = run.raw_data?.build_id;
        if (buildId) {
          builds.add(buildId);
        }
      });
      const sortedBuilds = Array.from(builds).sort();
      setAvailableBuildIds(sortedBuilds);
    }
  }, [runData]);

  // Get all unique colors from the database
  const getAllColors = () => {
    const colors = new Set();
    cardDatabaseArray.forEach(card => {
      if (card.color && !EXCLUDED_COLORS.includes(card.color)) {
        const colorDisplay = card.color.charAt(0).toUpperCase() + card.color.slice(1);
        colors.add(colorDisplay);
      }
    });
    return Array.from(colors).sort();
  };

  // Get all unique types from the database
  const getAllTypes = () => {
    const types = new Set();
    cardDatabaseArray.forEach(card => {
      if (card.type && !EXCLUDED_TYPES.includes(card.type)) {
        types.add(card.type);
      }
    });
    return Array.from(types).sort();
  };

  // Get all unique rarities from the database
  const getAllRarities = () => {
    const rarities = new Set();
    cardDatabaseArray.forEach(card => {
      if (card.rarity && !EXCLUDED_RARITIES.includes(card.rarity)) {
        rarities.add(card.rarity);
      }
    });
    return Array.from(rarities).sort();
  };

  // Get card image URL
  const getCardImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    return `https://spire-codex.com${imagePath}`;
  };

  // Get dynamic color style based on actual color name
  const getColorStyle = (colorName) => {
    const predefinedStyles = {
      'ironclad': { bg: '#ffebee', border: '#f44336', text: '#c62828', light: '#ffcdd2', gradient: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' },
      'silent': { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32', light: '#c8e6c9', gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' },
      'defect': { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0', light: '#bbdefb', gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' },
      'necrobinder': { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a', light: '#e1bee7', gradient: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' },
      'regent': { bg: '#fff3e0', border: '#ff9800', text: '#e65100', light: '#ffe0b2', gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' },
      'colorless': { bg: '#f5f5f5', border: '#9e9e9e', text: '#616161', light: '#e0e0e0', gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)' },
      'quest': { bg: '#e8eaf6', border: '#5c6bc0', text: '#283593', light: '#c5cae9', gradient: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)' }
    };
    
    const lowerColor = colorName?.toLowerCase();
    if (predefinedStyles[lowerColor]) {
      return predefinedStyles[lowerColor];
    }
    
    const hue = Math.abs(colorName?.charCodeAt(0) || 0) * 10 % 360;
    return {
      bg: `hsl(${hue}, 20%, 95%)`,
      border: `hsl(${hue}, 70%, 50%)`,
      text: `hsl(${hue}, 70%, 30%)`,
      light: `hsl(${hue}, 20%, 85%)`,
      gradient: `linear-gradient(135deg, hsl(${hue}, 20%, 95%) 0%, hsl(${hue}, 20%, 85%) 100%)`
    };
  };

  // Fetch statistics to get user's run count
  const fetchUserStats = async (hash) => {
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
      fetchUserStats(savedUserHash);
    } else {
      fetchUserStats();
    }
  }, []);

  // Get filtered run data based on data source and build_id
  const getFilteredRunData = () => {
    if (!runData || runData.length === 0) return [];
    
    let filtered = [...runData];
    
    // Filter by user (my_recent)
    if (dataSource === 'my_recent' && recentUserHash) {
      filtered = filtered.filter(run => run.user_id_hash === recentUserHash);
    }
    
    // Filter by build_id
    if (selectedBuildId !== 'all') {
      filtered = filtered.filter(run => run.raw_data?.build_id === selectedBuildId);
    }
    
    console.log(`[DataSource] Using ${filtered.length} runs (${dataSource}, build: ${selectedBuildId})`);
    return filtered;
  };

  useEffect(() => {
    if (runData && runData.length > 0) {
      processCardStats();
    } else {
      setLoading(false);
    }
  }, [runData, dataSource, recentUserHash, selectedBuildId]);

  useEffect(() => {
    applySearchAndFilters();
  }, [cardStats, searchQuery, filters, viewUpgraded, sortBy]);

  const processCardStats = () => {
    setLoading(true);
    const filteredRunData = getFilteredRunData();
    
    if (filteredRunData.length === 0) {
      setCardStats({});
      setProcessedRunsData([]);
      setLoading(false);
      return;
    }
    
    const runsData = processAllRunsData(filteredRunData);
    setProcessedRunsData(runsData);
    const stats = calculateCardStats(runsData);

    setCardStats(stats);
    setLoading(false);
  };

  const applySearchAndFilters = () => {
    let cards = Object.values(cardStats);
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      cards = cards.filter(card => 
        card.name?.toLowerCase().includes(lowerQuery)
      );
    }
    
    if (filters.color && filters.color !== 'all') {
      cards = cards.filter(card => {
        const dbCard = card.dbCard || getCardFromDatabase(card.id);
        const cardColor = dbCard?.color || '';
        const displayColor = cardColor.charAt(0).toUpperCase() + cardColor.slice(1);
        return displayColor === filters.color;
      });
    }
    
    if (filters.type && filters.type !== 'all') {
      cards = cards.filter(card => {
        const dbCard = card.dbCard || getCardFromDatabase(card.id);
        return dbCard?.type === filters.type;
      });
    }
    
    if (filters.rarity && filters.rarity !== 'all') {
      cards = cards.filter(card => {
        const dbCard = card.dbCard || getCardFromDatabase(card.id);
        return dbCard?.rarity === filters.rarity;
      });
    }
    
    if (filters.cost !== undefined && filters.cost !== 'all') {
      const costNum = parseInt(filters.cost);
      cards = cards.filter(card => {
        const dbCard = card.dbCard || getCardFromDatabase(card.id);
        if (costNum === 4) {
          return dbCard?.cost >= 4;
        } else {
          return dbCard?.cost === costNum;
        }
      });
    }
    
    cards.sort((a, b) => {
      if (sortBy === 'winRate') {
        const aRate = viewUpgraded && a.upgradedAppearances > 0 ? a.upgradedWinRate : a.baseWinRate;
        const bRate = viewUpgraded && b.upgradedAppearances > 0 ? b.upgradedWinRate : b.baseWinRate;
        return bRate - aRate;
      } else if (sortBy === 'popularity') {
        const aCount = viewUpgraded && a.upgradedAppearances > 0 ? a.upgradedAppearances : a.baseAppearances;
        const bCount = viewUpgraded && b.upgradedAppearances > 0 ? b.upgradedAppearances : b.baseAppearances;
        return bCount - aCount;
      }
      return a.name.localeCompare(b.name);
    });
    
    setFilteredCards(cards);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid #f3f3f3', borderTop: '3px solid #646cff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '20px' }}>Loading card analytics...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const hasAnyData = runData && runData.length > 0;
  
  if (!hasAnyData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
        <h2>No Run Data Available</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Upload run data to see card analytics and performance metrics.
        </p>
      </div>
    );
  }

  const getSelectedCardDetails = () => {
    if (!selectedCard) return null;
    const dbCard = selectedCard.dbCard || getCardFromDatabase(selectedCard.id);
    
    const displayColor = dbCard?.color ? (dbCard.color.charAt(0).toUpperCase() + dbCard.color.slice(1)) : 'Colorless';
    
    const isViewingUpgraded = viewUpgraded && selectedCard.upgradedAppearances > 0;
    const appearances = isViewingUpgraded ? selectedCard.upgradedAppearances : selectedCard.baseAppearances;
    const wins = isViewingUpgraded ? selectedCard.upgradedWins : selectedCard.baseWins;
    const losses = isViewingUpgraded ? selectedCard.upgradedLosses : selectedCard.baseLosses;
    const winRate = isViewingUpgraded ? selectedCard.upgradedWinRate : selectedCard.baseWinRate;
    const ascensionData = isViewingUpgraded ? selectedCard.upgradedAscensionArray : selectedCard.baseAscensionArray;
    
    // Get keywords from database card
    const keywords = dbCard?.keywords || [];
    
    return {
      ...selectedCard,
      ...dbCard,
      cost: dbCard?.cost,
      type: dbCard?.type,
      color: displayColor,
      rarity: dbCard?.rarity,
      description: dbCard?.description || dbCard?.text || 'No description available.',
      upgrade_description: dbCard?.upgrade_description,
      image_url: dbCard?.image_url,
      beta_image_url: dbCard?.beta_image_url,
      appearances,
      wins,
      losses,
      winRate,
      ascensionData,
      isViewingUpgraded,
      hasUpgradedData: selectedCard.upgradedAppearances > 0,
      keywords: keywords
    };
  };

  const fullSelectedCard = getSelectedCardDetails();
  const currentDescription = viewUpgraded && fullSelectedCard?.upgrade_description 
    ? fullSelectedCard.upgrade_description 
    : fullSelectedCard?.description;
  const currentImageUrl = getCardImageUrl(fullSelectedCard?.image_url);
  const currentKeywords = fullSelectedCard?.keywords || [];

  const getSortDisplayText = () => {
    if (sortBy === 'winRate') return 'Win Rate';
    if (sortBy === 'popularity') return 'Popularity';
    return 'Name';
  };

  const currentRunCount = getFilteredRunData().length;

  return (
    <div style={{ padding: '20px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* Data Source Toggle */}
      <div style={{
        marginBottom: '20px',
        padding: '12px 15px',
        background: '#f5f5f5',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Data Source:</span>
          <div style={{ display: 'flex', gap: '10px', background: '#e0e0e0', padding: '5px', borderRadius: '8px' }}>
            <button
              onClick={() => setDataSource('all')}
              style={{
                padding: '8px 16px',
                background: dataSource === 'all' ? '#646cff' : 'transparent',
                color: dataSource === 'all' ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px'
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
                cursor: recentUserHash ? 'pointer' : 'not-allowed',
                fontSize: '12px'
              }}
            >
              My Recent Upload ({stats.myRuns} runs)
            </button>
          </div>
        </div>
        {dataSource === 'my_recent' && recentUserHash && (
          <span style={{ fontSize: '11px', color: '#4caf50' }}>
            Using only your uploaded runs
          </span>
        )}
        {dataSource === 'all' && (
          <span style={{ fontSize: '11px', color: '#666' }}>
            Using all historical server data
          </span>
        )}
      </div>
      
      {/* Search Bar */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Search by card name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '12px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '8px'
          }}
        />
      </div>
      
      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        padding: '15px',
        background: '#f5f5f5',
        borderRadius: '8px',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Filters:</span>
        
        <select
          value={filters.color}
          onChange={(e) => setFilters(prev => ({ ...prev, color: e.target.value }))}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}
        >
          <option value="all">All Colors</option>
          {getAllColors().map(color => (
            <option key={color} value={color}>{color}</option>
          ))}
        </select>
        
        <select
          value={filters.type}
          onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}
        >
          <option value="all">All Types</option>
          {getAllTypes().map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        
        <select
          value={filters.rarity}
          onChange={(e) => setFilters(prev => ({ ...prev, rarity: e.target.value }))}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}
        >
          <option value="all">All Rarities</option>
          {getAllRarities().map(rarity => (
            <option key={rarity} value={rarity}>{rarity}</option>
          ))}
        </select>
        
        <select
          value={filters.cost}
          onChange={(e) => setFilters(prev => ({ ...prev, cost: e.target.value }))}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}
        >
          <option value="all">All Costs</option>
          <option value="0">0 Energy</option>
          <option value="1">1 Energy</option>
          <option value="2">2 Energy</option>
          <option value="3">3 Energy</option>
          <option value="4">4+ Energy</option>
        </select>

        {/* Build ID Filter */}
        <select
          value={selectedBuildId}
          onChange={(e) => setSelectedBuildId(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px' }}
        >
          <option value="all">All Versions</option>
          {availableBuildIds.map(build => (
            <option key={build} value={build}>{build}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', marginLeft: 'auto' }}
        >
          <option value="winRate">Sort by Win Rate</option>
          <option value="popularity">Sort by Popularity</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={viewUpgraded}
            onChange={(e) => {
              setViewUpgraded(e.target.checked);
              setSelectedCard(null);
            }}
          />
          Show Upgraded Stats
        </label>
      </div>
      
      {/* Compact Card List */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '25px',
        padding: '15px',
        background: '#fafafa',
        borderRadius: '10px',
        maxHeight: '250px',
        overflowY: 'auto',
        border: '1px solid #e0e0e0'
      }}>
        {filteredCards.map((card) => {
          const dbCard = card.dbCard || getCardFromDatabase(card.id);
          const rawColor = dbCard?.color || 'colorless';
          const styles = getColorStyle(rawColor);
          const isSelected = selectedCard?.id === card.id;
          const displayWinRate = viewUpgraded && card.upgradedAppearances > 0 
            ? card.upgradedWinRate 
            : card.baseWinRate;
          const displayCount = viewUpgraded && card.upgradedAppearances > 0 
            ? card.upgradedAppearances 
            : card.baseAppearances;
          
          return (
            <div
              key={card.id}
              onClick={() => setSelectedCard(isSelected ? null : card)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: isSelected ? styles.border : styles.bg,
                border: `1px solid ${isSelected ? styles.border : '#ddd'}`,
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 'bold', 
                color: styles.text,
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {card.name}
              </span>
              {sortBy === 'popularity' ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#2196f3',
                  background: 'white',
                  padding: '2px 6px',
                  borderRadius: '12px'
                }}>
                  {displayCount}
                </span>
              ) : (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: displayWinRate >= 70 ? '#4caf50' : (displayWinRate >= 50 ? '#ff9800' : '#f44336'),
                  background: 'white',
                  padding: '2px 6px',
                  borderRadius: '12px'
                }}>
                  {displayWinRate.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {filteredCards.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: '#f9f9f9', borderRadius: '12px', marginBottom: '20px' }}>
          No cards found matching your search criteria.
        </div>
      )}
      
      {/* Detailed Card Information Area - Full Width */}
      {fullSelectedCard ? (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: `2px solid ${getColorStyle(fullSelectedCard.color?.toLowerCase()).border}`,
          overflow: 'hidden',
          animation: 'fadeIn 0.3s ease',
          marginTop: '20px'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '20px',
            background: getColorStyle(fullSelectedCard.color?.toLowerCase()).gradient,
            borderBottom: `1px solid ${getColorStyle(fullSelectedCard.color?.toLowerCase()).border}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', color: getColorStyle(fullSelectedCard.color?.toLowerCase()).text }}>
                  {fullSelectedCard.name}
                  {fullSelectedCard.hasUpgradedData && (
                    <span style={{ 
                      fontSize: '14px', 
                      background: fullSelectedCard.isViewingUpgraded ? '#4caf50' : '#ff9800', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      marginLeft: '10px',
                      verticalAlign: 'middle'
                    }}>
                      {fullSelectedCard.isViewingUpgraded ? 'Upgraded' : 'Base'} Stats
                    </span>
                  )}
                </h2>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 10px', borderRadius: '15px', fontSize: '12px' }}>
                    {fullSelectedCard.type}
                  </span>
                  <span style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 10px', borderRadius: '15px', fontSize: '12px' }}>
                    {fullSelectedCard.rarity || 'Unknown'}
                  </span>
                  <span style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 10px', borderRadius: '15px', fontSize: '12px' }}>
                    {fullSelectedCard.color}
                  </span>
                  <span style={{ background: 'rgba(0,0,0,0.1)', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>
                    {fullSelectedCard.cost === -1 ? 'X Cost' : (fullSelectedCard.cost === -2 ? 'Unplayable' : `${fullSelectedCard.cost} Energy`)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {fullSelectedCard.hasUpgradedData && (
                  <button
                    onClick={() => setViewUpgraded(!viewUpgraded)}
                    style={{
                      background: viewUpgraded ? '#4caf50' : '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {viewUpgraded ? 'Show Base Stats' : 'Show Upgraded Stats'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedCard(null)}
                  style={{
                    background: 'rgba(0,0,0,0.1)',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
          
          {/* Card Body - Full Width Layout with 3 columns for top section */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* Top Row - Card Info, Metrics, and Keywords in 3 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '25px' }}>
              {/* Column 1 - Card Image and Description */}
              <div>
                {currentImageUrl && (
                  <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                    <img 
                      src={currentImageUrl}
                      alt={fullSelectedCard.name}
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '160px', 
                        objectFit: 'contain',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    {viewUpgraded && (
                      <div style={{ 
                        marginTop: '6px', 
                        fontSize: '11px', 
                        color: '#4caf50',
                        fontWeight: 'bold'
                      }}>
                        Upgraded Version
                      </div>
                    )}
                  </div>
                )}
                
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#333' }}>
                  Card Description
                </h4>
                <div style={{
                  padding: '12px',
                  background: '#f9f9f9',
                  borderRadius: '8px',
                  lineHeight: '1.5',
                  fontSize: '13px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {renderDescription(currentDescription, viewUpgraded)}
                </div>
              </div>
              
              {/* Column 2 - Performance Metrics */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#333' }}>
                  Performance Metrics
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px'
                }}>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4caf50' }}>
                      {fullSelectedCard.winRate.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Win Rate</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#2196f3' }}>
                      {fullSelectedCard.appearances}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Appearances</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#ffebee', borderRadius: '8px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f44336' }}>
                      {fullSelectedCard.losses}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Losses</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '15px', background: '#fff3e0', borderRadius: '8px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff9800' }}>
                      {fullSelectedCard.wins}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>Wins</div>
                  </div>
                </div>
              </div>
              
              {/* Column 3 - Keywords */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#333' }}>
                  Keywords
                </h4>
                <div style={{
                  padding: '15px',
                  background: '#f9f9f9',
                  borderRadius: '8px',
                  minHeight: '180px'
                }}>
                  {currentKeywords.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {currentKeywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#e3f2fd',
                            color: '#1565c0',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                      No keywords available
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Bottom Row - Two Columns with equal height */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', alignItems: 'stretch' }}>
            
            {/* Left Column - Stacked Visualizations (Win Rate Chart + Upgrade Impact) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Card Pick Rate Pie Chart */}
                <CardPickRatePieChart 
                runData={runData}
                cardStats={cardStats}
                selectedCardId={fullSelectedCard.id}
                />
                
                {/* Upgrade Impact Dashboard */}
                <div>
                <UpgradeImpactDashboard 
                    processedRunsData={processedRunsData}
                    cardStats={cardStats}
                    selectedCardId={fullSelectedCard.id}
                />
                </div>
            </div>
            
            {/* Right Column - Card Pairings + Pick Rate Pie Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                {/* Card Pairings (Chord Diagram) */}
                <CardPairingAnalytics 
                processedRunsData={processedRunsData}
                selectedCardId={fullSelectedCard.id}
                viewUpgraded={viewUpgraded}
                getColorStyle={getColorStyle}
                />

                {/* Win Rate Chart */}
                <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#333' }}>
                    Win Rate by Ascension Level
                </h4>
                <div style={{
                    background: '#fafafa',
                    borderRadius: '8px',
                    padding: '10px',
                    overflowX: 'auto',
                    height: 'calc(100% - 30px)'
                }}>
                    <AscensionWinRateChart 
                    data={fullSelectedCard.ascensionData}
                    cardName={fullSelectedCard.name}
                    isUpgraded={viewUpgraded && fullSelectedCard.hasUpgradedData}
                    height={300}
                    />
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '8px', textAlign: 'center' }}>
                    Hover over data points for details • Labels show win rate (10+ appearances)
                </div>
                </div>
            </div>
            </div>
          </div>
          
          {/* Comparison note */}
          {fullSelectedCard.hasUpgradedData && (
            <div style={{ padding: '15px 20px', fontSize: '12px', color: '#666', borderTop: '1px solid #eee', background: '#fafafa' }}>
              Toggle between base and upgraded stats using the button above to compare performance.
              {fullSelectedCard.upgradedWinRate > fullSelectedCard.baseWinRate ? 
                ` Upgraded version shows +${(fullSelectedCard.upgradedWinRate - fullSelectedCard.baseWinRate).toFixed(1)}% higher win rate overall.` : 
                fullSelectedCard.upgradedWinRate < fullSelectedCard.baseWinRate ?
                ` Base version shows +${(fullSelectedCard.baseWinRate - fullSelectedCard.upgradedWinRate).toFixed(1)}% higher win rate overall.` :
                ` No significant difference in win rate between versions.`
              }
            </div>
          )}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          background: '#f9f9f9',
          borderRadius: '12px',
          color: '#999'
        }}>
          <h3 style={{ margin: 0 }}>Select a Card</h3>
          <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>Click any card from the list above to see detailed analytics</p>
        </div>
      )}
      
      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
}

export default CardAnalyticsDashboard;