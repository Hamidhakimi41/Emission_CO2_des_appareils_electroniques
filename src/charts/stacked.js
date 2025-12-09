console.log("stacked chart loaded V10");

// On encapsule tout pour éviter les collisions globales
(function () {

    // Sélection du SVG du stacked chart
    const stackedSvg = d3.select("#stacked");
    const w = +stackedSvg.attr("width");
    const h = +stackedSvg.attr("height");

    const margin = { top: 40, right: 20, bottom: 60, left: 60 };
    const innerWidth = w - margin.left - margin.right;
    const innerHeight = h - margin.top - margin.bottom;

    const g = stackedSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Chargement des données
    d3.csv("data/stacked_data.csv").then(data => {

        // Colonnes à empiler
        const keys = ["gwp_manufacturing", "gwp_use", "gwp_transport", "gwp_eol"];

        // Convertir en nombres
        data.forEach(d => {
            keys.forEach(k => d[k] = +d[k]);
        });

        // Calcul des barres empilées
        const stack = d3.stack().keys(keys);
        const stackedData = stack(data);

        // Échelle X - noms des produits
        const x = d3.scaleBand()
            .domain(data.map(d => d.name))
            .range([0, innerWidth])
            .padding(0.3);

        // Échelle Y - valeur totale
        const y = d3.scaleLinear()
            .domain([
                0,
                d3.max(data, d => keys.reduce((sum, k) => sum + d[k], 0))
            ])
            .nice()
            .range([innerHeight, 0]);

        // Palette de couleurs
        const color = d3.scaleOrdinal()
            .domain(keys)
            .range(["#4daf4a", "#377eb8", "#ff7f00", "#984ea3"]);

        // Axe X
        g.append("g")
            .attr("transform", `translate(0, ${innerHeight})`)
            .call(d3.axisBottom(x));

        // Axe Y
        g.append("g")
            .call(d3.axisLeft(y));

        // Barres empilées
        g.selectAll("g.layer")
            .data(stackedData)
            .enter()
            .append("g")
            .attr("class", "layer")
            .attr("fill", d => color(d.key))
            .selectAll("rect")
            .data(d => d)
            .enter()
            .append("rect")
            .attr("x", d => x(d.data.name))
            .attr("y", d => y(d[1]))
            .attr("height", d => y(d[0]) - y(d[1]))
            .attr("width", x.bandwidth());
            // --------------------
    // Légende
    // --------------------
    console.log(">>> Ajout légende");

  
    const legend = stackedSvg.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(10, 10)");


    const legendItems = [
        { label: "Fabrication", color: "#4daf4a" },
        { label: "Usage", color: "#377eb8" },
        { label: "Transport", color: "#ff7f00" },
        { label: "Fin de vie", color: "#984ea3" }
    ];

    legend.selectAll("rect")
        .data(legendItems)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 25)
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendItems)
        .enter()
        .append("text")
        .attr("x", 30)
        .attr("y", (d, i) => i * 25 + 14)
        .style("font-size", "14px")
        .text(d => d.label);

    }).catch(err => {
        console.error("Erreur CSV Stacked :", err);
    });

})();
