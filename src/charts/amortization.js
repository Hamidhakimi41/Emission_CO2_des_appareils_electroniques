window.initAmortization = function(containerSelector, csvPath) {
    const container = d3.select(containerSelector);
    container.selectAll("*").remove();

    // --- 1. CONFIGURATION ---
    const bounds = container.node().getBoundingClientRect();
    const width = bounds.width || 800;
    const height = 500;
    const margin = { top: 60, right: 120, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- 2. TRAITEMENT DES DONNÉES ---
    d3.dsv(";", csvPath).then(data => {

        data.forEach(d => {
            d.gwp_manufacturing = +d.gwp_manufacturing_kg || 0;
            d.gwp_use = +d.gwp_use_kg || 0;
        });

        // Calcul des moyennes par catégorie
        const categories = d3.rollups(data, v => ({
            avgManuf: d3.mean(v, d => d.gwp_manufacturing),
            avgTotalUse: d3.mean(v, d => d.gwp_use)
        }), d => d.category)
        .filter(d => d[1].avgManuf > 10) // On retire les accessoires trop petits
        .map(([key, value]) => ({
            name: key,
            manufacturing: value.avgManuf,
            annualUse: value.avgTotalUse / 4 // Estimation usage annuel (vie ~4 ans)
        }));

        // Génération des points de la courbe
        const curveData = categories.map(cat => {
            const points = [];
            // On calcule la valeur de l'année 1 pour référence
            const valueYear1 = (cat.manufacturing / 1) + cat.annualUse;

            for (let year = 1; year <= 10; year++) {
                points.push({
                    year: year,
                    value: (cat.manufacturing / year) + cat.annualUse,
                    name: cat.name,
                    initialValue: valueYear1 // On stocke la réf ici pour le calcul du gain
                });
            }
            return { name: cat.name, points: points };
        });

        // --- 3. ÉCHELLES ---
        const xScale = d3.scaleLinear().domain([1, 10]).range([0, innerWidth]);
        const yMax = d3.max(curveData, c => c.points[0].value);
        const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);
        const color = d3.scaleOrdinal(d3.schemeTableau10).domain(categories.map(d => d.name));

        // --- 4. DESSIN (Axes & Grilles) ---
        const makeXGrid = () => d3.axisBottom(xScale).ticks(10);
        const makeYGrid = () => d3.axisLeft(yScale).ticks(5);

        // Grilles
        g.append("g").attr("class", "grid").attr("transform", `translate(0,${innerHeight})`)
            .call(makeXGrid().tickSize(-innerHeight).tickFormat("")).style("stroke-opacity", 0.1);
        g.append("g").attr("class", "grid")
            .call(makeYGrid().tickSize(-innerWidth).tickFormat("")).style("stroke-opacity", 0.1);

        // Axes
        g.append("g").attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).tickFormat(d => d + " ans"))
            .style("color", "#64748b").style("font-family", "sans-serif");
        g.append("g")
            .call(d3.axisLeft(yScale))
            .style("color", "#64748b").style("font-family", "sans-serif");

        // Labels Axes
        svg.append("text").attr("x", width / 2).attr("y", height - 15).attr("text-anchor", "middle")
            .style("fill", "#64748b").style("font-size", "12px").text("Durée de conservation (années)");
        svg.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 20).attr("text-anchor", "middle")
            .style("fill", "#64748b").style("font-size", "12px").text("Impact Carbone Annualisé (kgCO₂e / an)");

        // --- 5. LIGNES & POINTS ---
        const line = d3.line()
            .x(d => xScale(d.year))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        const lines = g.selectAll(".category-line")
            .data(curveData)
            .join("g")
            .attr("class", "category-line");

        lines.append("path")
            .attr("d", d => line(d.points))
            .attr("fill", "none")
            .attr("stroke", d => color(d.name))
            .attr("stroke-width", 3);

        // Label en fin de ligne
        lines.append("text")
            .datum(d => ({ name: d.name, lastPoint: d.points[d.points.length - 1] }))
            .attr("transform", d => `translate(${xScale(d.lastPoint.year) + 5}, ${yScale(d.lastPoint.value)})`)
            .attr("dy", "0.35em")
            .text(d => d.name)
            .style("font-size", "11px").style("font-weight", "bold").style("fill", d => color(d.name)).style("font-family", "sans-serif");

        // --- 6. INTERACTIVITÉ CORRIGÉE ---
        // Création/Sélection du tooltip avec styles forcés (au cas où CSS manquant)
        let tooltip = d3.select("body").select(".amortization-tooltip");
        if (tooltip.empty()) {
            tooltip = d3.select("body").append("div")
                .attr("class", "amortization-tooltip")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("background", "white")      // IMPORTANT: Fond blanc
                .style("padding", "10px")          // IMPORTANT: Espace
                .style("border", "1px solid #ccc") // IMPORTANT: Bordure
                .style("border-radius", "8px")
                .style("box-shadow", "0 4px 6px rgba(0,0,0,0.1)") // Ombre pour lisibilité
                .style("pointer-events", "none")
                .style("z-index", 10000)
                .style("font-family", "sans-serif")
                .style("font-size", "12px");
        }

        lines.selectAll(".point-group")
            .data(d => d.points)
            .join("circle")
            .attr("cx", d => xScale(d.year))
            .attr("cy", d => yScale(d.value))
            .attr("r", 15) // Zone invisible large pour capter la souris
            .attr("fill", "transparent")
            .style("cursor", "crosshair")
            .on("mouseover", function(event, d) {
                // Point blanc visible
                d3.select(this.parentNode).append("circle")
                    .attr("class", "hover-dot")
                    .attr("cx", xScale(d.year))
                    .attr("cy", yScale(d.value))
                    .attr("r", 6)
                    .attr("fill", "white")
                    .attr("stroke", color(d.name))
                    .attr("stroke-width", 3)
                    .attr("pointer-events", "none");

                // Calcul du gain (CORRECTION LOGIQUE ICI)
                // On compare la valeur actuelle (d.value) à la valeur initiale stockée (d.initialValue)
                const savings = d.year > 1 
                    ? Math.round((1 - (d.value / d.initialValue)) * 100) 
                    : 0;

                const savingsHTML = d.year > 1 
                    ? `<div style="margin-top:4px; font-weight:bold; color:#16a34a">🌱 -${savings}% d'impact vs An 1</div>` 
                    : `<div style="margin-top:4px; color:#666; font-style:italic">Année de référence</div>`;

                tooltip.style("opacity", 1)
                    .html(`
                        <div style="font-weight:bold; color:${color(d.name)}; margin-bottom:2px;">${d.name}</div>
                        <div style="font-size:11px; color:#666;">Conservation : ${d.year} an(s)</div>
                        <div style="font-size:14px; font-weight:bold; margin-top:2px;">${Math.round(d.value)} kgCO₂e <span style="font-size:10px; font-weight:normal">/an</span></div>
                        ${savingsHTML}
                    `)
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.selectAll(".hover-dot").remove();
                tooltip.style("opacity", 0);
            });

        // Titre
        svg.append("text").attr("x", width / 2).attr("y", 30).attr("text-anchor", "middle")
            .style("font-size", "18px").style("font-weight", "bold").style("font-family", "sans-serif")
            .text("Impact annuel selon la durée de vie");
    });
};

// on lance la fonction avec le chemin vers les données
initAmortization("#amortization-chart", "data/data_cleaned/boavizta_data_cleaned.csv");