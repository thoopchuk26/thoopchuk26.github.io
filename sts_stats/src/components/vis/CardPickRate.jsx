// components/vis/CardPickRatePieChart.jsx
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { getCardFromDatabase, normalizeCardId } from '../utils/CardDataProcessing';

const CardPickRatePieChart = ({ runData, cardStats, selectedCardId }) => {
  const [stats, setStats] = useState({
    seen: 0,
    picked: 0,
    skipped: 0,
    pickRate: 0
  });
  const [loading, setLoading] = useState(true);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  // Calculate pick statistics
  useEffect(() => {
    if (!runData || runData.length === 0 || !selectedCardId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    let seenCount = 0;
    let pickedCount = 0;
    
    const normalizedSelectedId = normalizeCardId(selectedCardId);
    
    // Process each run to find when the card was offered
    runData.forEach(run => {
      const mapPointHistory = run.raw_data?.map_point_history || [];
      
      for (const act of mapPointHistory) {
        for (const point of act) {
          const playerStats = point.player_stats || [];
          
          for (const stats of playerStats) {
            // Look at card_choices to see if the card was offered
            if (stats.card_choices) {
              stats.card_choices.forEach(choice => {
                const cardId = choice.card?.id;
                if (cardId) {
                  const normalizedCardId = normalizeCardId(cardId);
                  if (normalizedCardId === normalizedSelectedId) {
                    seenCount++;
                    if (choice.was_picked) {
                      pickedCount++;
                    }
                  }
                }
              });
            }
          }
        }
      }
    });
    
    setStats({
      seen: seenCount,
      picked: pickedCount,
      skipped: seenCount - pickedCount,
      pickRate: seenCount > 0 ? (pickedCount / seenCount) * 100 : 0
    });
    
    setLoading(false);
    
  }, [runData, selectedCardId]);

  // Draw pie chart
  useEffect(() => {
    if (loading || stats.seen === 0 || !svgRef.current) return;
    
    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();
    
    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2;
    
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);
    
    // Data for pie chart
    const data = [
      { name: 'Picked', value: stats.picked, color: '#4caf50' },
      { name: 'Skipped', value: stats.skipped, color: '#f44336' }
    ].filter(d => d.value > 0);
    
    // Create pie generator
    const pie = d3.pie()
      .value(d => d.value)
      .sort(null);
    
    const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(radius - 10);
    
    const arcs = pie(data);
    
    // Add tooltip div
    if (!tooltipRef.current) {
      const tooltipDiv = document.createElement('div');
      tooltipDiv.style.position = 'fixed';
      tooltipDiv.style.display = 'none';
      tooltipDiv.style.background = 'rgba(0,0,0,0.9)';
      tooltipDiv.style.color = 'white';
      tooltipDiv.style.padding = '8px 12px';
      tooltipDiv.style.borderRadius = '6px';
      tooltipDiv.style.fontSize = '12px';
      tooltipDiv.style.pointerEvents = 'none';
      tooltipDiv.style.zIndex = '10000';
      tooltipDiv.style.whiteSpace = 'nowrap';
      document.body.appendChild(tooltipDiv);
      tooltipRef.current = tooltipDiv;
    }
    
    // Draw slices
    svg.selectAll("path")
      .data(arcs)
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke-width", 3)
          .attr("opacity", 0.8);
        
        if (tooltipRef.current) {
          const percentage = (d.data.value / stats.seen) * 100;
          tooltipRef.current.style.display = "block";
          tooltipRef.current.style.left = `${event.pageX + 15}px`;
          tooltipRef.current.style.top = `${event.pageY - 10}px`;
          tooltipRef.current.innerHTML = `
            <strong>${d.data.name}</strong><br/>
            Count: ${d.data.value}<br/>
            Percentage: ${percentage.toFixed(1)}%
          `;
        }
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current && tooltipRef.current.style.display === 'block') {
          tooltipRef.current.style.left = `${event.pageX + 15}px`;
          tooltipRef.current.style.top = `${event.pageY - 10}px`;
        }
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke-width", 2)
          .attr("opacity", 1);
        
        if (tooltipRef.current) {
          tooltipRef.current.style.display = "none";
        }
      });
    
    // Add percentage labels
    arcs.forEach(d => {
      const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
      const x = Math.sin(midAngle) * (radius - 40);
      const y = -Math.cos(midAngle) * (radius - 40);
      const percentage = (d.data.value / stats.seen) * 100;
      
      if (percentage > 10) { // Only show label if slice is large enough
        svg.append("text")
          .attr("x", x)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .attr("dy", ".35em")
          .style("font-size", "12px")
          .style("font-weight", "bold")
          .style("fill", "white")
          .text(`${percentage.toFixed(0)}%`);
      }
    });
    
    // Add center text
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text(`${stats.pickRate.toFixed(0)}%`);
    
    svg.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.5em")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Pick Rate");
      
  }, [stats, loading]);

  // Clean up tooltip on unmount
  useEffect(() => {
    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, []);

  const dbCard = selectedCardId ? (cardStats[selectedCardId]?.dbCard || getCardFromDatabase(selectedCardId)) : null;
  const cardName = cardStats[selectedCardId]?.name || dbCard?.name || selectedCardId?.replace('CARD.', '').replace(/_/g, ' ') || 'Card';

  if (loading) {
    return (
      <div style={{
        background: '#f9f9f9',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid #f3f3f3', borderTop: '3px solid #4caf50', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '10px', fontSize: '12px' }}>Loading pick rate data...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!selectedCardId) {
    return (
      <div style={{
        background: '#f9f9f9',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Select a Card to See Pick Rate</h3>
        <p style={{ margin: '5px 0 0', fontSize: '12px' }}>Shows how often this card is taken when offered</p>
      </div>
    );
  }

  if (stats.seen === 0) {
    return (
      <div style={{
        background: '#f9f9f9',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#999'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>📊</div>
        <h3 style={{ margin: 0, fontSize: '14px' }}>No Pick Rate Data Available</h3>
        <p style={{ margin: '5px 0 0', fontSize: '12px' }}>
          "{cardName}" hasn't appeared in any card rewards yet
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
        background: 'linear-gradient(135deg, #4caf50 0%, #2196f3 100%)',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Card Pick Rate</h3>
            <p style={{ margin: '5px 0 0', fontSize: '11px', opacity: 0.9 }}>
              How often {cardName} is taken when offered
            </p>
          </div>
        </div>
      </div>

      {/* Pie Chart */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <svg ref={svgRef} style={{ width: '300px', height: '300px' }}></svg>
        </div>
        
        {/* Statistics Summary */}
        <div style={{
          display: 'flex',
          gap: '30px',
          marginTop: '20px',
          padding: '15px',
          background: '#f5f5f5',
          borderRadius: '8px',
          width: '100%',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
              {stats.pickRate.toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Pick Rate</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>
              {stats.picked}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Times Picked</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>
              {stats.skipped}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Times Skipped</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#666' }}>
              {stats.seen}
            </div>
            <div style={{ fontSize: '11px', color: '#666' }}>Total Seen</div>
          </div>
        </div>
        
        {/* Legend */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          marginTop: '15px',
          padding: '10px',
          background: '#f9f9f9',
          borderRadius: '8px',
          width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', background: '#4caf50', borderRadius: '4px' }}></div>
            <span style={{ fontSize: '11px' }}>Picked ({stats.picked})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', background: '#f44336', borderRadius: '4px' }}></div>
            <span style={{ fontSize: '11px' }}>Skipped ({stats.skipped})</span>
          </div>
        </div>
        
        {/* Insight Note */}
        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: '#e8f5e9',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#2e7d32',
          width: '100%'
        }}>
          💡 <strong>Insight:</strong> A high pick rate (50%) indicates players strongly value this card. 
          A low pick rate (20%) suggests it's situational or weak. Hover over the pie slices for exact numbers.
        </div>
      </div>
    </div>
  );
};

export default CardPickRatePieChart;