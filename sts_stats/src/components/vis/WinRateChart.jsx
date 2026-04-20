import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const AscensionWinRateChart = ({ data, cardName, isUpgraded, height = 220, width = null }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Get container width if width not provided
    let actualWidth = width;
    if (!actualWidth && containerRef.current) {
      actualWidth = containerRef.current.clientWidth;
    }
    if (!actualWidth) actualWidth = 500;

    const margin = { top: 35, right: 25, bottom: 40, left: 45 };
    const chartWidth = actualWidth - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr("width", actualWidth)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Prepare data - filter out ascension levels with no data
    const filteredData = data.filter(d => d.appearances > 0);
    
    if (filteredData.length === 0) {
      svg.append("text")
        .attr("x", chartWidth / 2)
        .attr("y", chartHeight / 2)
        .attr("text-anchor", "middle")
        .style("fill", "#999")
        .text("No data for this card");
      return;
    }

    // X scale (ascension level 0-10)
    const xScale = d3.scaleLinear()
      .domain([0, 10])
      .range([0, chartWidth]);

    // Y scale (win rate percentage)
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([chartHeight, 0]);

    // Line generator
    const line = d3.line()
      .x(d => xScale(d.ascension))
      .y(d => yScale(d.winRate))
      .curve(d3.curveMonotoneX);

    // Area generator
    const area = d3.area()
      .x(d => xScale(d.ascension))
      .y0(chartHeight)
      .y1(d => yScale(d.winRate))
      .curve(d3.curveMonotoneX);

    // Add gradient
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "area-gradient")
      .attr("gradientUnits", "objectBoundingBox")
      .attr("x1", "0")
      .attr("y1", "0")
      .attr("x2", "0")
      .attr("y2", "1");

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", isUpgraded ? "#4caf50" : "#ff9800")
      .attr("stop-opacity", 0.3);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", isUpgraded ? "#4caf50" : "#ff9800")
      .attr("stop-opacity", 0.05);

    // Add area
    svg.append("path")
      .datum(filteredData)
      .attr("class", "area")
      .attr("d", area)
      .style("fill", "url(#area-gradient)");

    // Add line
    svg.append("path")
      .datum(filteredData)
      .attr("class", "line")
      .attr("d", line)
      .style("fill", "none")
      .style("stroke", isUpgraded ? "#4caf50" : "#ff9800")
      .style("stroke-width", 2);

    // Create tooltip div if it doesn't exist
    if (!tooltipRef.current) {
      const tooltipDiv = document.createElement('div');
      tooltipDiv.style.position = 'fixed';
      tooltipDiv.style.display = 'none';
      tooltipDiv.style.background = 'rgba(0,0,0,0.95)';
      tooltipDiv.style.color = 'white';
      tooltipDiv.style.padding = '10px 14px';
      tooltipDiv.style.borderRadius = '8px';
      tooltipDiv.style.fontSize = '11px';
      tooltipDiv.style.pointerEvents = 'none';
      tooltipDiv.style.zIndex = '10000';
      tooltipDiv.style.whiteSpace = 'nowrap';
      tooltipDiv.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
      tooltipDiv.style.border = '1px solid rgba(255,255,255,0.2)';
      tooltipDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      document.body.appendChild(tooltipDiv);
      tooltipRef.current = tooltipDiv;
    }

    // Add dots and tooltips
    filteredData.forEach(d => {
      const cx = xScale(d.ascension);
      const cy = yScale(d.winRate);
      const winRateColor = d.winRate >= 70 ? '#4caf50' : (d.winRate >= 50 ? '#ff9800' : '#f44336');
      
      // Add visible dot
      svg.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", 5)
        .style("fill", isUpgraded ? "#4caf50" : "#ff9800")
        .style("stroke", "white")
        .style("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("mouseover", function(event) {
          d3.select(this)
            .attr("r", 7)
            .style("stroke-width", 2);
          
          const mouseX = event.clientX;
          const mouseY = event.clientY;
          
          let left = mouseX + 15;
          let top = mouseY + 15;
          
          const tooltipWidth = 260;
          const tooltipHeight = 130;
          
          if (left + tooltipWidth > window.innerWidth) {
            left = mouseX - tooltipWidth - 15;
          }
          if (top + tooltipHeight > window.innerHeight) {
            top = mouseY - tooltipHeight - 15;
          }
          if (left < 0) left = 10;
          if (top < 0) top = 10;
          
          const tooltipContent = `
            <div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #444; padding-bottom: 3px;">
              Ascension ${d.ascension}
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px;">
              <span>Win Rate:</span>
              <span style="font-weight: bold; color: ${winRateColor};">${d.winRate.toFixed(1)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px;">
              <span>Record:</span>
              <span style="font-weight: bold;">${d.wins}W - ${d.losses}L</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span>Appearances:</span>
              <span style="font-weight: bold;">${d.appearances}</span>
            </div>
          `;
          
          tooltipRef.current.innerHTML = tooltipContent;
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = `${left}px`;
          tooltipRef.current.style.top = `${top}px`;
        })
        .on("mousemove", function(event) {
          if (tooltipRef.current && tooltipRef.current.style.display === 'block') {
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            let left = mouseX + 15;
            let top = mouseY + 15;
            
            const tooltipWidth = 260;
            const tooltipHeight = 130;
            
            if (left + tooltipWidth > window.innerWidth) {
              left = mouseX - tooltipWidth - 15;
            }
            if (top + tooltipHeight > window.innerHeight) {
              top = mouseY - tooltipHeight - 15;
            }
            if (left < 0) left = 10;
            if (top < 0) top = 10;
            
            tooltipRef.current.style.left = `${left}px`;
            tooltipRef.current.style.top = `${top}px`;
          }
        })
        .on("mouseout", function() {
          d3.select(this)
            .attr("r", 5)
            .style("stroke-width", 1.5);
          
          if (tooltipRef.current) {
            tooltipRef.current.style.display = "none";
          }
        });

      // Add small text label for points with significant data
      if (d.appearances >= 10) {
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy - 8)
          .attr("text-anchor", "middle")
          .style("font-size", "8px")
          .style("fill", "#666")
          .style("font-weight", "bold")
          .text(`${d.winRate.toFixed(0)}%`);
      } else if (d.appearances >= 5) {
        svg.append("text")
          .attr("x", cx)
          .attr("y", cy - 7)
          .attr("text-anchor", "middle")
          .style("font-size", "7px")
          .style("fill", "#999")
          .text(`${d.appearances}x`);
      }
    });

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .tickValues([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
        .tickFormat(d3.format("d")))
      .style("font-size", "10px");

    // Add Y axis
    svg.append("g")
      .call(d3.axisLeft(yScale)
        .tickValues([0, 25, 50, 75, 100])
        .tickFormat(d => `${d}%`))
      .style("font-size", "10px");

    // Add axis labels
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + 28)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Ascension Level");

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -chartHeight / 2)
      .attr("y", -30)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Win Rate (%)");

    // Add title
    svg.append("text")
      .attr("x", chartWidth / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", "#333")
      .text(`${cardName} - Win Rate by Ascension${isUpgraded ? ' (Upgraded)' : ''}`);

    // Add background grid lines
    svg.append("g")
      .selectAll("line.horizontal-grid")
      .data(yScale.ticks(5))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", chartWidth)
      .attr("y1", d => yScale(d))
      .attr("y2", d => yScale(d))
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "3,3");

    svg.append("g")
      .selectAll("line.vertical-grid")
      .data(xScale.ticks(10))
      .enter()
      .append("line")
      .attr("x1", d => xScale(d))
      .attr("x2", d => xScale(d))
      .attr("y1", 0)
      .attr("y2", chartHeight)
      .attr("stroke", "#e0e0e0")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "3,3");

    return () => {
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
    };
  }, [data, cardName, isUpgraded, height, width]);

  if (!data || data.length === 0) {
    return (
      <div style={{ 
        width: '100%', 
        height: `${height}px`, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9f9f9',
        borderRadius: '8px',
        color: '#999'
      }}>
        No ascension data available
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto', minHeight: `${height}px` }}></svg>
    </div>
  );
};

export default AscensionWinRateChart;