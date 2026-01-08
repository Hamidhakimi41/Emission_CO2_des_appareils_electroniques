(function () {
    const width = 900;
    const height = 900;
  
    const CSV_PATH = "data/data_cleaned/boavizta_data_cleaned.csv";
    const METRIC = "gwp_total"; // bubble size metric
  
    function num(v) {
      const n = +String(v ?? "").replace(",", ".");
      return Number.isFinite(n) ? n : 0;
    }
  
    function buildHierarchy(rows) {
      const root = { name: "Boavizta", children: [] };
  
      const byCat = d3.group(rows, d => d.category || "Unknown");
      for (const [cat, catRows] of byCat) {
        const catNode = { name: cat, children: [] };
  
        const bySub = d3.group(catRows, d => d.subcategory || "Unknown");
        for (const [sub, subRows] of bySub) {
          const subNode = { name: sub, children: [] };
  
          const sorted = subRows
            .map(d => ({
              name: d.name || "Unnamed device",
              manufacturer: d.manufacturer || "",
              category: d.category || "",
              subcategory: d.subcategory || "",
              value: Math.max(0.001, num(d[METRIC])),
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
  
          subNode.children = sorted;
          catNode.children.push(subNode);
        }
  
        root.children.push(catNode);
      }
  
      return root;
    }
  
    function formatNiceKg(v) {
      if (!Number.isFinite(v)) return "—";
      if (v >= 1000) return `${(v / 1000).toFixed(1)} t CO₂e`;
      return `${v.toFixed(0)} kg CO₂e`;
    }
  
    function pct(v) {
      if (!Number.isFinite(v)) return "—";
      return `${Math.round(v * 100)}%`;
    }
  
    function makeTooltip() {
      return d3.select("body")
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
        .style("font-family", "Inter, Arial, sans-serif")
        .style("font-size", "12px")
        .style("display", "none");
    }
  
    const tooltip = makeTooltip();
  
    // Références (kg CO2e) adaptées aux ordres de grandeur de tes bulles
    const referenceBubbles = [
        { name: "5 000 km en voiture (moyenne)", kg: 1000 },
      { name: "A/R Paris–New York (avion)", kg: 2060 },
      { name: "Empreinte annuelle moyenne (France)", kg: 9000 }
    ];
  
    d3.dsv(";", CSV_PATH).then(rows => init(rows)).catch(err => {
      console.error("PACK load error:", err);
    });
  
    function init(rows) {
      // Reset container
      d3.select("#pack").selectAll("*").remove();
      console.log("PACKED.js reloaded ✅", new Date().toLocaleTimeString());
  
      const filtered = rows.filter(d => (d.category || d.subcategory || d.name) && num(d[METRIC]) > 0);
      const data = buildHierarchy(filtered);
  
      // Couleurs: pas de couleur "message" au niveau 1 (catégories), structure lisible au niveau 2, neutre au niveau 3
      const color = d3.scaleOrdinal()
        .domain([1, 2, 3])
        .range([
          "#F9FBFA", // depth 1
          "#CFE8D6", // depth 2
          "#EDF7F1"  // depth 3
        ]);
  
      const pack = d3.pack()
        .size([width, height])
        .padding(3);
  
      const root = pack(
        d3.hierarchy(data)
          .sum(d => d.value || 0)
          .sort((a, b) => b.value - a.value)
      );
  
      // Aggregates per node
      root.eachAfter(n => {
        if (!n.children) {
          n.total_sum = num(n.data.gwp_total);
          n.fab_sum = num(n.data.gwp_manufacturing_kg);
          n.use_sum = num(n.data.gwp_use_kg);
        } else {
          n.total_sum = d3.sum(n.children, c => c.total_sum || 0);
          n.fab_sum = d3.sum(n.children, c => c.fab_sum || 0);
          n.use_sum = d3.sum(n.children, c => c.use_sum || 0);
        }
        n.fab_ratio = n.total_sum > 0 ? (n.fab_sum / n.total_sum) : 0;
      });
      // Pour calibrer les bulles de référence sur les bulles "appareils"
        const leaves = root.leaves();
        const maxLeafKg = d3.max(leaves, d => d.total_sum || 0) || 1;
        const maxLeafR = d3.max(leaves, d => d.r || 0) || 1;

        // Echelle en "unités pack" (même espace que d.r)
        const refRPack = d3.scaleSqrt()
        .domain([0, maxLeafKg])
        .range([0, maxLeafR]);

        // Echelle en pixels à la vue racine (car à l'écran tu vois d.r * kRoot)
        const kRoot = width / (root.r * 2);
        const refRScreen = kg => refRPack(kg) * kRoot;

  
      // Precompute: show a few subcategories at root (one level ahead)
      const TOP_SUBS_PER_CAT = 4;
      const subcatKey = d => `${d.parent?.data?.name}__${d.data?.name}`;
      const rootTopSubcats = new Set();
  
      (root.children || []).forEach(catNode => {
        const subs = (catNode.children || [])
          .slice()
          .sort((a, b) => (b.total_sum || 0) - (a.total_sum || 0))
          .slice(0, TOP_SUBS_PER_CAT);
        subs.forEach(s => rootTopSubcats.add(subcatKey(s)));
      });
  
      // Layout: chart + right panel
      const packRoot = d3.select("#pack");
      const wrap = packRoot.append("div")
        .style("display", "grid")
        .style("grid-template-columns", "1fr 320px")
        .style("gap", "16px")
        .style("align-items", "start");
  
      const left = wrap.append("div")
        .style("padding", "16px")
        .style("border", "1px solid rgba(0,0,0,0.08)")
        .style("border-radius", "16px")
        .style("background", "#F7FBF7");
  
      const right = wrap.append("aside")
        .style("position", "sticky")
        .style("top", "16px");
  
      // Legend
      right.append("div")
        .attr("id", "packLegend")
        .style("padding", "12px")
        .style("border", "1px solid rgba(0,0,0,0.08)")
        .style("border-radius", "14px")
        .style("background", "#fff")
        .style("margin-bottom", "12px")
        .style("font-family", "Inter, Arial, sans-serif")
        .style("font-size", "13px")
        .html(`
          <div style="font-family: Montserrat, Arial, sans-serif; font-weight:700; color:#1B5E20; margin-bottom:10px;">
            Légende
          </div>
          <div style="display:flex; gap:10px; align-items:center; margin:8px 0;">
            <span style="width:14px; height:14px; border-radius:4px; display:inline-block; background:#E4FFF0; border:1px solid rgba(0,0,0,0.12);"></span>
            <span>Total (taille de la bulle)</span>
          </div>
        
          <div style="display:flex; gap:10px; align-items:center; margin:8px 0;">
            <span style="width:14px; height:14px; border-radius:4px; display:inline-block; background:#CFE8D6; border:1px solid rgba(0,0,0,0.12);"></span>
            <span>Sous-catégories</span>
          </div>
        `);
  
      // Panel
      const panel = right.append("div")
        .style("padding", "12px")
        .style("border", "1px solid rgba(0,0,0,0.08)")
        .style("border-radius", "14px")
        .style("background", "#fff");
  
      const panelTitle = panel.append("div")
        .attr("id", "panelTitle")
        .style("font-family", "Montserrat, Arial, sans-serif")
        .style("font-weight", "700")
        .style("color", "#1B5E20")
        .style("margin-bottom", "10px")
        .text("Comparaison");

      const scatterCard = right.append("div")
        .attr("id", "scatterCard")
        .style("padding", "12px")
        .style("border", "1px solid rgba(0,0,0,0.08)")
        .style("border-radius", "14px")
        .style("background", "#fff")
        .style("margin-top", "12px");
      
      scatterCard.append("div")
        .style("font-family", "Montserrat, Arial, sans-serif")
        .style("font-weight", "700")
        .style("color", "#1B5E20")
        .style("margin-bottom", "10px")
        .text("Scatter (détails)");
      
      scatterCard.append("div")
        .attr("id", "scatterPanel"); // scatter.js va remplir ça
      
  
      const panelBars = panel.append("div").attr("id", "panelBars");
  
      // Main SVG
      const svg = left.append("svg")
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
  
      // Reference bubble scale, tied to real dataset scale
      const maxRef = d3.max(root.children || [], d => d.total_sum || 0) || 1;
      const refR = d3.scaleSqrt().domain([0, maxRef]).range([0, 26]); // smaller so it fits nicely
  
      // References block, compact and well placed bottom-left
      const refsBoxW = 360;
      const refsBoxH = 120;
      const refsPad = 18;
  
      const refsX = -width / 2 + refsPad;
      const refsY = height / 2 - refsPad - refsBoxH;
  
      const refsG = svg.append("g")
        .attr("class", "refs")
        .attr("transform", `translate(${refsX}, ${refsY})`);
  
      refsG.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", refsBoxW)
        .attr("height", refsBoxH)
        .attr("rx", 14)
        .attr("fill", "rgba(255,255,255,0.92)")
        .attr("stroke", "rgba(0,0,0,0.08)");
  
      refsG.append("text")
        .attr("x", 16)
        .attr("y", 26)
        .style("font-family", "Montserrat, Arial, sans-serif")
        .style("font-weight", 700)
        .style("font-size", "14px")
        .style("fill", "#1B5E20")
        .text("Références (ordre de grandeur)");
  
      const refRow = refsG.selectAll("g.ref")
        .data(referenceBubbles)
        .join("g")
        .attr("class", "ref")
        .attr("transform", (d, i) => `translate(18, ${52 + i * 24})`);
  
      refRow.append("circle")
        .attr("cx", 10)
        .attr("cy", 0)
        .attr("r", d => refRScreen(d.kg))
        .attr("fill", "rgba(228,255,240,0.9)")
        .attr("stroke", "rgba(20,60,30,0.22)")
        .attr("stroke-width", 1.2);
  
      refRow.append("text")
        .attr("x", 40)
        .attr("y", 4)
        .style("font-family", "Inter, Arial, sans-serif")
        .style("font-size", "12px")
        .style("fill", "#1b1b1b")
        .text(d => `${d.name} · ${formatNiceKg(d.kg)}`);
  
      // Focus + view for zoom
      let focus = root;
      let view;
  
      function isVisibleLabel(d) {
        if (focus === root) {
          if (d.depth === 1) return d.r > 35;
          if (d.depth === 2) return d.r > 16 && rootTopSubcats.has(subcatKey(d));
          return false;
        }
        if (d.parent === focus) {
          if (d.depth === 2) return d.r > 18;
          if (d.depth === 3) return d.r > 14;
          return d.r > 18;
        }
        return false;
      }
  
      // Nodes
      const node = svg.append("g")
        .selectAll("g")
        .data(root.descendants().slice(1))
        .join("g")
        .attr("pointer-events", "auto")
        .on("mouseover", function () {
          d3.select(this).select("circle.outer").attr("stroke", "rgba(20,60,30,0.75)");
        })
        .on("mouseout", function (event, d) {
          d3.select(this).select("circle.outer")
            .attr("stroke", d.children ? "rgba(20,60,30,0.20)" : "rgba(20,60,30,0.28)");
        })
        .on("mousemove", (event, d) => {
          if (!d) return;
  
          const subtitle =
            d.depth === 1 ? "Catégorie" :
            d.depth === 2 ? "Sous-catégorie" :
            "Appareil";
  
          tooltip.style("display", "block")
            .style("left", (event.clientX + 14) + "px")
            .style("top", (event.clientY + 14) + "px")
            .html(`
              <div style="font-weight:700; margin-bottom:4px;">${d.data?.name || ""}</div>
              <div style="color:#444; margin-bottom:8px;">
                ${subtitle}${d.data?.manufacturer ? ` · ${d.data.manufacturer}` : ""}
              </div>
              <div><b>Total</b>: ${formatNiceKg(d.total_sum || 0)}</div>
              <div><b>Fabrication</b>: ${formatNiceKg(d.fab_sum || 0)} (${pct(d.fab_ratio || 0)})</div>
              <div><b>Usage</b>: ${formatNiceKg(d.use_sum || 0)}</div>
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
            event.stopPropagation();
          }
        });
  
      node.append("circle")
        .attr("class", "outer")
        .attr("fill", d => d.children ? color(d.depth) : "#E4FFF0")
        .attr("stroke", d => d.children ? "rgba(20,60,30,0.20)" : "rgba(20,60,30,0.28)")
        .attr("stroke-width", d => d.children ? 1 : 1.2);
  

  
      // Labels
      const label = svg.append("g")
        .style("font-family", "DM Sans, Inter, Arial, sans-serif")
        .style("font-weight", 600)
        .style("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants())
        .join("text")
        .text(d => d.data.name)
        .style("fill", "#1B5E20")
        .style("font-size", d => {
          if (d.depth === 1) return "20px";
          if (d.depth === 2) return "13px";
          return "11px";
        })
        .style("font-weight", d => d.depth === 1 ? 700 : 500);
  
      svg.on("click", (event) => zoom(event, root));
  
      function updatePanel() {
        const isRoot = focus === root;
        const title = isRoot ? "Top catégories (Total vs Fabrication)" : `Top dans "${focus.data.name}"`;
        panelTitle.text(title);
  
        const items = (focus.children || [])
          .map(n => ({
            name: n.data.name,
            total: n.total_sum || 0,
            fab: n.fab_sum || 0,
            rest: Math.max(0, (n.total_sum || 0) - (n.fab_sum || 0))
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6);
  
        panelBars.selectAll("*").remove();
  
        const W = 300;
        const rowH = 28;
        const H = 24 + items.length * rowH;
  
        const svgP = panelBars.append("svg")
          .attr("width", W)
          .attr("height", H);
  
        const margin = { top: 10, right: 10, bottom: 10, left: 110 };
        const x = d3.scaleLinear()
          .domain([0, d3.max(items, d => d.total) || 1])
          .range([margin.left, W - margin.right]);
  
        const row = svgP.append("g")
          .selectAll("g.row")
          .data(items)
          .join("g")
          .attr("class", "row")
          .attr("transform", (d, i) => `translate(0, ${margin.top + i * rowH})`);
  
        row.append("text")
          .attr("x", margin.left - 8)
          .attr("y", 18)
          .attr("text-anchor", "end")
          .style("font-family", "Inter, Arial, sans-serif")
          .style("font-size", "12px")
          .style("fill", "#1b1b1b")
          .text(d => d.name);
  
        row.append("rect")
          .attr("x", x(0))
          .attr("y", 6)
          .attr("height", 14)
          .attr("width", d => Math.max(0, x(d.fab) - x(0)))
          .attr("fill", "#FBF9BC")
          .attr("stroke", "rgba(0,0,0,0.06)");
  
        row.append("rect")
          .attr("x", d => x(d.fab))
          .attr("y", 6)
          .attr("height", 14)
          .attr("width", d => Math.max(0, x(d.total) - x(d.fab)))
          .attr("fill", "#A5D6A7")
          .attr("stroke", "rgba(0,0,0,0.06)");
  
        row.append("text")
          .attr("x", W - margin.right)
          .attr("y", 18)
          .attr("text-anchor", "end")
          .style("font-family", "Inter, Arial, sans-serif")
          .style("font-size", "11px")
          .style("fill", "#555")
          .text(d => `${formatNiceKg(d.total)} | Fab ${pct(d.total ? d.fab / d.total : 0)}`);
      }
  
      function zoomTo(v) {
        const k = width / v[2];
        view = v;
  
        node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
  
        node.select("circle.outer").attr("r", d => d.r * k);
  
        node.select("circle.manufacturing-core").attr("r", d => {
          const ratio = Math.max(0, Math.min(1, d.fab_ratio || 0));
          return (d.r * k) * Math.sqrt(ratio);
        });
  
        label
          .style("fill-opacity", d => isVisibleLabel(d) ? 1 : 0)
          .style("display", d => isVisibleLabel(d) ? "inline" : "none");
      }
  
      function zoom(event, d) {
        focus = d;
        updatePanel();
  
        const transition = svg.transition()
          .duration(event && event.altKey ? 7500 : 750)
          .tween("zoom", () => {
            const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
            return t => zoomTo(i(t));
          });
  
        label.transition(transition)
          .style("fill-opacity", d => isVisibleLabel(d) ? 1 : 0)
          .on("start", function (d) { if (isVisibleLabel(d)) this.style.display = "inline"; })
          .on("end", function (d) { if (!isVisibleLabel(d)) this.style.display = "none"; });
      }
  
      // Initial render
      zoomTo([root.x, root.y, root.r * 2]);
      updatePanel();
    }
  })();
  