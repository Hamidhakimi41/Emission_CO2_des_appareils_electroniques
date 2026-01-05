(function () {

    /* ==============================
       SETUP SVG
    ============================== */
  
    const svg = d3.select("#carbon-road");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
  
    const margin = { left: 60, right: 60, top: 40, bottom: 40 };
    const groundY = height - margin.bottom;
  
    /* ==============================
       SCALES
    ============================== */
  
    const x = d3.scaleLinear()
      .domain([0, 10])
      .range([margin.left, width - margin.right]);
  
    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([groundY, margin.top]);
  
    /* ==============================
       PROFILES (FAKE DATA)
    ============================== */
  
    const profiles = {
      laptop: [
        { t: 0.0, h: 0 },
        { t: 0.3, h: 70 },
        { t: 0.6, h: 100 },
        { t: 1.0, h: 60 },
        { t: 1.3, h: 75 },
        { t: 3.0, h: 40 },
        { t: 6.0, h: 30 },
        { t: 8.5, h: 25 },
        { t: 9.2, h: 45 },
        { t: 10.0, h: 20 }
      ],
  
      smartphone: [
        { t: 0.0, h: 0 },
        { t: 0.3, h: 50 },
        { t: 0.6, h: 70 },
        { t: 1.0, h: 45 },
        { t: 1.3, h: 55 },
        { t: 3.0, h: 25 },
        { t: 6.0, h: 18 },
        { t: 8.5, h: 15 },
        { t: 9.2, h: 30 },
        { t: 10.0, h: 12 }
      ]
    };
  
    let reliefData = profiles.laptop;
  
    /* ==============================
       LINE & AREA
    ============================== */
  
    const curve = d3.curveCatmullRom.alpha(0.5);
  
    const line = d3.line()
      .x(d => x(d.t))
      .y(d => y(d.h))
      .curve(curve);
  
    const area = d3.area()
      .x(d => x(d.t))
      .y0(groundY)
      .y1(d => y(d.h))
      .curve(curve);
  
    /* ==============================
       DRAW RELIEF
    ============================== */
  
    const mountain = svg.append("path")
      .datum(reliefData)
      .attr("fill", "#C8E6C9")
      .attr("opacity", 0.6)
      .attr("d", area);
  
    // Route = asphalte (créée UNE fois)
    const roadPath = svg.append("path")
      .datum(reliefData)
      .attr("fill", "none")
      .attr("stroke", "#424242")
      .attr("stroke-width", 12)
      .attr("stroke-linecap", "round")
      .attr("d", line);
  
    // Ligne suivie par la voiture (créée UNE fois)
    const reliefPath = svg.append("path")
      .datum(reliefData)
      .attr("fill", "none")
      .attr("stroke", "#2E7D32")
      .attr("stroke-width", 4)
      .attr("d", line);
  
    // Marquage central (créé UNE fois)
    const centerLine = svg.append("path")
      .datum(reliefData)
      .attr("fill", "none")
      .attr("stroke", "#FFFFFF")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,6")
      .attr("d", line);
  
    /* ==============================
       GROUND LINE
    ============================== */
  
    svg.append("line")
      .attr("x1", x(0))
      .attr("x2", x(10))
      .attr("y1", groundY)
      .attr("y2", groundY)
      .attr("stroke", "#555")
      .attr("stroke-width", 2);
  
    /* ==============================
       PHASE ANNOTATIONS
    ============================== */
  
    const annotations = [
      { label: "Fabrication\n500 km / 30 kg CO₂", t: 0.6, h: 100 },
      { label: "Transport\n80 km / 5 kg CO₂", t: 1.3, h: 75 },
      { label: "Usage\n300 km / 18 kg CO₂", t: 5.0, h: 40 },
      { label: "Fin de vie\n40 km / 2 kg CO₂", t: 9.2, h: 45 }
    ];
  
    svg.selectAll(".annotation")
      .data(annotations)
      .enter()
      .append("text")
      .attr("x", d => x(d.t))
      .attr("y", d => y(d.h) - 12)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#333")
      .selectAll("tspan")
      .data(d => d.label.split("\n"))
      .enter()
      .append("tspan")
      .attr("x", function () { return d3.select(this.parentNode).attr("x"); })
      .attr("dy", (d, i) => i === 0 ? 0 : "1.2em")
      .text(d => d);
  
    /* ==============================
       PHASE ICONS (AU SOL)
    ============================== */
  
    const phaseIcons = [
      { href: "images/factory.svg", t: 0.6, size: 36 },
      { href: "images/truck.svg", t: 1.3, size: 32 },
      { href: "images/usage.svg", t: 5.0, size: 32 },
      { href: "images/recycling.svg", t: 9.2, size: 32 }
    ];
  
    svg.selectAll(".phase-icon")
      .data(phaseIcons)
      .enter()
      .append("image")
      .attr("class", "phase-icon")
      .attr("href", d => d.href)
      .attr("width", d => d.size)
      .attr("height", d => d.size)
      .attr("x", d => x(d.t) - d.size / 2)
      .attr("y", d => groundY - d.size)
      .style("opacity", 0.9)
      .style("pointer-events", "none");
  
    /* ==============================
       TIME AXIS
    ============================== */
  
    const axis = d3.axisBottom(x)
      .ticks(5)
      .tickFormat(d => `${d} ans`);
  
    svg.append("g")
      .attr("transform", `translate(0, ${groundY + 20})`)
      .call(axis);
  
    /* ==============================
       CAR IMAGE
    ============================== */
  
    const carGroup = svg.append("g");
  
    carGroup.append("image")
      .attr("href", "images/car.svg")
      .attr("width", 40)
      .attr("height", 40)
      .attr("x", -20)
      .attr("y", -20);
  
    /* ==============================
       SMOKE
    ============================== */
  
    const smoke = svg.append("circle")
      .attr("r", 6)
      .attr("fill", "rgba(120,120,120,0.6)")
      .style("opacity", 0);
  
    /* ==============================
       SLIDER → MOVEMENT
    ============================== */
  
    const slider = document.getElementById("timeSlider");
  
    let pathNode = reliefPath.node();
    let pathLength = pathNode.getTotalLength();
  
    function updateCar(t) {
      const progress = t / +slider.max;
  
      const p1 = pathNode.getPointAtLength(progress * pathLength);
      const p2 = pathNode.getPointAtLength(
        Math.min(progress * pathLength + 2, pathLength)
      );
  
      const slope = Math.max(0, p1.y - p2.y);
  
      carGroup
        .attr("transform", `translate(${p1.x}, ${p1.y - 8})`);
  
      smoke
        .attr("cx", p1.x - 18)
        .attr("cy", p1.y - 14)
        .style("opacity", Math.min(slope / 10, 1));
    }
  
    updateCar(0);
  
    slider.addEventListener("input", () => {
      updateCar(+slider.value);
    });
  
    /* ==============================
       DEVICE SELECTOR (CORRECT)
    ============================== */
  
    const selector = document.getElementById("deviceSelector");
  
    selector.addEventListener("change", () => {
  
      reliefData = profiles[selector.value];
  
      mountain.datum(reliefData).attr("d", area);
      roadPath.datum(reliefData).attr("d", line);
      reliefPath.datum(reliefData).attr("d", line);
      centerLine.datum(reliefData).attr("d", line);
  
      // recalcul pour la voiture (IMPORTANT)
      pathNode = reliefPath.node();
      pathLength = pathNode.getTotalLength();
  
      updateCar(+slider.value);
    });
  
  })();
  