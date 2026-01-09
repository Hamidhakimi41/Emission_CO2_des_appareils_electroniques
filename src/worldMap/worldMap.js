{
    const mapWidth = 400;
    const mapHeight = 250;
    
    const csvPath = '../../data/data_cleaned/boavizta_data_cleaned.csv';

    // On uniformise les noms
    const nameMapping = {
        "China": "CN", "Peoples Republic of China": "CN", "CN": "CN",
        "United States": "US", "United States of America": "US", "USA": "US", "US": "US",
        "Europe": "EU", "European Union": "EU", "Germany": "DE", "Deutschland": "DE",
        "Worldwide": "WW", "World": "WW", "Global": "WW",
        "Asia": "Asia", "Asia Pacific": "Asia"
    };

    const regionCoords = {
        "US": [-98.5, 39.8], "EU": [15.0, 50.0], "DE": [10.4, 51.1],
        "CN": [104.0, 35.0], "Asia": [100.0, 30.0], "JP": [138.0, 36.0],
        "TW": [121.0, 23.5], "KR": [127.5, 36.0], "VN": [108.0, 14.0]
    };

    // Labels
    const countryLabels = {
        "CN": "Chine", "US": "États-Unis", "DE": "Allemagne",
        "KR": "KR", "VN": "Vietnam", "TW": "Taïwan"
    };

    const globalAnchors = [[-100, 40], [-60, -20], [20, 10], [140, -25], [100, 50], [10, 50]];
    const tooltip = d3.select("#tooltip");

    const projection = d3.geoMercator().scale(55).translate([mapWidth / 2, mapHeight / 1.6]);
    const path = d3.geoPath().projection(projection);
    const widthScale = d3.scaleSqrt().range([0.5, 4]); 

    // Petite fonction pour animer des points blancs pour montrer qu'il y a un flux
    function animateParticles(svgContainer, pathSelection) {
        let gParticles = svgContainer.select(".particles-layer");
        if (gParticles.empty()) {
            gParticles = svgContainer.append("g").attr("class", "particles-layer");
        }
        gParticles.selectAll(".particle").remove(); // Nettoyage

        pathSelection.each(function(d) {
            const pathNode = this;
            const pathLength = pathNode.getTotalLength();
            if (!pathLength) return;

            // Création du point blanc
            const particle = gParticles.append("circle")
                .attr("class", "particle")
                .attr("r", 1.5) // Petit point
                .attr("fill", "#fff")
                .style("pointer-events", "none")
                .style("filter", "drop-shadow(0 0 2px white)");

            repeat();

            function repeat() {
                particle.transition()
                    .duration(2000 + Math.random() * 1500) 
                    .ease(d3.easeLinear)
                    .attrTween("transform", function() {
                        return function(t) {
                            const p = pathNode.getPointAtLength(t * pathLength);
                            return `translate(${p.x},${p.y})`;
                        };
                    })
                    .on("end", repeat); // Boucle infinie
            }
        });
    }


    Promise.all([
        d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
        d3.dsv(";", csvPath)
    ]).then(([mapData, rawData]) => {

        console.log("worldMap: Données chargées.");

        const countriesGeo = topojson.feature(mapData, mapData.objects.countries);

        // NETTOYAGE
        const cleanData = rawData.filter(d => {
            const keys = Object.keys(d);
            const keyAssembly = keys.find(k => k.trim().toLowerCase().includes("assembly"));
            const keyUse = keys.find(k => k.trim().toLowerCase().includes("use_location"));
            const keyManuf = keys.find(k => k.trim().toLowerCase().includes("manufacturer"));

            if (!d[keyAssembly] || !d[keyUse]) return false;

            let s = d[keyAssembly].trim();
            let t = d[keyUse].trim();
            d.srcCode = nameMapping[s] || s;
            d.trgCode = nameMapping[t] || t;
            d.manufacturer = d[keyManuf] ? d[keyManuf].trim() : "Inconnu";

            const sk = regionCoords[d.srcCode];
            const tk = regionCoords[d.trgCode] || d.trgCode === "WW";
            
            return d.manufacturer && sk && tk;
        });

        const manufacturers = Array.from(new Set(cleanData.map(d => d.manufacturer))).sort();
        const container = d3.select("#grid-container");

        // BOUCLE CRÉATION CARTES
        manufacturers.forEach(manuf => {
            const card = container.append("div").attr("class", "map-card");
            card.append("h3").attr("class", "map-title").text(manuf);
            
            const svg = card.append("svg")
                .attr("width", mapWidth)
                .attr("height", mapHeight);

            // Calques
            const gMap = svg.append("g");
            const gFlows = svg.append("g");
            // Le calque particules sera créé par la fonction d'animation
            const gDots = svg.append("g");
            const gLabels = svg.append("g");

            // Fond de carte
            gMap.selectAll("path")
                .data(countriesGeo.features)
                .join("path")
                .attr("class", "country")
                .attr("d", path);

            // Filtrage et calcul liens
            const manufData = cleanData.filter(d => d.manufacturer === manuf);
            const rollup = d3.rollup(manufData, v => v.length, d => d.srcCode, d => d.trgCode);
            const links = [];
            
            for (const [src, targets] of rollup) {
                for (const [trg, count] of targets) {
                    const sPt = regionCoords[src];
                    if (trg === "WW") {
                        globalAnchors.forEach(anchor => {
                            links.push({
                                source: src, target: "Monde (WW)",
                                sc: projection(sPt), tc: projection(anchor),
                                count: count
                            });
                        });
                    } else if (regionCoords[trg] && src !== trg) {
                        links.push({
                            source: src, target: trg,
                            sc: projection(sPt), tc: projection(regionCoords[trg]),
                            count: count
                        });
                    }
                }
            }

            const maxCount = d3.max(links, d => d.count) || 1;
            widthScale.domain([0, maxCount]);

            // Dessin Lignes
            const paths = gFlows.selectAll("path")
                .data(links)
                .join("path")
                .attr("class", "flow-line")
                .attr("d", d => {
                    const dx = d.tc[0] - d.sc[0];
                    const dy = d.tc[1] - d.sc[1];
                    const dr = Math.sqrt(dx * dx + dy * dy) * 1.3;
                    return `M${d.sc[0]},${d.sc[1]}A${dr},${dr} 0 0,1 ${d.tc[0]},${d.tc[1]}`;
                })
                .style("stroke-width", d => widthScale(d.count));

            // --- LANCEMENT DE L'ANIMATION POUR CETTE CARTE ---
            animateParticles(svg, paths);

            // Interaction Tooltip sur les lignes
            paths.on("mouseover", (e, d) => {
                    d3.select(e.currentTarget).style("stroke", "#fff").style("opacity", 1);
                    tooltip.style("opacity", 1)
                           .html(`<strong>${manuf}</strong><br>Assemblage : ${d.source}<br>Utilisation : ${d.target}<br>Nombre de modèles : ${d.count}`)
                           .style("left", (e.pageX + 10) + "px")
                           .style("top", (e.pageY - 20) + "px");
                })
                .on("mouseout", (e) => {
                    d3.select(e.currentTarget).style("stroke", "#ffd700").style("opacity", 0.5);
                    tooltip.style("opacity", 0);
                });

            // Dessin Points
            gDots.selectAll(".dot-s").data(links).join("circle")
                .attr("cx", d => d.sc[0]).attr("cy", d => d.sc[1])
                .attr("r", 2.5).attr("fill", "#00ff00").style("pointer-events", "none");

            gDots.selectAll(".dot-t").data(links.filter(d => d.target !== "Monde (WW)")).join("circle")
                .attr("cx", d => d.tc[0]).attr("cy", d => d.tc[1])
                .attr("r", 2.5).attr("fill", "#ff0000").style("pointer-events", "none");
                
            // Afficher les noms des pays
            Object.entries(countryLabels).forEach(([code, label]) => {
                 if(regionCoords[code]) {
                     const p = projection(regionCoords[code]);
                     gLabels.append("text")
                        .attr("x", p[0]).attr("y", p[1] + 12)
                        .text(label) 
                        .attr("text-anchor", "middle")
                        .style("fill", "#888")
                        .style("font-size", "8px") 
                        .style("font-family", "sans-serif")
                        .style("pointer-events", "none")
                        .style("text-shadow", "0 0 2px black");
                 }
            });

        }); // Fin boucle manufacturers

    }).catch(err => {
        console.error(err);
        d3.select("#grid-container").html(`<p style="color:red">Erreur chargement: ${err.message}</p>`);
    });
}