// components/vis/UpgradeImpactDashboard.jsx
import { useState } from 'react';
import { getCardFromDatabase } from '../utils/CardDataProcessing';

const UpgradeImpactDashboard = ({ processedRunsData, cardStats, selectedCardId }) => {
  const [viewMode, setViewMode] = useState('details'); // 'details' or 'recommendations'
  
  // Get the selected card's stats
  const selectedCardStat = cardStats[selectedCardId];
  
  if (!selectedCardStat) {
    return (
      <div style={{
        background: '#f9f9f9',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📈</div>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Select a Card to See Upgrade Impact</h3>
        <p style={{ margin: '5px 0 0', fontSize: '12px' }}>Upgrade analysis will appear here</p>
      </div>
    );
  }

  const dbCard = selectedCardStat.dbCard || getCardFromDatabase(selectedCardId);
  const baseAppearances = selectedCardStat.baseAppearances || 0;
  const upgradedAppearances = selectedCardStat.upgradedAppearances || 0;
  const baseWinRate = selectedCardStat.baseWinRate || 0;
  const upgradedWinRate = selectedCardStat.upgradedWinRate || 0;
  const totalAppearances = baseAppearances + upgradedAppearances;
  const upgradePercentage = totalAppearances > 0 
    ? (upgradedAppearances / totalAppearances) * 100 
    : 0;
  const deltaWinRate = upgradedWinRate - baseWinRate;
  const hasUpgradeData = upgradedAppearances > 0;

  // Get color style for card
  const getCardColorStyle = (colorName) => {
    const predefinedStyles = {
      'ironclad': { bg: '#ffebee', border: '#f44336', text: '#c62828', light: '#ffcdd2', gradient: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' },
      'silent': { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32', light: '#c8e6c9', gradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' },
      'defect': { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0', light: '#bbdefb', gradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' },
      'necrobinder': { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a', light: '#e1bee7', gradient: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)' },
      'regent': { bg: '#fff3e0', border: '#ff9800', text: '#e65100', light: '#ffe0b2', gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' },
      'colorless': { bg: '#f5f5f5', border: '#9e9e9e', text: '#616161', light: '#e0e0e0', gradient: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)' },
      'quest': { bg: '#e8eaf6', border: '#5c6bc0', text: '#283593', light: '#c5cae9', gradient: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)' }
    };
    return predefinedStyles[colorName?.toLowerCase()] || predefinedStyles.colorless;
  };

  const colorStyle = getCardColorStyle(dbCard?.color);
  const displayColor = dbCard?.color ? (dbCard.color.charAt(0).toUpperCase() + dbCard.color.slice(1)) : 'Colorless';

  // Get delta win rate color
  const getDeltaColor = (delta) => {
    if (delta > 10) return '#4caf50';
    if (delta > 0) return '#8bc34a';
    if (delta < -10) return '#f44336';
    if (delta < 0) return '#ff9800';
    return '#999';
  };

  // Get upgrade recommendation
  const getRecommendation = () => {
    if (!hasUpgradeData) {
      return {
        text: "No upgrade data available yet. Upgrade this card in your runs to see its impact!",
        type: "info",
        priority: "unknown"
      };
    }
    
    if (deltaWinRate > 10) {
      return {
        text: "HIGH PRIORITY - This card performs significantly better when upgraded! Prioritize upgrading it at campfires.",
        type: "positive",
        priority: "high"
      };
    }
    if (deltaWinRate > 5) {
      return {
        text: "Worth Upgrading - This card shows a solid improvement when upgraded. Good target for upgrades.",
        type: "positive",
        priority: "medium-high"
      };
    }
    if (deltaWinRate > 0) {
      return {
        text: "Minor Improvement - Upgrading helps, but other cards might be higher priority.",
        type: "neutral",
        priority: "medium"
      };
    }
    if (deltaWinRate < -10) {
      return {
        text: "AVOID UPGRADING - This card actually performs worse when upgraded! Save your upgrade for other cards.",
        type: "negative",
        priority: "avoid"
      };
    }
    if (deltaWinRate < 0) {
      return {
        text: "Consider Skipping - Upgrading may not be worth it. Focus on other cards first.",
        type: "negative",
        priority: "low"
      };
    }
    return {
      text: "Neutral Impact - Upgrading neither helps nor hurts significantly. Upgrade based on preference.",
      type: "neutral",
      priority: "optional"
    };
  };

  const recommendation = getRecommendation();

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: `2px solid ${colorStyle.border}`,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        background: colorStyle.gradient,
        borderBottom: `1px solid ${colorStyle.border}`
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: colorStyle.text }}>Upgrade Impact Analysis</h3>
            <p style={{ margin: '5px 0 0', fontSize: '11px', opacity: 0.8 }}>
              Comparing base vs upgraded versions of {selectedCardStat.name}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('details')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '20px',
                border: 'none',
                background: viewMode === 'details' ? colorStyle.border : 'rgba(0,0,0,0.1)',
                color: viewMode === 'details' ? 'white' : colorStyle.text,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Details
            </button>
            <button
              onClick={() => setViewMode('recommendations')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '20px',
                border: 'none',
                background: viewMode === 'recommendations' ? colorStyle.border : 'rgba(0,0,0,0.1)',
                color: viewMode === 'recommendations' ? 'white' : colorStyle.text,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Recommendation
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'details' ? (
        /* Detailed Stats View */
        <div style={{ padding: '20px' }}>
          {/* Card Info Summary */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '20px',
            padding: '15px',
            background: colorStyle.bg,
            borderRadius: '10px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#666' }}>Card</div>
              <div style={{ fontWeight: 'bold', fontSize: '18px', color: colorStyle.text }}>{selectedCardStat.name}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                {displayColor} • {dbCard?.type || 'Card'} • {dbCard?.cost === -1 ? 'X Cost' : (dbCard?.cost === -2 ? 'Unplayable' : `${dbCard?.cost} Energy`)}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Runs</div>
              <div style={{ fontWeight: 'bold', fontSize: '24px' }}>{totalAppearances}</div>
            </div>
          </div>

          {/* Comparison Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Base Version */}
            <div style={{
              padding: '20px',
              background: '#f5f5f5',
              borderRadius: '10px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Base Version</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ff9800' }}>
                {baseWinRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Win Rate
              </div>
              <div style={{ marginTop: '10px', padding: '8px', background: 'white', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Appearances: </span>
                <span style={{ fontWeight: 'bold' }}>{baseAppearances}</span>
              </div>
              <div style={{ marginTop: '5px', padding: '8px', background: 'white', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Record: </span>
                <span style={{ fontWeight: 'bold' }}>{selectedCardStat.baseWins || 0}W - {selectedCardStat.baseLosses || 0}L</span>
              </div>
            </div>

            {/* Upgraded Version */}
            <div style={{
              padding: '20px',
              background: hasUpgradeData ? '#e8f5e9' : '#f5f5f5',
              borderRadius: '10px',
              textAlign: 'center',
              position: 'relative'
            }}>
              {!hasUpgradeData && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  fontSize: '10px',
                  color: '#999'
                }}>
                  No data yet
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Upgraded Version</div>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#4caf50' }}>
                {upgradedWinRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                Win Rate
              </div>
              <div style={{ marginTop: '10px', padding: '8px', background: 'white', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Appearances: </span>
                <span style={{ fontWeight: 'bold' }}>{upgradedAppearances}</span>
              </div>
              <div style={{ marginTop: '5px', padding: '8px', background: 'white', borderRadius: '6px' }}>
                <span style={{ fontSize: '12px', color: '#666' }}>Record: </span>
                <span style={{ fontWeight: 'bold' }}>{selectedCardStat.upgradedWins || 0}W - {selectedCardStat.upgradedLosses || 0}L</span>
              </div>
            </div>
          </div>

          {/* Delta Analysis */}
          <div style={{
            padding: '20px',
            background: `linear-gradient(135deg, ${getDeltaColor(deltaWinRate)}20 0%, ${getDeltaColor(deltaWinRate)}10 100%)`,
            borderRadius: '10px',
            textAlign: 'center',
            border: `1px solid ${getDeltaColor(deltaWinRate)}40`
          }}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>Win Rate Delta</div>
            <div style={{ fontSize: '48px', fontWeight: 'bold', color: getDeltaColor(deltaWinRate) }}>
              {deltaWinRate > 0 ? '+' : ''}{deltaWinRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              Upgrade Rate: {upgradePercentage.toFixed(0)}% ({upgradedAppearances} out of {totalAppearances} runs)
            </div>
          </div>

          {/* Confidence Indicator */}
          {hasUpgradeData && upgradedAppearances < 10 && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              background: '#fff3e0',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#e65100',
              textAlign: 'center'
            }}>
              Limited upgrade data ({upgradedAppearances} upgrades) - Results may not be statistically significant
            </div>
          )}
          {hasUpgradeData && upgradedAppearances >= 10 && (
            <div style={{
              marginTop: '15px',
              padding: '10px',
              background: '#e8f5e9',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#2e7d32',
              textAlign: 'center'
            }}>
              Statistically significant data ({upgradedAppearances} upgrades)
            </div>
          )}
        </div>
      ) : (
        /* Recommendation View */
        <div style={{ padding: '20px' }}>
          {/* Priority Badge */}
          <div style={{
            textAlign: 'center',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'inline-block',
              padding: '8px 20px',
              borderRadius: '30px',
              background: recommendation.type === 'positive' ? '#4caf50' : (recommendation.type === 'negative' ? '#f44336' : '#ff9800'),
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              {recommendation.priority === 'high' && 'HIGH PRIORITY'}
              {recommendation.priority === 'medium-high' && 'WORTH UPGRADING'}
              {recommendation.priority === 'medium' && 'MINOR IMPROVEMENT'}
              {recommendation.priority === 'low' && 'CONSIDER SKIPPING'}
              {recommendation.priority === 'avoid' && 'AVOID UPGRADING'}
              {recommendation.priority === 'optional' && 'OPTIONAL'}
              {recommendation.priority === 'unknown' && 'NEEDS MORE DATA'}
            </div>
          </div>

          {/* Recommendation Text */}
          <div style={{
            padding: '20px',
            background: '#f5f5f5',
            borderRadius: '10px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#333' }}>
              {recommendation.text}
            </div>
          </div>

          {/* Impact Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px'
          }}>
            <div style={{
              padding: '15px',
              background: '#e8f5e9',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                {deltaWinRate > 0 ? '+' : ''}{deltaWinRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>Win Rate Change</div>
            </div>
            <div style={{
              padding: '15px',
              background: '#e3f2fd',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>
                {upgradePercentage.toFixed(0)}%
              </div>
              <div style={{ fontSize: '11px', color: '#666' }}>Upgrade Rate</div>
            </div>
          </div>

          {/* Tip */}
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#fff8e1',
            borderRadius: '8px',
            fontSize: '11px',
            color: '#e65100'
          }}>
            <strong>Tip:</strong> Prioritize upgrades at campfires when you have cards with high positive delta. 
            Save your upgrades for cards that provide the biggest win rate improvement.
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradeImpactDashboard;