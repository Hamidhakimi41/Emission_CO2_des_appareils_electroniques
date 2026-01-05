(function () {
    const width = 900;
    const height = 900;
  
    // Change this path if needed
    const CSV_PATH = "data/data_cleaned/boavizta_data_cleaned.csv";
  
    // Metric used for bubble size
    // Option A: total impact
    const METRIC = "gwp_total"; // or "gwp_manufacturing_kg", "gwp_use_kg"
  
    // Helper: safe number
    function num(v) {
      const n = +String(v ?? "").replace(",", ".");
      return Number.isFinite(n) ? n : 0;
    }
  
    // Build hierarchy: category -> subcategory -> device
    function buildHierarchy(rows) {
      const root = { name: "Boavizta", children: [] };
  
      const byCat = d3.group(rows, d => d.category || "Unknown");
      for (const [cat, catRows] of byCat) {
        const catNode = { name: cat, children: [] };
  
        const bySub = d3.group(catRows, d => d.subcategory || "Unknown");
        for (const [sub, subRows] of bySub) {
          const subNode = { name: sub, children: [] };
  
          // Leaf nodes: devices
          // If too many devices, you can keep only top N by metric:
          const sorted = subRows
            .map(d => ({
              name: d.name || "Unnamed device",
              manufacturer: d.manufacturer || "",
              category: d.category || "",
              subcategory: d.subcategory || "",
              value: Math.max(0.001, num(d[METRIC])), // must be > 0 for pack
              gwp_total: num(d.gwp_total),
              gwp_manufacturing_kg: num(d.gwp_manufacturing_kg),
              gwp_use_kg: num(d.gwp_use_kg),
              gwp_manufacturing_ratio: num(d.gwp_manufacturing_ratio),
              gwp_use_ratio: num(d.gwp_use_ratio),
              lifetime: num(d.lifetime),
              yearly_tec: num(d.yearly_tec),
              report_year: num(d.report_year)
            }))
            .sort((a, b) => b.value - a.value);
  
          // OPTIONAL LIMIT (uncomment if needed)
          // const TOP_N = 25;
          // const kept = sorted.slice(0, TOP_N);
  
          const kept = sorted;
  
          subNode.children = kept;
          catNode.children.push(subNode);
        }
  
        root.children.push(catNode);
      }
  
      return root;
    }
  
    function formatKg(v) {
      if (!Number.isFinite(v)) return "—";
      return `${v.toFixed(1)} kg CO₂e`;
    }
  
    function makeTooltip() {
      const t = d3.select("body")
        .append("div")
        .attr("id", "pack-tooltip")
        .style("position", "fixed")
        .style("pointer-events", "none")
        .style("z-index", "9999")
        .style("background", "rgba(255,255,255,0.95)")
        .style("border", "1px solid rgba(0,0,0,0.15)")
        .style("border-radius", "10px")
        .style("padding", "10px 12px")
        .style("box-shadow", "0 6px 18px rgba(0,0,0,0.12)")
        .style("font", "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif")
        .style("display", "none");
      return t;
    }
  
    const tooltip = makeTooltip();
  

    d3.dsv(";", CSV_PATH).then(rows => {
      console.log("PACK rows:", rows.length, rows[0]); // debug
      init(rows);
    }).catch(err => {
      console.error("PACK load error:", err);
    });
    
    function init(rows) {
      // Filter out garbage rows
      const filtered = rows.filter(d =>
        (d.category || d.subcategory || d.name) && num(d[METRIC]) > 0
      );
  
      const data = buildHierarchy(filtered);
  
      // Color scale by depth (category/subcategory/device)
      const color = d3.scaleOrdinal()
        .domain([1, 2, 3, 4, 5])
        .range([
            "#E8F5E9", // vert très clair
            "#C8E6C9", // vert clair
            "#A5D6A7", // vert moyen
            "#80CBC4", // turquoise doux
            "#B2DFDB"  // vert d’eau
        ]);

  
      const pack = data =>
        d3.pack()
          .size([width, height])
          .padding(3)(
            d3.hierarchy(data)
              .sum(d => d.value || 0)
              .sort((a, b) => b.value - a.value)
          );
  
      const root = pack(data);
  
      const svg = d3.select("#pack")
        .append("svg")
        .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .style("height", "auto")
        .style("display", "block")
        .style("background", "#F3FAF4")
        .style("border", "1px solid rgba(0,0,0,0.08)")

        .style("cursor", "pointer")
        .style("border-radius", "16px");
  
      let focus = root;
      let view;
  
      const node = svg.append("g")
        .selectAll("circle")
        .data(root.descendants().slice(1))
        .join("circle")
        .attr("fill", d => d.children ? color(d.depth) : "#E4FFF0")
        .attr("stroke", d => d.children ? "rgba(20,60,30,0.20)" : "rgba(20,60,30,0.28)")
        .attr("stroke-width", d => d.children ? 1 : 1.2)
        .attr("pointer-events", d => !d.children ? "auto" : null)
        .on("mouseover", function() { d3.select(this).attr("stroke", "rgba(20,60,30,0.75)"); })
        .on("mouseout", function() { d3.select(this).attr("stroke", d => d.children ? "rgba(20,60,30,0.20)" : "rgba(20,60,30,0.28)"); })

        .on("mousemove", (event, d) => {
          if (!d || d.children) return;
  
          tooltip.style("display", "block")
            .style("left", (event.clientX + 14) + "px")
            .style("top", (event.clientY + 14) + "px")
            .html(`
              <div style="font-weight:600; margin-bottom:4px;">${d.data.name}</div>
              <div style="color:#333; margin-bottom:6px;">${d.data.manufacturer || ""}</div>
              <div><b>Total</b>: ${formatKg(d.data.gwp_total)}</div>
              <div><b>Fabrication</b>: ${formatKg(d.data.gwp_manufacturing_kg)} (${Math.round((d.data.gwp_manufacturing_ratio || 0) * 100)}%)</div>
              <div><b>Usage</b>: ${formatKg(d.data.gwp_use_kg)} (${Math.round((d.data.gwp_use_ratio || 0) * 100)}%)</div>
              <div style="margin-top:6px; color:#555;">
                lifetime: ${d.data.lifetime || "—"} ans • yearly_tec: ${d.data.yearly_tec || "—"} kWh/an
              </div>
            `);
        })
        .on("mouseleave", () => tooltip.style("display", "none"))
        .on("click", (event, d) => {
          if (d.children) {
            if (focus !== d) {
              zoom(event, d);
              event.stopPropagation();
            }
          } else {
            // leaf click: you can later hook a side panel
            event.stopPropagation();
          }
        });
  
      const label = svg.append("g")
        .style("font", "11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants())
        .join("text")
        .style("fill", "#1d1d1f")
        .style("fill-opacity", d => d.parent === root ? 1 : 0)
        .style("display", d => d.parent === root ? "inline" : "none")
        .text(d => d.data.name);
  
      svg.on("click", (event) => zoom(event, root));
      zoomTo([focus.x, focus.y, focus.r * 2]);
  
      function zoomTo(v) {
        const k = width / v[2];
        view = v;
  
        label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        node.attr("r", d => d.r * k);
      }
  
      function zoom(event, d) {
        const focus0 = focus;
        focus = d;
  
        const transition = svg.transition()
          .duration(event && event.altKey ? 7500 : 750)
          .tween("zoom", () => {
            const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
            return t => zoomTo(i(t));
          });
  
        label
          .filter(function (d) { return d.parent === focus || this.style.display === "inline"; })
          .transition(transition)
          .style("fill-opacity", d => d.parent === focus ? 1 : 0)
          .on("start", function (d) { if (d.parent === focus) this.style.display = "inline"; })
          .on("end", function (d) { if (d.parent !== focus) this.style.display = "none"; });
      }
    }
  
  })();
  