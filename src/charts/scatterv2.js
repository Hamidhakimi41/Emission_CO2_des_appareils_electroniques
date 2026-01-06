(function() {

    const svg = d3.select("#scatter2");
    
    if (svg.empty()) {
        console.error("Erreur : L'élément #scatter2 n'a pas été trouvé dans le HTML.");
        return;
    }

    const containerWidth = svg.node().getBoundingClientRect().width;
    const width = containerWidth; 
    const height = +svg.attr("height");

    const margin = { top: 50, right: 180, bottom: 60, left: 100 };
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Masque (Clip Path)
    svg.append("defs").append("clipPath")
        .attr("id", "chart-area-clip")
        .append("rect")
        .attr("x", -10) 
        .attr("y", -10)
        .attr("width", innerWidth + 20)
        .attr("height", innerHeight + 20);

    const xAxisGroup = g.append("g").attr("transform", `translate(0, ${innerHeight})`);
    const yAxisGroup = g.append("g");
    
    const circlesGroup = g.append("g")
        .attr("clip-path", "url(#chart-area-clip)"); 
    
    const xLabel = g.append("text")
        .attr("y", innerHeight + 40)
        .attr("x", innerWidth / 2)
        .attr("text-anchor", "middle")
        .classed("axis-label", true);

    const yLabel = g.append("text")
        .attr("y", -60)
        .attr("x", -innerHeight / 2)
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("dy", "1em")
        .style("font-weight", "bold")
        .text("GWP Total (kgCO2eq)");

    g.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .text("Impact Carbone vs Caractéristiques");

    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("background-color", "white")
            .style("border", "1px solid #ccc")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("box-shadow", "0 0 5px rgba(0,0,0,0.2)");
    }

    // --- ETAT ---
    let currentXMetric = 'weight'; 
    let currentCategory = 'All';
    let currentSubCategory = 'All'; // <--- NOUVEAU
    let availableManufacturers = []; 
    let selectedManufacturers = new Set(); 
    let data = [];

    // --- ELEMENTS DU DOM (accessibles globalement pour les updates) ---
    let subCategorySelect;

    d3.dsv(";", "data/data_cleaned/boavizta_data_cleaned.csv").then(rawData => {
        rawData.forEach(d => {
            d.gwp_total = +d.gwp_total;
            d.weight = +d.weight;
            d.screen_size = +d.screen_size;
            // S'assurer que subcategory existe, sinon mettre une string vide
            d.subcategory = d.subcategory || ""; 
        });

        data = rawData;

        d3.select("#scatter-controls").remove();
        const controls = d3.select("body").insert("div", "#scatter2")
            .attr("id", "scatter-controls")
            .style("margin-bottom", "20px")
            .style("margin-left", margin.left + "px")
            .style("font-family", "sans-serif");

        // 1. AXE X
        controls.append("span").text("Axe X : ").style("font-weight", "bold");
        const xSelect = controls.append("select").on("change", function() {
            currentXMetric = this.value;
            updateContext(); 
        });
        xSelect.append("option").attr("value", "weight").text("Poids (kg)");
        xSelect.append("option").attr("value", "screen_size").text("Taille d'écran (pouces)");

        controls.append("span").html("&nbsp;&nbsp; | &nbsp;&nbsp;"); 

        controls.append("span").text("Catégorie : ").style("font-weight", "bold");
        const categorySelect = controls.append("select").on("change", function() {
            currentCategory = this.value;
            currentSubCategory = 'All';
            updateSubCategoryDropdown(); 
            updateContext(); 
        });
        const categories = ["All", ...new Set(data.map(d => d.category))];
        categorySelect.selectAll("option")
            .data(categories)
            .enter().append("option")
            .attr("value", d => d)
            .text(d => d);

        controls.append("span").html("&nbsp;&nbsp; | &nbsp;&nbsp;"); 

        controls.append("span").text("Sous-catégorie : ").style("font-weight", "bold");
        subCategorySelect = controls.append("select").on("change", function() {
            currentSubCategory = this.value;
            updateContext(); 
        });
        updateSubCategoryDropdown();
        updateContext();

    }).catch(error => {
        console.error("Erreur CSV :", error);
    });

    function updateSubCategoryDropdown() {
        let filteredSubCats = data;
        if (currentCategory !== 'All') {
            filteredSubCats = data.filter(d => d.category === currentCategory);
        }

        const subCategories = ["All", ...new Set(filteredSubCats.map(d => d.subcategory).filter(d => d !== ""))].sort();

        const options = subCategorySelect.selectAll("option")
            .data(subCategories);

        options.exit().remove();

        options.enter().append("option")
            .merge(options)
            .attr("value", d => d)
            .text(d => d);

        subCategorySelect.property("value", "All");
        currentSubCategory = "All";
    }


    function updateContext() {
        const validData = data.filter(d => {
            const validMetric = !isNaN(d[currentXMetric]) && d[currentXMetric] > 0;
            const validCategory = currentCategory === 'All' || d.category === currentCategory;
            const validSubCategory = currentSubCategory === 'All' || d.subcategory === currentSubCategory;
            
            return validMetric && validCategory && validSubCategory;
        });

        availableManufacturers = [...new Set(validData.map(d => d.manufacturer))].sort();
        selectedManufacturers = new Set(availableManufacturers); 

        render();
    }

    function render() {
        let contextData = data.filter(d => {
            const validMetric = !isNaN(d[currentXMetric]) && d[currentXMetric] > 0;
            const validCategory = currentCategory === 'All' || d.category === currentCategory;
            const validSubCategory = currentSubCategory === 'All' || d.subcategory === currentSubCategory;

            return validMetric && validCategory && validSubCategory;
        });

        const visibleData = contextData.filter(d => selectedManufacturers.has(d.manufacturer));

        const xMax = d3.max(visibleData, d => d[currentXMetric]) || d3.max(contextData, d => d[currentXMetric]) || 10;
        const yMax = d3.max(visibleData, d => d.gwp_total) || d3.max(contextData, d => d.gwp_total) || 100;

        const xScale = d3.scaleLinear()
            .domain([0, xMax]).nice() 
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, yMax]).nice()
            .range([innerHeight, 0]);

        const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
            .domain(data.map(d => d.manufacturer)); 

        xAxisGroup.transition().duration(1000).call(d3.axisBottom(xScale));
        yAxisGroup.transition().duration(1000).call(d3.axisLeft(yScale));

        xLabel.text(currentXMetric === 'weight' ? "Poids (kg)" : "Taille d'écran (pouces)");

        const circles = circlesGroup.selectAll("circle")
            .data(contextData, d => d.name + d.manufacturer);

        circles.exit().transition().duration(500).attr("r", 0).remove();

        circles.transition().duration(1000)
            .attr("cx", d => xScale(d[currentXMetric]))
            .attr("cy", d => yScale(d.gwp_total))
            .attr("fill", d => colorScale(d.manufacturer))
            .attr("opacity", d => selectedManufacturers.has(d.manufacturer) ? 0.9 : 0)
            .attr("r", d => selectedManufacturers.has(d.manufacturer) ? 4 : 0) 
            .attr("pointer-events", d => selectedManufacturers.has(d.manufacturer) ? "all" : "none");

        circles.enter().append("circle")
            .attr("cx", d => xScale(d[currentXMetric]))
            .attr("cy", d => yScale(d.gwp_total))
            .attr("r", 0)
            .attr("fill", d => colorScale(d.manufacturer))
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .attr("opacity", 0)
            .transition().duration(1000)
            .attr("r", 4) 
            .attr("opacity", d => selectedManufacturers.has(d.manufacturer) ? 0.9 : 0);

        circlesGroup.selectAll("circle")
            .on("mouseover", function(event, d) {
                if (!selectedManufacturers.has(d.manufacturer)) return;
                
                d3.select(this)
                    .attr("stroke", "#333")
                    .attr("stroke-width", 2)
                    .attr("r", 6)
                    .attr("opacity", 1);

                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`
                    <strong>${d.manufacturer}</strong> - ${d.name}<br/>
                    <span style="font-size:11px; color:#666">${d.category} / ${d.subcategory}</span><br/>
                    GWP: ${d.gwp_total} kgCO2eq<br/> 
                    ${currentXMetric === 'weight' ? 'Poids: ' + d.weight + ' kg' : 'Écran: ' + d.screen_size + '"'}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                if (!selectedManufacturers.has(d.manufacturer)) return;
                
                d3.select(this)
                    .attr("stroke", "white")
                    .attr("stroke-width", 1)
                    .attr("r", 4)
                    .attr("opacity", 0.9);

                tooltip.transition().duration(500).style("opacity", 0);
            });

        renderLegend(colorScale);
    }

    function renderLegend(colorScale) {
        svg.selectAll(".legend").remove();

        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

        const tempText = svg.append("text").style("font-size", "12px").style("visibility", "hidden");
        let maxItemTextWidth = 0;
        availableManufacturers.forEach(d => {
            tempText.text(d);
            const w = tempText.node().getBBox().width;
            if (w > maxItemTextWidth) maxItemTextWidth = w;
        });
        tempText.remove();

        const legendListWidth = 14 + 6 + 10 + 5 + maxItemTextWidth;

        const btnGroup = legend.append("g")
            .style("cursor", "pointer")
            .on("click", () => {
                if (selectedManufacturers.size === availableManufacturers.length) {
                     selectedManufacturers.clear();
                } else {
                     selectedManufacturers = new Set(availableManufacturers);
                }
                render();
            })
            .on("mouseover", function() {
                d3.select(this).select("rect").attr("fill", "#e0e0e0").attr("stroke", "#666");
            })
            .on("mouseout", function() {
                d3.select(this).select("rect").attr("fill", "#f5f5f5").attr("stroke", "#999");
            });

        const btnText = btnGroup.append("text")
            .text("Tout Sélectionner / Désélectionner")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .style("font-size", "13px")
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("y", 12.5);

        const btnTextWidth = btnText.node().getBBox().width;
        const btnPadding = 20; 
        const btnWidth = btnTextWidth + btnPadding;
        const btnHeight = 25;

        btnText.attr("x", btnWidth / 2);

        btnGroup.insert("rect", "text")
            .attr("width", btnWidth)
            .attr("height", btnHeight)
            .attr("rx", 5)
            .attr("fill", "#f5f5f5")
            .attr("stroke", "#999")
            .attr("stroke-width", 1);

        const buttonXOffset = (legendListWidth - btnWidth) / 2;
        btnGroup.attr("transform", `translate(${buttonXOffset}, 0)`);

        const legendItems = legend.selectAll(".legend-item")
            .data(availableManufacturers)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 25 + btnHeight + 15})`) 
            .style("cursor", "pointer")
            .on("click", function(event, d) {
                if (selectedManufacturers.has(d)) {
                    selectedManufacturers.delete(d);
                } else {
                    selectedManufacturers.add(d);
                }
                render(); 
            });

        legendItems.append("rect")
            .attr("width", 14)
            .attr("height", 14)
            .attr("rx", 2)
            .attr("fill", "white")
            .attr("stroke", "#555");

        legendItems.append("path")
            .attr("d", "M 3 7 L 6 10 L 11 3")
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .style("display", d => selectedManufacturers.has(d) ? "block" : "none");

        legendItems.append("rect")
            .attr("x", 20)
            .attr("y", 2)
            .attr("width", 10)
            .attr("height", 10)
            .attr("fill", d => colorScale(d))
            .style("opacity", d => selectedManufacturers.has(d) ? 1 : 0.3);

        legendItems.append("text")
            .attr("x", 35)
            .attr("y", 10)
            .text(d => d)
            .style("font-size", "12px")
            .attr("alignment-baseline", "middle")
            .style("fill", d => selectedManufacturers.has(d) ? "black" : "#aaa");
    }

})();