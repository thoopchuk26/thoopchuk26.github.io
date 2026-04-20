import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { calculatePairingStats, getCardFromDatabase } from '../utils/CardDataProcessing';

const CardPairingAnalytics = ({ processedRunsData, selectedCardId, viewUpgraded, getColorStyle }) => {
  const [pairingMetric, setPairingMetric] = useState('winRate');
  const [hoveredArc, setHoveredArc] = useState(null);
  const [viewMode, setViewMode] = useState('chord');
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  // Get card name
  const getCardName = (cardId) => {
    const cleanCardId = cardId.replace('_UPGRADED', '');
    const dbCard = getCardFromDatabase(cleanCardId);
    return dbCard?.name || cleanCardId.replace('CARD.', '').replace(/_/g, ' ');
  };

  // Calculate pairing stats using shared utility
  const pairingStats = calculatePairingStats(processedRunsData, selectedCardId, viewUpgraded);
  
  // Prepare data for chord diagram
  const prepareChordData = () => {
    const sortedPairings = [...pairingStats.pairings];
    if (pairingMetric === 'winRate') {
      sortedPairings.sort((a, b) => b.winRate - a.winRate);
    } else {
      sortedPairings.sort((a, b) => b.appearances - a.appearances);
    }
    
    const topPairings = sortedPairings.slice(0, 8);
    
    const cards = [
      { id: selectedCardId, name: getCardName(selectedCardId), winRate: pairingStats.selectedCardStats.winRate, appearances: pairingStats.selectedCardStats.appearances, isCenter: true, dbCard: getCardFromDatabase(selectedCardId) },
      ...topPairings.map(p => ({ 
        id: p.id, 
        name: p.name, 
        winRate: p.winRate, 
        appearances: p.appearances,
        synergyScore: p.synergyPercentage,
        isCenter: false,
        dbCard: p.dbCard
      }))
    ];
    
    const n = cards.length;
    const matrix = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const card1 = cards[i];
        const card2 = cards[j];
        
        if (card1.isCenter) {
          const pairing = topPairings.find(p => p.id === card2.id);
          if (pairing) {
            const strength = Math.min(pairing.appearances / 20, 1);
            matrix[i][j] = strength * 100;
          }
        } else if (card2.isCenter) {
          const pairing = topPairings.find(p => p.id === card1.id);
          if (pairing) {
            const strength = Math.min(pairing.appearances / 20, 1);
            matrix[i][j] = strength * 100;
          }
        } else {
          matrix[i][j] = 5;
        }
      }
    }
    
    return { matrix, cards };
  };

  // Get card color for chord arcs
  const getCardChordColor = (card) => {
    if (card.isCenter) {
      return '#ff9800';
    }
    
    const winRate = card.winRate;
    if (winRate >= 70) return '#4caf50';
    if (winRate >= 50) return '#ff9800';
    return '#f44336';
  };

  // Get display color name
  const getCardColorName = (dbCard) => {
    const colorMap = {
      'ironclad': 'Ironclad',
      'silent': 'Silent',
      'defect': 'Defect',
      'necrobinder': 'Necrobinder',
      'regent': 'Regent',
      'colorless': 'Colorless',
      'quest': 'Quest'
    };
    return colorMap[dbCard?.color?.toLowerCase()] || dbCard?.color?.charAt(0).toUpperCase() + dbCard?.color?.slice(1) || 'Colorless';
  };

  // Get card color style
  const getCardColorStyle = (dbCard) => {
    const colorName = dbCard?.color?.toLowerCase() || 'colorless';
    return getColorStyle(colorName);
  };

  // Get win rate color
  const getWinRateColor = (winRate) => {
    if (winRate >= 70) return '#4caf50';
    if (winRate >= 50) return '#ff9800';
    return '#f44336';
  };

  // Create tooltip element once (same as WinRateChart)
  useEffect(() => {
    if (!tooltipRef.current) {
      const tooltipDiv = document.createElement('div');
      tooltipDiv.style.position = 'fixed';
      tooltipDiv.style.display = 'none';
      tooltipDiv.style.background = 'rgba(0,0,0,0.95)';
      tooltipDiv.style.color = 'white';
      tooltipDiv.style.padding = '12px 16px';
      tooltipDiv.style.borderRadius = '8px';
      tooltipDiv.style.fontSize = '12px';
      tooltipDiv.style.pointerEvents = 'none';
      tooltipDiv.style.zIndex = '10000';
      tooltipDiv.style.whiteSpace = 'nowrap';
      tooltipDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
      tooltipDiv.style.border = '1px solid rgba(255,255,255,0.2)';
      tooltipDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      document.body.appendChild(tooltipDiv);
      tooltipRef.current = tooltipDiv;
    }
    
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  // D3 Chord Diagram
  useEffect(() => {
    if (viewMode !== 'chord' || !selectedCardId || pairingStats.selectedCardStats.appearances === 0) return;
    
    const { matrix, cards } = prepareChordData();
    if (cards.length < 2) return;
    
    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();
    
    // Get container width
    const container = containerRef.current;
    const containerWidth = container?.clientWidth || 500;
    const size = Math.min(containerWidth - 40, 480);
    const outerRadius = size * 0.4;
    const innerRadius = outerRadius - 25;
    
    const svg = d3.select(svgRef.current)
      .attr("width", size + 40)
      .attr("height", size + 40)
      .append("g")
      .attr("transform", `translate(${(size + 40) / 2},${(size + 40) / 2})`);
    
    // Create chord layout
    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);
    
    const chords = chord(matrix);
    
    // Create color scale for arcs
    const colorScale = d3.scaleOrdinal()
      .domain(cards.map((_, i) => i))
      .range(cards.map(card => getCardChordColor(card)));
    
    // Draw chords (ribbons)
    const ribbonGenerator = d3.ribbon()
      .radius(innerRadius);
    
    const ribbons = svg.append("g")
      .selectAll("path")
      .data(chords)
      .enter()
      .append("path")
      .attr("d", ribbonGenerator)
      .attr("fill", d => colorScale(d.source.index))
      .attr("stroke", "white")
      .attr("stroke-width", 1)
      .attr("opacity", 0.7)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("opacity", 1)
          .attr("stroke-width", 2);
        
        const sourceCard = cards[d.source.index];
        const targetCard = cards[d.target.index];
        
        if (tooltipRef.current) {
          let pairingData = null;
          if (sourceCard.isCenter) {
            pairingData = pairingStats.pairings.find(p => p.id === targetCard.id);
          } else if (targetCard.isCenter) {
            pairingData = pairingStats.pairings.find(p => p.id === sourceCard.id);
          }
          
          let tooltipHtml = '';
          if (pairingData) {
            tooltipHtml = `
              <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;">
                ${sourceCard.name} ↔ ${targetCard.name}
              </div>
              <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 5px;">
                <span>Pairing Win Rate:</span>
                <span style="font-weight: bold;">${pairingData.winRate.toFixed(1)}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 5px;">
                <span>Synergy:</span>
                <span style="font-weight: bold; color: ${pairingData.synergyPercentage >= 0 ? '#4caf50' : '#f44336'};">${pairingData.synergyPercentage > 0 ? '+' : ''}${Math.round(pairingData.synergyPercentage)}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 15px;">
                <span>Appearances:</span>
                <span style="font-weight: bold;">${pairingData.appearances} runs</span>
              </div>
              <div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #444; font-size: 10px; color: #aaa;">
                Record: ${pairingData.wins}W - ${pairingData.losses}L
              </div>
            `;
          } else {
            tooltipHtml = `
              <strong>${sourceCard.name} ↔ ${targetCard.name}</strong><br/>
              No direct pairing data available
            `;
          }
          
          tooltipRef.current.innerHTML = tooltipHtml;
          tooltipRef.current.style.display = 'block';
          
          // Use same positioning logic as WinRateChart
          const mouseX = event.clientX;
          const mouseY = event.clientY;
          let left = mouseX + 20;
          let top = mouseY + 20;
          
          const tooltipWidth = 280;
          const tooltipHeight = 150;
          
          if (left + tooltipWidth > window.innerWidth) {
            left = mouseX - tooltipWidth - 20;
          }
          if (top + tooltipHeight > window.innerHeight) {
            top = mouseY - tooltipHeight - 20;
          }
          if (left < 0) left = 10;
          if (top < 0) top = 10;
          
          tooltipRef.current.style.left = `${left}px`;
          tooltipRef.current.style.top = `${top}px`;
        }
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current && tooltipRef.current.style.display === 'block') {
          const mouseX = event.clientX;
          const mouseY = event.clientY;
          let left = mouseX + 20;
          let top = mouseY + 20;
          
          const tooltipWidth = 280;
          const tooltipHeight = 150;
          
          if (left + tooltipWidth > window.innerWidth) {
            left = mouseX - tooltipWidth - 20;
          }
          if (top + tooltipHeight > window.innerHeight) {
            top = mouseY - tooltipHeight - 20;
          }
          if (left < 0) left = 10;
          if (top < 0) top = 10;
          
          tooltipRef.current.style.left = `${left}px`;
          tooltipRef.current.style.top = `${top}px`;
        }
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("opacity", 0.7)
          .attr("stroke-width", 1);
        
        if (tooltipRef.current) {
          tooltipRef.current.style.display = "none";
        }
      });
    
    // Draw arcs (outer groups)
    const arcGenerator = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);
    
    const groups = svg.append("g")
      .selectAll("g")
      .data(chords.groups)
      .enter()
      .append("g");
    
    groups.append("path")
      .attr("d", arcGenerator)
      .attr("fill", d => colorScale(d.index))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .on("mouseover", function(event, d) {
        d3.select(this).attr("stroke-width", 3);
        
        const card = cards[d.index];
        
        if (tooltipRef.current) {
          let additionalInfo = '';
          if (!card.isCenter) {
            const pairing = pairingStats.pairings.find(p => p.id === card.id);
            if (pairing) {
              additionalInfo = `
                <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 5px;">
                  <span>Synergy:</span>
                  <span style="font-weight: bold; color: ${pairing.synergyPercentage >= 0 ? '#4caf50' : '#f44336'};">${pairing.synergyPercentage > 0 ? '+' : ''}${Math.round(pairing.synergyPercentage)}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 15px;">
                  <span>Pairing Record:</span>
                  <span style="font-weight: bold;">${pairing.wins}W - ${pairing.losses}L</span>
                </div>
              `;
            }
          }
          
          tooltipRef.current.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px;">
              ${card.name}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 5px;">
              <span>Win Rate:</span>
              <span style="font-weight: bold; color: ${getWinRateColor(card.winRate)};">${card.winRate.toFixed(1)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 15px;">
              <span>Appearances:</span>
              <span style="font-weight: bold;">${card.appearances} runs</span>
            </div>
            ${additionalInfo}
          `;
          tooltipRef.current.style.display = 'block';
          
          // Use same positioning logic as WinRateChart
          const mouseX = event.clientX;
          const mouseY = event.clientY;
          let left = mouseX + 20;
          let top = mouseY + 20;
          
          const tooltipWidth = 280;
          const tooltipHeight = 150;
          
          if (left + tooltipWidth > window.innerWidth) {
            left = mouseX - tooltipWidth - 20;
          }
          if (top + tooltipHeight > window.innerHeight) {
            top = mouseY - tooltipHeight - 20;
          }
          if (left < 0) left = 10;
          if (top < 0) top = 10;
          
          tooltipRef.current.style.left = `${left}px`;
          tooltipRef.current.style.top = `${top}px`;
        }
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current && tooltipRef.current.style.display === 'block') {
          const mouseX = event.clientX;
          const mouseY = event.clientY;
          let left = mouseX + 20;
          let top = mouseY + 20;
          
          const tooltipWidth = 280;
          const tooltipHeight = 150;
          
          if (left + tooltipWidth > window.innerWidth) {
            left = mouseX - tooltipWidth - 20;
          }
          if (top + tooltipHeight > window.innerHeight) {
            top = mouseY - tooltipHeight - 20;
          }
          if (left < 0) left = 10;
          if (top < 0) top = 10;
          
          tooltipRef.current.style.left = `${left}px`;
          tooltipRef.current.style.top = `${top}px`;
        }
      })
      .on("mouseout", function() {
        d3.select(this).attr("stroke-width", 2);
        if (tooltipRef.current) {
          tooltipRef.current.style.display = "none";
        }
      });
    
    // Add labels outside the arcs
    groups.append("text")
      .each(function(d) { 
        const angle = (d.startAngle + d.endAngle) / 2;
        const radius = outerRadius + 12;
        const x = Math.sin(angle) * radius;
        const y = -Math.cos(angle) * radius;
        
        d3.select(this)
          .attr("x", x)
          .attr("y", y)
          .attr("dy", ".35em")
          .attr("text-anchor", x > 0 ? "start" : "end")
          .style("font-size", "9px")
          .style("font-weight", d.index === 0 ? "bold" : "normal")
          .style("fill", d.index === 0 ? "#ff9800" : "#333")
          .text(cards[d.index].name.length > 12 ? cards[d.index].name.substring(0, 10) + '..' : cards[d.index].name);
      });
    
    // Add win rate badges outside the labels
    groups.append("text")
      .each(function(d) {
        const angle = (d.startAngle + d.endAngle) / 2;
        const radius = outerRadius + 28;
        const x = Math.sin(angle) * radius;
        const y = -Math.cos(angle) * radius;
        const card = cards[d.index];
        const winRateColor = getWinRateColor(card.winRate);
        
        d3.select(this)
          .attr("x", x)
          .attr("y", y)
          .attr("dy", ".35em")
          .attr("text-anchor", x > 0 ? "start" : "end")
          .style("font-size", "8px")
          .style("fill", winRateColor)
          .style("font-weight", "bold")
          .text(`${Math.round(card.winRate)}%`);
      });
    
  }, [selectedCardId, pairingStats, pairingMetric, viewMode]);

  const chordData = prepareChordData();
  const hasSelectedCardData = pairingStats.selectedCardStats.appearances > 0;

  if (!selectedCardId) {
    return (
      <div style={{
        background: '#f9f9f9',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔗</div>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Select a Card to See Pairings</h3>
        <p style={{ margin: '5px 0 0', fontSize: '12px' }}>Card synergies will appear here</p>
      </div>
    );
  }

  if (!hasSelectedCardData) {
    return (
      <div style={{
        background: '#f9f9f9',
        borderRadius: '12px',
        padding: '30px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📭</div>
        <h3 style={{ margin: 0, fontSize: '14px' }}>No Data Available</h3>
        <p style={{ margin: '10px 0 0', fontSize: '12px' }}>
          "{getCardName(selectedCardId)}" hasn't appeared in any recorded runs yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e0e0e0',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '15px 20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Card Synergy Chord Diagram</h3>
            <p style={{ margin: '5px 0 0', fontSize: '11px', opacity: 0.9 }}>
              Visualizing relationships centered on {getCardName(selectedCardId)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPairingMetric('winRate')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '20px',
                border: 'none',
                background: pairingMetric === 'winRate' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              By Win Rate
            </button>
            <button
              onClick={() => setPairingMetric('frequency')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '20px',
                border: 'none',
                background: pairingMetric === 'frequency' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              By Popularity
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'chord' ? 'list' : 'chord')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '20px',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              {viewMode === 'chord' ? 'Show List' : 'Show Chord'}
            </button>
          </div>
        </div>
      </div>

      {/* Selected Card Summary */}
      <div style={{
        padding: '15px 20px',
        background: '#f5f5f5',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#666' }}>Center Card</span>
            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#333' }}>
              {getCardName(selectedCardId)}
              {pairingStats.selectedCardStats.upgradedCount > 0 && (
                <span style={{ 
                  fontSize: '12px', 
                  background: '#4caf50', 
                  color: 'white', 
                  padding: '2px 6px', 
                  borderRadius: '12px',
                  marginLeft: '8px',
                  verticalAlign: 'middle'
                }}>
                  +{pairingStats.selectedCardStats.upgradedCount}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2196f3' }}>
                {pairingStats.selectedCardStats.appearances}
              </div>
              <div style={{ fontSize: '10px', color: '#666' }}>Appearances</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: getWinRateColor(pairingStats.selectedCardStats.winRate) }}>
                {pairingStats.selectedCardStats.winRate.toFixed(1)}%
              </div>
              <div style={{ fontSize: '10px', color: '#666' }}>Win Rate</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff9800' }}>
                {pairingStats.selectedCardStats.wins}/{pairingStats.selectedCardStats.losses}
              </div>
              <div style={{ fontSize: '10px', color: '#666' }}>W/L</div>
            </div>
          </div>
        </div>
        {pairingStats.selectedCardStats.appearances < 10 && (
          <div style={{ fontSize: '10px', color: '#ff9800', marginTop: '8px' }}>
            Limited data ({pairingStats.selectedCardStats.appearances} appearances) - results may not be statistically significant
          </div>
        )}
      </div>

      {/* Visualization Area */}
      <div style={{ padding: '15px 20px' }}>
        {viewMode === 'chord' ? (
          <>
            <div 
              ref={containerRef}
              style={{ 
                position: 'relative',
                background: '#fafafa',
                borderRadius: '8px',
                padding: '20px',
                minHeight: '520px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'visible'
              }}
            >
              <svg 
                ref={svgRef} 
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  maxWidth: '520px',
                  display: 'block',
                  margin: '0 auto'
                }}
              ></svg>
            </div>
            
            {/* Chord Diagram Legend */}
            <div style={{
              marginTop: '15px',
              padding: '10px',
              background: '#f9f9f9',
              borderRadius: '8px',
              fontSize: '10px',
              color: '#666',
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ff9800' }}></div>
                <span>Center Card</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#4caf50' }}></div>
                <span>High Win Rate (70%+)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ff9800' }}></div>
                <span>Medium Win Rate (50-70%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f44336' }}></div>
                <span>Low Win Rate (&lt;50%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '20px', height: '2px', background: '#666' }}></div>
                <span>Chord width = Pairing frequency</span>
              </div>
            </div>
            
            <div style={{ fontSize: '11px', color: '#999', marginTop: '10px', textAlign: 'center' }}>
              Hover over arcs or chords for details • Arc size = Card presence • Chord thickness = Pairing strength
            </div>
          </>
        ) : (
          // List view
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '12px', color: '#666' }}>
              Top {pairingMetric === 'winRate' ? 'Highest Win Rate' : 'Most Common'} Pairings
              {chordData.cards.length - 1 < 5 && chordData.cards.length - 1 > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '10px', color: '#ff9800' }}>
                  (Only {chordData.cards.length - 1} pairings available)
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chordData.cards.slice(1, 6).map((card, index) => {
                const cardColorStyle = getCardColorStyle(card.dbCard);
                const cardColorName = getCardColorName(card.dbCard);
                const winRateColor = getWinRateColor(card.winRate);
                const pairing = pairingStats.pairings.find(p => p.id === card.id);
                const synergyScore = pairing?.synergyPercentage || 0;
                
                const confidenceLevel = card.appearances >= 10 ? 'high' : (card.appearances >= 5 ? 'medium' : 'low');
                const confidenceColor = confidenceLevel === 'high' ? '#4caf50' : (confidenceLevel === 'medium' ? '#ff9800' : '#f44336');
                
                return (
                  <div
                    key={card.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: hoveredArc === card.id ? cardColorStyle.bg : 'white',
                      borderRadius: '10px',
                      transition: 'all 0.2s ease',
                      border: `1px solid ${hoveredArc === card.id ? cardColorStyle.border : '#e0e0e0'}`,
                      cursor: 'pointer'
                    }}
                    onMouseEnter={() => setHoveredArc(card.id)}
                    onMouseLeave={() => setHoveredArc(null)}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      background: `linear-gradient(135deg, ${cardColorStyle.border}80, ${cardColorStyle.border}20)`,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: cardColorStyle.text
                    }}>
                      #{index + 1}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>
                        {card.name}
                        {card.upgradedCount > 0 && (
                          <span style={{ 
                            fontSize: '10px', 
                            background: '#ff9800', 
                            color: 'white', 
                            padding: '2px 4px', 
                            borderRadius: '8px',
                            marginLeft: '6px'
                          }}>
                            +{card.upgradedCount}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                        {cardColorName} • {card.dbCard?.type || 'Card'}
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: winRateColor }}>
                        {card.winRate.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: '9px', color: '#999' }}>
                        {card.appearances} runs
                      </div>
                    </div>
                    
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: confidenceColor,
                      margin: '0 4px'
                    }} title={`${confidenceLevel} confidence (${card.appearances} appearances)`} />
                    
                    <div style={{
                      width: '60px',
                      textAlign: 'center',
                      padding: '4px 8px',
                      borderRadius: '20px',
                      background: synergyScore > 20 ? '#e8f5e9' : (synergyScore < -20 ? '#ffebee' : '#f5f5f5'),
                      color: synergyScore > 20 ? '#4caf50' : (synergyScore < -20 ? '#f44336' : '#999'),
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}>
                      {synergyScore > 0 ? '+' : ''}{Math.round(synergyScore)}%
                    </div>
                    
                    <div style={{ fontSize: '11px', color: '#666', minWidth: '50px', textAlign: 'right' }}>
                      {pairing?.wins || 0}W / {pairing?.losses || 0}L
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardPairingAnalytics;