(function () {

    const svg = d3.select("#stacked");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
  
    const margin = { top: 50, right: 30, bottom: 100, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
  
    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  
    const keys = ["manufacturing", "use", "transport", "eol"];
  
    const color = d3.scaleOrdinal()
      .domain(keys)
      .range(["#2E7D32", "#66BB6A", "#AED581", "#C8E6C9"]);
  
      d3.dsv(";", "data/data_cleaned/boavizta_data_cleaned.csv", d => ({
        subcategory: d.subcategory,
        manufacturing: Number(d.gwp_manufacturing_kg) || 0,
        use: Number(d.gwp_use_kg) || 0,
        transport: (Number(d.gwp_total) || 0) * (Number(d.gwp_transport_ratio) || 0),
        eol: (Number(d.gwp_total) || 0) * (Number(d.gwp_eol_ratio) || 0)
      }))     
      .then(data => {
        console.log("RAW DATA", data.slice(0, 5));

      const aggregated = d3.rollups(
        data,
        v => ({
          manufacturing: d3.mean(v, d => d.manufacturing),
          use: d3.mean(v, d => d.use),
          transport: d3.mean(v, d => d.transport),
          eol: d3.mean(v, d => d.eol)
        }),
        d => d.subcategory
      ).map(([subcategory, values]) => ({
        subcategory,
        ...values
      }));
  
      const stack = d3.stack().keys(keys);
      const stackedData = stack(aggregated);
  
      const x = d3.scaleBand()
        .domain(aggregated.map(d => d.subcategory))
        .range([0, innerWidth])
        .padding(0.2);
  
      const y = d3.scaleLinear()
        .domain([0, d3.max(aggregated, d =>
          d.manufacturing + d.use + d.transport + d.eol
        )])
        .nice()
        .range([innerHeight, 0]);
  
      g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-40)")
        .style("text-anchor", "end");
  
      g.append("g")
        .call(d3.axisLeft(y));
  
      g.selectAll(".layer")
        .data(stackedData)
        .join("g")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("x", d => x(d.data.subcategory))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth());
  
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .text("Répartition de l’empreinte carbone par cycle de vie");
  
      const legend = svg.append("g")
        .attr("transform", `translate(${width - 200},${margin.top})`);
  
      keys.forEach((key, i) => {
        const row = legend.append("g")
          .attr("transform", `translate(0, ${i * 20})`);
  
        row.append("rect")
          .attr("width", 12)
          .attr("height", 12)
          .attr("fill", color(key));
  
        row.append("text")
          .attr("x", 20)
          .attr("y", 10)
          .text(key);
      });
    });
  
  })();
  