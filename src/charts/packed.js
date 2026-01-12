(function () {
    const width = 900;
    const height = 900;
  
    const CSV_PATH = "data/data_cleaned/boavizta_data_cleaned.csv";
    const METRIC = "gwp_total"; // Métrique pour la taille des bulles
  
    // --- Fonctions Utilitaires ---
    function num(v) {
      const n = +String(v ?? "").replace(",", ".");
      return Number.isFinite(n) ? n : 0;
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

    // --- Construction de la hiérarchie ---
    function buildHierarchy(rows) {
      const root = { name: "Boavizta", children: [] };
  
      const byCat = d3.group(rows, d => d.category || "Unknown");
      for (const [cat, catRows] of byCat) {
        const catNode = { name: cat, children: [] };
  
        const bySub = d3.group(catRows, d => d.subcategory || "Unknown");
        for (const [sub, subRows] of bySub) {
          const subNode = { name: sub, children: [] };
  
          // Mapping des données
          const sorted = subRows
            .map(d => ({
              name: d.name || "Unnamed device",
              manufacturer: d.manufacturer || "",
              category: d.category || "",
              subcategory: d.subcategory || "",
              weight: num(d.weight),
              screen_size: num(d.screen_size),
              value: Math.max(0.001, num(d[METRIC])),
              gwp_total: num(d.gwp_total),
              gwp_manufacturing_kg: num(d.gwp_manufacturing_kg),
              gwp_use_kg: num(d.gwp_use_kg),
              gwp_manufacturing_ratio: num(d.gwp_manufacturing_ratio),
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
  
    // --- Tooltip Packed (Style défini dans le CSS global) ---
    d3.select("#pack-tooltip").remove();
    const tooltip = d3.select("body")
      .append("div")
      .attr("id", "pack-tooltip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("z-index", "9999")
      .style("display", "none");
  
    // --- Références ---
    const referenceBubbles = [
        { name: "5 000 km voiture", kg: 1000 },
        { name: "A/R Paris–NY (avion)", kg: 2060 },
        { name: "Empreinte annuelle (Fr)", kg: 9000 }
    ];
  
    // --- Chargement des données ---
    d3.dsv(";", CSV_PATH).then(rows => init(rows)).catch(err => {
      console.error("PACK load error:", err);
    });
  
    // ============================================================
    // FONCTION PRINCIPALE INIT
    // ============================================================
    function init(rows) {
      console.log("PACKED.js initialized ");
  
      // 1. Préparation Données
      const filtered = rows.filter(d => (d.category || d.subcategory || d.name) && num(d[METRIC]) > 0);
      const data = buildHierarchy(filtered);
  
      // Couleurs douces
      const color = d3.scaleOrdinal()
        .domain([1, 2, 3])
        .range(["#F8FAFC", "#dcfce7", "#f0fdf4"]); 
  
      const pack = d3.pack()
        .size([width, height])
        .padding(3);
  
      const root = pack(
        d3.hierarchy(data)
          .sum(d => d.value || 0)
          .sort((a, b) => b.value - a.value)
      );
  
      // Aggrégations pour les totaux
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

      // Calibrage Références
      const leaves = root.leaves();
      const maxLeafKg = d3.max(leaves, d => d.total_sum || 0) || 1;
      const maxLeafR = d3.max(leaves, d => d.r || 0) || 1;
      const refRPack = d3.scaleSqrt().domain([0, maxLeafKg]).range([0, maxLeafR]);
      const kRoot = width / (root.r * 2);
      const refRScreen = kg => refRPack(kg) * kRoot;
  
      // Pré-calcul affichage labels sous-catégories
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
  
      // ============================================================
      // LAYOUT DOM 
      // ============================================================
      const packRoot = d3.select("#pack");
      packRoot.selectAll("*").remove();

      const wrap = packRoot.append("div")
        .attr("class", "pack-layout"); // Utilise la Grid CSS définie dans index.html

      // --- PARTIE GAUCHE (PACKED BUBBLE) ---
      const left = wrap.append("div")
        .attr("class", "chart-card") // Classe CSS 'modern card'
        .style("padding", "0")       // Le SVG remplit la carte
        .style("overflow", "hidden")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("align-items", "center")
        .style("background", "#F8FAFC"); 

      // --- PARTIE DROITE (PANNEAU) ---
      const right = wrap.append("aside")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "20px")
        .style("position", "sticky")
        .style("top", "20px");

      // 1. CARTE COMPARAISON (Barres)
      const panel = right.append("div")
        .attr("class", "chart-card")
        .style("padding", "20px");

      const panelTitle = panel.append("div")
        .style("font-family", "'Montserrat', sans-serif")
        .style("font-weight", "700")
        .style("color", "#0f172a")
        .style("font-size", "14px")
        .style("margin-bottom", "15px")
        .style("border-bottom", "1px solid #e2e8f0")
        .style("padding-bottom", "10px")
        .text("Comparaison");
      
      const panelBars = panel.append("div");

      // 2. CARTE SCATTER (Détails)
      const scatterCard = right.append("div")
        .attr("class", "chart-card")
        .style("padding", "20px");

      scatterCard.append("div")
        .style("font-family", "'Montserrat', sans-serif")
        .style("font-weight", "700")
        .style("color", "#0f172a")
        .style("font-size", "14px")
        .style("margin-bottom", "5px")
        .text("Distribution & Marques");
        
      // Conteneur SVG Scatter
      const scatterSvg = scatterCard.append("svg")
         .attr("id", "scatterPanel")
         .style("width", "100%")
         .style("height", "auto")
         .style("min-height", "550px"); // on ajuster pour les legends

      // ============================================================
      // INTÉGRATION SCATTER 
      // ============================================================
      let scatterChart = null;

      // Interaction: Survol Scatter -> Packed Bubble
      const onScatterHover = (deviceName, isHovered) => {
          const targetBubbles = svg.selectAll("circle.leaf-node")
               .filter(d => d.data.name === deviceName);
          
          if (isHovered) {
              targetBubbles
                  .attr("stroke", "#ef4444") 
                  .attr("stroke-width", 3)
                  .style("filter", "drop-shadow(0 0 4px rgba(239,68,68,0.5))");
          } else {
              targetBubbles
                  .attr("stroke", "rgba(20,60,30,0.28)")
                  .attr("stroke-width", 1.2)
                  .style("filter", null);
          }
      };

      // Initialisation
      if (window.initScatter) {
          scatterChart = window.initScatter("#scatterPanel", filtered, onScatterHover);
      } else {
          scatterCard.append("div").style("color", "red").style("font-size","12px").text("Erreur: scatterv2.js non chargé.");
      }
  
      // ============================================================
      // DESSIN SVG PRINCIPAL 
      // ============================================================
      const svg = left.append("svg")
        .attr("viewBox", `-${width / 2} -${height / 2} ${width} ${height}`)
        .style("width", "100%")
        .style("height", "auto")
        .style("display", "block")
        .style("cursor", "pointer");
  
      // --- Dessin des Références (bas gauche) ---
      const refsG = svg.append("g")
        .attr("transform", `translate(${-width/2 + 20}, ${height/2 - 20 - 130})`);
  
      refsG.append("rect")
        .attr("width", 280).attr("height", 130).attr("rx", 12)
        .attr("fill", "rgba(255,255,255,0.8)").attr("stroke", "rgba(0,0,0,0.05)")
        .style("backdrop-filter", "blur(4px)");
  
      refsG.append("text").attr("x", 16).attr("y", 28)
        .style("font-family", "Montserrat, sans-serif").style("font-weight", 700).style("fill", "#1B5E20").style("font-size", "14px")
        .text("Références");
  
      const refRow = refsG.selectAll("g.ref").data(referenceBubbles).join("g")
        .attr("transform", (d, i) => `translate(18, ${58 + i * 26})`);
  
      refRow.append("circle").attr("cx", 10).attr("r", d => refRScreen(d.kg))
        .attr("fill", "#dcfce7").attr("stroke", "#166534").attr("stroke-opacity", 0.3);
      
      refRow.append("text").attr("x", 40).attr("y", 4)
        .style("font-family", "Inter, sans-serif").style("font-size", "12px").style("fill", "#334155")
        .text(d => `${d.name} (${formatNiceKg(d.kg)})`);
  
      // --- Gestion Vue & Focus ---
      let focus = root;
      let view;
  
      function isVisibleLabel(d) {
        if (focus === root) {
          if (d.depth === 1) return d.r > 35;
          if (d.depth === 2) return d.r > 16 && rootTopSubcats.has(subcatKey(d));
          return false;
        }
        if (d.parent === focus) {
          return d.r > (d.depth === 2 ? 18 : 14);
        }
        return false;
      }
  
      // --- Noeuds ---
      const node = svg.append("g")
        .selectAll("g")
        .data(root.descendants().slice(1))
        .join("g")
        .attr("pointer-events", "auto")
        .on("mouseover", function () {
          d3.select(this).select("circle.outer").attr("stroke", "#166534").attr("stroke-opacity", 0.8);
        })
        .on("mouseout", function (event, d) {
          d3.select(this).select("circle.outer")
            .attr("stroke", d.children ? "rgba(20,60,30,0.20)" : "rgba(20,60,30,0.28)")
            .attr("stroke-opacity", 1);
        })
        .on("mousemove", (event, d) => {
          const subtitle = d.depth === 1 ? "Catégorie" : d.depth === 2 ? "Sous-catégorie" : "Appareil";
          tooltip.style("display", "block")
            .style("left", (event.clientX + 14) + "px")
            .style("top", (event.clientY + 14) + "px")
            .html(`
              <div style="font-weight:700; margin-bottom:4px; font-family:'Montserrat', sans-serif;">${d.data?.name || ""}</div>
              <div style="color:#64748b; margin-bottom:8px; font-size:11px;">${subtitle}</div>
              <div><b style="color:#166534">Total</b>: ${formatNiceKg(d.total_sum || 0)}</div>
              <div><b>Fabrication</b>: ${formatNiceKg(d.fab_sum || 0)} (${pct(d.fab_ratio || 0)})</div>
            `);
        })
        .on("mouseleave", () => tooltip.style("display", "none"))
        .on("click", (event, d) => {
          if (d.children && focus !== d) {
            zoom(event, d);
            event.stopPropagation();
          } else {
            event.stopPropagation();
          }
        });
  
      node.append("circle")
        .attr("class", d => d.children ? "outer" : "outer leaf-node") // on ajoute une classe pour les feuilles pour interaction scatter
        .attr("fill", d => d.children ? color(d.depth) : "#F0FDF4")
        .attr("stroke", d => d.children ? "rgba(20,60,30,0.15)" : "rgba(20,60,30,0.28)")
        .attr("stroke-width", d => d.children ? 1 : 1.2);
  
      // --- Labels ---
      const label = svg.append("g")
        .style("font-family", "'Inter', sans-serif").style("pointer-events", "none").attr("text-anchor", "middle")
        .selectAll("text").data(root.descendants()).join("text")
        .text(d => d.data.name)
        .style("fill", "#14532d") 
        .style("font-size", d => d.depth === 1 ? "22px" : d.depth === 2 ? "14px" : "11px")
        .style("font-weight", d => d.depth === 1 ? 700 : 500)
        .style("text-shadow", "0 1px 4px rgba(255,255,255,0.8)"); 
  
      svg.on("click", (event) => zoom(event, root));
  
      // --- Mise à jour du Panneau Latéral  ---
      function updatePanelBars() {
        const isRoot = focus === root;
        const title = isRoot ? "Top catégories" : `Top dans "${focus.data.name}"`;
        panelTitle.text(title);
  
        const items = (focus.children || [])
          .map(n => ({
            name: n.data.name,
            total: n.total_sum || 0,
            fab: n.fab_sum || 0
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6);
  
        panelBars.selectAll("*").remove();
        if(items.length === 0) {
            panelBars.append("div").style("color", "#94a3b8").style("font-style", "italic").style("font-size", "12px").text("Aucune sous-catégorie.");
            return;
        }
  
        const W = 300, rowH = 32, H = items.length * rowH;
        const svgP = panelBars.append("svg").attr("width", "100%").attr("height", H);
        
        // Echelle dynamique
        const maxVal = d3.max(items, d => d.total) || 1;
        const xScale = d3.scaleLinear().domain([0, maxVal]).range([0, 160]); 

        const row = svgP.selectAll("g.row").data(items).join("g")
          .attr("transform", (d, i) => `translate(0, ${i * rowH})`);
  
        // Nom
        row.append("text").attr("x", 0).attr("y", 18)
          .style("font-family", "Inter, sans-serif").style("font-size", "12px").style("fill", "#334155").style("font-weight", "500")
          .text(d => d.name.length > 18 ? d.name.substring(0,16)+"..." : d.name);
  
        // Groupe Barres (aligné à droite)
        const barGroup = row.append("g").attr("transform", "translate(130, 0)"); // Décalage pour laisser place au texte
        
        // Barre Fab (Jaune/Orange doux)
        barGroup.append("rect").attr("x", 0).attr("y", 6).attr("height", 12)
          .attr("width", d => xScale(d.fab)).attr("fill", "#fcd34d").attr("rx", 2);
        
        // Barre Usage - Stacked
        barGroup.append("rect").attr("x", d => xScale(d.fab)).attr("y", 6).attr("height", 12)
          .attr("width", d => xScale(d.total - d.fab)).attr("fill", "#86efac").attr("rx", 2);

        // Valeur texte
        barGroup.append("text").attr("x", d => xScale(d.total) + 5).attr("y", 16)
             .style("font-size", "10px").style("fill", "#94a3b8").text(d => formatNiceKg(d.total));
      }
  
      // --- Fonction de Zoom et Interaction ---
      function zoomTo(v) {
        const k = width / v[2]; view = v;
        node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
        node.select("circle.outer").attr("r", d => d.r * k);
        
        label
          .style("fill-opacity", d => isVisibleLabel(d) ? 1 : 0)
          .style("display", d => isVisibleLabel(d) ? "inline" : "none");
      }
  
      function zoom(event, d) {
        focus = d;
        updatePanelBars(); // Mise à jour histogramme
  
        // --- Interaction avec Scatter ---
        if (scatterChart) {
            let catName = 'All';
            let subName = 'All';

            if (focus.depth === 1) { 
                catName = focus.data.name;
            } else if (focus.depth === 2) { 
                catName = focus.parent.data.name;
                subName = focus.data.name;
            } else if (focus.depth === 3) {
                catName = focus.parent.parent.data.name;
                subName = focus.parent.data.name;
            }
            scatterChart.update(catName, subName);
        }
        // ------------------------------
  
        const transition = svg.transition().duration(750)
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
      updatePanelBars();
    }
  })();