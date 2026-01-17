window.initScatter = function(containerSelector, sharedData, onHoverCallback) {

    const svgContainer = d3.select(containerSelector);
    svgContainer.selectAll("*").remove();

    // --- SETUP DIMENSIONS ---
    const containerNode = svgContainer.node();
    const containerWidth = containerNode ? containerNode.getBoundingClientRect().width : 300;
    const width = containerWidth || 300; 
    const height = 480; // Un peu plus haut pour l'aération
    svgContainer.attr("width", width).attr("height", height);

    const margin = { top: 30, right: 20, bottom: 140, left: 50 }; // Bottom large pour légende
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svgContainer.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // --- STYLES SVG (Injectés ici pour éviter le CSS externe) ---
    svgContainer.append("style").text(`
        .axis-grid line { stroke: #e2e8f0; stroke-dasharray: 4; }
        .axis-grid path { display: none; }
        .axis-text { font-family: 'Inter', sans-serif; font-size: 11px; fill: #64748b; }
        .domain { display: none; } /* Cache la ligne noire des axes */
        .legend-chip:hover rect { stroke: #94a3b8; }
    `);

    // --- DATA PREP ---
    let currentXMetric = 'weight'; 
    let activeCategory = 'All';
    let activeSubCategory = 'All';
    let selectedManufacturers = new Set(); 
    
    sharedData.forEach(d => {
        d.gwp_total = +d.gwp_total || 0;
        d.weight = +d.weight || 0;
        d.screen_size = +d.screen_size || 0;
    });

    // On récupère TOUS les fabricants uniques possibles dès le départ
    const allManufacturers = [...new Set(sharedData.map(d => d.manufacturer))].sort();
    
    // On crée l'échelle une seule fois avec un domaine fixe
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
        .domain(allManufacturers);

    // --- AXES ---
    const xAxisGroup = g.append("g").attr("transform", `translate(0, ${innerHeight})`);
    const yAxisGroup = g.append("g");

    // Grilles (Grid lines)
    const xGrid = g.append("g").attr("class", "axis-grid").attr("transform", `translate(0, ${innerHeight})`);
    const yGrid = g.append("g").attr("class", "axis-grid");

    // Labels Axes (Plus modernes)
    const xLabel = g.append("text")
        .attr("y", innerHeight + 40)
        .attr("x", innerWidth / 2)
        .attr("text-anchor", "middle")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#94a3b8")
        .style("letter-spacing", "0.5px")
        .text("POIDS (KG)");

    const yLabel = g.append("text")
        .attr("y", -35)
        .attr("x", -innerHeight / 2)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#94a3b8")
        .style("letter-spacing", "0.5px")
        .text("IMPACT CO2 (KG)");

    const circlesGroup = g.append("g"); // Pas de clip path pour laisser les cercles "respirer" sur les bords

    // Tooltip
    let tooltip = d3.select("body").select(".scatter-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "scatter-tooltip") // Le style est dans le CSS global
            .style("opacity", 0)
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("z-index", 10000);
    }

    // --- CONTROLS (Selecteur X stylisé) ---
    const parentDiv = d3.select(containerNode.parentNode);
    parentDiv.selectAll(".scatter-controls").remove();
    
    const controlsDiv = parentDiv.insert("div", ":first-child")
        .attr("class", "scatter-controls")
        .style("margin-bottom", "15px")
        .style("display", "flex")
        .style("justify-content", "flex-end") // Alignement à droite
        .style("align-items", "center");

    const xSelect = controlsDiv.append("select")
        .style("padding", "6px 10px")
        .style("border-radius", "8px")
        .style("border", "1px solid #cbd5e1")
        .style("background-color", "#f8fafc")
        .style("font-family", "Inter, sans-serif")
        .style("font-size", "12px")
        .style("color", "#334155")
        .style("cursor", "pointer")
        .on("change", function() {
            currentXMetric = this.value;
            xLabel.text(currentXMetric === 'weight' ? "POIDS (KG)" : "ÉCRAN (POUCES)");
            updateViz();
        });
    xSelect.append("option").attr("value", "weight").text("Axe X : Poids");
    xSelect.append("option").attr("value", "screen_size").text("Axe X : Écran");


    // --- UPDATE FUNCTION ---
    function updateState(category, subCategory) {
        activeCategory = category || 'All';
        activeSubCategory = subCategory || 'All';
        selectedManufacturers.clear(); 
        updateViz();
    }

    function updateViz() {
        // Filtrage
        let filteredData = sharedData.filter(d => {
            const hasMetric = d[currentXMetric] > 0;
            const matchCat = (activeCategory === 'All' || activeCategory === 'Boavizta') ? true : d.category === activeCategory;
            const matchSub = (activeSubCategory === 'All') ? true : d.subcategory === activeSubCategory;
            return hasMetric && matchCat && matchSub;
        });

        const manufacturersInView = [...new Set(filteredData.map(d => d.manufacturer))].sort();
        if (selectedManufacturers.size === 0 && manufacturersInView.length > 0) {
            manufacturersInView.forEach(m => selectedManufacturers.add(m));
        }
        
        const visibleData = filteredData.filter(d => selectedManufacturers.has(d.manufacturer));

        // Echelles
        const xMax = d3.max(visibleData, d => d[currentXMetric]) || 10;
        const yMax = d3.max(visibleData, d => d.gwp_total) || 100;

        const xScale = d3.scaleLinear().domain([0, xMax]).nice().range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

        // Mise à jour Axes & Grilles
        const xAxis = d3.axisBottom(xScale).ticks(5).tickSize(0).tickPadding(10);
        const yAxis = d3.axisLeft(yScale).ticks(5).tickSize(0).tickPadding(10);
        const xGridAxis = d3.axisBottom(xScale).ticks(5).tickSize(-innerHeight).tickFormat("");
        const yGridAxis = d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat("");

        xAxisGroup.transition().duration(750).call(xAxis).selectAll("text").attr("class", "axis-text");
        yAxisGroup.transition().duration(750).call(yAxis).selectAll("text").attr("class", "axis-text");
        
        xGrid.transition().duration(750).call(xGridAxis).select(".domain").remove();
        yGrid.transition().duration(750).call(yGridAxis).select(".domain").remove();

        // --- CERCLES ---
        const circles = circlesGroup.selectAll("circle")
            .data(visibleData, d => d.name + "_" + d.manufacturer);

        circles.exit().transition().duration(500).attr("r", 0).remove();

        const enter = circles.enter().append("circle")
            .attr("cx", d => xScale(d[currentXMetric]))
            .attr("cy", d => yScale(d.gwp_total))
            .attr("r", 0)
            .attr("fill", d => colorScale(d.manufacturer))
            .attr("stroke", "white")
            .attr("stroke-width", 1.5) // Bord blanc pour détacher les points
            .style("cursor", "pointer")
            .style("filter", "drop-shadow(0px 2px 3px rgba(0,0,0,0.1))"); // Ombre portée sur les points !

        enter.merge(circles)
            .transition().duration(750)
            .attr("cx", d => xScale(d[currentXMetric]))
            .attr("cy", d => yScale(d.gwp_total))
            .attr("r", 6) // Points un peu plus gros
            .attr("fill", d => colorScale(d.manufacturer))
            .attr("opacity", 1);

        // Interactions
        circlesGroup.selectAll("circle")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .transition().duration(200)
                    .attr("r", 10)
                    .attr("stroke", "#333");
                
                tooltip.style("opacity", 1)
                    .html(`
                        <div style="font-weight:700; margin-bottom:4px; color:${colorScale(d.manufacturer)}">${d.manufacturer}</div>
                        <div style="font-size:13px; margin-bottom:4px;">${d.name}</div>
                        <div style="font-size:11px; color:#64748b;">
                            GWP: <b>${Math.round(d.gwp_total)}</b> kgCO₂e<br/>
                            ${currentXMetric === 'weight' ? 'Poids: ' + d.weight + ' kg' : 'Écran: ' + d.screen_size + '"'}
                        </div>
                    `)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
                    
                if (onHoverCallback) onHoverCallback(d.name, true);
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .transition().duration(200)
                    .attr("r", 6)
                    .attr("stroke", "white");
                tooltip.style("opacity", 0);
                if (onHoverCallback) onHoverCallback(d.name, false);
            });

        drawModernLegend(manufacturersInView, colorScale);
    }

    // --- LEGENDE MODERNE (CHIPS) ---
    function drawModernLegend(manufacturers, colorScale) {
        g.selectAll(".legend-group").remove();
        const legendGroup = g.append("g")
            .attr("class", "legend-group")
            .attr("transform", `translate(0, ${innerHeight + 60})`);

        let xOffset = 0;
        let yOffset = 0;
        const maxRowWidth = innerWidth;
        const spacing = 10;
        const rowHeight = 30;

        manufacturers.forEach((brand) => {
            const isActive = selectedManufacturers.has(brand);
            
            // Groupe temporaire pour mesurer la largeur du texte
            const tempText = legendGroup.append("text")
                .style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-weight", "600")
                .text(brand);
            const textWidth = tempText.node().getComputedTextLength();
            tempText.remove();

            const chipWidth = textWidth + 24; // Padding

            // Retour à la ligne si ça dépasse
            if (xOffset + chipWidth > maxRowWidth) {
                xOffset = 0;
                yOffset += rowHeight + 8;
            }

            const chip = legendGroup.append("g")
                .attr("class", "legend-chip")
                .attr("transform", `translate(${xOffset}, ${yOffset})`)
                .style("cursor", "pointer")
                .on("click", () => {
                    if (selectedManufacturers.has(brand)) selectedManufacturers.delete(brand);
                    else selectedManufacturers.add(brand);
                    updateViz();
                });

            // Fond du "Chip"
            chip.append("rect")
                .attr("width", chipWidth)
                .attr("height", 24)
                .attr("rx", 12) // Bords très arrondis
                .attr("fill", isActive ? colorScale(brand) : "#f1f5f9")
                .attr("stroke", isActive ? "none" : "#cbd5e1")
                .style("transition", "all 0.2s");

            // Texte
            chip.append("text")
                .attr("x", chipWidth / 2)
                .attr("y", 16)
                .attr("text-anchor", "middle")
                .text(brand)
                .style("font-family", "Inter, sans-serif")
                .style("font-size", "10px")
                .style("font-weight", "600")
                .style("fill", isActive ? "#fff" : "#64748b")
                .style("pointer-events", "none"); // Empêche le clic sur le texte

            xOffset += chipWidth + spacing;
        });
    }

    updateViz();
    return { update: updateState };
};
