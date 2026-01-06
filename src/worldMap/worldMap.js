{

    const mapWidth = 960;
    const mapHeight = 600;
    
    const csvPath = 'data/data_cleaned/boavizta_data_cleaned.csv';

    // --- CONFIGURATION ---
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

    const globalAnchors = [[-100, 40], [-60, -20], [20, 10], [140, -25], [100, 50], [10, 50]];

    // --- SETUP SVG ---
    // On vide d'abord le conteneur pour éviter les doublons lors des rechargements
    d3.select('#map-container').html("");

    const svg = d3.select('#map-container').append('svg')
        .attr('width', mapWidth)
        .attr('height', mapHeight)
        .style("background", "#050505");

    const g = svg.append('g');

    const zoom = d3.zoom()
        .scaleExtent([1, 8]) 
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom); 

    // Calques
    const gMap = g.append('g');
    const gFlows = g.append('g');
    const gParticles = g.append('g');
    const gDots = g.append('g');
    const tooltip = d3.select("#tooltip");

    // Projection
    const projection = d3.geoMercator().scale(130).translate([mapWidth / 2, mapHeight / 1.5]);
    const path = d3.geoPath().projection(projection);
    const widthScale = d3.scaleSqrt().range([0.5, 3]); 

    // --- CHARGEMENT ---
    console.log("--> WorldMap: Démarrage du chargement...");

    Promise.all([
        d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
        d3.dsv(";", csvPath)
    ]).then(([mapData, rawData]) => {

        console.log("--> WorldMap: Données chargées. Lignes CSV :", rawData.length);

        // 1. CARTE
        const countries = topojson.feature(mapData, mapData.objects.countries);
        gMap.selectAll('path').data(countries.features).join('path')
            .attr('class', 'country')
            .attr('d', path)
            .style("fill", "#1a1a1a")
            .style("stroke", "#333")
            .style("stroke-width", "0.5px");

        // 2. NETTOYAGE
        const cleanData = rawData.filter(d => {
            const keys = Object.keys(d);
            const keyAssembly = keys.find(k => k.trim().toLowerCase().includes("assembly"));
            const keyUse = keys.find(k => k.trim().toLowerCase().includes("use_location"));
            const keyManuf = keys.find(k => k.trim().toLowerCase().includes("manufacturer"));

            const valAssembly = keyAssembly ? d[keyAssembly] : null;
            const valUse = keyUse ? d[keyUse] : null;
            const valManuf = keyManuf ? d[keyManuf] : null;

            if (!valAssembly || !valUse) return false;

            let s = valAssembly.trim();
            let t = valUse.trim();
            d.srcCode = nameMapping[s] || s;
            d.trgCode = nameMapping[t] || t;
            
            d.manufacturer = valManuf ? valManuf.trim() : "Inconnu";

            const sk = regionCoords[d.srcCode];
            const tk = regionCoords[d.trgCode] || d.trgCode === "WW";
            
            return d.manufacturer && sk && tk;
        });

        console.log("--> WorldMap: Données valides après nettoyage :", cleanData.length);

        // 3. MENU
        const manufacturers = Array.from(new Set(cleanData.map(d => d.manufacturer))).sort();
        const select = d3.select("#manufacturerSelect");
        select.selectAll("option:not([value='all'])").remove();
        manufacturers.forEach(m => { if(m) select.append("option").text(m).attr("value", m); });

        // 4. LOGIQUE DES LIENS
        function getLinks(dataSubset) {
            const rollup = d3.rollup(dataSubset, v => v.length, d => d.manufacturer, d => d.srcCode, d => d.trgCode);
            const links = [];
            for (const [manuf, sources] of rollup) {
                for (const [src, targets] of sources) {
                    for (const [trg, count] of targets) {
                        const sPt = regionCoords[src];
                        if (trg === "WW") {
                            globalAnchors.forEach(anchor => {
                                links.push({
                                    manufacturer: manuf, source: src, target: "Monde (WW)",
                                    sourceCoords: projection(sPt), targetCoords: projection(anchor),
                                    count: count, id: Math.random()
                                });
                            });
                        } else if (regionCoords[trg] && src !== trg) {
                            links.push({
                                manufacturer: manuf, source: src, target: trg,
                                sourceCoords: projection(sPt), targetCoords: projection(regionCoords[trg]),
                                count: count, id: Math.random()
                            });
                        }
                    }
                }
            }
            return links;
        }

        // --- ANIMATION ---
        function animateParticles(pathSelection) {
            gParticles.selectAll(".particle").remove(); 

            pathSelection.each(function(d) {
                // Vérification de sécurité
                if (!this.getTotalLength) return;
                const length = this.getTotalLength();
                if (!length) return;

                const particle = gParticles.append("circle")
                    .attr("class", "particle")
                    .attr("r", 2)
                    .attr("fill", "#fff") 
                    .style("filter", "drop-shadow(0 0 3px white)"); 

                repeat();

                function repeat() {
                    particle.transition()
                        .duration(2000 + Math.random() * 1000)
                        .ease(d3.easeLinear)
                        .attrTween("transform", function() {
                            return function(t) {
                                const point = pathSelection.nodes()[pathSelection.data().indexOf(d)].getPointAtLength(t * length);
                                return `translate(${point.x},${point.y})`;
                            };
                        })
                        .on("end", repeat);
                }
            });
        }

        // 5. FONCTION DE MISE À JOUR
        function update(selectedManuf) {
            const filtered = selectedManuf === "all" ? cleanData : cleanData.filter(d => d.manufacturer === selectedManuf);
            const links = getLinks(filtered);
            
            const maxCount = d3.max(links, d => d.count) || 1;
            widthScale.domain([0, maxCount]);

            // A. TRACÉ DES LIGNES
            const paths = gFlows.selectAll(".flow-line")
                .data(links, d => d.id); 

            paths.exit().remove(); 

            const enterPaths = paths.enter().append("path")
                .attr("class", "flow-line")
                .style("fill", "none")
                .style("stroke", "#ffd700")
                .style("stroke-linecap", "round")
                .style("opacity", 0.4);

            const mergedPaths = paths.merge(enterPaths)
                .attr("d", d => {
                    const dx = d.targetCoords[0] - d.sourceCoords[0];
                    const dy = d.targetCoords[1] - d.sourceCoords[1];
                    const dr = Math.sqrt(dx * dx + dy * dy) * 1.3;
                    return `M${d.sourceCoords[0]},${d.sourceCoords[1]}A${dr},${dr} 0 0,1 ${d.targetCoords[0]},${d.targetCoords[1]}`;
                })
                .style("stroke-width", d => widthScale(d.count));

            // Interaction
            mergedPaths.on("mouseover", (e, d) => {
                d3.select(e.currentTarget).style("stroke", "#fff").style("opacity", 1);
                tooltip.style("opacity", 1)
                    .html(`<strong style="color:#ffd700">${d.manufacturer}</strong><br>Assemblage: ${d.source} ➝ Utilisation: ${d.target}<br>Modèles: ${d.count}`);
            })
            .on("mousemove", e => tooltip.style("left", (e.pageX+15)+"px").style("top", (e.pageY-20)+"px"))
            .on("mouseout", (e) => {
                d3.select(e.currentTarget).style("stroke", "#ffd700").style("opacity", 0.4);
                tooltip.style("opacity", 0);
            });

            // B. LANCER L'ANIMATION
            animateParticles(mergedPaths);

            // C. POINTS
            gDots.selectAll("circle").remove();
            
            gDots.selectAll(".dot-s").data(links).enter().append("circle")
                .attr("cx", d => d.sourceCoords[0]).attr("cy", d => d.sourceCoords[1])
                .attr("r", 3).attr("fill", "#00ff00");
            
            gDots.selectAll(".dot-t").data(links.filter(d => !d.target.includes("WW"))).enter().append("circle")
                .attr("cx", d => d.targetCoords[0]).attr("cy", d => d.targetCoords[1])
                .attr("r", 3).attr("fill", "#ff0000");
        }

        update("all");
        select.on("change", function(event) { update(event.target.value); });

    }).catch(err => {
        console.error("ERREUR CHARGEMENT WORLDMAP :", err);
        d3.select('#map-container').html(`<p style="color:red; text-align:center; padding-top:20px;">Erreur : ${err.message}</p>`);
    });

}