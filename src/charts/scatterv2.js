(function() {

    const svg = d3.select("#scatter2");
    
    if (svg.empty()) {
        console.error("Erreur : L'élément #scatter2 n'a pas été trouvé dans le HTML.");
        return;
    }

    const containerWidth = svg.node().getBoundingClientRect().width;
    const width = containerWidth; 
    const height = +svg.attr("height");

    const margin = { top: 50, right: 150, bottom: 60, left: 100 };
    
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxisGroup = g.append("g").attr("transform", `translate(0, ${innerHeight})`);
    const yAxisGroup = g.append("g");

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
        .text("Impact Carbone (GWP) vs Caractéristiques Physiques");

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

    let currentXMetric = 'weight'; 
    let currentCategory = 'All';   
    let currentManufacturer = 'All';
    let data = [];

    d3.dsv(";", "data/data_cleaned/boavizta_data_cleaned.csv").then(rawData => {

        rawData.forEach(d => {
            d.gwp_total = +d.gwp_total;
            d.weight = +d.weight;
            d.screen_size = +d.screen_size;
        });

        data = rawData;

        d3.select("#scatter-controls").remove();

        const controls = d3.select("body").insert("div", "#scatter2")
            .attr("id", "scatter-controls")
            .style("margin-bottom", "20px")
            .style("margin-left", margin.left + "px")
            .style("font-family", "sans-serif");

    // Met à jour la liste des constructeurs en fonction des filtres actuels   
    function updateManufacturerDropdown() {
        
        const availableData = data.filter(d => {
            const validMetric = !isNaN(d[currentXMetric]) && d[currentXMetric] > 0;
            const validCategory = currentCategory === 'All' || d.category === currentCategory;
            return validMetric && validCategory;
        });

        const newManufacturers = ["All", ...new Set(availableData.map(d => d.manufacturer))].sort();

        const options = manufacturerSelect.selectAll("option")
            .data(newManufacturers);

        options.exit().remove();

        options.enter().append("option")
            .merge(options)
            .attr("value", d => d)
            .text(d => d);


        if (!newManufacturers.includes(currentManufacturer)) {
            currentManufacturer = "All";
            manufacturerSelect.property("value", "All");
        } else {
            manufacturerSelect.property("value", currentManufacturer);
        }
    }
        // Axe x
        controls.append("span").text("Axe X : ").style("font-weight", "bold");
        const xSelect = controls.append("select").on("change", function() {
            currentXMetric = this.value;
            updateManufacturerDropdown(); 
            render();
        });
        xSelect.append("option").attr("value", "weight").text("Poids (kg)");
        xSelect.append("option").attr("value", "screen_size").text("Taille d'écran (pouces)");

        controls.append("span").html("&nbsp;&nbsp; | &nbsp;&nbsp;"); 

        // Catégorie
        controls.append("span").text("Catégorie : ").style("font-weight", "bold");
        const categorySelect = controls.append("select").on("change", function() {
            currentCategory = this.value;
            updateManufacturerDropdown();
            render();
        });
        const categories = ["All", ...new Set(data.map(d => d.category))];
        categorySelect.selectAll("option")
            .data(categories)
            .enter().append("option")
            .attr("value", d => d)
            .text(d => d);

        controls.append("span").html("&nbsp;&nbsp; | &nbsp;&nbsp;"); 

        // Entreprise
        controls.append("span").text("Constructeur : ").style("font-weight", "bold");
        const manufacturerSelect = controls.append("select").on("change", function() {
            currentManufacturer = this.value;
            render();
        });
        const manufacturersList = ["All", ...new Set(data.map(d => d.manufacturer))].sort();
        
        manufacturerSelect.selectAll("option")
            .data(manufacturersList)
            .enter().append("option")
            .attr("value", d => d)
            .text(d => d);

        render();

    }).catch(error => {
        console.error("Erreur CSV :", error);
    });

    function render() {
        let filteredData = data.filter(d => {
            const validMetric = !isNaN(d[currentXMetric]) && d[currentXMetric] > 0;
            const validCategory = currentCategory === 'All' || d.category === currentCategory;
            const validManufacturer = currentManufacturer === 'All' || d.manufacturer === currentManufacturer;
            
            return validMetric && validCategory && validManufacturer;
        });

        const xScale = d3.scaleLinear()
            .domain([0, d3.max(filteredData, d => d[currentXMetric]) || 10]).nice() 
            .range([0, innerWidth]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(filteredData, d => d.gwp_total) || 100]).nice()
            .range([innerHeight, 0]);

        const colorScale = d3.scaleOrdinal(d3.schemeTableau10)
            .domain(data.map(d => d.manufacturer)); 

        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale);

        xAxisGroup.transition().duration(1000).call(xAxis);
        yAxisGroup.transition().duration(1000).call(yAxis);

        xLabel.text(currentXMetric === 'weight' ? "Poids (kg)" : "Taille d'écran (pouces)");

        const circles = g.selectAll("circle")
            .data(filteredData, d => d.name + d.manufacturer);

        circles.exit()
            .transition().duration(500)
            .attr("r", 0)
            .remove();

        circles.transition().duration(1000)
            .attr("cx", d => xScale(d[currentXMetric]))
            .attr("cy", d => yScale(d.gwp_total))
            .attr("fill", d => colorScale(d.manufacturer));

        circles.enter().append("circle")
            .attr("cx", d => xScale(d[currentXMetric]))
            .attr("cy", d => yScale(d.gwp_total))
            .attr("r", 0)
            .attr("fill", d => colorScale(d.manufacturer))
            .attr("stroke", "#333")
            .attr("stroke-width", 0.5)
            .attr("opacity", 0.8)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke-width", 2).attr("r", 8);
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`
                    <strong>${d.manufacturer}</strong> - ${d.name}<br/>
                    GWP Total: <strong>${d.gwp_total} kgCO2eq</strong><br/>
                    ${currentXMetric === 'weight' ? 'Poids: ' + d.weight + ' kg' : 'Écran: ' + d.screen_size + '"'}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 0.5).attr("r", 5);
                tooltip.transition().duration(500).style("opacity", 0);
            })
            .transition().duration(1000)
            .attr("r", 5);
        
        svg.selectAll(".legend").remove();

        const activeManufacturers = [...new Set(filteredData.map(d => d.manufacturer))].sort();
        
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

        legend.append("text").text("Constructeur").style("font-weight", "bold").attr("y", -10);

        const legendItems = legend.selectAll(".legend-item")
            .data(activeManufacturers)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`)
            .style("cursor", "pointer")
            .on("mouseover", function(event, manufacturer) {
                g.selectAll("circle")
                    .style("opacity", d => d.manufacturer === manufacturer ? 1 : 0.1);
            })
            .on("mouseout", function() {
                g.selectAll("circle").style("opacity", 0.8);
            });

        legendItems.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", d => colorScale(d));

        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .text(d => d)
            .style("font-size", "12px")
            .attr("alignment-baseline", "middle");
    }

})();